import numpy as np
import pytest

from simengine.twin.residual import (
    ContextSurface,
    ResidualEngine,
    compute_normalized_residuals,
    compute_output_residuals,
    compute_parameter_residuals,
    compute_relational_residual,
    compute_symmetry_residual,
)


def test_normalized_residual_has_near_zero_mean_and_unit_variance_on_healthy_data():
    rng = np.random.default_rng(0)
    u = rng.uniform(0.0, 100.0, size=5000)  # e.g. throttle position
    true_signal = 50.0 + 0.3 * u  # a mild context-dependent baseline
    noise = rng.normal(0.0, 2.0, size=u.size)
    y_healthy = true_signal + noise
    r_healthy = y_healthy - true_signal  # == noise here, by construction

    # The context surface is fit on the RESIDUAL's own healthy distribution
    # (eq 19.2's mu_i(u)/sigma_i(u)), not on the raw signal level - fitting
    # it on y itself would normalize by the signal's magnitude instead of
    # its healthy scatter, producing nonsense z values.
    surface = ContextSurface.fit(u, r_healthy, n_bins=20)

    z_values = []
    for i in range(u.size):
        r = compute_output_residuals({"chan": y_healthy[i]}, {"chan": true_signal[i]})
        z = compute_normalized_residuals(r, u[i], {"chan": surface})
        z_values.append(z["chan"])
    z_values = np.array(z_values)

    assert abs(z_values.mean()) < 0.15
    assert 0.7 <= z_values.std() <= 1.3


def test_four_residual_dimensions_are_computable_with_no_nans():
    engine = ResidualEngine(surfaces={})
    residual = engine.compute(
        y_measured={"CHT": 380.0, "oil_pressure": 2.8e5},
        y_predicted={"CHT": 375.0, "oil_pressure": 3.0e5},
        context_value=50.0,
        theta_hat={"eta_c": 0.90},
        theta_confirmed_normal={"eta_c": 0.94},
        relational_pairs={"oil_pressure_vs_temp": -0.2e5},
        symmetry_groups={"CHT_per_cyl": [378.0, 382.0, 375.0, 390.0]},
    )
    all_values = list(residual.output.values()) + list(residual.parameter.values()) + list(residual.relational.values())
    for group in residual.symmetry.values():
        all_values.extend(group.tolist())
    assert all(np.isfinite(v) for v in all_values)
    assert residual.output["CHT"] == pytest.approx(5.0)
    assert residual.parameter["eta_c"] == pytest.approx(-0.04)


def test_relational_residual_flags_a_pump_degraded_case():
    from simengine.engine.lube import oil_pressure as expected_oil_pressure

    R_h_healthy = 2.0e8
    Q_pump_healthy = 1.5e-3
    actual_measured_pressure = 2.0e5  # measured lower than the healthy-relation prediction
    residual = compute_relational_residual(
        actual_measured_pressure, expected_oil_pressure, R_h_healthy, Q_pump_healthy
    )
    assert residual < 0  # measured pressure below what the healthy relation predicts


def test_symmetry_residual_flags_the_odd_cylinder_out():
    per_cyl = [380.0, 382.0, 379.0, 410.0]  # cylinder 4 running hot
    dev = compute_symmetry_residual(per_cyl)
    assert dev[3] == max(dev)
    assert dev[3] > 15.0
    assert abs(dev.sum()) < 1e-9  # deviations from the mean sum to zero by construction
