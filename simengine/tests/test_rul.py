import numpy as np
import pytest

from simengine.twin.rul import (
    ComponentRUL,
    engine_level_rul,
    inverse_gaussian_rul_quantiles,
    mission_conditioned_expected_damage,
    particle_filter_rul_crossing_times,
    rul_quantiles_from_crossing_times,
)

D0, D_TH, MU, SIGMA_D = 0.0, 1.0, 0.02, 0.01


def test_rul_distribution_is_right_skewed():
    quantiles = inverse_gaussian_rul_quantiles(D0, D_TH, MU, SIGMA_D)
    # Right-skewed: the gap from q50 to q95 should exceed the gap from q05 to q50.
    gap_low = quantiles[0.5] - quantiles[0.05]
    gap_high = quantiles[0.95] - quantiles[0.5]
    assert gap_high > gap_low


def test_closed_form_and_particle_filter_agree_on_linear_drift():
    analytic = inverse_gaussian_rul_quantiles(D0, D_TH, MU, SIGMA_D)

    def mu_fn(D):
        return np.full_like(D, MU)

    crossing_times = particle_filter_rul_crossing_times(
        D0, D_TH, mu_fn, SIGMA_D, n_particles=3000, dt=0.05, max_t=200.0,
        rng=np.random.default_rng(0),
    )
    assert np.mean(np.isnan(crossing_times)) < 0.01  # nearly all particles cross within the horizon

    particle_based = rul_quantiles_from_crossing_times(crossing_times)
    for q in (0.05, 0.5, 0.95):
        assert particle_based[q] == pytest.approx(analytic[q], rel=0.15)


def test_mission_conditioned_damage_integrates_planned_drift():
    def mu_fn(u, D):
        return u  # drift rate directly given by the planned condition

    def gentle_plan(t):
        return 0.01

    def harsh_plan(t):
        return 0.05

    D_gentle = mission_conditioned_expected_damage(D0, mu_fn, gentle_plan, T=10.0, n_steps=500)
    D_harsh = mission_conditioned_expected_damage(D0, mu_fn, harsh_plan, T=10.0, n_steps=500)
    assert D_harsh > D_gentle
    assert D_gentle == pytest.approx(0.1, rel=1e-3)


def test_engine_level_rul_is_the_minimum_not_the_average():
    components = [
        ComponentRUL(component="bearing", q05=50.0, q50=80.0, q95=120.0, dominant_driver="wear"),
        ComponentRUL(component="oil_pump", q05=200.0, q50=300.0, q95=450.0, dominant_driver="pump_wear"),
        ComponentRUL(component="turbo", q05=150.0, q50=220.0, q95=310.0, dominant_driver="bearing_wear"),
    ]
    engine_rul = engine_level_rul(components)
    assert engine_rul["q05"] == 50.0
    assert engine_rul["q50"] == 80.0
    assert engine_rul["q95"] == 120.0
    assert engine_rul["governing_component"] == "bearing"

    average_q05 = np.mean([c.q05 for c in components])
    assert engine_rul["q05"] != pytest.approx(average_q05)
    assert engine_rul["q05"] < average_q05
