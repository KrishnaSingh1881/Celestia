"""Thin request/response wrappers around simengine.twin.contracts. These
exist only to shape the HTTP/WebSocket boundary (batch vs single ingest,
bundling every pipeline stage's output into one broadcast payload) - unit
normalization and channel aliasing happen in exactly ONE place
(IngestRequest below), not duplicated per endpoint or re-derived on the
frontend, unlike the three independent bar/kPa heuristics the
sihaimodel-main baseline had scattered across frontend and backend.
"""
from __future__ import annotations

from pydantic import BaseModel, Field

from simengine.twin.contracts import Context, Diagnosis, Prediction, Residual, Risk
from simengine.twin.contracts import RUL as ContractRUL


class IngestRequest(BaseModel):
    """A single telemetry sample plus its operating context. `channel` maps
    directly onto backend.app.pipeline.AVAILABLE_CHANNELS names (MAP, CHT,
    coolant_temp, oil_pressure, oil_temp, EGT_proxy, rpm) - any other key is
    accepted but ignored by the pipeline today."""

    t: float
    channel: dict[str, float]
    context: Context = Field(default_factory=Context)
    dt_s: float = 0.02


class IngestBatchRequest(BaseModel):
    frames: list[IngestRequest]


class PipelineResult(BaseModel):
    t: float
    prediction: Prediction
    residual: Residual
    diagnosis: Diagnosis
    rul: ContractRUL
    risk: Risk


class IngestResponse(BaseModel):
    results: list[PipelineResult]


class HealthResponse(BaseModel):
    status: str = "ok"
