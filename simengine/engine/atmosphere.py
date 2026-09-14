"""ISA atmosphere model and altitude-corrected MAP (report eq 6.8, section 6.5).

Every operating-point baseline (power, EGT, boost, cooling) must be corrected
for altitude via this module - altitude legitimately moves nearly every
parameter, and the wastegate only holds rated MAP up to the reference
engine's critical altitude (Appendix A / Table 1: ~4500m).
"""
from __future__ import annotations

from simengine.config import load_seed_params


def isa_temperature(h_m: float, T0_K: float = 288.15, lapse_rate_K_per_m: float = 0.0065):
    """T_amb = T0 - L*h  (eq 6.8)."""
    return T0_K - lapse_rate_K_per_m * h_m


def isa_pressure(
    h_m: float,
    T0_K: float = 288.15,
    p0_Pa: float = 101325.0,
    lapse_rate_K_per_m: float = 0.0065,
    g: float = 9.80665,
    Rg_air: float = 287.0,
):
    """p_amb = p0 * (T_amb/T0)^(g/(Rg*L))  (eq 6.8)."""
    T_amb = isa_temperature(h_m, T0_K=T0_K, lapse_rate_K_per_m=lapse_rate_K_per_m)
    exponent = g / (Rg_air * lapse_rate_K_per_m)
    return p0_Pa * (T_amb / T0_K) ** exponent


def isa_params_from_config() -> dict:
    p = load_seed_params()
    lit = p["fixed_from_literature"]
    return {
        "T0_K": lit["ISA_T0_K"],
        "p0_Pa": lit["ISA_p0_Pa"],
        "lapse_rate_K_per_m": lit["ISA_lapse_rate_K_per_m"],
        "g": lit["ISA_g"],
    }


def commanded_MAP(
    h_m: float,
    MAP_rated_Pa: float,
    critical_altitude_m: float,
    Rg_air: float = 287.0,
    **isa_kwargs,
):
    """Wastegate-controlled MAP: held at the rated value up to the reference
    engine's critical altitude, then falls in proportion to ambient pressure
    beyond it (wastegate is fully closed and can no longer compensate).
    """
    if h_m <= critical_altitude_m:
        return MAP_rated_Pa
    p_amb_here = isa_pressure(h_m, Rg_air=Rg_air, **isa_kwargs)
    p_amb_critical = isa_pressure(critical_altitude_m, Rg_air=Rg_air, **isa_kwargs)
    return MAP_rated_Pa * (p_amb_here / p_amb_critical)
