import numpy as np
import pytest

from simengine.twin.estimator import LearnedCorrection, UnscentedKalmanFilter


def _spring_f(x_aug, u, dt):
    """Augmented state [position, velocity, k]. x'' = -k*x (undamped spring).
    k is carried as a (near-)random-walk parameter via process noise only,
    not evolved here."""
    pos, vel, k = x_aug
    acc = -k * pos
    return np.array([pos + vel * dt, vel + acc * dt, k])


def _spring_h(x_aug, u):
    pos, _vel, _k = x_aug
    return np.array([pos])


def _simulate_truth(n_steps, dt, k_schedule, rng, process_std=(0.0005, 0.0005), meas_std=0.5):
    """Ground truth trajectory (no filter involved) plus noisy measurements,
    with k allowed to change partway through (k_schedule(t) -> k)."""
    pos, vel = 1.0, 0.0
    true_positions = np.zeros(n_steps)
    measurements = np.zeros(n_steps)
    true_ks = np.zeros(n_steps)
    for i in range(n_steps):
        k = k_schedule(i)
        acc = -k * pos
        pos = pos + vel * dt + rng.normal(0, process_std[0])
        vel = vel + acc * dt + rng.normal(0, process_std[1])
        true_positions[i] = pos
        true_ks[i] = k
        measurements[i] = pos + rng.normal(0, meas_std)
    return true_positions, true_ks, measurements


def test_ukf_filtered_estimate_beats_raw_measurement_noise():
    rng = np.random.default_rng(42)
    dt = 0.05
    n_steps = 400
    k_true = 4.0
    true_positions, _, measurements = _simulate_truth(n_steps, dt, lambda i: k_true, rng, meas_std=0.5)

    Q = np.diag([1e-6, 1e-6, 1e-10])
    R = np.array([[0.5**2]])
    ukf = UnscentedKalmanFilter(_spring_f, _spring_h, Q, R)

    x = np.array([1.0, 0.0, 3.0])  # deliberately wrong initial k guess
    P = np.diag([0.1, 0.1, 1.0])

    filtered_positions = np.zeros(n_steps)
    for i in range(n_steps):
        x, P, _innovation, _Pyy = ukf.step(x, P, u=None, y=np.array([measurements[i]]), dt=dt)
        filtered_positions[i] = x[0]

    raw_error = np.sqrt(np.mean((measurements - true_positions) ** 2))
    filtered_error = np.sqrt(np.mean((filtered_positions - true_positions) ** 2))
    assert filtered_error < raw_error


def test_ukf_tracks_a_step_change_in_the_health_parameter():
    rng = np.random.default_rng(7)
    dt = 0.05
    n_steps = 1200
    change_at = 600
    k_before, k_after = 4.0, 6.0

    def schedule(i):
        return k_before if i < change_at else k_after

    _, true_ks, measurements = _simulate_truth(n_steps, dt, schedule, rng, meas_std=0.3)

    # A more agile process-noise on k than a real slow-degradation deployment
    # would use (report: "very small variance") - deliberately so a STEP
    # change is trackable within this test's short horizon; see estimator.py
    # docstring for the slow-drift assumption this trades off against.
    Q = np.diag([1e-6, 1e-6, 5e-4])
    R = np.array([[0.3**2]])
    ukf = UnscentedKalmanFilter(_spring_f, _spring_h, Q, R)

    x = np.array([1.0, 0.0, k_before])
    P = np.diag([0.1, 0.1, 0.5])

    k_estimates = np.zeros(n_steps)
    for i in range(n_steps):
        x, P, _innovation, _Pyy = ukf.step(x, P, u=None, y=np.array([measurements[i]]), dt=dt)
        k_estimates[i] = x[2]

    error_just_before_change = abs(k_estimates[change_at - 1] - k_after)
    error_well_after_change = abs(k_estimates[-1] - k_after)
    assert error_well_after_change < error_just_before_change
    assert error_well_after_change < 0.5  # converges reasonably close to the new true k


def test_ukf_innovation_is_available_for_downstream_detection():
    Q = np.diag([1e-6, 1e-6, 1e-10])
    R = np.array([[0.25]])
    ukf = UnscentedKalmanFilter(_spring_f, _spring_h, Q, R)
    x = np.array([1.0, 0.0, 4.0])
    P = np.diag([0.1, 0.1, 0.5])
    x_new, P_new, innovation, Pyy = ukf.step(x, P, u=None, y=np.array([1.0]), dt=0.05)
    assert innovation.shape == (1,)
    assert Pyy.shape == (1, 1)
    assert np.all(np.isfinite(x_new))
    assert np.all(np.isfinite(P_new))


def test_learned_correction_fits_training_residual_pattern():
    rng = np.random.default_rng(1)
    U = rng.uniform(-1.0, 1.0, size=(200, 2))
    true_bias = 0.5 * U[:, 0] - 0.3 * U[:, 1] + 0.1
    residual = true_bias + rng.normal(0, 0.02, size=200)

    correction = LearnedCorrection(ridge_lambda=0.1).fit(U, residual)
    predicted = correction.predict(U)
    assert np.corrcoef(predicted, true_bias)[0, 1] > 0.95


def test_learned_correction_reverts_toward_small_values_when_unfit():
    correction = LearnedCorrection()
    out = correction.predict(np.array([[10.0, -10.0]]))
    assert out[0] == pytest.approx(0.0)
