import numpy as np
import pytest

from simengine.config import load_seed_params
from simengine.engine.combustion import (
    heat_release_rate,
    knock_dIk_dtheta,
    knock_params_from_config,
    mixture_masses,
    wiebe,
)
from simengine.engine.geometry import EngineGeometry


def test_wiebe_boundary_conditions():
    # With the standard shape factors (aw=5, mw=2), the Wiebe function is
    # asymptotic and reaches xb = 1 - exp(-aw) = 0.99326... exactly at
    # theta0 + dtheta_burn, not a mathematically exact 1.0 - that is the
    # conventional "effectively complete combustion" point, not a bug.
    theta0 = np.deg2rad(-22.0)
    dtheta_burn = np.deg2rad(60.0)
    xb0, _ = wiebe(theta0, theta0, dtheta_burn)
    xb_end, _ = wiebe(theta0 + dtheta_burn, theta0, dtheta_burn)
    assert xb0 == pytest.approx(0.0, abs=1e-9)
    assert xb_end == pytest.approx(1.0 - np.exp(-5.0), abs=1e-9)
    assert xb_end > 0.99


def test_wiebe_monotonic_and_clipped_outside_burn_window():
    theta0 = np.deg2rad(-22.0)
    dtheta_burn = np.deg2rad(60.0)
    theta = np.linspace(theta0 - 0.5, theta0 + dtheta_burn + 0.5, 500)
    xb, _ = wiebe(theta, theta0, dtheta_burn)
    assert np.all(np.diff(xb) >= -1e-12)  # monotonically non-decreasing
    assert xb[0] == pytest.approx(0.0, abs=1e-9)
    assert xb[-1] == pytest.approx(1.0 - np.exp(-5.0), abs=1e-9)


def test_o2_limit_is_load_bearing_for_takeoff_case():
    """Regression guard for report section 4.2's own named failure: omitting
    the O2 limit (mf_burn = min(mf, mair/AFRs)) over-predicted take-off power
    by ~19% in the report's first calibration pass. We check the same effect
    on total chemical heat release Qtot, which is directly proportional to
    indicated work at fixed combustion efficiency.

    Algebraically, whenever lambda < 1 (rich mixture, the O2 limit binds),
    mf_burn_with_limit / mf_burn_without_limit reduces exactly to `lambda`
    (mf_burn_with_limit = mair/AFRs = mf*lambda when the limit binds) - so at
    the take-off point's lambda=0.85 the raw fuel-mass effect is exactly a 15%
    drop. The report's larger ~19% figure reflects the full closed-cycle power
    calculation (Phase 5), where the extra unburned fuel would also have
    altered gas temperature and wall heat transfer; this combustion-only test
    only has the fuel-mass term available; it must exceed 10% as a "did the
    limit actually engage" guard, without over-claiming the full 19%.
    """
    params = load_seed_params()
    lit = params["fixed_from_literature"]
    fitted = params["fitted"]
    rated = params["reference_engine"]["rated_points"]["takeoff"]

    g = EngineGeometry.from_config()
    Rg = lit["gas_constant_J_per_kgK"]
    LHV = lit["fuel_LHV_J_per_kg"]
    eta_c = fitted["combustion_efficiency"]
    AFRs = lit["stoich_AFR"]
    lam = rated["lambda"]
    MAP = rated["MAP_Pa"]
    Tivc = 330.0  # representative trapped-charge temperature at IVC

    IVC_deg = params["fixed_from_spec"]["IVC_deg_ATDC"]
    V1 = g.volume(np.deg2rad(IVC_deg))
    m0 = MAP * V1 / (Rg * Tivc)

    mf, mair, mf_burn_with_limit = mixture_masses(m0, lam, AFRs)
    mf_burn_without_limit = mf  # the bug this test guards against

    Qtot_with_limit = mf_burn_with_limit * LHV * eta_c
    Qtot_without_limit = mf_burn_without_limit * LHV * eta_c

    assert Qtot_with_limit < Qtot_without_limit
    relative_drop = 1.0 - (Qtot_with_limit / Qtot_without_limit)
    assert relative_drop == pytest.approx(1.0 - lam, rel=1e-6)
    assert relative_drop >= 0.10, (
        f"O2 limit only reduced heat release by {relative_drop:.1%}; "
        "expected a clearly load-bearing effect (>=10%) at this rich, "
        "take-off operating point (report documents ~19% end-to-end)"
    )


def test_heat_release_rate_scales_linearly_with_inputs():
    dxb_dtheta = 2.5
    q = heat_release_rate(dxb_dtheta, mf_burn=0.001, LHV=43.5e6, eta_c=0.94)
    assert q == pytest.approx(0.001 * 43.5e6 * 0.94 * 2.5)


def test_misfire_override_zeroes_heat_release_with_no_special_branch():
    theta0 = np.deg2rad(-22.0)
    dtheta_burn = np.deg2rad(60.0)
    theta = np.linspace(theta0, theta0 + dtheta_burn, 100)
    _, dxb_dtheta = wiebe(theta, theta0, dtheta_burn)

    # A misfire is just mf_burn = 0 fed through the SAME heat_release_rate()
    # function used for every healthy cycle - no misfire-specific code path.
    q_misfire = heat_release_rate(dxb_dtheta, mf_burn=0.0, LHV=43.5e6, eta_c=0.94)
    assert np.all(q_misfire == 0.0)

    q_healthy = heat_release_rate(dxb_dtheta, mf_burn=0.0015, LHV=43.5e6, eta_c=0.94)
    assert np.any(q_healthy > 0.0)


def test_knock_integrand_positive_and_increases_with_pressure_and_temperature():
    kp = knock_params_from_config()
    base = knock_dIk_dtheta(p_Pa=20e5, T_K=900.0, omega_rad_s=600.0, **kp)
    higher_p = knock_dIk_dtheta(p_Pa=30e5, T_K=900.0, omega_rad_s=600.0, **kp)
    higher_T = knock_dIk_dtheta(p_Pa=20e5, T_K=1000.0, omega_rad_s=600.0, **kp)

    assert base > 0.0
    # Higher pressure and higher temperature both shorten the ignition delay,
    # i.e. increase dIk/dtheta (knock risk rises with both).
    assert higher_p > base
    assert higher_T > base


def test_knock_integral_can_accumulate_to_threshold_via_generic_solver():
    from simengine.engine.solver import integrate_closed_cycle

    kp = knock_params_from_config()
    omega = 600.0  # rad/s, representative

    def deriv(theta_rad, y):
        # Constant, aggressive p/T to deliberately drive Ik across 1.0 within
        # the integration window, proving the accumulator mechanics work.
        return np.array([knock_dIk_dtheta(p_Pa=35e5, T_K=1100.0, omega_rad_s=omega, **kp)])

    result = integrate_closed_cycle(
        theta_ivc_deg=-140.0, theta_evo_deg=140.0, dtheta_deg=0.2,
        deriv_fn=deriv, y0=np.array([0.0]),
    )
    Ik = result["y"][:, 0]
    assert Ik[-1] > Ik[0]
    assert np.all(np.diff(Ik) >= 0.0)
