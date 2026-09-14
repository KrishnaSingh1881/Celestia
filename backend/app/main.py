"""FastAPI service wrapping simengine's pipeline (backend.app.pipeline).

Tiering note (report section 27, Appendix F/Table 13): this single process
simulates every tier (Edge/GCS/Ground) for now - a real deployment would
split it across the aircraft, ground control station, and a fleet/ground
system per Table 13's rate column. Each route below is commented with the
tier and rate it corresponds to, so that split stays visible even though
this reference backend doesn't implement it.

Transport pattern (WebSocket broadcast hub + heartbeat, batch/single ingest
duality) follows sihaimodel-main/backend/app/main.py's proven shape, but
every route here calls backend.app.pipeline.EngineSession - never the old
RandomForest/reliability.py heuristics that prototype used.
"""
from __future__ import annotations

import asyncio
import time

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from backend.app.pipeline import EngineSession, api_context_to_twin_context
from backend.app.schemas import (
    FlightSimulationStartRequest,
    FlightSimulationStatus,
    GraphEdge,
    GraphNode,
    GraphTopologyResponse,
    HealthBreakdownResponse,
    HealthResponse,
    IngestBatchRequest,
    IngestRequest,
    IngestResponse,
    MissionPlanRequest,
    MissionPlanResponse,
    MissionSegmentResult,
    PipelineResult,
)
from backend.app.simulation import FlightPhase, FlightSimulator
from simengine.twin.meanvalue import Context as TwinContext
from simengine.twin.mission_risk import AdvisoryTierClassifier, mission_survival_probability

app = FastAPI(title="AeroTwin backend (Celestia SIH26054)")

# Local dev serves the frontend from a Vite dev server on a different origin
# (port, and sometimes 127.0.0.1 vs localhost) than this API - browsers
# enforce CORS on plain fetch()/XHR (WebSocket handshakes aren't subject to
# the same-origin fetch check, which is why REST calls needed this but the
# telemetry WS didn't). Wide open because this is a local reference backend,
# not a multi-tenant service.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Single global session (one engine, one diagnosis state) - see this
# module's docstring; a multi-aircraft deployment would key sessions by
# aircraft/tail number instead of using one process-wide instance.
_session = EngineSession()
_active_websockets: set[WebSocket] = set()
_latest_result: PipelineResult | None = None
_mission_plan: MissionPlanResponse | None = None


def _run_one(frame: IngestRequest) -> PipelineResult:
    twin_ctx = api_context_to_twin_context(frame.context)
    prediction, residual, diagnosis, rul, risk = _session.step(frame.channel, twin_ctx, frame.dt_s)
    return PipelineResult(t=frame.t, prediction=prediction, residual=residual, diagnosis=diagnosis, rul=rul, risk=risk)


async def _broadcast(result: PipelineResult) -> None:
    global _latest_result
    _latest_result = result
    dead = set()
    payload = result.model_dump_json()
    for ws in _active_websockets:
        try:
            await ws.send_text(payload)
        except Exception:
            dead.add(ws)
    _active_websockets.difference_update(dead)


def _reset_session_state() -> None:
    global _session, _latest_result, _mission_plan
    _session = EngineSession()
    _latest_result = None
    _mission_plan = None


def _simulation_on_step(measured: dict, twin_ctx: TwinContext, dt_s: float):
    """Runs on every fine simulation step - same EngineSession.step() call
    /api/telemetry/ingest uses, just called from the background flight-sim
    task instead of an HTTP request."""
    return _session.step(measured, twin_ctx, dt_s)


async def _simulation_on_broadcast(t: float, pipeline_result) -> None:
    prediction, residual, diagnosis, rul, risk = pipeline_result
    result = PipelineResult(t=t, prediction=prediction, residual=residual, diagnosis=diagnosis, rul=rul, risk=risk)
    await _broadcast(result)


_flight_sim = FlightSimulator(on_step=_simulation_on_step, on_broadcast=_simulation_on_broadcast)


