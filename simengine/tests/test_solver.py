import numpy as np

from simengine.engine.solver import integrate_closed_cycle


def test_zero_derivative_holds_state_constant():
    def deriv(theta_rad, y):
        return np.zeros_like(y)

    result = integrate_closed_cycle(
        theta_ivc_deg=-140.0,
        theta_evo_deg=140.0,
        dtheta_deg=0.2,
        deriv_fn=deriv,
        y0=np.array([3.0, 7.0]),
    )
    assert np.allclose(result["y"][:, 0], 3.0)
    assert np.allclose(result["y"][:, 1], 7.0)


def test_unit_derivative_in_theta_gives_linear_ramp():
    # dy/dtheta = 1 (constant, in radians) -> y(theta) = y0 + (theta - theta0)
    def deriv(theta_rad, y):
        return np.array([1.0])

    theta_ivc_deg = -30.0
    theta_evo_deg = 30.0
    result = integrate_closed_cycle(
        theta_ivc_deg=theta_ivc_deg,
        theta_evo_deg=theta_evo_deg,
        dtheta_deg=0.5,
        deriv_fn=deriv,
        y0=np.array([0.0]),
    )
    theta_rad = result["theta_deg"] * np.pi / 180.0
    theta0_rad = theta_ivc_deg * np.pi / 180.0
    expected = theta_rad - theta0_rad
    assert np.allclose(result["y"][:, 0], expected, atol=1e-9)


def test_rk4_exact_on_cubic_polynomial():
    # dy/dtheta = 3*theta^2 -> y = theta^3 + C. RK4 is exact for cubics.
    def deriv(theta_rad, y):
        return np.array([3.0 * theta_rad**2])

    result = integrate_closed_cycle(
        theta_ivc_deg=-10.0,
        theta_evo_deg=10.0,
        dtheta_deg=1.0,
        deriv_fn=deriv,
        y0=np.array([0.0]),
    )
    theta_rad = result["theta_deg"] * np.pi / 180.0
    theta0_rad = -10.0 * np.pi / 180.0
    expected = theta_rad**3 - theta0_rad**3
    assert np.allclose(result["y"][:, 0], expected, atol=1e-9)


def test_output_shapes():
    def deriv(theta_rad, y):
        return np.zeros_like(y)

    result = integrate_closed_cycle(-140.0, 140.0, 0.2, deriv, np.array([1.0, 2.0, 3.0]))
    n = result["theta_deg"].size
    assert result["y"].shape == (n, 3)
