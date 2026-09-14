"""Gas exchange and sealing: speed-density volumetric efficiency, the
universal compressible-orifice flow function, and blow-by. Report eq 6.1-6.4.

orifice_flow() is the ONE flow function reused for valves, wastegate,
injectors, leaks and blow-by (report section 6.2) - do not write a second
flow function per use site; every restricted-flow path in the rest of
simengine should call this.
"""
from __future__ import annotations

import numpy as np


def mdot_engine_speed_density(
    eta_v: float,
    p_MAP_Pa: float,
    Ti_K: float,
    Rg: float,
    Vd_m3: float,
    N_rev_s: float,
):
    """Trapped air mass flow via the speed-density method (eq 6.1).

    mdot_a = eta_v * rho_i * Vd * (N/2), rho_i = p_MAP / (Rg*Ti)
    N_rev_s is crank speed in rev/s; the /2 accounts for one intake stroke
    per two crank revolutions in a 4-stroke engine.
    """
    rho_i = p_MAP_Pa / (Rg * Ti_K)
    return eta_v * rho_i * Vd_m3 * (N_rev_s / 2.0)


def flow_function_psi(pi_ratio, gamma: float = 1.4):
    """Compressible orifice flow function Psi(pi), pi = p_downstream/p_upstream
    (eq 6.3). Choked for pi <= pi_crit = (2/(gamma+1))^(gamma/(gamma-1))
    (~0.528 for air, gamma=1.4); compressible-subsonic otherwise. Continuous
    at pi = pi_crit by construction (the choked branch is the subsonic branch
    evaluated at pi_crit).
    """
    pi_arr = np.clip(np.asarray(pi_ratio, dtype=float), 0.0, 1.0)
    pi_crit = (2.0 / (gamma + 1.0)) ** (gamma / (gamma - 1.0))

    psi_crit = np.sqrt(gamma) * (2.0 / (gamma + 1.0)) ** (
        (gamma + 1.0) / (2.0 * (gamma - 1.0))
    )
    pi_subsonic = np.maximum(pi_arr, pi_crit)  # avoid negative radicand below pi_crit
    subsonic = np.sqrt(
        np.maximum(
            (2.0 * gamma / (gamma - 1.0))
            * (pi_subsonic ** (2.0 / gamma) - pi_subsonic ** ((gamma + 1.0) / gamma)),
            0.0,
        )
    )
    psi = np.where(pi_arr <= pi_crit, psi_crit, subsonic)
    return psi if psi.shape else float(psi)


def orifice_flow(
    Cd: float,
    A_m2: float,
    p_u_Pa,
    p_d_Pa,
    T_u_K,
    Rg: float,
    gamma: float = 1.4,
):
    """Universal compressible-orifice mass flow rate (eq 6.2).

    mdot = Cd*A*(p_u/sqrt(Rg*T_u)) * Psi(p_d/p_u)

    Returns 0 for reverse pressure gradient (p_d >= p_u).
    """
    p_u_Pa = np.asarray(p_u_Pa, dtype=float)
    p_d_Pa = np.asarray(p_d_Pa, dtype=float)
    pi_ratio = np.clip(p_d_Pa / p_u_Pa, 0.0, 1.0)
    psi = flow_function_psi(pi_ratio, gamma=gamma)
    mdot = Cd * A_m2 * (p_u_Pa / np.sqrt(Rg * T_u_K)) * psi
    reverse = p_d_Pa >= p_u_Pa
    return np.where(reverse, 0.0, mdot)


def blowby_dm_dtheta(
    Cd_bb: float,
    A_bb_m2: float,
    p_cyl_Pa,
    p_crankcase_Pa,
    T_K,
    Rg: float,
    omega_rad_s: float,
    gamma: float = 1.4,
):
    """Blow-by mass-loss rate per crank angle (eq 6.4): the same universal
    orifice_flow(), gated by cylinder-to-crankcase pressure difference, mass
    LOST from the cylinder so this returns a non-positive value.
    """
    mdot = orifice_flow(Cd_bb, A_bb_m2, p_cyl_Pa, p_crankcase_Pa, T_K, Rg, gamma=gamma)
    return -mdot / omega_rad_s
