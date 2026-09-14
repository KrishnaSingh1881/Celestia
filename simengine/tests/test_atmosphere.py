import pytest

from simengine.engine.atmosphere import commanded_MAP, isa_params_from_config, isa_pressure, isa_temperature


def test_sea_level_matches_isa_standard_values():
    params = isa_params_from_config()
    T = isa_temperature(0.0, T0_K=params["T0_K"], lapse_rate_K_per_m=params["lapse_rate_K_per_m"])
    p = isa_pressure(0.0, **params)
    assert T == pytest.approx(288.15, rel=1e-6)
    assert p == pytest.approx(101325.0, rel=1e-4)


def test_temperature_and_pressure_decrease_with_altitude():
    params = isa_params_from_config()
    T_low = isa_temperature(1000.0, T0_K=params["T0_K"], lapse_rate_K_per_m=params["lapse_rate_K_per_m"])
    T_high = isa_temperature(8000.0, T0_K=params["T0_K"], lapse_rate_K_per_m=params["lapse_rate_K_per_m"])
    p_low = isa_pressure(1000.0, **params)
    p_high = isa_pressure(8000.0, **params)
    assert T_high < T_low
    assert p_high < p_low


def test_MAP_held_constant_below_critical_altitude():
    MAP_rated = 1.32e5
    critical_alt = 4500.0
    MAP_2000 = commanded_MAP(2000.0, MAP_rated, critical_alt)
    MAP_4000 = commanded_MAP(4000.0, MAP_rated, critical_alt)
    assert MAP_2000 == pytest.approx(MAP_rated)
    assert MAP_4000 == pytest.approx(MAP_rated)


def test_MAP_falls_with_ambient_pressure_above_critical_altitude():
    MAP_rated = 1.32e5
    critical_alt = 4500.0
    MAP_at_critical = commanded_MAP(critical_alt, MAP_rated, critical_alt)
    MAP_above = commanded_MAP(7000.0, MAP_rated, critical_alt)
    assert MAP_at_critical == pytest.approx(MAP_rated)
    assert MAP_above < MAP_rated
