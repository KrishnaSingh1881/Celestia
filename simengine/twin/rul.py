"""Remaining useful life as a first-passage problem. Report eq 25.1-25.5.

Damage state D(t), failure at D=D_th, drift+diffusion (eq 25.1):
    dD = mu(u,D) dt + sigma_D dW

For constant drift, RUL (first passage time to D_th) has a CLOSED FORM: the
inverse Gaussian / Wald distribution (eq 25.2) - right-skewed, matching
"quiet then fast" degradation. Report the 5th percentile as the planning
number, not the mean. For nonlinear/non-Gaussian degradation, a particle
filter's empirical crossing-time distribution IS the RUL distribution, no
distributional assumption required (eq 25.4).

Engine-level RUL = min over components at each quantile - NOT an average
(eq 25.5): the engine survives only as long as its worst component does.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

import numpy as np
from scipy.optimize import brentq
from scipy.stats import norm


def _wald_cdf(t: float, mu_w: float, lam: float) -> float:
    """Closed-form CDF of the inverse Gaussian (Wald) distribution."""
    if t <= 0:
        return 0.0
    sqrt_term = np.sqrt(lam / t)
    a = sqrt_term * (t / mu_w - 1.0)
    b = sqrt_term * (t / mu_w + 1.0)
    return float(norm.cdf(a) + np.exp(2.0 * lam / mu_w) * norm.cdf(-b))


def inverse_gaussian_rul_pdf(t, D0: float, D_th: float, mu: float, sigma_D: float):
    """f_RUL(t) (eq 25.2), closed form for constant drift."""
    t = np.asarray(t, dtype=float)
    L = D_th - D0
    with np.errstate(divide="ignore", invalid="ignore"):
        pdf = (L / (sigma_D * np.sqrt(2.0 * np.pi * t**3))) * np.exp(
            -((L - mu * t) ** 2) / (2.0 * sigma_D**2 * t)
        )
    return np.where(t > 0, pdf, 0.0)


def inverse_gaussian_rul_quantile(D0: float, D_th: float, mu: float, sigma_D: float, q: float) -> float:
    L = D_th - D0
    if L <= 0:
        return 0.0
    mu_w = L / mu
    lam = L**2 / sigma_D**2

    def f(t):
        return _wald_cdf(t, mu_w, lam) - q

    lo, hi = 1e-9, mu_w * 10.0
    while f(hi) < 0:
        hi *= 2.0
    return brentq(f, lo, hi)


def inverse_gaussian_rul_quantiles(
    D0: float, D_th: float, mu: float, sigma_D: float, quantiles=(0.05, 0.5, 0.95)
) -> dict[float, float]:
    return {q: inverse_gaussian_rul_quantile(D0, D_th, mu, sigma_D, q) for q in quantiles}


def mission_conditioned_expected_damage(
    D0: float, mu_fn: Callable[[object, float], float], u_plan_fn: Callable[[float], object], T: float, n_steps: int = 1000
) -> float:
    """E[D(T)] = D0 + integral(mu(u_plan(t), D) dt)  (eq 25.3) - integrates
    the drift along a PLANNED mission profile, answering "will it survive
    THIS mission" rather than assuming today's conditions persist."""
    dt = T / n_steps
    D = D0
    for i in range(n_steps):
        t = i * dt
        u = u_plan_fn(t)
        D += mu_fn(u, D) * dt
    return D


def particle_filter_rul_crossing_times(
    D0: float,
    D_th: float,
    mu_fn: Callable[[np.ndarray], np.ndarray],
    sigma_D: float,
    n_particles: int = 1000,
    dt: float = 0.01,
    max_t: float = 1000.0,
    rng: np.random.Generator | None = None,
) -> np.ndarray:
    """Empirical first-passage-time distribution for nonlinear/non-Gaussian
    degradation (eq 25.4): propagate N_p particles, no distributional
    assumption - the crossing-time histogram IS the RUL distribution.
    Returns an (n_particles,) array, NaN for particles that never crossed
    D_th within max_t.
    """
    rng = rng or np.random.default_rng()
    D = np.full(n_particles, D0, dtype=float)
    crossing_times = np.full(n_particles, np.nan)
    active = np.ones(n_particles, dtype=bool)
    n_steps = int(max_t / dt)
    for step in range(n_steps):
        if not active.any():
            break
        t = (step + 1) * dt
        noise = rng.normal(0.0, sigma_D * np.sqrt(dt), size=n_particles)
        D[active] = D[active] + mu_fn(D[active]) * dt + noise[active]
        newly_crossed = active & (D >= D_th)
        crossing_times[newly_crossed] = t
        active = active & ~newly_crossed
    return crossing_times


def rul_quantiles_from_crossing_times(crossing_times: np.ndarray, quantiles=(0.05, 0.5, 0.95)) -> dict[float, float]:
    valid = crossing_times[~np.isnan(crossing_times)]
    if valid.size == 0:
        return {q: float("inf") for q in quantiles}
    return {q: float(np.quantile(valid, q)) for q in quantiles}


@dataclass
class ComponentRUL:
    component: str
    q05: float
    q50: float
    q95: float
    dominant_driver: str


def engine_level_rul(component_ruls: list[ComponentRUL]) -> dict[str, float]:
    """RUL_engine(q) = min_j(RUL_j(q))  (eq 25.5) - the engine survives only
    as long as its worst component does. NOT an average."""
    if not component_ruls:
        raise ValueError("need at least one component RUL to aggregate")
    return {
        "q05": min(c.q05 for c in component_ruls),
        "q50": min(c.q50 for c in component_ruls),
        "q95": min(c.q95 for c in component_ruls),
        "governing_component": min(component_ruls, key=lambda c: c.q05).component,
    }
