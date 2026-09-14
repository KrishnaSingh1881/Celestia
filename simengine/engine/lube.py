"""Lubrication and tribology. Report eq 8.1-8.5.

Four physically distinct causes of falling oil pressure are kept as separate
parameters here (pump wear, bearing clearance growth, leak, hot thin oil) so
later fault injection (Phase 11) can perturb exactly one of them at a time -
they are NOT collapsed into a single "oil pressure fault".
"""
from __future__ import annotations

import numpy as np


def pump_flow(eta_vol: float, D_p_m3_per_rev: float, N_rev_s: float, k_l: float, dP_Pa: float, mu_Pa_s: float):
    """Pump delivery flow (eq 8.1): Q_pump = eta_vol*D_p*N - k_l*dP/mu.

    eta_vol falling (pump wear) and k_l/mu rising (leakage back past
    clearances, worse at low viscosity) are two independent fault paths onto
    the same Q_pump output.
    """
    return eta_vol * D_p_m3_per_rev * N_rev_s - k_l * dP_Pa / mu_Pa_s


def gallery_hydraulic_resistance(mu_Pa_s, L_m: float, d_m: float):
    """Hagen-Poiseuille resistance of a gallery/journal passage (eq 8.2):
    R_h = 128*mu*L / (pi*d^4). Rising d (bearing clearance growth) LOWERS
    R_h (and hence pressure) at a given flow; a gallery blockage instead
    narrows an effective d elsewhere in the network, RAISING R_h (report's
    counter-intuitive "pressure rises" discriminator, eq/Table 6 row
    gallery_blockage) - same formula, opposite-signed parameter change.
    """
    return 128.0 * mu_Pa_s * L_m / (np.pi * d_m**4)


def oil_pressure(R_h_eff_Pa_s_per_m3, Q_pump_m3_s):
    """p_oil = R_h,eff * Q_pump."""
    return R_h_eff_Pa_s_per_m3 * Q_pump_m3_s


def vogel_viscosity(T_K, K: float, theta1_K: float, theta2_K: float):
    """Vogel viscosity-temperature relation (eq 8.3): mu(T) = K*exp(theta1/(T+theta2)).

    This benign, load-driven viscosity fall with rising temperature is the
    ONLY one of the four oil-pressure-loss causes that is not a fault - a
    model without mu(T) cannot subtract it from the other three.
    """
    return K * np.exp(theta1_K / (T_K + theta2_K))


def sommerfeld_number(mu_Pa_s, N_rev_s: float, P_Pa: float, R_m: float, c_m: float):
    """Sommerfeld number (eq 8.4): S = (mu*N/P)*(R/c)^2."""
    return (mu_Pa_s * N_rev_s / P_Pa) * (R_m / c_m) ** 2


def film_thickness(c_m: float, eccentricity_ratio: float):
    """Minimum film thickness h_min = c*(1 - epsilon).

    As eccentricity_ratio (epsilon) -> 1, h_min -> 0: the Stribeck cliff -
    film collapse is sudden after a long quiet period, not gradual.
    """
    return c_m * (1.0 - eccentricity_ratio)


def oil_temperature_ddt(
    Qdot_friction_W: float,
    Qdot_piston_W: float,
    Qdot_cooler_W: float,
    m_oil_kg: float,
    c_oil_J_per_kgK: float,
):
    """Oil as a thermal calorimeter (eq 8.5):
    m_o*c_o*dTo/dt = Qdot_fric(=FMEP*Vd*N/2) + Qdot_piston - Qdot_cooler

    A friction increase of a few hundred W is invisible in shaft power
    (~0.3% of a ~kW-scale output) but shows up as a measurable few-K oil
    temperature offset - this is why oil temperature is treated as a sensor
    for friction/bearing health, not just a cooling-circuit indicator.
    """
    return (Qdot_friction_W + Qdot_piston_W - Qdot_cooler_W) / (m_oil_kg * c_oil_J_per_kgK)


def friction_heat_rate(FMEP_Pa: float, Vd_tot_m3: float, N_rev_s: float) -> float:
    """Qdot_fric = FMEP * Vd_tot * N/2 (the same bracket as brake power,
    eq 7.4, but representing the FMEP share dissipated as heat rather than
    delivered as useful shaft work)."""
    return FMEP_Pa * Vd_tot_m3 * N_rev_s / 2.0
