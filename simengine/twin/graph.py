"""The dynamic causal health graph. Report section 23, eq 23.1-23.4.

Topology comes from PHYSICS (fault_library.yaml's parameter_path/
discriminator fields and the cascade descriptions in report section 12),
never from correlation-mining telemetry - this is what keeps root-cause
ranking interpretable and prevents spurious links from limited data.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

NODE_KINDS = ("component", "parameter", "observable", "context")


@dataclass
class Node:
    name: str
    kind: str  # one of NODE_KINDS

    def __post_init__(self):
        if self.kind not in NODE_KINDS:
            raise ValueError(f"unknown node kind {self.kind!r}, expected one of {NODE_KINDS}")


@dataclass
class Edge:
    src: str
    dst: str
    gain: float
    lag_h: float
    alpha: float = 1.0  # Beta(alpha, beta) confidence, per eq 23.4
    beta: float = 1.0


def _sigmoid(x):
    return 1.0 / (1.0 + np.exp(-x))


class CausalHealthGraph:
    def __init__(self):
        self.nodes: dict[str, Node] = {}
        self.edges: dict[tuple[str, str], Edge] = {}
        self._parents: dict[str, list[str]] = {}
        self._children: dict[str, list[str]] = {}

    def add_node(self, name: str, kind: str) -> None:
        self.nodes[name] = Node(name, kind)
        self._parents.setdefault(name, [])
        self._children.setdefault(name, [])

    def add_edge(self, src: str, dst: str, gain: float, lag_h: float, alpha: float = 1.0, beta: float = 1.0) -> None:
        self.edges[(src, dst)] = Edge(src, dst, gain, lag_h, alpha, beta)
        self._parents.setdefault(dst, []).append(src)
        self._children.setdefault(src, []).append(dst)

    def parents(self, name: str) -> list[str]:
        return self._parents.get(name, [])

    def children(self, name: str) -> list[str]:
        return self._children.get(name, [])

    # ---------------------------------------------------------------
    # Backward reasoning - root cause (eq 23.1-23.2)
    # ---------------------------------------------------------------

    @staticmethod
    def noisy_or_activation_prob(parent_severities: dict[str, float], parent_activation_probs: dict[str, float]) -> float:
        """P(e_i=1 | parents) = 1 - prod_j( (1-p_ij)^s_j )  (eq 23.1)."""
        prod = 1.0
        for name, s_j in parent_severities.items():
            p_ij = parent_activation_probs[name]
            prod *= (1.0 - p_ij) ** s_j
        return 1.0 - prod

    @staticmethod
    def log_odds_update(prior_prob: float, log_likelihood_ratios: list[float]) -> float:
        """Posterior log-odds = prior log-odds + sum of per-evidence LLRs
        (eq 23.2) - the dashboard's additive "causal trace"."""
        prior_prob = np.clip(prior_prob, 1e-9, 1.0 - 1e-9)
        prior_log_odds = np.log(prior_prob / (1.0 - prior_prob))
        return float(prior_log_odds + sum(log_likelihood_ratios))

    @staticmethod
    def log_odds_to_prob(log_odds: float) -> float:
        return float(_sigmoid(log_odds))

    def hypothesis_posterior(
        self,
        prior_prob: float,
        observed_activations: dict[str, bool],
        activation_prob_given_hypothesis: dict[str, float],
        activation_prob_given_null: dict[str, float],
    ) -> float:
        """Posterior probability of one root-cause hypothesis, combining
        per-observable evidence via log-odds (eq 23.2). Call once per
        candidate hypothesis and compare/rank the results - never collapse
        to a single verdict."""
        llrs = []
        for name, activated in observed_activations.items():
            p_h = np.clip(activation_prob_given_hypothesis[name], 1e-6, 1 - 1e-6)
            p_null = np.clip(activation_prob_given_null[name], 1e-6, 1 - 1e-6)
            llr = np.log(p_h / p_null) if activated else np.log((1 - p_h) / (1 - p_null))
            llrs.append(llr)
        log_odds = self.log_odds_update(prior_prob, llrs)
        return self.log_odds_to_prob(log_odds)

    # ---------------------------------------------------------------
    # Forward reasoning - cascade projection (eq 23.3)
    # ---------------------------------------------------------------

    def propagate(self, initial_severities: dict[str, float], duration_h: float, dt_h: float = 0.1) -> dict[str, np.ndarray]:
        """s_i(t) = sigmoid(sum_{j in parents(i)}(w_ij * s_j(t - tau_ij)))
        (eq 23.3, bias omitted/zero here for simplicity). Returns a time
        series per node plus 'time_h'. A node with no parents holds its
        initial value (or 0 if unspecified) for the whole horizon - it is a
        source, not something this graph explains.
        """
        n_steps = int(duration_h / dt_h) + 1
        times = np.arange(n_steps) * dt_h
        history = {name: np.zeros(n_steps) for name in self.nodes}
        for name, s0 in initial_severities.items():
            history[name][:] = s0 if name not in self._parents or not self._parents[name] else 0.0
            history[name][0] = s0

        for t_idx in range(1, n_steps):
            t = times[t_idx]
            for name in self.nodes:
                parents = self._parents.get(name, [])
                if not parents:
                    if name in initial_severities:
                        history[name][t_idx] = initial_severities[name]
                    else:
                        history[name][t_idx] = history[name][t_idx - 1]
                    continue
                total = 0.0
                for p in parents:
                    edge = self.edges[(p, name)]
                    t_delayed = t - edge.lag_h
                    if t_delayed < 0.0:
                        # Before the delay has elapsed, the parent's
                        # (possibly already-stepped) severity has not yet
                        # reached this node - assume pre-simulation baseline
                        # (0), not history[p][0] (which may already be the
                        # post-step value if the parent steps at t=0).
                        s_p_delayed = 0.0
                    else:
                        idx_delayed = min(int(t_delayed / dt_h), t_idx - 1)
                        s_p_delayed = history[p][idx_delayed]
                    total += edge.gain * s_p_delayed
                history[name][t_idx] = _sigmoid(total)

        return {"time_h": times, **history}

    def counterfactual_projection(
        self, initial_severities: dict[str, float], duration_h: float, dt_h: float, gain_overrides: dict[tuple[str, str], float]
    ) -> dict[str, np.ndarray]:
        """Re-run propagate() with temporarily modified edge gains (e.g. a
        reduced power setting damping a cascade) - the mechanism behind
        "recommend power reduction to 65%, extends time-to-limit to 3h"."""
        original_gains = {}
        for key, new_gain in gain_overrides.items():
            original_gains[key] = self.edges[key].gain
            self.edges[key].gain = new_gain
        try:
            return self.propagate(initial_severities, duration_h, dt_h)
        finally:
            for key, gain in original_gains.items():
                self.edges[key].gain = gain

    # ---------------------------------------------------------------
    # Edges that learn (eq 23.4)
    # ---------------------------------------------------------------

    def update_edge_confidence(self, src: str, dst: str, observed_effect: bool) -> None:
        """Beta-Bernoulli conjugate update: w_ij <- (alpha+n+)/(alpha+beta+n).
        Point gain estimate is kept as the posterior mean."""
        edge = self.edges[(src, dst)]
        if observed_effect:
            edge.alpha += 1.0
        else:
            edge.beta += 1.0
        edge.gain = edge.alpha / (edge.alpha + edge.beta)

    def record_maintenance_event(self, component_name: str) -> list[str]:
        """A replaced/serviced component resets: its own node's implicit
        health state (callers should reset any severity they track for it
        externally) and every edge confidence rooted at it (back to an
        uninformative Beta(1,1)) - so a maintenance-aware graph stops
        blaming a part that no longer exists in its degraded form. Returns
        the list of affected downstream node names, so callers can flag
        them for re-identification (Phase 9 self-calibration) on the next
        confirmed-normal window.
        """
        affected = list(self._children.get(component_name, []))
        for dst in affected:
            edge = self.edges[(component_name, dst)]
            edge.alpha, edge.beta = 1.0, 1.0
        return affected
