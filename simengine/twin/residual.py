"""Residuals: the actual replacement for fixed thresholds. Report eq 19.1-19.2.

Four residual dimensions (section 19.1):
1. output      - measured vs. predicted, per sensor channel
2. parameter   - estimated theta vs. confirmed-normal theta (slower, quieter,
                 directly interpretable as component health)
3. relational  - deviation of a physically-constrained PAIR (e.g. the oil
                 pressure-temperature relation) from what healthy operation
                 implies - the Table-6 discriminators
4. symmetry    - cylinder-to-cylinder spread; self-referencing, survives
                 model error almost completely

Scope note: this project's twin (Phase 13) is a single lumped-cylinder
model, so no real per-cylinder Tier B output exists yet to compute a
genuine symmetry residual FROM. compute_symmetry_residual() itself is fully
implemented and tested against synthetic per-cylinder arrays; wiring it to
real per-cylinder twin output is future work once/if the twin is extended
to track cylinders individually.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

import numpy as np


@dataclass
class ContextSurface:
    """A binned lookup for (mu_i(u), sigma_i(u)), fit from confirmed-normal
    (healthy) historical data indexed by a scalar context value u (e.g.
    throttle, altitude, or any other single operating-context coordinate).
    """

    bin_edges: np.ndarray
    bin_mu: np.ndarray
    bin_sigma: np.ndarray

    @classmethod
    def fit(cls, context_values, observed_values, n_bins: int = 10, min_sigma: float = 1e-6) -> "ContextSurface":
        u = np.asarray(context_values, dtype=float)
        y = np.asarray(observed_values, dtype=float)
        bin_edges = np.linspace(u.min(), u.max(), n_bins + 1)
        bin_edges[-1] += 1e-9  # make the rightmost edge inclusive
        bin_mu = np.zeros(n_bins)
        bin_sigma = np.zeros(n_bins)
        indices = np.clip(np.digitize(u, bin_edges) - 1, 0, n_bins - 1)
        for b in range(n_bins):
            in_bin = y[indices == b]
            if in_bin.size > 1:
                bin_mu[b] = in_bin.mean()
                bin_sigma[b] = max(in_bin.std(), min_sigma)
            elif in_bin.size == 1:
                bin_mu[b] = in_bin[0]
                bin_sigma[b] = min_sigma
            else:
                bin_mu[b] = y.mean()
                bin_sigma[b] = max(y.std(), min_sigma)
        return cls(bin_edges=bin_edges, bin_mu=bin_mu, bin_sigma=bin_sigma)

    def predict(self, context_value: float) -> tuple[float, float]:
        n_bins = self.bin_mu.size
        idx = int(np.clip(np.digitize(context_value, self.bin_edges) - 1, 0, n_bins - 1))
        return float(self.bin_mu[idx]), float(self.bin_sigma[idx])


def compute_output_residuals(y_measured: dict, y_predicted: dict) -> dict:
    """r_i(t) = y_i(t) - y_hat_i(...)  (eq 19.1)."""
    return {name: y_measured[name] - y_predicted[name] for name in y_measured}


def compute_normalized_residuals(output_residuals: dict, context_value: float, surfaces: dict[str, ContextSurface]) -> dict:
    """z_i(t) = (r_i(t) - mu_i(u)) / sigma_i(u)  (eq 19.2)."""
    z = {}
    for name, r in output_residuals.items():
        mu, sigma = surfaces[name].predict(context_value)
        z[name] = (r - mu) / max(sigma, 1e-9)
    return z


def compute_parameter_residuals(theta_hat: dict, theta_confirmed_normal: dict) -> dict:
    return {name: theta_hat[name] - theta_confirmed_normal[name] for name in theta_hat}


def compute_relational_residual(actual_pair_value: float, expected_relation_fn: Callable[..., float], *args, **kwargs) -> float:
    """Deviation of a physically-constrained pair from its healthy relation,
    e.g. actual oil pressure vs. what the healthy oil-pressure-temperature
    relation (simengine.engine.lube) predicts at the current oil
    temperature/speed."""
    expected = expected_relation_fn(*args, **kwargs)
    return actual_pair_value - expected


def compute_symmetry_residual(per_cylinder_values) -> np.ndarray:
    """Cylinder-to-cylinder spread: deviation of each cylinder's value from
    the cross-cylinder mean. Self-referencing - needs no model of "normal"
    at all, which is why it survives model error almost completely."""
    values = np.asarray(per_cylinder_values, dtype=float)
    return values - values.mean()


@dataclass
class Residual:
    output: dict = field(default_factory=dict)
    normalized: dict = field(default_factory=dict)
    parameter: dict = field(default_factory=dict)
    relational: dict = field(default_factory=dict)
    symmetry: dict = field(default_factory=dict)


class ResidualEngine:
    """Ties the four residual dimensions together against a shared set of
    per-channel context surfaces (mu_i(u), sigma_i(u))."""

    def __init__(self, surfaces: dict[str, ContextSurface] | None = None):
        self.surfaces = surfaces or {}

    def compute(
        self,
        y_measured: dict,
        y_predicted: dict,
        context_value: float,
        theta_hat: dict | None = None,
        theta_confirmed_normal: dict | None = None,
        relational_pairs: dict[str, float] | None = None,
        symmetry_groups: dict[str, list[float]] | None = None,
    ) -> Residual:
        output = compute_output_residuals(y_measured, y_predicted)
        normalized = (
            compute_normalized_residuals(output, context_value, self.surfaces) if self.surfaces else {}
        )
        parameter = (
            compute_parameter_residuals(theta_hat, theta_confirmed_normal)
            if theta_hat is not None and theta_confirmed_normal is not None
            else {}
        )
        relational = relational_pairs or {}
        symmetry = (
            {name: compute_symmetry_residual(vals) for name, vals in symmetry_groups.items()}
            if symmetry_groups
            else {}
        )
        return Residual(
            output=output, normalized=normalized, parameter=parameter,
            relational=relational, symmetry=symmetry,
        )
