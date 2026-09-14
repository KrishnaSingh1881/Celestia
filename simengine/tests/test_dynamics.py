import pytest

from simengine.engine.dynamics import (
    propeller_efficiency,
    propeller_thrust,
    propeller_torque,
    solve_operating_rpm,
)


def test_propeller_thrust_and_torque_scale_with_rpm_squared():
    low = propeller_thrust(CT=0.1, rho_kg_m3=1.0, n_rev_s=50.0, D_m=2.0)
    high = propeller_thrust(CT=0.1, rho_kg_m3=1.0, n_rev_s=100.0, D_m=2.0)
    assert high == pytest.approx(4 * low, rel=1e-9)

    low_q = propeller_torque(CQ=0.05, rho_kg_m3=1.0, n_rev_s=50.0, D_m=2.0)
    high_q = propeller_torque(CQ=0.05, rho_kg_m3=1.0, n_rev_s=100.0, D_m=2.0)
    assert high_q == pytest.approx(4 * low_q, rel=1e-9)


def test_propeller_efficiency_formula():
    eff = propeller_efficiency(J_adv=0.8, CT=0.12, CQ=0.06)
    assert eff == pytest.approx(0.8 * 0.12 / (2 * 3.141592653589793 * 0.06))


def test_solve_operating_rpm_finds_torque_balance():
    # Engine torque falls slightly with speed; propeller load torque rises
    # with speed^2 (typical fixed-pitch behaviour). The balance point is
    # where they cross.
    def engine_torque(omega):
        return 150.0 - 0.001 * omega

    def prop_load_torque(omega):
        return 0.02 * omega**2

    gear_ratio = 2.43
    eta_g = 0.97
    omega_balance = solve_operating_rpm(
        engine_torque, prop_load_torque, gear_ratio, eta_g, omega_guess_rad_s=500.0
    )
    residual = engine_torque(omega_balance) - prop_load_torque(omega_balance) / (
        gear_ratio * eta_g
    )
    assert abs(residual) < 1e-3
    assert omega_balance > 0
