import pytest

from simengine.engine.turbo import (
    compressor_outlet_temperature,
    compressor_power,
    domega_tc_dt,
    turbine_power,
)


def test_compressor_outlet_temp_increases_with_pressure_ratio():
    T1 = 288.0
    low_pr = compressor_outlet_temperature(T1, eta_c=0.75, Pi_c=1.3)
    high_pr = compressor_outlet_temperature(T1, eta_c=0.75, Pi_c=2.0)
    assert high_pr > low_pr > T1


def test_compressor_outlet_temp_decreases_with_efficiency():
    T1 = 288.0
    Pi_c = 1.8
    low_eff = compressor_outlet_temperature(T1, eta_c=0.6, Pi_c=Pi_c)
    high_eff = compressor_outlet_temperature(T1, eta_c=0.85, Pi_c=Pi_c)
    assert high_eff < low_eff


def test_compressor_power_positive_for_temperature_rise():
    p = compressor_power(mdot_air_kg_s=0.1, cp_air_J_per_kgK=1005.0, T1_K=288.0, T2_K=340.0)
    assert p > 0.0


def test_turbine_power_positive_and_scales_with_efficiency():
    common = dict(
        mdot_exh_kg_s=0.11, cp_exh_J_per_kgK=1100.0, T3_K=1100.0, expansion_ratio=0.4,
    )
    low_eff = turbine_power(eta_t=0.6, **common)
    high_eff = turbine_power(eta_t=0.8, **common)
    assert low_eff > 0.0
    assert high_eff > low_eff


def test_shaft_accelerates_when_turbine_power_exceeds_compressor_power():
    domega = domega_tc_dt(
        Wdot_turbine_W=5000.0, Wdot_compressor_W=3000.0, eta_m=0.95,
        J_tc_kg_m2=1e-5, omega_tc_rad_s=2000.0,
    )
    assert domega > 0.0


def test_shaft_decelerates_when_compressor_power_exceeds_turbine_power():
    domega = domega_tc_dt(
        Wdot_turbine_W=1000.0, Wdot_compressor_W=3000.0, eta_m=0.95,
        J_tc_kg_m2=1e-5, omega_tc_rad_s=2000.0,
    )
    assert domega < 0.0
