"""Assembles engine/{geometry,thermo,combustion,heat,flow,friction} into one
closed-cycle (IVC->EVO) Tier A run, replacing
research/celestia_cycle_model_reference.py's monolithic run_cycle() with the
same physics built from the modular pieces, integrated with the report's
specified RK4 (simengine.engine.solver), not the reference script's RK2.

This is the "primary correctness gate" module (report section 7, Table 4):
run_closed_cycle() for the three rated points in Appendix A must reproduce
published power within the report's stated -0.7%/-2.5%/+2.2% band.
"""
from __future__ import annotations

import numpy as np

from simengine.config import load_seed_params
from simengine.engine import combustion, flow, friction, heat, thermo
from simengine.engine.geometry import EngineGeometry
from simengine.engine.solver import integrate_closed_cycle


def run_closed_cycle(
    rpm: float,
    MAP_Pa: float,
    lam: float,
    Tivc_K: float = 330.0,
    Cd_bb: float = 0.0,
    A_bb_m2: float = 0.0,
    hmult: float = 1.0,
    dtheta_deg: float = 0.2,
    geometry: EngineGeometry | None = None,
    params: dict | None = None,
) -> dict:
    """Integrate the closed portion of the cycle (IVC -> EVO) for one
    cylinder and return the same kind of summary the reference script's
    run_cycle()/brake_numbers() produce, but assembled from the modular
    engine/* functions and integrated with RK4.
    """
    params = params or load_seed_params()
    geometry = geometry or EngineGeometry.from_config()

    spec = params["fixed_from_spec"]
    lit = params["fixed_from_literature"]
    fitted = params["fitted"]

    Rg = lit["gas_constant_J_per_kgK"]
    LHV = lit["fuel_LHV_J_per_kg"]
    AFRs = lit["stoich_AFR"]
    aw, mw = lit["wiebe_aw"], lit["wiebe_mw"]
    gamma_params = {"intercept": lit["gamma_ref_intercept"], "slope": lit["gamma_ref_slope"]}
    C1, C2 = lit["woschni_C1"], lit["woschni_C2"]

    th_ign_deg = fitted["ignition_theta0_deg_ATDC"]
    dth_burn_deg = fitted["burn_duration_deg"]
    eta_c = fitted["combustion_efficiency"]
    Twall = fitted["wall_temperature_K"]
    pmep_Pa = fitted["pmep_Pa"]
    cf = friction.chen_flynn_params_from_config()

    IVC_deg = spec["IVC_deg_ATDC"]
    EVO_deg = spec["EVO_deg_ATDC"]

    omega = rpm * 2.0 * np.pi / 60.0
    Sp = 2.0 * geometry.stroke_m * rpm / 60.0
    theta0_rad = np.deg2rad(th_ign_deg)
    dth_burn_rad = np.deg2rad(dth_burn_deg)
    theta_ivc_rad = np.deg2rad(IVC_deg)

    V1 = geometry.volume(theta_ivc_rad)
    m0 = MAP_Pa * V1 / (Rg * Tivc_K)
    mf, mair, mf_burn = combustion.mixture_masses(m0, lam, AFRs)
    Qtot = mf_burn * LHV * eta_c

    def deriv(theta_rad, y):
        p, T, m = y[0], y[1], y[2]
        V = geometry.volume(theta_rad)
        dV = geometry.dVdtheta(theta_rad)
        area = geometry.area(theta_rad)
        g = thermo.gamma_of_T(T, **gamma_params)
        cv = thermo.cv_of_T(T, Rg, **gamma_params)

        _, dxb = combustion.wiebe(theta_rad, theta0_rad, dth_burn_rad, aw=aw, mw=mw)
        dQch = Qtot * dxb

        p_mot = MAP_Pa * (V1 / V) ** 1.32
        h_g, _ = heat.woschni_h(
            p_Pa=p, T_K=T, Sp_m_s=Sp, bore_m=geometry.bore_m, C1=C1, C2=C2,
            Vd_cyl_m3=geometry.displacement_per_cyl_m3, Tivc_K=Tivc_K,
            MAP_Pa=MAP_Pa, V1_m3=V1, p_mot_Pa=p_mot,
            theta_rad=theta_rad, theta0_rad=theta0_rad,
        )
        h_g = hmult * h_g
        dQht = heat.dQht_dtheta(h_g, area, T, Twall, omega)

        if A_bb_m2 > 0.0:
            dm = flow.blowby_dm_dtheta(
                Cd_bb=Cd_bb, A_bb_m2=A_bb_m2, p_cyl_Pa=p, p_crankcase_Pa=1.0e5,
                T_K=T, Rg=Rg, omega_rad_s=omega,
            )
        else:
            dm = 0.0

        dT = (dQch - dQht - p * dV) / (m * cv) - T * dm / m
        dp = (dm / m + dT / T - dV / V) * p
        return np.array([dp, dT, dm])

    y0 = np.array([MAP_Pa, Tivc_K, m0])
    result = integrate_closed_cycle(IVC_deg, EVO_deg, dtheta_deg, deriv, y0)
    theta_deg = result["theta_deg"]
    theta_rad = np.deg2rad(theta_deg)
    p = result["y"][:, 0]
    T = result["y"][:, 1]
    m = result["y"][:, 2]
    V = geometry.volume(theta_rad)

    Wgross = np.trapezoid(p, V)
    imep_Pa = friction.imep(Wgross, geometry.displacement_per_cyl_m3)
    p_max = p.max()
    fmep_Pa = friction.fmep_chen_flynn(p_max, Sp, **cf)
    bmep_Pa = friction.bmep(imep_Pa, pmep_Pa, fmep_Pa)

    N_rev_s = rpm / 60.0
    Vd_tot = geometry.displacement_total_m3
    Tq_Nm = friction.brake_torque(bmep_Pa, Vd_tot)
    P_W = friction.brake_power(bmep_Pa, Vd_tot, N_rev_s)

    # BSFC/efficiency use the total INJECTED fuel mass (mf), not the
    # O2-limited burned mass (mf_burn) - matches the reference script's
    # brake_numbers(), which divides by res['mf'] (total fuel), since fuel
    # consumption counts fuel supplied, not only fuel that found oxygen.
    mdot_f_kg_s = mf * geometry.n_cylinders * N_rev_s / 2.0
    bsfc_g_per_kWh = mdot_f_kg_s * 3.6e9 / P_W if P_W > 0 else float("nan")
    eta_overall = P_W / (mdot_f_kg_s * LHV) if mdot_f_kg_s > 0 else float("nan")

    return dict(
        theta_deg=theta_deg, p_Pa=p, T_K=T, m_kg=m, V_m3=V,
        Wgross_J=Wgross, imep_Pa=imep_Pa, fmep_Pa=fmep_Pa, bmep_Pa=bmep_Pa,
        p_max_Pa=p_max, T_max_K=T.max(), T_evo_K=T[-1],
        Tq_Nm=Tq_Nm, P_W=P_W, bsfc_g_per_kWh=bsfc_g_per_kWh, eta=eta_overall,
        mf_burn_kg=mf_burn, Qtot_J=Qtot, rpm=rpm, MAP_Pa=MAP_Pa,
    )
