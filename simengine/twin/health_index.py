"""The health index, built so it can be un-built. Report eq 24.1-24.2.

Because HI is a weighted sum, every channel's exact contribution is
recoverable (decompose()) - the same computation serves the pilot (one
number) and the engineer (the full breakdown).
"""
from __future__ import annotations

import numpy as np

from simengine.twin.graph import CausalHealthGraph


def saturating_phi(u, u0: float = 3.0):
    """phi(u) = 1 - exp(-(u/u0)^2)  (eq 24.1) - saturating so one wild
    channel cannot single-handedly drive HI to its floor."""
    return 1.0 - np.exp(-((np.asarray(u, dtype=float) / u0) ** 2))


def graph_centrality(graph: CausalHealthGraph) -> dict[str, float]:
    """A simple degree centrality (in-degree + out-degree, normalized to the
    largest value) over the causal graph's nodes - the kappa_i in eq 24.2.
    Deliberately simple (not eigenvector/betweenness centrality) since the
    graphs this project builds (Phase 16 tests, and any real deployment's
    fault_library.yaml-derived topology) are small enough that degree
    centrality already distinguishes "central" failure-cascade nodes from
    peripheral ones; swap in a richer centrality measure if graphs grow.
    """
    raw = {name: len(graph.parents(name)) + len(graph.children(name)) for name in graph.nodes}
    max_c = max(raw.values()) if raw else 0
    if max_c <= 0:
        return {name: 0.0 for name in raw}
    return {name: c / max_c for name, c in raw.items()}


def channel_weights(centrality: dict[str, float], consequence_weight: dict[str, float]) -> dict[str, float]:
    """pi_i = c_i * kappa_i / sum_j(c_j * kappa_j)  (eq 24.2)."""
    raw = {name: consequence_weight[name] * centrality[name] for name in centrality if name in consequence_weight}
    total = sum(raw.values())
    if total <= 0:
        n = len(raw)
        return {name: 1.0 / n for name in raw} if n else {}
    return {name: v / total for name, v in raw.items()}


class HealthIndex:
    def __init__(self, weights: dict[str, float], u0: float = 3.0):
        self.weights = weights
        self.u0 = u0

    def compute(self, z: dict[str, float]) -> float:
        """HI(t) = 100*(1 - sum_i(pi_i * phi(|z_i(t)|)))  (eq 24.1)."""
        penalty = sum(
            self.weights.get(name, 0.0) * float(saturating_phi(abs(value), self.u0)) for name, value in z.items()
        )
        return 100.0 * (1.0 - penalty)

    def decompose(self, z: dict[str, float]) -> dict[str, float]:
        """Per-channel contribution to the deficit (100 - HI). These sum
        exactly (up to floating point) to HI(z) - 100."""
        return {
            name: -100.0 * self.weights.get(name, 0.0) * float(saturating_phi(abs(value), self.u0))
            for name, value in z.items()
        }

    def subsystem_index(self, z: dict[str, float], subsystem_channels: list[str]) -> float:
        """Same computation restricted to (and re-normalized over) one
        subsystem's channels - "pilot sees one number, engineer sees six"."""
        sub_z = {name: z[name] for name in subsystem_channels if name in z}
        if not sub_z:
            return 100.0
        raw_weights = {name: self.weights.get(name, 0.0) for name in sub_z}
        total_w = sum(raw_weights.values())
        if total_w <= 0:
            return 100.0
        norm_weights = {name: w / total_w for name, w in raw_weights.items()}
        penalty = sum(norm_weights[name] * float(saturating_phi(abs(sub_z[name]), self.u0)) for name in sub_z)
        return 100.0 * (1.0 - penalty)
