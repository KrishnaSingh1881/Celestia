import numpy as np
import pytest

from simengine.calibration.calibrate import (
    FULL_FITTED_PARAM_NAMES,
    RATED_POINTS,
    calibrate,
    calibrate_against_rated_points,
    predict_rated_point_powers,
    self_calibrate_from_cruise_window,
)
from simengine.config import load_seed_params


def test_calibration_reproduces_published_power_within_report_band():
    base = load_seed_params()
    priors = {k: base["fitted"][k] for k in FULL_FITTED_PARAM_NAMES}
    # Start from a perturbed ("not yet calibrated") guess, not the answer.
    perturbed_start = {k: v * 1.10 for k, v in priors.items()}

    result = calibrate_against_rated_points(priors=perturbed_start, lambda_reg=1e-2)
    assert result.success

    powers = predict_rated_point_powers(result.theta_hat, FULL_FITTED_PARAM_NAMES, dtheta_deg=1.0)
    targets = np.array([p["power_published_W"] for p in RATED_POINTS])
    error_pct = (powers - targets) / targets * 100.0
    assert np.all(np.abs(error_pct) <= 5.0), f"power error out of band: {error_pct}"


def test_calibration_predicted_bsfc_and_pmax_land_in_physical_ranges_though_never_fitted():
    """Peak cylinder pressure and BSFC were never in the calibration
    objective (only the 3 power numbers were) - the report treats their
    landing in a physically expected range as evidence the model STRUCTURE
    is right, not merely curve-fit. Uses the full 0.2 deg step for the final
    check, as Phase 5's own regression test does.
    """
    base = load_seed_params()
    priors = {k: base["fitted"][k] for k in FULL_FITTED_PARAM_NAMES}
    perturbed_start = {k: v * 1.10 for k, v in priors.items()}
    result = calibrate_against_rated_points(priors=perturbed_start, lambda_reg=1e-2)

    from simengine.calibration.calibrate import _params_with_overrides
    from simengine.engine.cycle import run_closed_cycle

    p = _params_with_overrides(base, result.theta_hat, FULL_FITTED_PARAM_NAMES)
    takeoff = RATED_POINTS[0]
    out = run_closed_cycle(rpm=takeoff["rpm"], MAP_Pa=takeoff["MAP_Pa"], lam=takeoff["lam"], params=p)
    assert 200.0 <= out["bsfc_g_per_kWh"] <= 320.0
    assert 40e5 <= out["p_max_Pa"] <= 80e5


def test_weak_prior_lets_combustion_efficiency_drift_nonphysical():
    """Regression/documentation guard for the report's own section 15.1
    warning: with too weak a Tikhonov prior, an 8-parameter fit against only
    3 data points can compensate for a bad direction by pushing
    combustion_efficiency above 1.0 (a physical impossibility) while still
    fitting power well. This is why calibrate_against_rated_points defaults
    to lambda_reg=1e-2, not something weaker.
    """
    base = load_seed_params()
    priors = {k: base["fitted"][k] for k in FULL_FITTED_PARAM_NAMES}
    perturbed_start = {k: v * 1.10 for k, v in priors.items()}

    weak_prior_result = calibrate_against_rated_points(priors=perturbed_start, lambda_reg=1e-4)
    strong_prior_result = calibrate_against_rated_points(priors=perturbed_start, lambda_reg=1e-2)

    eta_c_idx = FULL_FITTED_PARAM_NAMES.index("combustion_efficiency")
    assert weak_prior_result.theta_hat[eta_c_idx] > 1.0
    assert strong_prior_result.theta_hat[eta_c_idx] < 1.0


def test_identifiability_flags_rank_deficient_direction():
    """Toy model where two parameters have IDENTICAL effect on every output
    (only their sum is identifiable) - the SVD diagnostic must flag a
    near-zero singular value rather than silently reporting an arbitrary
    unique split between them.
    """

    def model_fn(theta):
        a, b = theta
        # Three operating points, but the model only ever depends on (a+b).
        return np.array([2.0 * (a + b), 3.0 * (a + b), 5.0 * (a + b)])

    targets = np.array([2.0 * 4.0, 3.0 * 4.0, 5.0 * 4.0])  # true a+b = 4.0
    priors = np.array([1.0, 1.0])  # prior a+b = 2.0, wrong, but that's fine

    result = calibrate(model_fn, targets, priors, lambda_reg=1e-8)

    assert result.singular_values.size == 2
    assert np.any(result.unidentifiable_mask), (
        f"expected a near-zero singular value, got {result.singular_values}"
    )
    # The identifiable combination (a+b) must still be recovered correctly...
    a_hat, b_hat = result.theta_hat
    assert (a_hat + b_hat) == pytest.approx(4.0, rel=1e-3)
    # ...even though the individual split between a and b is not meaningful
    # (it is whatever the regularizer/solver path happened to pick).


def test_identifiability_full_rank_case_has_no_unidentifiable_direction():
    def model_fn(theta):
        a, b = theta
        return np.array([2.0 * a + b, a + 3.0 * b, 4.0 * a - b])

    targets = np.array([2.0 * 3.0 + 1.0, 3.0 + 3.0 * 1.0, 4.0 * 3.0 - 1.0])  # a=3, b=1
    priors = np.array([1.0, 1.0])
    result = calibrate(model_fn, targets, priors, lambda_reg=1e-8)
    assert not np.any(result.unidentifiable_mask)
    assert result.theta_hat[0] == pytest.approx(3.0, rel=1e-3)
    assert result.theta_hat[1] == pytest.approx(1.0, rel=1e-3)


def test_self_calibration_restricted_subset_converges_and_stays_near_prior():
    base = load_seed_params()
    # A cruise-window observation slightly different from the model's own
    # baseline prediction at this operating point (~56.5kW) - representing a
    # small installation difference to be absorbed.
    cruise_window = dict(rpm=5000.0, MAP_Pa=1.05e5, lam=0.95, power_W=54000.0)
    result = self_calibrate_from_cruise_window(cruise_window)

    assert result.success
    assert set(result.param_names) == {"wall_temperature_K", "chen_flynn_Bf"}
    # Restricted subset: parameters move to absorb the discrepancy, but stay
    # within a physically reasonable neighbourhood of their priors (this is
    # what "restricted" and the Tikhonov prior together guarantee).
    prior_Twall = base["fitted"]["wall_temperature_K"]
    prior_Bf = base["fitted"]["chen_flynn_Bf"]
    assert 0.5 * prior_Twall <= result.theta_dict["wall_temperature_K"] <= 1.5 * prior_Twall
    assert 0.5 * prior_Bf <= result.theta_dict["chen_flynn_Bf"] <= 1.5 * prior_Bf


def test_self_calibration_does_not_touch_full_parameter_set():
    cruise_window = dict(rpm=5000.0, MAP_Pa=1.05e5, lam=0.95, power_W=54000.0)
    result = self_calibrate_from_cruise_window(cruise_window)
    assert len(result.param_names) == 2
    assert "ignition_theta0_deg_ATDC" not in result.param_names
    assert "combustion_efficiency" not in result.param_names
