import pytest

from simengine.engine.friction import (
    bmep,
    brake_power,
    brake_torque,
    chen_flynn_params_from_config,
    fmep_chen_flynn,
    imep,
)


def test_chen_flynn_seed_constants_match_report():
    cf = chen_flynn_params_from_config()
    assert cf["Af_Pa"] == pytest.approx(0.90e5)
    assert cf["Bf"] == pytest.approx(0.012)
    assert cf["Cf"] == pytest.approx(2.0e3)
    assert cf["Df"] == pytest.approx(120.0)


def test_fmep_increases_with_peak_pressure_and_speed():
    cf = chen_flynn_params_from_config()
    base = fmep_chen_flynn(p_max_Pa=60e5, Sp_m_s=10.0, **cf)
    higher_pmax = fmep_chen_flynn(p_max_Pa=70e5, Sp_m_s=10.0, **cf)
    higher_speed = fmep_chen_flynn(p_max_Pa=60e5, Sp_m_s=15.0, **cf)
    assert higher_pmax > base
    assert higher_speed > base


def test_bmep_and_brake_numbers_consistent():
    imep_val = imep(Wgross_J=250.0, Vd_cyl_m3=302.8e-6)
    fmep_val = 1.5e5
    pmep_val = 0.25e5
    bmep_val = bmep(imep_val, pmep_val, fmep_val)
    assert bmep_val == pytest.approx(imep_val - pmep_val - fmep_val)

    Vd_tot = 1211.2e-6
    N_rev_s = 5800 / 60.0
    Tq = brake_torque(bmep_val, Vd_tot)
    P = brake_power(bmep_val, Vd_tot, N_rev_s=N_rev_s)
    assert Tq > 0
    assert P > 0
    # Power = torque * angular speed: P/Tq = (bmep*Vd_tot*N/2)/(bmep*Vd_tot/(4pi))
    # = 2*pi*N = omega. This must hold exactly from eq 7.4's own algebra.
    omega = 2 * 3.141592653589793 * N_rev_s
    assert P == pytest.approx(Tq * omega, rel=1e-9)
