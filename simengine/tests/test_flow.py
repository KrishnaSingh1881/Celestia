import numpy as np
import pytest

from simengine.engine.flow import (
    blowby_dm_dtheta,
    flow_function_psi,
    mdot_engine_speed_density,
    orifice_flow,
)


def test_flow_function_continuous_at_critical_ratio():
    gamma = 1.4
    pi_crit = (2.0 / (gamma + 1.0)) ** (gamma / (gamma - 1.0))
    below = flow_function_psi(pi_crit - 1e-4, gamma=gamma)
    at = flow_function_psi(pi_crit, gamma=gamma)
    above = flow_function_psi(pi_crit + 1e-4, gamma=gamma)
    assert below == pytest.approx(at, rel=1e-3)
    assert above == pytest.approx(at, rel=1e-3)


def test_flow_function_choked_region_is_flat():
    gamma = 1.4
    pi_crit = (2.0 / (gamma + 1.0)) ** (gamma / (gamma - 1.0))
    psi_low = flow_function_psi(0.1, gamma=gamma)
    psi_mid = flow_function_psi(pi_crit / 2, gamma=gamma)
    assert psi_low == pytest.approx(psi_mid, rel=1e-9)


def test_flow_function_decreases_toward_zero_as_pi_approaches_1():
    gamma = 1.4
    psi_high = flow_function_psi(0.99, gamma=gamma)
    psi_mid = flow_function_psi(0.7, gamma=gamma)
    assert psi_high < psi_mid


def test_orifice_flow_zero_for_reverse_pressure_gradient():
    mdot = orifice_flow(Cd=0.8, A_m2=1e-4, p_u_Pa=1.0e5, p_d_Pa=1.5e5, T_u_K=350.0, Rg=287.0)
    assert float(mdot) == 0.0


def test_orifice_flow_positive_for_forward_gradient_and_scales_with_area():
    common = dict(Cd=0.8, p_u_Pa=2.0e5, p_d_Pa=1.0e5, T_u_K=350.0, Rg=287.0)
    small = orifice_flow(A_m2=1e-5, **common)
    large = orifice_flow(A_m2=2e-5, **common)
    assert float(small) > 0.0
    assert float(large) == pytest.approx(2.0 * float(small), rel=1e-9)


def test_blowby_signature_falling_pmax_with_rising_egt_proxy():
    """Sensitivity-sanity style check (report's Gate 3 pattern): increasing
    the blow-by orifice area should increase the mass-loss rate, which is
    exactly the mechanism the report says causes falling peak pressure
    together with rising EGT (unburned/less-expanded gas carries more
    enthalpy to exhaust). Here we check the direct, low-level effect: bigger
    leak area -> bigger mass loss rate (magnitude).
    """
    common = dict(
        Cd_bb=0.7, p_cyl_Pa=40e5, p_crankcase_Pa=1.1e5, T_K=1200.0,
        Rg=287.0, omega_rad_s=600.0,
    )
    small_leak = blowby_dm_dtheta(A_bb_m2=1e-6, **common)
    large_leak = blowby_dm_dtheta(A_bb_m2=1e-5, **common)
    assert small_leak < 0.0  # mass is lost from the cylinder
    assert large_leak < small_leak  # bigger leak area -> more (more negative) mass loss


def test_speed_density_volumetric_efficiency_scales_flow():
    common = dict(p_MAP_Pa=1.2e5, Ti_K=320.0, Rg=287.0, Vd_m3=3.028e-4, N_rev_s=5800 / 60.0)
    low_ve = mdot_engine_speed_density(eta_v=0.7, **common)
    high_ve = mdot_engine_speed_density(eta_v=0.95, **common)
    assert high_ve > low_ve
    assert high_ve == pytest.approx(low_ve * 0.95 / 0.7, rel=1e-9)
