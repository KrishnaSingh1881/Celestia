"""Crank/propeller coupling and the propeller load map. Report eq 7.5-7.6."""
from __future__ import annotations

from typing import Callable

import numpy as np


def crank_domega_dt(
    Tb_Nm: float,
    T_prop_Nm: float,
    gear_ratio: float,
    eta_g: float,
    J_eff_kg_m2: float,
) -> float:
    """Crankshaft speed dynamics (eq 7.5):

    J_eff * domega/dt = Tb(theta,omega,u) - T_prop / (i*eta_g)
    """
    return (Tb_Nm - T_prop_Nm / (gear_ratio * eta_g)) / J_eff_kg_m2


def propeller_thrust(CT: float, rho_kg_m3: float, n_rev_s: float, D_m: float) -> float:
    """T = CT * rho * n^2 * D^4  (eq 7.6)."""
    return CT * rho_kg_m3 * n_rev_s**2 * D_m**4


def propeller_torque(CQ: float, rho_kg_m3: float, n_rev_s: float, D_m: float) -> float:
    """Q = CQ * rho * n^2 * D^5  (eq 7.6)."""
    return CQ * rho_kg_m3 * n_rev_s**2 * D_m**5


def propeller_efficiency(J_adv: float, CT: float, CQ: float) -> float:
    """eta_p = J*CT / (2*pi*CQ)  (eq 7.6)."""
    return J_adv * CT / (2.0 * np.pi * CQ)


def solve_operating_rpm(
    engine_torque_fn: Callable[[float], float],
    prop_load_torque_fn: Callable[[float], float],
    gear_ratio: float,
    eta_g: float,
    omega_guess_rad_s: float,
    tol: float = 1e-6,
    max_iter: int = 100,
) -> float:
    """Newton iteration for the steady-state crank speed at which engine
    torque balances propeller-side load torque:

        engine_torque_fn(omega) - prop_load_torque_fn(omega) / (i*eta_g) = 0

    Returns the balancing omega (rad/s).
    """

    def residual(omega):
        return engine_torque_fn(omega) - prop_load_torque_fn(omega) / (gear_ratio * eta_g)

    omega = omega_guess_rad_s
    f0 = residual(omega)
    for _ in range(max_iter):
        eps = max(1e-3, 1e-6 * abs(omega))
        f = residual(omega)
        if abs(f) < tol * max(1.0, abs(f0)):
            break
        df = (residual(omega + eps) - f) / eps
        if df == 0.0:
            break
        omega = omega - f / df
    return omega
