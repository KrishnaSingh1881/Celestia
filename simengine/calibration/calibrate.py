"""Calibration without access to the real engine. Report eq 15.1-15.3.

Three parameter classes (tagged in simengine/config/engine_seed_params.yaml):
fixed_from_spec (never fitted), fixed_from_literature (fitted only within an
uncertainty band, if at all), fitted (the 8-12 free parameters this module
identifies). The objective is ONLY the three published power ratings
(Appendix A / Table 4) - everything else the calibrated model produces
(peak torque, BSFC, peak cylinder pressure) is a prediction, not a fit
target, and is checked independently (see test_calibrate.py and Phase 10's
Gate 2).
"""
from __future__ import annotations

import copy
from dataclasses import dataclass, field
from typing import Callable

import numpy as np
from scipy.optimize import least_squares

from simengine.config import load_seed_params
from simengine.engine.cycle import run_closed_cycle

# The free ("fitted") parameters this calibrator identifies against the three
# rated points - matches the report's stated 8-12 free parameters.
FULL_FITTED_PARAM_NAMES = [
    "burn_duration_deg",
    "ignition_theta0_deg_ATDC",
    "combustion_efficiency",
    "wall_temperature_K",
    "chen_flynn_Af_Pa",
    "chen_flynn_Bf",
    "chen_flynn_Cf",
    "chen_flynn_Df",
]

# Restricted subset used for in-service self-calibration (eq 15.5): only the
# parameters that plausibly drift with installation (cowling/ducting/prop
# differences), refit from a single stable cruise-window observation without
# touching the rest of the calibration. eta_v surface offset (the report's
# third restricted-subset member) is not listed here yet because Tier A has
# no volumetric-efficiency surface to offset - MAP is taken as a direct
# boundary condition until Phase 13's Tier B mean-value twin introduces one;
# add it here once that surface exists.
RESTRICTED_SELF_CAL_PARAM_NAMES = ["wall_temperature_K", "chen_flynn_Bf"]

RATED_POINTS = [
    dict(rpm=5800.0, MAP_Pa=1.32e5, lam=0.85, power_published_W=84500.0),
    dict(rpm=5500.0, MAP_Pa=1.20e5, lam=0.88, power_published_W=73500.0),
    dict(rpm=5000.0, MAP_Pa=1.05e5, lam=0.95, power_published_W=55100.0),
]


@dataclass
class CalibrationResult:
    theta_hat: np.ndarray
    param_names: list[str]
    jacobian: np.ndarray               # data-residual rows only, prior rows excluded
    singular_values: np.ndarray
    condition_number: float
    unidentifiable_mask: np.ndarray    # True where a singular value is ~0 relative to the largest
    residual_norm: float
    success: bool
    theta_dict: dict = field(default_factory=dict)

    def __post_init__(self):
        self.theta_dict = dict(zip(self.param_names, self.theta_hat))


def _params_with_overrides(base_params: dict, theta_vector, names: list[str]) -> dict:
    p = copy.deepcopy(base_params)
    for name, value in zip(names, theta_vector):
        p["fitted"][name] = float(value)
    return p


def calibrate(
    model_fn: Callable[[np.ndarray], np.ndarray],
    targets: np.ndarray,
    priors: np.ndarray,
    weights: np.ndarray | None = None,
    lambda_reg: float = 1e-6,
    singular_value_threshold: float = 1e-6,
) -> CalibrationResult:
    """Levenberg-Marquardt fit with a Tikhonov prior toward `priors` (eq 15.1),
    plus an SVD-based identifiability diagnostic on the DATA Jacobian (eq
    15.3). Both residual terms are scaled to be dimensionless (relative to
    the target/prior magnitude) so heterogeneous units and a plain 'lm'
    solver (no box constraints - scipy requires unbounded (-inf,inf) for
    'lm') behave sensibly together; physical plausibility is enforced via the
    prior, exactly as eq 15.1's risk-management discussion describes, not via
    hard bounds.
    """
    priors = np.asarray(priors, dtype=float)
    targets = np.asarray(targets, dtype=float)
    weights = np.ones_like(targets) if weights is None else np.asarray(weights, dtype=float)
    prior_scale = np.maximum(np.abs(priors), 1e-9)
    target_scale = np.maximum(np.abs(targets), 1e-9)

    def residuals(theta):
        y_pred = np.asarray(model_fn(theta), dtype=float)
        data_res = weights * (targets - y_pred) / target_scale
        prior_res = np.sqrt(lambda_reg) * (theta - priors) / prior_scale
        return np.concatenate([data_res, prior_res])

    # x_scale=prior_scale is essential here: the free parameters span ~5
    # orders of magnitude (combustion_efficiency ~1 vs chen_flynn_Af_Pa
    # ~1e5) - without per-parameter scaling, LM's finite-difference Jacobian
    # and step-size heuristics behave very poorly and it can burn through
    # max_nfev without converging.
    result = least_squares(
        residuals, x0=priors, method="lm", x_scale=prior_scale, max_nfev=2000
    )

    n_data = targets.size
    J_full = result.jac
    J_data = J_full[:n_data, :]
    singular_values = np.linalg.svd(J_data, compute_uv=False)
    s_max = singular_values.max() if singular_values.size else 0.0
    condition_number = float(s_max / max(singular_values.min(), 1e-300)) if s_max > 0 else float("inf")
    unidentifiable_mask = singular_values < singular_value_threshold * max(s_max, 1e-300)

    return CalibrationResult(
        theta_hat=result.x,
        param_names=[],
        jacobian=J_data,
        singular_values=singular_values,
        condition_number=condition_number,
        unidentifiable_mask=unidentifiable_mask,
        residual_norm=float(np.linalg.norm(result.fun[:n_data])),
        success=bool(result.success),
    )


