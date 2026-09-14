# AeroTwin / Celestia — Demo Walkthrough

A narration script for a live demo, mirroring `sihaimodel-main/README.md`'s
narration pattern but describing the REAL pipeline built in
`simengine/` + `backend/` + `frontend/` (Phases 0–18 of
`docs/BUILD_ROADMAP.md`), not a scripted/canned prototype.

## Before you start

```bash
# terminal 1 - backend
cd uav-engine-twin
source .venv/bin/activate  # or: uv venv .venv && uv pip install -e ".[dev,backend]"
uvicorn backend.app.main:app --reload

# terminal 2 - frontend
cd uav-engine-twin/frontend
npm install
npm run dev
```

Open the printed frontend URL (typically `http://localhost:5173`).

## 0:00 — Open (problem framing)

*"MALE UAVs fly 15–30 hour missions with no in-flight maintenance. If the
piston engine develops a fault mid-mission, there's no mechanic to catch it.
Every number on this dashboard comes from an actual physics simulation of a
Rotax-914-class boosted boxer engine — a crank-angle-resolved thermodynamic
cycle model (Tier A) that calibrates to the manufacturer's three published
power ratings to within a couple of percent, and a real-time mean-value twin
(Tier B) derived from it that runs the live dashboard."*

## 0:20 — Show the dashboard is real, not scripted

*"Health index, mission survival probability, remaining useful life, and the
top diagnosis are all live — they come from a running FastAPI backend over a
WebSocket, not canned demo text. The 3D twin's crankshaft and propeller spin
at the backend's actual computed RPM and the reduction-gear ratio (2.43:1);
the cylinder head's thermal glow tracks the real predicted CHT."*

## 0:45 — Inject a real fault

```bash
# terminal 3 - feed a synthetic cooling_degradation fault to the running backend
curl -s -X POST http://localhost:8000/api/telemetry/ingest \
  -H "Content-Type: application/json" \
  -d '{"t": 0, "channel": {"MAP": 132000, "CHT": 410, "coolant_temp": 400,
       "oil_pressure": 300000, "oil_temp": 330, "EGT_proxy": 2100, "rpm": 5800},
       "context": {"throttle_pct": 100}}'
```

*"Watch the Health & RUL page: the health index drops, the ranked diagnosis
list (never a single verdict — always a probability-ranked list with
evidence) surfaces 'cooling degradation' as the leading hypothesis, and
Mission Control's tier escalates from Nominal toward Advisory or Caution.
Authority always stays with the crew — nothing in this system ever commands
an actuator; every recommendation is advisory only, all the way from the
detection layer up through the mission-risk tier classifier."*

## 1:30 — Why this is trustworthy, not just plausible

*"This isn't curve-fit to look right. Every physics module has an
independent regression test; the whole system passes five formal validation
gates from the underlying technical report — energy conservation closes to
about 0.0001% of fuel energy per cycle, the model reproduces three published
power ratings to a fraction of a percent, 18 of 21 named failure modes move
their predicted 'first mover' sensor in the correct direction, the real-time
twin agrees with the high-fidelity model within the report's stated
tolerances, and a small evaluation campaign confirms the diagnosis pipeline
correctly names the injected fault, not just detects that something is
wrong."*

## 2:15 — Close

*"210+ automated tests back every layer of this, from the raw thermodynamics
up through the causal health graph and mission-risk classifier. The next
steps are: extend real theta-parameter hooks for the remaining wired fault
modes so more of the fault library can be exercised end-to-end through the
live twin (today only cooling_degradation and oil_pump_wear have that),
build out the remaining dashboard pages (Sensors, Maintenance, Fault
Simulation, Settings — currently routed and lazy-loaded placeholders), and
calibrate the residual context-surfaces against real or campaign-generated
telemetry instead of the fixed placeholder sigmas used today."*

## What's genuinely real vs. still a placeholder (say this out loud if asked)

| Real, tested | Documented simplification |
|---|---|
| Tier A crank-resolved cycle, calibrated to Table 4 | eta_v(N) is an analytic proxy, not a fitted intake surface |
| Tier B mean-value twin, cross-validated vs Tier A (Gate 4) | Turbo shaft is a quasi-steady relaxation, not the literal (numerically stiff) inertial ODE |
| UKF, CUSUM/GLR/Mahalanobis detection, parity-space discrimination | Only 2 of 21 fault modes have a real theta hook to inject through the live twin today |
| Causal graph auto-built from fault_library.yaml | Edge gains start uninformative (Beta(1,1)); only refined by Beta-Bernoulli updates you run yourself |
| Health index, RUL (closed-form + particle filter), mission risk/go-no-go | Residual context-surfaces (mu_i(u)/sigma_i(u)) use fixed placeholder sigmas, not data fit from confirmed-normal telemetry |
