import numpy as np
import pytest

from simengine.faults.campaign import _CONTINUOUS_AXES, generate_campaign
from simengine.faults.injector import apply_severity
from simengine.faults.library import FAULT_MODE_NAMES


def test_all_21_fault_modes_plus_healthy_appear_at_least_once():
    scenarios = generate_campaign(n_missions=200, seed=0)
    modes_seen = {s.labels["root_cause"] for s in scenarios}
    expected = {"healthy"} | set(FAULT_MODE_NAMES)
    assert expected.issubset(modes_seen)
    assert len(expected) == 22  # 21 physical faults + healthy


def test_fault_mode_counts_are_stratified_not_left_to_chance():
    scenarios = generate_campaign(n_missions=220, seed=1)  # 220 = 10 * 22, exact division
    counts = {}
    for s in scenarios:
        counts[s.labels["root_cause"]] = counts.get(s.labels["root_cause"], 0) + 1
    assert len(counts) == 22
    assert all(c == 10 for c in counts.values())


def test_sensor_nuisance_fraction_is_approximately_one_third():
    scenarios = generate_campaign(n_missions=3000, seed=2)
    n_contaminated = sum(
        1 for s in scenarios if any(f.mode == "sensor_drift_bias_stuck" for f in s.faults)
    )
    fraction = n_contaminated / len(scenarios)
    assert 0.28 <= fraction <= 0.38


def test_sensor_nuisance_can_co_occur_with_a_physical_fault():
    scenarios = generate_campaign(n_missions=3000, seed=3)
    both = [
        s for s in scenarios
        if s.labels["root_cause"] != "healthy"
        and any(f.mode == "sensor_drift_bias_stuck" for f in s.faults)
    ]
    assert len(both) > 0


def test_every_scenario_fault_trajectory_stays_within_physical_bounds():
    scenarios = generate_campaign(n_missions=300, seed=4)
    t = np.linspace(0.0, 8.0, 50)
    for s in scenarios:
        for f in s.faults:
            if f.mode == "sensor_drift_bias_stuck":
                continue  # observation-model-only, no theta trajectory to bound
            theta_min, theta_max = 0.0, 10.0  # generic physical bounds for this check
            theta_j0 = 1.0
            alpha_j = 1.0
            if f.shape == "linear":
                from simengine.faults.injector import severity_linear
                s_t = severity_linear(t, s0=0.0, beta=f.end_severity / s.mission.duration_h)
            elif f.shape == "exponential":
                from simengine.faults.injector import severity_exponential
                s_t = severity_exponential(t, s0=0.01, beta=f.end_severity)
            else:
                from simengine.faults.injector import severity_step
                s_t = severity_step(t, s0=0.0, delta_s=f.end_severity, t_f=f.onset_h)
            theta_t = apply_severity(theta_j0, alpha_j, s_t, theta_min, theta_max)
            assert np.all(theta_t >= theta_min) and np.all(theta_t <= theta_max)


def test_continuous_axes_are_space_filling_not_clustered():
    scenarios = generate_campaign(n_missions=500, seed=5)
    altitudes = np.array([s.mission.cruise_altitude_ft for s in scenarios])
    low, high = _CONTINUOUS_AXES[2][1], _CONTINUOUS_AXES[2][2]
    assert altitudes.min() < low + 0.15 * (high - low)
    assert altitudes.max() > high - 0.15 * (high - low)


def test_scenario_round_trips_through_dict():
    scenarios = generate_campaign(n_missions=25, seed=6)
    original = scenarios[5]
    from simengine.faults.campaign import ScenarioSpec

    round_tripped = ScenarioSpec.from_dict(original.to_dict())
    assert round_tripped == original
