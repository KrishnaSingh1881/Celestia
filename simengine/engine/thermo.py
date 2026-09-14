"""Temperature-dependent gas properties used throughout the closed-cycle model.

gamma_of_T is the simple linear ratio-of-specific-heats fit used by the report
and by research/celestia_cycle_model_reference.py, valid across ~300-2800K.
"""
from simengine.config import load_seed_params


def gamma_of_T(T, intercept: float = 1.38, slope: float = 6.0e-5) -> float:
    """gamma(T) = intercept - slope*(T - 300.0)."""
    return intercept - slope * (T - 300.0)


def cv_of_T(T, Rg: float, intercept: float = 1.38, slope: float = 6.0e-5) -> float:
    """c_v = R_g / (gamma(T) - 1)."""
    return Rg / (gamma_of_T(T, intercept=intercept, slope=slope) - 1.0)


def gamma_params_from_config() -> dict:
    p = load_seed_params()
    lit = p["fixed_from_literature"]
    return {
        "intercept": lit["gamma_ref_intercept"],
        "slope": lit["gamma_ref_slope"],
    }
