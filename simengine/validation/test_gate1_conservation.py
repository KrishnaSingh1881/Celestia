"""Gate 1 - Conservation (report eq 18.1). Run as a unit test on every commit.

|mf_burn*LHV*eta_c - Wgross - integral(Qht) - dU_gas| < 0.5% of Q_fuel

For the closed IVC->EVO cycle with no blow-by (dm/dtheta = 0), the report's
general open-system enthalpy-leaving term reduces to the change in internal
energy of the trapped gas, dU_gas = m0 * integral(cv(T) dT) evaluated along
the actual T(theta) trajectory (NOT m*cv(T_evo)*T_evo - m*cv(T_ivc)*T_ivc,
which would silently assume a single constant cv across the whole cycle -
the model's cv is temperature-dependent and evaluated locally at each step,
so the conserved quantity has to be integrated the same way).
"""
import numpy as np

from simengine.config import load_seed_params
from simengine.engine import combustion, heat, thermo
from simengine.engine.cycle import run_closed_cycle
from simengine.engine.geometry import EngineGeometry

RATED_TAKEOFF = dict(rpm=5800.0, MAP_Pa=1.32e5, lam=0.85)


def _conservation_residual(rpm, MAP_Pa, lam, dtheta_deg=0.2):
    params = load_seed_params()
    geometry = EngineGeometry.from_config()
    lit = params["fixed_from_literature"]
    fitted = params["fitted"]
    gamma_params = {"intercept": lit["gamma_ref_intercept"], "slope": lit["gamma_ref_slope"]}
    Rg = lit["gas_constant_J_per_kgK"]
    C1, C2 = lit["woschni_C1"], lit["woschni_C2"]
    Twall = fitted["wall_temperature_K"]
    theta0_rad = np.deg2rad(fitted["ignition_theta0_deg_ATDC"])
    dth_burn_rad = np.deg2rad(fitted["burn_duration_deg"])
    aw, mw = lit["wiebe_aw"], lit["wiebe_mw"]

    result = run_closed_cycle(rpm=rpm, MAP_Pa=MAP_Pa, lam=lam, dtheta_deg=dtheta_deg, A_bb_m2=0.0)
    theta_rad = np.deg2rad(result["theta_deg"])
    p, T, m = result["p_Pa"], result["T_K"], result["m_kg"]
    V = result["V_m3"]
    Qtot = result["Qtot_J"]
    Sp = 2.0 * geometry.stroke_m * rpm / 60.0
    omega = rpm * 2.0 * np.pi / 60.0
    V1 = V[0]
    Tivc = T[0]
    MAP = MAP_Pa

    _, dxb = combustion.wiebe(theta_rad, theta0_rad, dth_burn_rad, aw=aw, mw=mw)
    dQch_dtheta = Qtot * dxb

    p_mot = MAP * (V1 / V) ** 1.32
    h_g, _ = heat.woschni_h(
        p_Pa=p, T_K=T, Sp_m_s=Sp, bore_m=geometry.bore_m, C1=C1, C2=C2,
        Vd_cyl_m3=geometry.displacement_per_cyl_m3, Tivc_K=Tivc, MAP_Pa=MAP, V1_m3=V1,
        p_mot_Pa=p_mot, theta_rad=theta_rad, theta0_rad=theta0_rad,
    )
    area = geometry.area(theta_rad)
    dQht_dtheta = heat.dQht_dtheta(h_g, area, T, Twall, omega)

    Q_ch_total = np.trapezoid(dQch_dtheta, theta_rad)
    Q_ht_total = np.trapezoid(dQht_dtheta, theta_rad)
    Wgross = result["Wgross_J"]

    # dU_gas = m0 * integral(cv(T) dT) along the actual T(theta) trajectory.
    cv_along_path = thermo.cv_of_T(T, Rg, **gamma_params)
    dU_gas = m[0] * np.trapezoid(cv_along_path, T)

    imbalance = Q_ch_total - Wgross - Q_ht_total - dU_gas
    return imbalance, Q_ch_total


def test_gate1_conservation_takeoff():
    imbalance, Q_ch_total = _conservation_residual(**RATED_TAKEOFF)
    assert abs(imbalance) < 0.005 * abs(Q_ch_total), (
        f"conservation imbalance {imbalance:.4f} J is "
        f"{abs(imbalance)/abs(Q_ch_total):.3%} of Q_ch_total, exceeds 0.5% gate"
    )


def test_gate1_conservation_max_continuous():
    imbalance, Q_ch_total = _conservation_residual(rpm=5500.0, MAP_Pa=1.20e5, lam=0.88)
    assert abs(imbalance) < 0.005 * abs(Q_ch_total)


def test_gate1_conservation_cruise():
    imbalance, Q_ch_total = _conservation_residual(rpm=5000.0, MAP_Pa=1.05e5, lam=0.95)
    assert abs(imbalance) < 0.005 * abs(Q_ch_total)