# Edge tier, up to the twin's own rate (20-50Hz per Table 13) in a real
# deployment; here, whatever rate the caller posts frames at.
@app.get("/api/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse()


@app.post("/api/telemetry/ingest", response_model=IngestResponse)
async def ingest_single(frame: IngestRequest) -> IngestResponse:
    result = _run_one(frame)
    await _broadcast(result)
    return IngestResponse(results=[result])


@app.post("/api/telemetry/ingest/batch", response_model=IngestResponse)
async def ingest_batch(batch: IngestBatchRequest) -> IngestResponse:
    results = []
    for frame in batch.frames:
        result = _run_one(frame)
        results.append(result)
        await _broadcast(result)
    return IngestResponse(results=results)


# GCS tier (causal graph/RUL, 0.1-1Hz / per-minute per Table 13) - a real
# split would compute these on the ground side from telemetry the edge
# already reduced; here they are simply the last ingested result's fields.
@app.get("/api/diagnosis/latest")
async def diagnosis_latest():
    if _latest_result is None:
        return {"hypotheses": []}
    return _latest_result.diagnosis.model_dump()


@app.get("/api/rul/latest")
async def rul_latest():
    if _latest_result is None:
        return None
    return _latest_result.rul.model_dump()


@app.get("/api/mission-risk/latest")
async def mission_risk_latest():
    if _latest_result is None:
        return None
    return _latest_result.risk.model_dump()


@app.websocket("/ws/telemetry")
async def ws_telemetry(websocket: WebSocket):
    await websocket.accept()
    _active_websockets.add(websocket)
    try:
        while True:
            # Heartbeat: if the client sends nothing for a while, a recv
            # timeout lets us notice a dead connection without blocking
            # broadcasts to everyone else.
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
            except asyncio.TimeoutError:
                await websocket.send_text('{"heartbeat": true, "t": %f}' % time.time())
    except WebSocketDisconnect:
        pass
    finally:
        _active_websockets.discard(websocket)


@app.post("/api/session/reset")
async def reset_session():
    """Starts a fresh EngineSession (new twin state, cleared detection
    trackers) - useful between demo scenarios. Also stops any running
    flight simulation, since it would otherwise keep driving the session
    that was just reset out from under it."""
    await _flight_sim.stop()
    _reset_session_state()
    return {"status": "reset"}


# GCS tier (causal graph inference, 0.1-1Hz per Table 13) - the graph
# TOPOLOGY itself changes rarely (only when record_maintenance_event() runs),
# so this is safe to poll at a low rate from the frontend; per-node
# `activation` is refreshed from whatever the latest diagnosis found.
@app.get("/api/graph/topology", response_model=GraphTopologyResponse)
async def graph_topology() -> GraphTopologyResponse:
    graph = _session.graph
    activation: dict[str, float] = {}
    if _latest_result is not None:
        for hyp in _latest_result.diagnosis.hypotheses:
            activation[hyp.cause] = hyp.probability

    nodes = [
        GraphNode(id=name, kind=node.kind, activation=activation.get(name, 0.0))
        for name, node in graph.nodes.items()
    ]
    edges = [
        GraphEdge(
            source=edge.src, target=edge.dst, gain=edge.gain, lag_h=edge.lag_h,
            confidence=edge.alpha / (edge.alpha + edge.beta),
        )
        for edge in graph.edges.values()
    ]
    return GraphTopologyResponse(nodes=nodes, edges=edges)


# GCS tier - health index decomposition is derived from the latest residual,
# already computed by the edge-tier twin step; this just re-exposes it.
@app.get("/api/health/breakdown", response_model=HealthBreakdownResponse)
async def health_breakdown() -> HealthBreakdownResponse:
    if _latest_result is None:
        return HealthBreakdownResponse(health_index=100.0, contributions={})
    contributions = _session.health_index.decompose(_latest_result.residual.z)
    return HealthBreakdownResponse(
        health_index=_latest_result.risk.health_index, contributions=contributions
    )


# GCS tier (mission simulation/what-if, on-demand per Table 13). This is a
# RISK ASSESSMENT for a planned profile (report eq 26.1-26.2), not a live
# lat/lon flight simulator - it reuses the CURRENT engine's RUL as the
# hazard driver for every segment, scaled by that segment's planned power
# setting (a simple linear proxy: higher power -> higher wear/hazard rate).
@app.post("/api/mission/plan", response_model=MissionPlanResponse)
async def mission_plan(request: MissionPlanRequest) -> MissionPlanResponse:
    global _mission_plan
    rul_q50_h = _latest_result.rul.q50_h if _latest_result is not None else 200.0
    rul_q05_h = _latest_result.rul.q05_h if _latest_result is not None else 100.0
    health_index = _latest_result.risk.health_index if _latest_result is not None else 100.0
    hazard_rate = 1.0 / max(rul_q50_h, 1e-3)

    boundaries = [0.0]
    seg_results: list[MissionSegmentResult] = []
    for seg in request.segments:
        t0 = boundaries[-1]
        t1 = t0 + seg.duration_h
        boundaries.append(t1)
        power_mult = max(seg.power_pct, 1.0) / 100.0
        seg_survival = mission_survival_probability(lambda _t: hazard_rate * power_mult, [t0, t1])
        seg_results.append(
            MissionSegmentResult(
                name=seg.name, duration_h=seg.duration_h, power_pct=seg.power_pct,
                survival_probability=seg_survival,
            )
        )

    overall_survival = 1.0
    for seg_result in seg_results:
        overall_survival *= seg_result.survival_probability
    total_duration_h = boundaries[-1]

    tier_result = AdvisoryTierClassifier().classify(
        HI=health_index,
        persistent_residual=False,
        coincidence_confirmed=False,
        RUL_5pct_h=rul_q05_h,
        remaining_mission_h=total_duration_h,
        cascade_projected_to_limit=False,
        is_knock_or_oil_pressure_class=False,
    )

    _mission_plan = MissionPlanResponse(
        segments=seg_results, overall_survival_probability=overall_survival,
        overall_tier=tier_result.tier, recommended_action=tier_result.message,
        total_duration_h=total_duration_h,
    )
    return _mission_plan


@app.get("/api/mission/plan")
async def get_mission_plan():
    if _mission_plan is None:
        return None
    return _mission_plan.model_dump()


# Edge tier - drives a real scripted flight (phase-by-phase throttle profile,
# optional ramping fault) through the SAME EngineSession.step() + WebSocket
# broadcast path /api/telemetry/ingest uses (see backend/app/simulation.py's
# module docstring). Starting a new simulation resets the session first, so
# a run always begins from a clean, unflagged state.
@app.post("/api/simulation/start", response_model=FlightSimulationStatus)
async def simulation_start(request: FlightSimulationStartRequest) -> FlightSimulationStatus:
    if not request.phases:
        raise HTTPException(status_code=422, detail="at least one flight phase is required")
    _reset_session_state()
    phases = [FlightPhase(name=p.name, duration_h=p.duration_h, throttle_pct=p.throttle_pct) for p in request.phases]
    await _flight_sim.start(
        phases=phases,
        fault_mode=request.fault.mode,
        fault_onset_frac=request.fault.onset_frac,
        fault_end_severity=request.fault.end_severity,
        fault_shape=request.fault.shape,
        real_seconds_per_sim_hour=request.real_seconds_per_sim_hour,
    )
    return FlightSimulationStatus(**_flight_sim.status())


@app.post("/api/simulation/stop", response_model=FlightSimulationStatus)
async def simulation_stop() -> FlightSimulationStatus:
    await _flight_sim.stop()
    return FlightSimulationStatus(**_flight_sim.status())


@app.get("/api/simulation/status", response_model=FlightSimulationStatus)
async def simulation_status() -> FlightSimulationStatus:
    return FlightSimulationStatus(**_flight_sim.status())
