import pytest

from simengine.engine.thermo import cv_of_T, gamma_of_T, gamma_params_from_config


def test_gamma_at_reference_temperature():
    assert gamma_of_T(300.0) == pytest.approx(1.38)


def test_gamma_decreases_with_temperature():
    assert gamma_of_T(2000.0) < gamma_of_T(300.0)


def test_cv_matches_ideal_gas_relation():
    Rg = 287.0
    T = 1500.0
    g = gamma_of_T(T)
    assert cv_of_T(T, Rg) == pytest.approx(Rg / (g - 1.0))


def test_config_params_match_report_values():
    params = gamma_params_from_config()
    assert params["intercept"] == pytest.approx(1.38)
    assert params["slope"] == pytest.approx(6.0e-5)
