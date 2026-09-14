"""Turbocharger: compressor, turbine, and shaft dynamics. Report eq 6.5-6.7."""
from __future__ import annotations

import numpy as np


def compressor_outlet_temperature(T1_K: float, eta_c: float, Pi_c: float, gamma: float = 1.4):
    """Compressor outlet (charge-air) temperature (eq 6.5).

    T2 = T1 * [1 + (1/eta_c)*(Pi_c^((gamma-1)/gamma) - 1)]
    """
    return T1_K * (1.0 + (1.0 / eta_c) * (Pi_c ** ((gamma - 1.0) / gamma) - 1.0))


def compressor_power(mdot_air_kg_s: float, cp_air_J_per_kgK: float, T1_K: float, T2_K: float):
    """Shaft power absorbed by the compressor: Wdot_c = mdot*cp*(T2-T1)."""
    return mdot_air_kg_s * cp_air_J_per_kgK * (T2_K - T1_K)


def turbine_power(
    mdot_exh_kg_s: float,
    cp_exh_J_per_kgK: float,
    T3_K: float,
    expansion_ratio: float,
    eta_t: float,
    gamma: float = 1.33,
):
    """Turbine shaft power extracted from the exhaust stream (eq 6.6), an
    isentropic-efficiency-scaled expansion analogous in form to eq 6.5:

    Wdot_t = eta_t * mdot_exh * cp_exh * T3 * [1 - expansion_ratio^((gamma-1)/gamma)]

    expansion_ratio = p_downstream / p_upstream (< 1 for a real expansion).
    """
    return (
        eta_t
        * mdot_exh_kg_s
        * cp_exh_J_per_kgK
        * T3_K
        * (1.0 - expansion_ratio ** ((gamma - 1.0) / gamma))
    )


def domega_tc_dt(
    Wdot_turbine_W: float,
    Wdot_compressor_W: float,
    eta_m: float,
    J_tc_kg_m2: float,
    omega_tc_rad_s: float,
):
    """Turbocharger shaft acceleration (eq 6.7):

    J_tc * omega_tc * d(omega_tc)/dt = eta_m*Wdot_turbine - Wdot_compressor
    """
    net_power = eta_m * Wdot_turbine_W - Wdot_compressor_W
    return net_power / (J_tc_kg_m2 * omega_tc_rad_s)
