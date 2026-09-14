import numpy as np
import pytest

from simengine.engine.geometry import EngineGeometry


def geom():
    return EngineGeometry.from_config()


def test_volume_at_tdc_equals_clearance_volume():
    g = geom()
    v0 = g.volume(0.0)
    assert v0 == pytest.approx(g.clearance_volume_m3, rel=1e-9)


def test_volume_at_bdc_equals_clearance_plus_displacement():
    g = geom()
    v_bdc = g.volume(np.pi)
    expected = g.clearance_volume_m3 + g.displacement_per_cyl_m3
    assert v_bdc == pytest.approx(expected, rel=1e-6)


def test_dVdtheta_matches_numerical_derivative():
    g = geom()
    theta = np.linspace(0.01, 2 * np.pi - 0.01, 200)
    analytic = g.dVdtheta(theta)
    eps = 1e-6
    numerical = (g.volume(theta + eps) - g.volume(theta - eps)) / (2 * eps)
    assert np.allclose(analytic, numerical, rtol=1e-4, atol=1e-9)


def test_area_positive_and_finite():
    g = geom()
    theta = np.linspace(0, 2 * np.pi, 50)
    a = g.area(theta)
    assert np.all(np.isfinite(a))
    assert np.all(a > 0)


def test_geometry_config_values_match_report_table():
    g = geom()
    assert g.bore_m == pytest.approx(0.0795)
    assert g.stroke_m == pytest.approx(0.0610)
    assert g.conrod_length_m == pytest.approx(0.1115)
    assert g.n_cylinders == 4
    assert g.compression_ratio == pytest.approx(9.0)
    assert g.displacement_per_cyl_m3 * 1e6 == pytest.approx(302.8, rel=2e-3)
    assert g.clearance_volume_m3 * 1e6 == pytest.approx(37.9, rel=2e-2)
