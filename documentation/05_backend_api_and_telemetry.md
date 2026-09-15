# Backend REST API & Telemetry Protocol Specification

## Overview

The backend application ([`backend/app/main.py`](file:///home/dushyant/uav-engine-twin/backend/app/main.py)) is implemented using **FastAPI** and **Uvicorn**. It wires the physics engine and digital twin into a unified pipeline ([`backend/app/pipeline.py`](file:///home/dushyant/uav-engine-twin/backend/app/pipeline.py)), providing REST endpoints for control/ingest and a WebSocket server for real-time telemetry streaming.

---

## Data Schemas & Pydantic Contracts

Defined in [`backend/app/schemas.py`](file:///home/dushyant/uav-engine-twin/backend/app/schemas.py) and [`simengine/twin/contracts.py`](file:///home/dushyant/uav-engine-twin/simengine/twin/contracts.py).

### Telemetry Frame Schema (`IngestRequest`)
```json
{
  "t": 12.5,
  "dt_s": 0.05,
  "channel": {
    "rpm": 5800.0,
    "MAP_Pa": 132000.0,
    "CHT_K": 385.2,
    "oil_temp_K": 365.1,
    "oil_press_Pa": 320000.0,
    "EGT_K": 1120.0
  },
  "context": {
    "altitude_m": 1500.0,
    "airspeed_m_s": 55.0,
    "phase": "cruise",
    "ambient_T_K": 278.4,
    "ambient_p_Pa": 84500.0,
    "throttle_pct": 85.0
  }
}
```

---

## REST API Endpoints

### 1. System Health Check
- **Endpoint**: `GET /api/health`
- **Response**:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "engine_model": "Rotax-914-Class MALE-UAV Twin"
}
```

### 2. Single Telemetry Ingest
- **Endpoint**: `POST /api/telemetry/ingest`
- **Payload**: `IngestRequest`
- **Response**: `IngestResponse` containing step result (`PipelineResult`).

### 3. Batch Telemetry Ingest
- **Endpoint**: `POST /api/telemetry/ingest/batch`
- **Payload**:
```json
{
  "frames": [ { ... }, { ... } ]
}
```
- **Response**: Array of execution step results.

### 4. Latest Pipeline Outputs
- `GET /api/diagnosis/latest`: Latest causal graph diagnosis hypothesis array.
- `GET /api/rul/latest`: Current remaining useful life predictions (\(q_{05}, q_{50}, q_{95}\)).
- `GET /api/mission-risk/latest`: Current mission survival probability and advisory tier.

### 5. Causal Graph Topology & Inference
- **Endpoint**: `GET /api/graph/topology`
- **Response**: Returns nodes, edges, edge confidence, and current node activation states.

### 6. Flight Simulation Controller
- `POST /api/simulation/start`: Starts real-time automated flight mission profile.
- `POST /api/simulation/stop`: Pauses current simulation run.
- `GET /api/simulation/status`: Returns current flight phase (`takeoff`, `climb`, `cruise`, `descent`, `landing`), altitude, and elapsed time.

### 7. Fault Injection Interface
- **Endpoint**: `POST /api/fault/inject`
- **Payload**:
```json
{
  "fault_name": "cooling_degradation",
  "severity": 0.35,
  "ramp_time_s": 10.0
}
```
- **Effect**: Updates session context overrides (`ctx.theta`) to simulate dynamic fault propagation.

---

## Real-Time WebSocket Telemetry Protocol

- **Endpoint**: `ws://<host>:<port>/ws/telemetry`
- **Protocol**: JSON text broadcast over WebSocket connection.
- **Heartbeat**: Every 30 seconds of inactivity, server sends heartbeat frame:
```json
{
  "heartbeat": true,
  "t": 1726410000.123
}
```

### Live Pipeline Broadcast Payload (`PipelineResult`)
```json
{
  "t": 125.4,
  "prediction": {
    "y_hat": { "CHT_K": 386.1, "oil_press_Pa": 318500.0 },
    "x_hat": { "p_MAP_Pa": 132000.0, "omega_engine_rad_s": 607.37 },
    "theta_hat": { "cooling_mult": 0.85 },
    "P_diag": { "p_MAP_Pa": 12.4 }
  },
  "residual": {
    "r": { "CHT_K": 14.2 },
    "z": { "CHT_K": 3.8 },
    "d2": 14.44,
    "S_diag": { "CHT_K": 1.0 },
    "flags": { "CHT_K": true }
  },
  "diagnosis": {
    "hypotheses": [
      {
        "cause": "cooling_degradation",
        "probability": 0.985,
        "evidence": ["CHT normalized residual z = 3.8", "Coolant temp offset = +12.1K"]
      }
    ]
  },
  "rul": {
    "component": "cooling_system",
    "q05_h": 4.2,
    "q50_h": 8.5,
    "q95_h": 14.1,
    "driver": "radiator_fouling"
  },
  "risk": {
    "P_success": 0.42,
    "tier": "Caution",
    "recommended_action": "Reduce cruise power to 65% to maintain head temperature within limits",
    "authority": "crew decides",
    "health_index": 71.4
  }
}
```
