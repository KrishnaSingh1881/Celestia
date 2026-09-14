"""Mission risk and the go/no-go recommendation. Report eq 26.1-26.3.

Hard constraint, enforced architecturally: nothing in this module (or
anywhere else in simengine) may return or trigger an actuator command.
Every output here is advisory text plus evidence, surfaced to a human -
authority stays with the crew across every tier (Table 12). Do not add a
function here that writes to, arms, or overrides any actuator/FADEC
interface.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

import numpy as np


def integrate_hazard(lambda_fn: Callable[[float], float], t_start: float, t_end: float, n_steps: int = 200) -> float:
    ts = np.linspace(t_start, t_end, n_steps)
    lambdas = np.array([lambda_fn(t) for t in ts])
    return float(np.trapezoid(lambdas, ts))


def mission_survival_probability(lambda_fn: Callable[[float], float], segment_boundaries: list[float]) -> float:
    """P_success = prod_s(exp(-integral_s(lambda dt))) = exp(-total hazard
    integral over the whole profile)  (eq 26.1). lambda = f_RUL/R for the
    governing component - risk and prognosis are the same model viewed two
    ways, so callers typically build lambda_fn from simengine.twin.rul's
    PDF/survival functions.
    """
    total_hazard = 0.0
    for i in range(len(segment_boundaries) - 1):
        total_hazard += integrate_hazard(lambda_fn, segment_boundaries[i], segment_boundaries[i + 1])
    return float(np.exp(-total_hazard))


def expected_cost_go(P_success: float, C_loss: float, C_op: float) -> float:
    return (1.0 - P_success) * C_loss + P_success * C_op


def expected_cost_nogo(C_abort: float, C_maint: float) -> float:
    return C_abort + C_maint


def recommend_go(P_success: float, C_loss: float, C_op: float, C_abort: float, C_maint: float) -> bool:
    """Go/no-go as an explicit, operator-adjustable cost comparison (eq
    26.2) - recommend GO iff E[C_go] < E[C_nogo]. This is a RECOMMENDATION
    returned as a bool for the caller to display; it must never be wired
    directly to any actuator or flight-control interface."""
    return expected_cost_go(P_success, C_loss, C_op) < expected_cost_nogo(C_abort, C_maint)


@dataclass
class AdvisoryTierResult:
    tier: str
    message: str
    authority: str


class AdvisoryTierClassifier:
    """Table 12, verbatim. Checked most-severe-first so the classifier
    returns the single most severe tier that applies, not the first one
    checked in an arbitrary order."""

    def classify(
        self,
        HI: float,
        persistent_residual: bool,
        coincidence_confirmed: bool,
        RUL_5pct_h: float,
        remaining_mission_h: float,
        cascade_projected_to_limit: bool,
        is_knock_or_oil_pressure_class: bool,
        dominant_channel: str | None = None,
    ) -> AdvisoryTierResult:
        if cascade_projected_to_limit or is_knock_or_oil_pressure_class:
            return AdvisoryTierResult(
                tier="Warning",
                message="Immediate recommended action, with reasoning",
                authority="crew decides",
            )
        if coincidence_confirmed and RUL_5pct_h < remaining_mission_h:
            return AdvisoryTierResult(
                tier="Caution",
                message="Projected exceedance time + counterfactual options",
                authority="crew decides",
            )
        if coincidence_confirmed and RUL_5pct_h >= remaining_mission_h:
            return AdvisoryTierResult(
                tier="Advisory",
                message="Ranked cause + recommended setting change",
                authority="crew decides",
            )
        if persistent_residual:
            channel = dominant_channel or "a channel"
            return AdvisoryTierResult(
                tier="Watch",
                message=f"{channel} drifting; no action",
                authority="none",
            )
        if HI > 90:
            return AdvisoryTierResult(
                tier="Nominal",
                message="Health index and trend only",
                authority="none",
            )
        return AdvisoryTierResult(tier="Watch", message="unclassified state, defaulting to Watch", authority="none")
