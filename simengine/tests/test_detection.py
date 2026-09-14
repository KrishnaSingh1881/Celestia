import numpy as np
import pytest

from simengine.twin.detection import (
    AlarmEvidence,
    CUSUMTracker,
    GLRDetector,
    PersistenceTracker,
    chi2_threshold,
    cusum_arl0,
    mahalanobis_distance,
)


def test_mahalanobis_distance_matches_hand_computation():
    r = np.array([1.0, 2.0])
    Sigma = np.array([[2.0, 0.0], [0.0, 4.0]])
    d2 = mahalanobis_distance(r, Sigma)
    assert d2 == pytest.approx(1.0**2 / 2.0 + 2.0**2 / 4.0)


def test_chi2_threshold_gives_correct_false_alarm_rate_via_monte_carlo():
    m = 3
    alpha = 0.05
    threshold = chi2_threshold(m, alpha)
    rng = np.random.default_rng(0)
    Sigma = np.eye(m)
    n_trials = 20000
    exceed_count = 0
    for _ in range(n_trials):
        r = rng.multivariate_normal(np.zeros(m), Sigma)
        if mahalanobis_distance(r, Sigma) > threshold:
            exceed_count += 1
    empirical_alpha = exceed_count / n_trials
    assert abs(empirical_alpha - alpha) < 0.01


def test_cusum_default_config_matches_analytic_arl0_within_factor_of_two():
    # cusum_arl0() uses the Siegmund-corrected formula (h+1.166), which lands
    # much closer to empirical reality than the report's stated uncorrected
    # form (~793 vs an empirical ~2580 at these parameters) - see this
    # function's own docstring for the full discrepancy note.
    k_slack, h = 0.5, 6.0
    analytic_arl0 = cusum_arl0(k_slack, h)
    assert analytic_arl0 == pytest.approx(2573.0, rel=0.01)

    rng = np.random.default_rng(1)
    n_trials = 500
    run_lengths = []
    for _ in range(n_trials):
        tracker = CUSUMTracker(k_slack=k_slack, h=h)
        steps = 0
        alarmed = False
        while not alarmed and steps < 50000:
            z = rng.normal(0.0, 1.0)
            alarmed = tracker.update(z)
            steps += 1
        run_lengths.append(steps)
    empirical_arl0 = np.mean(run_lengths)
    assert analytic_arl0 / 2.0 <= empirical_arl0 <= analytic_arl0 * 2.0


def test_cusum_detects_a_sustained_mean_shift_quickly():
    tracker = CUSUMTracker(k_slack=0.5, h=6.0)
    rng = np.random.default_rng(2)
    alarmed_at = None
    for i in range(500):
        z = rng.normal(3.0, 1.0)  # a clear, sustained shift
        if tracker.update(z):
            alarmed_at = i
            break
    assert alarmed_at is not None
    assert alarmed_at < 20  # should trip fast under a large sustained shift


def test_glr_detects_and_estimates_injected_mean_shift():
    rng = np.random.default_rng(3)
    sigma = 1.0
    true_shift = 2.5
    r_window = rng.normal(true_shift, sigma, size=50)
    detector = GLRDetector(sigma=sigma)
    statistic, theta_f_hat = detector.evaluate(r_window)
    assert statistic > 10.0  # comfortably detected
    assert theta_f_hat == pytest.approx(true_shift, abs=0.5)


def test_glr_statistic_small_for_healthy_zero_mean_window():
    rng = np.random.default_rng(4)
    r_window = rng.normal(0.0, 1.0, size=50)
    detector = GLRDetector(sigma=1.0)
    statistic, theta_f_hat = detector.evaluate(r_window)
    assert abs(theta_f_hat) < 0.5
    assert statistic < 10.0


def test_persistence_tracker_rejects_single_sample_spike():
    tracker = PersistenceTracker(n_required=5)
    results = [tracker.update(c) for c in [True, False, True, True, True, True]]
    # A lone True, then a False resets it - never reaches n_required from
    # that single spike.
    assert results[0] is False
    assert not any(results[:2])
    # Four more consecutive Trues after the reset are still one short of 5.
    assert results[-1] is False


def test_persistence_tracker_fires_after_required_consecutive_hits():
    tracker = PersistenceTracker(n_required=3)
    results = [tracker.update(True) for _ in range(3)]
    assert results == [False, False, True]


def test_alarm_policy_requires_all_four_conditions():
    base = dict(
        statistic_exceeds_threshold=True, persists=True,
        companion_channel_consistent=True, sensor_hypothesis_ranked_lower=True,
    )
    assert AlarmEvidence(**base).alarm is True

    single_spike = dict(base, persists=False)
    assert AlarmEvidence(**single_spike).alarm is False

    uncorroborated = dict(base, companion_channel_consistent=False)
    assert AlarmEvidence(**uncorroborated).alarm is False

    sensor_more_likely = dict(base, sensor_hypothesis_ranked_lower=False)
    assert AlarmEvidence(**sensor_more_likely).alarm is False
