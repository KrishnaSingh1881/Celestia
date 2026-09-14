"""Pipeline stage data contracts (report section 27.4) - these ARE the
module boundaries, the literal interface chain:

CAN/serial  -> ingest    -> TelemetryFrame{t, channel[], quality[]}
TelemetryFrame -> context -> Context{alt, ias, phase, ambient, throttle}
+Context -> twin          -> Prediction{y_hat[], x_hat[], theta_hat[], P}
+Prediction -> residual   -> Residual{r[], z[], d2, S[], flags}
+Residual -> graph        -> Diagnosis{hypotheses[(cause, p, evidence[])]}
+Diagnosis -> prognosis   -> RUL{component, q05, q50, q95, driver}
+RUL -> mission           -> Risk{P_success, tier, recommended_action}
                             |
                    Dashboard . Reports . Logs

Every other pipeline module (twin/meanvalue.py, twin/residual.py, etc.) was
built before this file and returns plain dicts/dataclasses - contracts.py is
the typed boundary the backend (Phase 17) actually speaks, not a rewrite of
those modules' internals.
"""
from __future__ import annotations

from pydantic import BaseModel, Field


class TelemetryFrame(BaseModel):
    t: float = Field(description="seconds since mission/session start")
    channel: dict[str, float] = Field(default_factory=dict)
    quality: dict[str, float] = Field(default_factory=dict, description="1.0=good, 0.0=dropped/frozen, per channel")


class Context(BaseModel):
    altitude_m: float = 0.0
    airspeed_m_s: float = 0.0
    phase: str = "cruise"
    ambient_T_K: float = 288.15
    ambient_p_Pa: float = 101325.0
    throttle_pct: float = 100.0


class Prediction(BaseModel):
    y_hat: dict[str, float] = Field(default_factory=dict)
    x_hat: dict[str, float] = Field(default_factory=dict)
    theta_hat: dict[str, float] = Field(default_factory=dict)
    P_diag: dict[str, float] = Field(default_factory=dict, description="diagonal of the state covariance, per state name")


class Residual(BaseModel):
    r: dict[str, float] = Field(default_factory=dict)
    z: dict[str, float] = Field(default_factory=dict)
    d2: float = 0.0
    S_diag: dict[str, float] = Field(default_factory=dict)
    flags: dict[str, bool] = Field(default_factory=dict)


class Hypothesis(BaseModel):
    cause: str
    probability: float
    evidence: list[str] = Field(default_factory=list)


class Diagnosis(BaseModel):
    hypotheses: list[Hypothesis] = Field(default_factory=list)


class RUL(BaseModel):
    component: str
    q05_h: float
    q50_h: float
    q95_h: float
    driver: str


class Risk(BaseModel):
    P_success: float
    tier: str
    recommended_action: str
    authority: str = "crew decides"
    health_index: float = 100.0
