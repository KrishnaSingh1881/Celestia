"""Wires simengine's modules into the exact Appendix F pipeline chain
(simengine.twin.contracts): ingest -> context -> twin -> residual ->
estimator -> detection+discriminator -> graph -> health_index -> rul ->
mission_risk -> Risk.

Scope note (read before extending): this is a REFERENCE wiring
demonstrating the full chain end-to-end with the modules already built and
tested (Phases 1-16), not a fully-calibrated production diagnosis system.
In particular:
- Only the fault_library.yaml entries whose first_mover_channels intersect
  what simengine.twin.meanvalue.MeanValueTwin actually outputs today (MAP,
  CHT, coolant/oil temperature, oil pressure, an EGT proxy, rpm) are wired
  into the causal graph - faults needing per-cylinder EGT, vibration
  features, knock, or fuel-rail pressure (none of which Tier B produces yet)
  are left out, listed explicitly in UNAVAILABLE_FAULTS below rather than
  silently omitted.
- Per-channel healthy noise levels (NOMINAL_SIGMA) are representative
  placeholders (Appendix B/E magnitude order), not fit from real
  confirmed-normal telemetry (that fit is Phase 9/19's job, once real or
  campaign data exists).
- RUL/mission-risk numbers use a generic severity-to-drift mapping, not a
  per-fault-calibrated damage model.
"""
from __future__ import annotations

import numpy as np

from simengine.faults.library import load_fault_specs
from simengine.twin.contracts import (
    Context as ContractContext,
)
from simengine.twin.contracts import (
    Diagnosis,
    Hypothesis,
    Prediction,
    Residual,
    Risk,
)
from simengine.twin.contracts import RUL as ContractRUL
from simengine.twin.detection import CUSUMTracker, PersistenceTracker
from simengine.twin.graph import CausalHealthGraph
from simengine.twin.health_index import HealthIndex
from simengine.twin.meanvalue import Context as TwinContext
from simengine.twin.meanvalue import MeanValueTwin
from simengine.twin.mission_risk import AdvisoryTierClassifier, mission_survival_probability
from simengine.twin.rul import inverse_gaussian_rul_quantiles

AVAILABLE_CHANNELS = ["MAP", "CHT", "coolant_temp", "oil_pressure", "oil_temp", "EGT_proxy", "rpm"]

CHANNEL_ALIASES = {"boost_pressure": "MAP"}

NOMINAL_SIGMA = {
    "MAP": 0.02e5, "CHT": 3.0, "coolant_temp": 3.0, "oil_pressure": 0.1e5,
    "oil_temp": 3.0, "EGT_proxy": 15.0, "rpm": 20.0,
}

_ONSET_STRING_TO_HOURS = {
    "instant": 0.01, "seconds": 0.005, "min-h": 0.5, "slow-to-abrupt": 10.0, "any": 1.0,
}


def _edge_lag_hours(onset_timescale_hours) -> float:
    if isinstance(onset_timescale_hours, list):
        return float(onset_timescale_hours[0])
    return _ONSET_STRING_TO_HOURS.get(str(onset_timescale_hours), 1.0)


def api_context_to_twin_context(ctx: ContractContext, theta: dict | None = None) -> TwinContext:
    """Maps the API-facing Context (throttle_pct, altitude, ambient) onto
    the twin's internal Context (a commanded MAP + theta overrides). The
    throttle-to-MAP mapping is a simple linear interpolation between idle
    (~0.8 bar) and the take-off rated MAP (Appendix A, 1.32e5 Pa) - a
    reference/demo mapping, not a calibrated throttle map.
    """
    MAP_idle_Pa = 0.80e5
    MAP_full_Pa = 1.32e5
    throttle_frac = np.clip(ctx.throttle_pct / 100.0, 0.0, 1.0)
    MAP_command_Pa = MAP_idle_Pa + throttle_frac * (MAP_full_Pa - MAP_idle_Pa)
    return TwinContext(
        MAP_command_Pa=MAP_command_Pa,
        ambient_T_K=ctx.ambient_T_K,
        ambient_p_Pa=ctx.ambient_p_Pa,
        theta=theta or {},
    )


def build_graph_from_fault_library() -> tuple[CausalHealthGraph, dict[str, list[str]], list[str]]:
    """Returns (graph, fault_first_movers, unavailable_fault_names)."""
    graph = CausalHealthGraph()
    for channel in AVAILABLE_CHANNELS:
        graph.add_node(channel, "observable")

    fault_first_movers: dict[str, list[str]] = {}
    unavailable: list[str] = []
    for name, spec in load_fault_specs().items():
        movers = []
        for ch in spec.first_mover_channels:
            aliased = CHANNEL_ALIASES.get(ch, ch)
            if aliased in AVAILABLE_CHANNELS:
                movers.append(aliased)
        if not movers:
            unavailable.append(name)
            continue
        graph.add_node(name, "component")
        lag_h = _edge_lag_hours(spec.onset_timescale_hours)
        for ch in movers:
            graph.add_edge(name, ch, gain=1.0, lag_h=lag_h)
        fault_first_movers[name] = movers
    return graph, fault_first_movers, unavailable


