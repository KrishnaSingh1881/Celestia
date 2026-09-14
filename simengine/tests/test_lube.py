import pytest

from simengine.engine.lube import (
    film_thickness,
    friction_heat_rate,
    gallery_hydraulic_resistance,
    oil_pressure,
    oil_temperature_ddt,
    pump_flow,
    sommerfeld_number,
    vogel_viscosity,
)


VOGEL = dict(K=6.0e-6, theta1_K=900.0, theta2_K=120.0)


def test_vogel_viscosity_monotonically_decreases_with_temperature():
    mu_cold = vogel_viscosity(320.0, **VOGEL)
    mu_hot = vogel_viscosity(380.0, **VOGEL)
    assert mu_hot < mu_cold
    assert mu_cold > 0 and mu_hot > 0


def test_sommerfeld_number_decreases_as_clearance_increases():
    mu = vogel_viscosity(350.0, **VOGEL)
    S_tight = sommerfeld_number(mu, N_rev_s=90.0, P_Pa=5e6, R_m=0.02, c_m=20e-6)
    S_worn = sommerfeld_number(mu, N_rev_s=90.0, P_Pa=5e6, R_m=0.02, c_m=40e-6)
    assert S_worn < S_tight  # thinner film support as clearance grows


def test_film_thickness_collapses_near_eccentricity_one_stribeck_cliff():
    h_quiet = film_thickness(c_m=25e-6, eccentricity_ratio=0.5)
    h_near_cliff = film_thickness(c_m=25e-6, eccentricity_ratio=0.98)
    assert h_near_cliff < 0.05 * h_quiet


def test_oil_temperature_steady_state_rises_with_friction_heat():
    # dTo/dt = 0 at steady state => Qdot_fric + Qdot_piston = Qdot_cooler.
    # Holding cooler capacity (a linear function of (T-Tcoolant), i.e. fixed
    # UA) fixed, a higher friction heat input must produce a higher steady
    # oil temperature to balance it.
    UA = 20.0  # W/K, cooler conductance
    T_coolant = 350.0

    def steady_state_T(Qdot_fric, Qdot_piston=50.0):
        # Qdot_fric + Qdot_piston = UA*(T - T_coolant) => T = T_coolant + (.)/UA
        return T_coolant + (Qdot_fric + Qdot_piston) / UA

    T_low_friction = steady_state_T(Qdot_fric=100.0)
    T_high_friction = steady_state_T(Qdot_fric=400.0)
    assert T_high_friction > T_low_friction

    # Sanity-check the ODE itself is zero at exactly this balance point.
    ddt = oil_temperature_ddt(
        Qdot_friction_W=400.0, Qdot_piston_W=50.0,
        Qdot_cooler_W=UA * (T_high_friction - T_coolant),
        m_oil_kg=4.0, c_oil_J_per_kgK=2000.0,
    )
    assert ddt == pytest.approx(0.0, abs=1e-9)


def test_four_independent_causes_of_falling_oil_pressure_are_distinguishable():
    mu_nominal = vogel_viscosity(350.0, **VOGEL)
    # k_l chosen so the leak-back term is a modest fraction of pump delivery
    # at baseline (eta_vol*D_p*N ~ 1.6e-3 m3/s here) - a k_l several orders
    # larger, as an initial draft of this test used, drowns out the pump term
    # entirely and produces an unphysical negative flow.
    common = dict(N_rev_s=90.0, k_l=2e-14)
    baseline_Q = pump_flow(eta_vol=0.9, D_p_m3_per_rev=2e-5, dP_Pa=3e5, mu_Pa_s=mu_nominal, **common)
    assert baseline_Q > 0

    # 1. Pump wear: eta_vol falls, viscosity/temperature untouched.
    pump_worn_Q = pump_flow(eta_vol=0.6, D_p_m3_per_rev=2e-5, dP_Pa=3e5, mu_Pa_s=mu_nominal, **common)
    assert pump_worn_Q < baseline_Q

    # 2. Bearing clearance growth: R_h (and hence pressure at fixed flow)
    # falls, oil temperature is NOT directly implicated by this formula alone.
    R_tight = gallery_hydraulic_resistance(mu_nominal, L_m=0.05, d_m=0.006)
    R_worn = gallery_hydraulic_resistance(mu_nominal, L_m=0.05, d_m=0.008)
    assert oil_pressure(R_worn, baseline_Q) < oil_pressure(R_tight, baseline_Q)

    # 3. Leak: modeled as a k_l/mu term subtracting from pump flow AND (in a
    # full system model) accompanied by mass loss that raises temperature -
    # here we only check the pressure side moves against pump flow.
    leaky_Q = pump_flow(eta_vol=0.9, D_p_m3_per_rev=2e-5, N_rev_s=90.0, k_l=1.5e-13, dP_Pa=3e5, mu_Pa_s=mu_nominal)
    assert leaky_Q < baseline_Q

    # 4. Hot thin oil: viscosity itself falls with temperature, which INCREASES
    # the k_l/mu leak-back term in the pump equation (pressure falls too) but
    # for a benign, load-driven reason - distinguishable downstream only by
    # correlating with oil temperature, which is exactly the report's point.
    mu_hot = vogel_viscosity(400.0, **VOGEL)
    hot_oil_Q = pump_flow(eta_vol=0.9, D_p_m3_per_rev=2e-5, N_rev_s=90.0, k_l=2e-14, dP_Pa=3e5, mu_Pa_s=mu_hot)
    assert hot_oil_Q < baseline_Q
    assert mu_hot < mu_nominal


def test_friction_heat_rate_matches_bracket_used_by_brake_power():
    q = friction_heat_rate(FMEP_Pa=1.5e5, Vd_tot_m3=1211.2e-6, N_rev_s=5800 / 60.0)
    assert q > 0
    assert q == pytest.approx(1.5e5 * 1211.2e-6 * (5800 / 60.0) / 2.0)
