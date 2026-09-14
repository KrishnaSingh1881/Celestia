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

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from backend.app.pipeline import EngineSession, api_context_to_twin_context
from backend.app.schemas import (
    HealthResponse,
    IngestBatchRequest,
    IngestRequest,
    IngestResponse,
    PipelineResult,
)

app = FastAPI(title="AeroTwin backend (Celestia SIH26054)")

# Single global session (one engine, one diagnosis state) - see this
# module's docstring; a multi-aircraft deployment would key sessions by
# aircraft/tail number instead of using one process-wide instance.
_session = EngineSession()
_active_websockets: set[WebSocket] = set()
_latest_result: PipelineResult | None = None


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
    trackers) - useful between demo scenarios."""
    global _session, _latest_result
    _session = EngineSession()
    _latest_result = None
    return {"status": "reset"}
