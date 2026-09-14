"""Combustion: Wiebe heat release, O2-limited mixture, knock, misfire.

Report eq 4.1-4.5. Ported/extended from research/celestia_cycle_model_reference.py
(wiebe() and the O2-limited mf_burn = min(mf, mair/AFRs) logic are already
validated there).
"""
from __future__ import annotations

import numpy as np

from simengine.config import load_seed_params


def wiebe(theta_rad, theta0_rad, dtheta_burn_rad, aw: float = 5.0, mw: float = 2.0):
    """Wiebe burned-mass-fraction law (eq 4.1) and its crank-angle derivative
    (eq 4.2).

    Returns (xb, dxb_dtheta).
    """
    z = np.clip((theta_rad - theta0_rad) / dtheta_burn_rad, 0.0, 1.0)
    xb = 1.0 - np.exp(-aw * z ** (mw + 1.0))
    dxb_dtheta = (
        aw * (mw + 1.0) / dtheta_burn_rad * (1.0 - xb) * z**mw
    )
    return xb, dxb_dtheta


def heat_release_rate(dxb_dtheta, mf_burn: float, LHV: float, eta_c: float):
    """dQ_ch/dtheta = mf_burn * LHV * eta_c * dxb/dtheta  (eq 4.3)."""
    return mf_burn * LHV * eta_c * dxb_dtheta


def mixture_masses(m_tot: float, lam: float, AFRs: float):
    """O2-limited mixture split (eq 4.4).

    mf_burn = min(mf, mair/AFRs) is MANDATORY: the report's own first
    calibration pass over-predicted take-off power by 19% when this O2 limit
    was omitted (aero engines run rich, lambda ~ 0.85, so fuel is present in
    excess of what available oxygen can burn).

    Returns (mf, mair, mf_burn).
    """
    mf = m_tot / (lam * AFRs + 1.0)
    mair = m_tot - mf
    mf_burn = min(mf, mair / AFRs)
    return mf, mair, mf_burn


def misfire_override(mf: float, mair: float) -> float:
    """A misfire is x_b(theta) == 0 for one cylinder-cycle, i.e. mf_burn forced
    to 0. This is a PARAMETER VALUE, not a special code branch: callers pass
    mf_burn=0.0 into heat_release_rate()/the solver like any other value of
    mf_burn from mixture_masses(). This helper exists only so call sites can
    name the override explicitly instead of inlining a bare 0.0.
    """
    return 0.0


def knock_dIk_dtheta(
    p_Pa: float,
    T_K: float,
    omega_rad_s: float,
    A_ms: float,
    n: float,
    Ba_K: float,
) -> float:
    """Livengood-Wu autoignition-delay integrand (eq 4.5), Douaud-Eyzat form.

    tau(p,T) = A * p_atm^-n * exp(Ba/T)   [ms]
    dIk/dtheta = 1 / (omega * tau)

    Knock is signalled when the accumulated integral Ik = integral(dIk/dtheta)
    over the closed cycle first reaches 1.0. Accumulate this by including it
    as an extra component of the state vector integrated by
    simengine.engine.solver.integrate_closed_cycle, alongside p/T/m — do not
    write a separate integration loop for it.
    """
    p_atm = p_Pa / 101325.0
    tau_ms = A_ms * p_atm**-n * np.exp(Ba_K / T_K)
    tau_s = tau_ms / 1000.0
    return 1.0 / (omega_rad_s * tau_s)


def knock_params_from_config() -> dict:
    p = load_seed_params()
    lit = p["fixed_from_literature"]
    return {
        "A_ms": lit["knock_douaud_eyzat_A_ms"],
        "n": lit["knock_douaud_eyzat_n"],
        "Ba_K": lit["knock_douaud_eyzat_Ba_K"],
    }