class EngineSession:
    """One running diagnostic session: a live MeanValueTwin plus the
    detection/diagnosis state (CUSUM trackers, causal graph) that persists
    across calls to step()."""

    def __init__(self):
        self.twin = MeanValueTwin()
        self.graph, self.fault_first_movers, self.unavailable_faults = build_graph_from_fault_library()
        self.cusum = {ch: CUSUMTracker() for ch in AVAILABLE_CHANNELS}
        self.persistence = {ch: PersistenceTracker(n_required=3) for ch in AVAILABLE_CHANNELS}
        self.health_index = HealthIndex(weights={ch: 1.0 / len(AVAILABLE_CHANNELS) for ch in AVAILABLE_CHANNELS})

    def _predicted_channels(self, twin_ctx: TwinContext, rpm: float, MAP_Pa: float) -> dict[str, float]:
        surf = self.twin.surface.interpolate(rpm, MAP_Pa)
        return {
            "MAP": MAP_Pa,
            "CHT": self.twin.state.T_head_K,
            "coolant_temp": self.twin.state.T_coolant_K,
            "oil_pressure": self.twin.state.p_oil_Pa,
            "oil_temp": self.twin.state.T_oil_K,
            "EGT_proxy": surf["T_evo_K"],
            "rpm": rpm,
        }

    def step(self, measured_channels: dict[str, float], twin_ctx: TwinContext, dt_s: float) -> tuple[
        Prediction, Residual, Diagnosis, ContractRUL, Risk
    ]:
        state = self.twin.step(dt_s, twin_ctx)
        rpm = state["omega_engine_rad_s"] * 60.0 / (2.0 * np.pi)
        y_hat = self._predicted_channels(twin_ctx, rpm, state["p_MAP_Pa"])

        prediction = Prediction(y_hat=y_hat, x_hat=state, theta_hat=dict(twin_ctx.theta))

        r = {ch: measured_channels[ch] - y_hat[ch] for ch in measured_channels if ch in y_hat}
        z = {ch: r[ch] / NOMINAL_SIGMA.get(ch, 1.0) for ch in r}
        alarms = {ch: self.cusum[ch].update(z[ch]) for ch in z}
        persistent = {ch: self.persistence[ch].update(alarms[ch]) for ch in z}
        residual = Residual(r=r, z=z, d2=float(sum(v**2 for v in z.values())), flags=persistent)

        activated = {ch: persistent.get(ch, False) for ch in AVAILABLE_CHANNELS}
        n_hyp = len(self.fault_first_movers)
        hypotheses = []
        for fault_name, movers in self.fault_first_movers.items():
            prob_given_fault = {ch: (0.9 if ch in movers else 0.1) for ch in AVAILABLE_CHANNELS}
            prob_given_null = {ch: 0.05 for ch in AVAILABLE_CHANNELS}
            posterior = self.graph.hypothesis_posterior(1.0 / max(n_hyp, 1), activated, prob_given_fault, prob_given_null)
            evidence = [ch for ch, a in activated.items() if a]
            hypotheses.append(Hypothesis(cause=fault_name, probability=posterior, evidence=evidence))
        hypotheses.sort(key=lambda h: h.probability, reverse=True)
        diagnosis = Diagnosis(hypotheses=hypotheses[:5])

        top = hypotheses[0] if hypotheses else Hypothesis(cause="healthy", probability=0.0, evidence=[])
        confirmed = top.probability > 0.5 and len(top.evidence) > 0
        if confirmed:
            movers = self.fault_first_movers.get(top.cause, [])
            severity = float(np.mean([abs(z.get(ch, 0.0)) for ch in movers])) if movers else 0.0
            mu = 0.02 * max(severity, 0.1)
            quantiles = inverse_gaussian_rul_quantiles(D0=0.0, D_th=1.0, mu=mu, sigma_D=0.05)
            rul = ContractRUL(component=top.cause, q05_h=quantiles[0.05], q50_h=quantiles[0.5], q95_h=quantiles[0.95], driver=top.cause)
        else:
            rul = ContractRUL(component="engine", q05_h=1.0e4, q50_h=2.0e4, q95_h=3.0e4, driver="none")

        remaining_mission_h = 2.0
        hazard_rate = 1.0 / max(rul.q50_h, 1e-3)
        P_success = mission_survival_probability(lambda t: hazard_rate, [0.0, remaining_mission_h])

        HI = self.health_index.compute(z)
        tier_result = AdvisoryTierClassifier().classify(
            HI=HI,
            persistent_residual=any(persistent.values()),
            coincidence_confirmed=confirmed,
            RUL_5pct_h=rul.q05_h,
            remaining_mission_h=remaining_mission_h,
            cascade_projected_to_limit=False,
            is_knock_or_oil_pressure_class=("oil" in top.cause) if confirmed else False,
            dominant_channel=(top.evidence[0] if top.evidence else None),
        )
        risk = Risk(
            P_success=P_success, tier=tier_result.tier,
            recommended_action=tier_result.message, authority=tier_result.authority,
        )

        return prediction, residual, diagnosis, rul, risk
