import numpy as np
import pytest

from simengine.twin.discriminator import (
    bayesian_posterior,
    build_parity_matrix,
    has_energy_balance_explanation,
    is_frozen,
    parity_vector,
    rank_hypotheses,
    suspicion_score,
)


def test_parity_matrix_annihilates_the_state():
    # A simple linear observation structure: y = Hx*x + Hu*u, 3 outputs, 2 states.
    Hx = np.array([[1.0, 0.0], [0.0, 1.0], [1.0, 1.0]])
    W = build_parity_matrix(Hx)
    assert np.allclose(W @ Hx, 0.0, atol=1e-8)


def test_healthy_parity_vector_is_near_zero_regardless_of_state():
    Hx = np.array([[1.0, 0.0], [0.0, 1.0], [1.0, 1.0]])
    Hu = np.zeros((3, 1))
    W = build_parity_matrix(Hx)

    rng = np.random.default_rng(0)
    for _ in range(20):
        x = rng.normal(size=2)
        Y = Hx @ x  # perfectly healthy observation, no sensor fault, no noise
        U = np.zeros(1)
        p = parity_vector(W, Y, Hu, U)
        assert np.allclose(p, 0.0, atol=1e-8)


def test_sensor_fault_drives_parity_vector_along_fixed_direction():
    # Isolability (telling WHICH channel faulted, not just THAT one did)
    # needs redundancy degree >= 2 (a >= 2-dimensional parity space) - with
    # only 1 redundant relation (e.g. 3 channels/2 states), every single-
    # channel fault direction collapses onto the same 1-D parity line and
    # becomes indistinguishable from the others (a real structural
    # limitation, not a bug: this exact 3-channel/2-state case was tried
    # first and every channel came back with |suspicion|=1.0). 4 channels
    # over 2 states gives redundancy degree 2, enough to isolate.
    Hx = np.array([[1.0, 0.0], [0.0, 1.0], [1.0, 1.0], [1.0, -1.0]])
    Hu = np.zeros((4, 1))
    W = build_parity_matrix(Hx)
    x = np.array([1.0, 2.0])
    U = np.zeros(1)

    Y_healthy = Hx @ x
    faulty_channel = 1
    Y_faulty = Y_healthy.copy()
    Y_faulty[faulty_channel] += 5.0  # a bias fault on channel 1

    p = parity_vector(W, Y_faulty, Hu, U)
    scores = [suspicion_score(p, W, i) for i in range(4)]
    assert np.argmax(np.abs(scores)) == faulty_channel
    assert abs(scores[faulty_channel]) > 0.9  # close to +/-1, i.e. clearly aligned


def test_physical_energy_balance_rule():
    # Genuine overheat: a visible source rose (fuel/boost) - explained.
    assert has_energy_balance_explanation(source_increased=True, removal_decreased=False) is True
    # Genuine overheat via lost cooling - explained.
    assert has_energy_balance_explanation(source_increased=False, removal_decreased=True) is True
    # CHT rising with NEITHER explanation present anywhere else -> suspect the sensor.
    assert has_energy_balance_explanation(source_increased=False, removal_decreased=False) is False


def test_frozen_sensor_detector_flags_zero_variance_window():
    rng = np.random.default_rng(1)
    healthy_signal = 100.0 + rng.normal(0, 1.0, size=200)
    frozen_signal = healthy_signal.copy()
    frozen_signal[100:] = frozen_signal[99]  # freezes at sample 100, holds a PLAUSIBLE value

    healthy_flags = is_frozen(healthy_signal, window=20, variance_threshold=1e-6)
    frozen_flags = is_frozen(frozen_signal, window=20, variance_threshold=1e-6)

    assert not np.any(healthy_flags[50:])  # healthy signal never looks frozen
    assert np.any(frozen_flags[120:])      # frozen window (well past sample 100+20) is flagged


def test_sensor_drift_scenario_posterior_favors_sensor_hypothesis():
    # A single channel's residual moved (e.g. CHT_2), but its physically
    # coupled companions (coolant temp, EGT) stayed silent - the likelihood
    # of the data under "sensor fault" should dominate "engine fault".
    likelihoods = {"engine_fault:cooling_degradation": 0.05, "sensor_fault:CHT_2_drift": 0.80}
    ranked = rank_hypotheses(likelihoods)
    assert ranked[0][0] == "sensor_fault:CHT_2_drift"
    assert ranked[0][1] > ranked[1][1]


def test_engine_fault_scenario_posterior_favors_engine_hypothesis():
    # The true state changed - companion channels DID move together.
    likelihoods = {"engine_fault:cooling_degradation": 0.75, "sensor_fault:CHT_2_drift": 0.10}
    ranked = rank_hypotheses(likelihoods)
    assert ranked[0][0] == "engine_fault:cooling_degradation"


def test_posterior_never_collapses_to_a_single_verdict():
    likelihoods = {"a": 0.6, "b": 0.3, "c": 0.1}
    posterior = bayesian_posterior(likelihoods)
    assert len(posterior) == 3
    assert all(v > 0 for v in posterior.values())
    assert sum(posterior.values()) == pytest.approx(1.0)
