"""Slow-time degradation dynamics: Archard wear, Arrhenius thermal ageing,
Paris/Miner fatigue, and fouling. Report eq 10.1-10.6.

Central design point (report section 10.1, "one engine model, not a fault
library"): every failure mode in Appendix C is a TRAJECTORY through the
shared health-parameter vector theta produced by these functions - nothing
here special-cases a named fault. Fault authoring (Phase 11) drives these
functions' inputs (load, regime, temperature, stress range) differently per
scenario; it never branches this module's code.
"""
from __future__ import annotations

import numpy as np


def lubrication_regime_factor(sommerfeld_number: float, S_crit: float = 0.05, sharpness: float = 4.0):
    """Phi(regime) (eq 10.2 companion): ~0 in the hydrodynamic regime
    (Sommerfeld number >> S_crit), spikes toward 1 as the film collapses into
    mixed/boundary lubrication (S << S_crit). This is what makes wear
    quiescent-then-fast rather than gradual.
    """
    return 1.0 / (1.0 + (sommerfeld_number / S_crit) ** sharpness)


def archard_wear_rate(
    k: float, H_Pa: float, load_N: float, Sp_m_s: float, A_apparent_m2: float, regime_factor: float
):
    """Archard wear-rate on a clearance/dimension (eq 10.2):

    dc/dt = (k/H) * (W*Sp/A_app) * Phi(regime)
    """
    return (k / H_Pa) * (load_N * Sp_m_s / A_apparent_m2) * regime_factor


def arrhenius_rate(T_K, A: float, Ea_J_per_mol: float, Ru_J_per_molK: float = 8.314):
    """Arrhenius reaction-rate law (eq 10.3): k(T) = A*exp(-Ea/(Ru*T)).

    D_thermal = integral(k(T) dt); a +10K oil-temperature offset held
    constant roughly doubles the rate for typical Ea (~50-80 kJ/mol) values -
    this function returns the instantaneous rate; integrate it (e.g. via
    simengine.engine.solver or a simple cumulative sum) to get D_thermal.
    """
    return A * np.exp(-Ea_J_per_mol / (Ru_J_per_molK * T_K))


def paris_da_dN(C: float, delta_K, m: float):
    """Paris law crack-growth-per-cycle (eq 10.4): da/dN = C*(delta_K)^m."""
    return C * np.asarray(delta_K, dtype=float) ** m


def miner_damage_fraction(n_cycles, Nf_cycles):
    """One term of the Miner's-rule cumulative damage sum (eq 10.5):
    contribution = n_i / Nf_i. Sum contributions across stress levels/time
    windows externally; failure is signalled at a cumulative sum >= 1.
    """
    return np.asarray(n_cycles, dtype=float) / np.asarray(Nf_cycles, dtype=float)


def fouling_ddt(alpha: float, mdot_kg_s: float, sigma_f: float, sigma_inf: float):
    """Deposit/fouling state relaxation (eq 10.6):

    dsigma_f/dt = alpha*mdot*(sigma_inf - sigma_f)

    sigma_f maps onto eta_c, hA, or C_dA_inj depending on which surface is
    fouling (combustion efficiency, cooling effectiveness, injector flow
    area respectively) - the caller chooses which parameter this drives.
    """
    return alpha * mdot_kg_s * (sigma_inf - sigma_f)
