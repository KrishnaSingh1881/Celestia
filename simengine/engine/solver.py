"""Generic RK4 crank-angle integrator (report section 14.1).

The report's convergence study found explicit RK4 at Delta_theta = 0.2 deg CA
gives IMEP error < 0.05% and p_max error < 0.2% relative to a 0.05 deg
reference, at 1/20th the cost. This module implements ONE integrator, reused
by every closed-cycle state (pressure, temperature, mass, and later
combustion/blow-by extensions) — do not write a second crank-angle integrator
elsewhere.

NOTE: research/celestia_cycle_model_reference.py's run_cycle() uses a 2-stage
midpoint (RK2) method, not RK4. That is a known discrepancy between the
reference script and the report's own numerical-implementation section — this
module implements the report's specified RK4, which is what the rest of
simengine builds on.
"""
from __future__ import annotations

from typing import Callable

import numpy as np


def integrate_closed_cycle(
    theta_ivc_deg: float,
    theta_evo_deg: float,
    dtheta_deg: float,
    deriv_fn: Callable[[float, np.ndarray], np.ndarray],
    y0: np.ndarray,
) -> dict:
    """Integrate dy/dtheta = deriv_fn(theta_rad, y) from IVC to EVO with RK4.

    Parameters
    ----------
    theta_ivc_deg, theta_evo_deg : crank-angle window, degrees ATDC.
    dtheta_deg : fixed step size, degrees CA (report default: 0.2).
    deriv_fn : theta_rad, y -> dy/dtheta, same shape as y. Must be a pure
        function of (theta, y) — any external context (e.g. a motored-pressure
        reference trace) must be computed analytically inside deriv_fn from
        theta_rad directly, not looked up by array index.
    y0 : 1D initial state vector.

    Returns
    -------
    dict with:
      theta_deg : (n,) array of crank angles in degrees
      y         : (n, len(y0)) array of the state history
    """
    theta_deg = np.arange(
        theta_ivc_deg, theta_evo_deg + dtheta_deg, dtheta_deg
    )
    theta_rad = theta_deg * np.pi / 180.0
    n = theta_rad.size
    h = dtheta_deg * np.pi / 180.0

    y0 = np.asarray(y0, dtype=float)
    y = np.zeros((n, y0.size))
    y[0] = y0

    for i in range(n - 1):
        t = theta_rad[i]
        yi = y[i]
        k1 = np.asarray(deriv_fn(t, yi), dtype=float)
        k2 = np.asarray(deriv_fn(t + h / 2.0, yi + h / 2.0 * k1), dtype=float)
        k3 = np.asarray(deriv_fn(t + h / 2.0, yi + h / 2.0 * k2), dtype=float)
        k4 = np.asarray(deriv_fn(t + h, yi + h * k3), dtype=float)
        y[i + 1] = yi + (h / 6.0) * (k1 + 2.0 * k2 + 2.0 * k3 + k4)

    return {"theta_deg": theta_deg, "y": y}
