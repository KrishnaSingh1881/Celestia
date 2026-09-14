"""Fault injection: severity-shape generators and the bounded parameter
mapping. Report eq 16.1-16.2.

A fault is a prescribed time-evolution of one or more entries of the shared
health-parameter vector theta (built in Phase 8) - these functions produce
that time-evolution; nothing here special-cases a named fault, matching
section 10.1/16.1's "one engine model, faults are trajectories" principle.
"""
from __future__ import annotations

import numpy as np


def severity_linear(t, s0: float, beta: float):
    """s(t) = s0 + beta*t."""
    return s0 + beta * np.asarray(t, dtype=float)


def severity_exponential(t, s0: float, beta: float):
    """s(t) = s0 * exp(beta*t)."""
    return s0 * np.exp(beta * np.asarray(t, dtype=float))


def severity_step(t, s0: float, delta_s: float, t_f: float):
    """s(t) = s0 + delta_s*H(t - t_f), Heaviside step at t_f."""
    t = np.asarray(t, dtype=float)
    return s0 + delta_s * (t >= t_f)


SEVERITY_SHAPES = {
    "linear": severity_linear,
    "exponential": severity_exponential,
    "step": severity_step,
}


def apply_severity(
    theta_j0: float, alpha_j: float, s_t, theta_min: float, theta_max: float
):
    """Bounded parameter map (eq 16.2):

    theta_j(t) = clip(theta_j0*(1 + alpha_j*s(t)), theta_min, theta_max)

    The clip is not a defensive afterthought - it IS the physical bound (e.g.
    sealing area cannot go negative, an efficiency cannot exceed its map
    maximum), and campaign-generated scenarios rely on it to guarantee every
    trajectory stays physically valid at every instant, for any severity
    shape/end-state the DOE happens to draw.
    """
    s_t = np.asarray(s_t, dtype=float)
    theta_j = theta_j0 * (1.0 + alpha_j * s_t)
    return np.clip(theta_j, theta_min, theta_max)
