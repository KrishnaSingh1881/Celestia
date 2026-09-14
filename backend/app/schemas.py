"""Thin request/response wrappers around simengine.twin.contracts. These
exist only to shape the HTTP/WebSocket boundary (batch vs single ingest,
bundling every pipeline stage's output into one broadcast payload) - unit
normalization and channel aliasing happen in exactly ONE place
(IngestRequest below), not duplicated per endpoint or re-derived on the
frontend, unlike the three independent bar/kPa heuristics the
sihaimodel-main baseline had scattered across frontend and backend.
"""
from __future__ import annotations

from typing import Literal

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


class GraphNode(BaseModel):
    id: str
    kind: str  # component | parameter | observable | context
    activation: float = 0.0  # latest diagnosis probability, if this node is a component


class GraphEdge(BaseModel):
    source: str
    target: str
    gain: float
    lag_h: float
    confidence: float  # Beta(alpha,beta) posterior mean, eq 23.4


class GraphTopologyResponse(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]


class HealthBreakdownResponse(BaseModel):
    health_index: float
    contributions: dict[str, float]  # per-channel deficit contribution, simengine.twin.health_index.decompose()


class MissionSegmentRequest(BaseModel):
    name: str
    duration_h: float
    power_pct: float = 100.0


class MissionPlanRequest(BaseModel):
    segments: list[MissionSegmentRequest]


class MissionSegmentResult(BaseModel):
    name: str
    duration_h: float
    power_pct: float
    survival_probability: float


class MissionPlanResponse(BaseModel):
    segments: list[MissionSegmentResult]
    overall_survival_probability: float
    overall_tier: str
    recommended_action: str
    total_duration_h: float


class FlightPhaseSpec(BaseModel):
    name: str
    duration_h: float = Field(gt=0)
    throttle_pct: float = Field(ge=0.0, le=100.0)


class FaultInjectionSpec(BaseModel):
    """Only two modes carry a real theta hook into simengine.twin.meanvalue
    (see backend/app/simulation.py's module docstring for why) - "none" is
    always available as the honest healthy-flight option."""

    mode: Literal["none", "cooling_degradation", "oil_pump_wear"] = "none"
    onset_frac: float = Field(default=0.3, ge=0.0, le=1.0)
    end_severity: float = Field(default=0.5, ge=0.0, le=1.0)
    shape: Literal["linear", "exponential", "step"] = "linear"


class FlightSimulationStartRequest(BaseModel):
    phases: list[FlightPhaseSpec]
    fault: FaultInjectionSpec = Field(default_factory=FaultInjectionSpec)
    real_seconds_per_sim_hour: float = Field(default=90.0, gt=0.0)


class FlightSimulationStatus(BaseModel):
    running: bool
    phase_name: str | None = None
    phase_index: int = 0
    phase_count: int = 0
    elapsed_h: float = 0.0
    total_h: float = 0.0
    progress_pct: float = 0.0
    fault_mode: str = "none"
    fault_severity: float = 0.0
    error: str | None = None