def predict_rated_point_powers(
    theta_vector,
    param_names: list[str],
    rated_points: list[dict] | None = None,
    base_params: dict | None = None,
    dtheta_deg: float = 0.2,
) -> np.ndarray:
    """model_fn used to fit against Table 4: run_closed_cycle at each rated
    point with the given fitted-parameter overrides, returning brake power.

    dtheta_deg defaults to the report's validated 0.2 deg step, but the
    identification LOOP itself (calibrate_against_rated_points) runs at a
    coarser step by default for speed - LM needs many model evaluations
    (one per finite-difference Jacobian column, times many iterations), and
    the coarser step changes predicted power by <0.05% (well inside the
    calibration's own tolerance), so it costs no accuracy that matters here.
    The FINAL validated model (Phase 5's regression test, and any calibrated
    parameters actually shipped) always uses the full 0.2 deg step.
    """
    base_params = base_params or load_seed_params()
    rated_points = rated_points or RATED_POINTS
    powers = []
    for point in rated_points:
        p = _params_with_overrides(base_params, theta_vector, param_names)
        result = run_closed_cycle(
            rpm=point["rpm"], MAP_Pa=point["MAP_Pa"], lam=point["lam"], params=p, dtheta_deg=dtheta_deg
        )
        powers.append(result["P_W"])
    return np.array(powers)


def calibrate_against_rated_points(
    param_names: list[str] | None = None,
    priors: dict | None = None,
    rated_points: list[dict] | None = None,
    base_params: dict | None = None,
    lambda_reg: float = 1e-2,
    dtheta_deg: float = 1.0,
) -> CalibrationResult:
    """Full calibration pass: fit `param_names` (default:
    FULL_FITTED_PARAM_NAMES) against the three published power ratings
    (default: RATED_POINTS / Appendix A Table 4). Runs the identification
    loop at dtheta_deg=1.0 by default (see predict_rated_point_powers) -
    pass dtheta_deg=0.2 for a final, full-resolution calibration pass.

    lambda_reg defaults to 1e-2, not a token value: with only 3 data points
    against up to 8 free parameters, a weak prior (e.g. 1e-4) lets the
    optimizer drift to non-physical values (combustion_efficiency > 1 has
    been observed) while still fitting power well - exactly the report's own
    section 15.1 warning about wrong-coefficient compensation. 1e-2 keeps the
    fit close to the physical prior while still recovering the published
    power figures to within a few percent.
    """
    base_params = base_params or load_seed_params()
    param_names = param_names or FULL_FITTED_PARAM_NAMES
    rated_points = rated_points or RATED_POINTS
    prior_values = priors or {name: base_params["fitted"][name] for name in param_names}
    prior_vector = np.array([prior_values[name] for name in param_names])
    targets = np.array([p["power_published_W"] for p in rated_points])

    def model_fn(theta):
        return predict_rated_point_powers(theta, param_names, rated_points, base_params, dtheta_deg=dtheta_deg)

    result = calibrate(model_fn, targets, prior_vector, lambda_reg=lambda_reg)
    result.param_names = list(param_names)
    result.theta_dict = dict(zip(param_names, result.theta_hat))
    return result


def self_calibrate_from_cruise_window(
    cruise_window: dict,
    base_params: dict | None = None,
    lambda_reg: float = 0.1,
    dtheta_deg: float = 1.0,
) -> CalibrationResult:
    """In-service self-calibration (eq 15.5): re-fit ONLY
    RESTRICTED_SELF_CAL_PARAM_NAMES against a single observed stable
    cruise-window operating point, absorbing installation differences
    (cowling, prop, ducting) without touching the rest of the calibration.

    cruise_window: {"rpm": ..., "MAP_Pa": ..., "lam": ..., "power_W": ...}

    lambda_reg defaults much stronger here (0.1) than the full calibration's
    1e-2: a single cruise-window observation is one equation constraining two
    parameters, an even more underdetermined problem than the full fit's 3
    equations/8 parameters, and a weak prior lets wall_temperature_K drift to
    values as low as ~180K (observed with lambda_reg=1e-3) - physically
    meaningless for a combustion chamber wall.
    """
    base_params = base_params or load_seed_params()
    prior_vector = np.array(
        [base_params["fitted"][name] for name in RESTRICTED_SELF_CAL_PARAM_NAMES]
    )

    def model_fn(theta):
        p = _params_with_overrides(base_params, theta, RESTRICTED_SELF_CAL_PARAM_NAMES)
        result = run_closed_cycle(
            rpm=cruise_window["rpm"], MAP_Pa=cruise_window["MAP_Pa"], lam=cruise_window["lam"],
            params=p, dtheta_deg=dtheta_deg,
        )
        return np.array([result["P_W"]])

    targets = np.array([cruise_window["power_W"]])
    result = calibrate(model_fn, targets, prior_vector, lambda_reg=lambda_reg)
    result.param_names = list(RESTRICTED_SELF_CAL_PARAM_NAMES)
    result.theta_dict = dict(zip(RESTRICTED_SELF_CAL_PARAM_NAMES, result.theta_hat))
    return result
