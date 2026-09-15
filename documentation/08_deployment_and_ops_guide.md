# Deployment & Operations Guide

## Overview

This guide details environment setup, execution management, configuration parameters, and operational limitations for the AeroTwin digital twin platform.

---

## Prerequisites & Dependencies

- **Python**: Python 3.14 (or Python 3.11+) with `uv` package manager.
- **Node.js**: Node.js 18+ and `npm`.
- **Operating System**: Linux (Ubuntu 22.04+ recommended) or macOS.

---

## Quick Start (One Command)

The workspace includes a unified launcher script [`start.sh`](file:///home/dushyant/uav-engine-twin/start.sh):

```bash
# Make executable (if needed) and run
chmod +x ./start.sh
./start.sh
```

### What `start.sh` does automatically:
1. Checks for Python `.venv`; creates it via `uv venv .venv` if missing.
2. Installs Python packages in editable mode: `uv pip install -e ".[dev,backend]"`.
3. Checks `frontend/node_modules`; runs `npm install` inside `frontend/` if missing.
4. Starts FastAPI backend service on `http://127.0.0.1:8000` via Uvicorn.
5. Starts Vite frontend dev server on `http://127.0.0.1:5173`.
6. Handles `SIGINT` / `Ctrl+C` to cleanly terminate both processes.

### Customizing Host & Ports
Override default ports via environment variables:

```bash
BACKEND_PORT=8001 FRONTEND_PORT=5174 ./start.sh
```

---

## Manual Execution (Step-by-Step)

If running in separate terminals or containerized environments:

### Step 1: Virtual Environment & Backend
```bash
# 1. Create and activate virtual environment
uv venv .venv
source .venv/bin/activate

# 2. Install Python dependencies
uv pip install -e ".[dev,backend]"

# 3. Launch FastAPI backend
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```
- API Health Check: `http://127.0.0.1:8000/api/health`
- OpenAPI Docs: `http://127.0.0.1:8000/docs`

### Step 2: Frontend Dashboard
```bash
# In a separate terminal
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```
- Dashboard URL: `http://127.0.0.1:5173`

---

## Key Configuration Files

1. **[`simengine/config/engine_seed_params.yaml`](file:///home/dushyant/uav-engine-twin/simengine/config/engine_seed_params.yaml)**:
   - Contains geometric constants (bore, stroke, conrod), literature physical constants (gas constant, LHV, stoich AFR), and fitted baseline parameters (wall temperature, ignition timing, Chen-Flynn coefficients).
2. **[`simengine/config/fault_library.yaml`](file:///home/dushyant/uav-engine-twin/simengine/config/fault_library.yaml)**:
   - Contains definitions for all 21 physical fault modes, parameter mapping paths, and causal graph edge definitions.

---

## Operational Limitations & Known Scope Boundaries

> [!NOTE]
> For complete transparency, the following technical limits exist in the current software baseline:
> 
> 1. **Fault Model Hooks**: Today, 2 of the 21 physical fault modes (`cooling_degradation` and `oil_pump_wear`) have fully calibrated parameters driving the live Tier B ODE twin end-to-end. The remaining 6 wired into the causal graph have first-mover channels, while 13 require future sensor channel additions (per-cylinder EGT, vibration spectra).
> 2. **Turbocharger Shaft Dynamics**: The turbocharger uses a quasi-steady relaxation model to maintain numerical stability at 20–50 Hz without stiff multi-rate sub-stepping.
> 3. **Single Process Deployment**: In this reference implementation, Edge, GCS, and Ground analytics run within a single Python process. In field production, Tier B runs on edge hardware while causal graph inference runs on GCS servers.
