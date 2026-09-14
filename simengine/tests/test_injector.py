import numpy as np
import pytest

from simengine.faults.injector import (
    apply_severity,
    severity_exponential,
    severity_linear,
    severity_step,
)


def test_severity_linear_at_sample_points():
    t = np.array([0.0, 2.0, 5.0])
    s = severity_linear(t, s0=0.1, beta=0.05)
    assert np.allclose(s, [0.1, 0.2, 0.35])


def test_severity_exponential_at_sample_points():
    t = np.array([0.0, 1.0, 2.0])
    s = severity_exponential(t, s0=0.1, beta=0.5)
    assert np.allclose(s, [0.1, 0.1 * np.exp(0.5), 0.1 * np.exp(1.0)])


def test_severity_step_at_sample_points():
    t = np.array([0.0, 1.9, 2.0, 5.0])
    s = severity_step(t, s0=0.05, delta_s=0.3, t_f=2.0)
    assert np.allclose(s, [0.05, 0.05, 0.35, 0.35])


def test_apply_severity_respects_upper_bound():
    theta = apply_severity(theta_j0=1.0, alpha_j=1.0, s_t=np.array([0.0, 5.0, 100.0]),
                            theta_min=0.0, theta_max=3.0)
    assert np.all(theta <= 3.0)
    assert theta[0] == pytest.approx(1.0)
    assert theta[-1] == pytest.approx(3.0)


def test_apply_severity_respects_lower_bound():
    theta = apply_severity(theta_j0=1.0, alpha_j=-1.0, s_t=np.array([0.0, 2.0, 100.0]),
                            theta_min=0.2, theta_max=10.0)
    assert np.all(theta >= 0.2)
    assert theta[-1] == pytest.approx(0.2)


def test_apply_severity_unclipped_in_normal_range():
    theta = apply_severity(theta_j0=2.0, alpha_j=0.5, s_t=0.1, theta_min=0.0, theta_max=100.0)
    assert theta == pytest.approx(2.0 * (1 + 0.5 * 0.1))
