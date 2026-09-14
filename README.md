# AeroTwin / Celestia (SIH26054)

A physics-grounded digital twin for a MALE-UAV aero piston engine: a
crank-angle-resolved thermodynamic cycle model, a real-time mean-value twin,
UKF state estimation, fault detection/diagnosis, a causal health graph,
remaining-useful-life and mission-risk estimation, a FastAPI backend, and a
React/TypeScript frontend.

Built phase-by-phase from `docs/BUILD_ROADMAP.md`, itself derived from the
technical report `research/Celestia_SIH26054_Engine_Physics_and_Simulation_Engine.html`
(kept local-only, not part of this repo's history — see that doc's own
appendices for the equations/constants transcribed out of it).

## Quick start

```bash
# 1. Python environment (simengine + backend)
uv venv .venv
uv pip install --python .venv -e ".[dev,backend]"

# 2. Run the backend
.venv/bin/uvicorn backend.app.main:app --reload
# -> http://localhost:8000 (docs at /docs, health at /api/health)

# 3. Run the frontend (separate terminal)
cd frontend
npm install
npm run dev
# -> http://localhost:5173
```

See `docs/DEMO_SCRIPT.md` for a guided walkthrough, including how to inject
a synthetic fault and watch the dashboard respond.

## Running the tests

```bash
.venv/bin/pytest simengine/ backend/ -q
```

210+ tests across the physics core, calibration, the five report validation
gates, fault injection, sensor emulation, the real-time twin, state
estimation/detection/diagnosis, the causal graph/health index/RUL/mission
risk, and the backend pipeline/API.

## Layout

```
simengine/    Python physics/estimation/diagnosis engine (Phases 0-16)
backend/      FastAPI service wiring simengine into one pipeline (Phase 17)
frontend/     React + strict TypeScript dashboard (Phase 18)
docs/         BUILD_ROADMAP.md (the phase-by-phase spec) and DEMO_SCRIPT.md
research/     local-only reference material (not tracked in this repo)
sihaimodel-main/  local-only UI/UX baseline this frontend's IA was informed by (not tracked)
```

## Status

All 19 phases of `docs/BUILD_ROADMAP.md` are implemented. Honest scope notes
on what's a real, validated model vs. a documented placeholder live in each
module's own docstring — start with `docs/DEMO_SCRIPT.md`'s summary table,
`backend/app/pipeline.py`'s module docstring, and `simengine/twin/meanvalue.py`'s.
