# AeroTwin / Celestia (SIH26054) — Build Roadmap

This document is the single source of truth for building the UAV aero-piston-engine
digital twin described in `research/Celestia_SIH26054_Engine_Physics_and_Simulation_Engine.html`.
It turns that 29-section technical report, its companion reference script
`research/celestia_cycle_model_reference.py`, and the existing UI/UX prototype at
`sihaimodel-main/` into an ordered list of small, unambiguous build phases.

**Audience**: an AI coding agent executing this repo phase by phase. Every phase is
self-contained: it names exact files, exact function signatures, exact equations,
exact constants, and an exact "definition of done" test. Do not skip ahead, do not
invent file paths or names not listed here, do not merge phases.

---

## 0. Rules for the executing agent

1. **Never edit anything under `research/` or `sihaimodel-main/`.** Both are read-only
   references: `research/` is the requirement spec, `sihaimodel-main/` is the UI/UX and
   tech-stack baseline (it is git-ignored — it is not part of this project's history).
   Read from them, copy patterns from them, never modify them.
2. All new code goes in exactly four new top-level directories, created in this order
   over the phases below: `simengine/` (Python physics/estimation/diagnosis engine),
   `backend/` (FastAPI service wrapping `simengine`), `frontend/` (React app),
   `docs/` (this file and its companions).
3. Work through phases **in numeric order**. Each phase lists a "Depends on" line —
   do not start a phase whose dependency phase has not passed its Definition of Done.
4. After finishing a phase: run the tests named in that phase's "Definition of Done",
   confirm they pass, then move to the next phase. If a test cannot pass, stop and fix
   the current phase — do not proceed with a failing phase.
5. Every equation in this document is given exactly as derived in the source report.
   Implement them exactly as written — do not "simplify" or substitute an
   approximation you consider equivalent.
6. Units: SI everywhere internally (meters, kilograms, seconds, kelvin, pascals,
   radians). Convert to display units (bar, °C, rpm, degrees CA) only at the
   API/UI boundary, never inside physics code.
7. Python: 3.10+. Core dependencies: `numpy`, `scipy`, `pydantic` (v2), `pyyaml`,
   `fastapi`, `uvicorn`, `pytest`. Do not add other numerical/ML frameworks unless a
   phase explicitly calls for one.
8. Every module gets a `tests/test_<module>.py` in the same phase it is created —
   never defer tests to a later phase.
9. Commit at the end of every phase with a message naming the phase number and title.

---

## 1. Target repository layout

Build toward exactly this structure (directories created incrementally, phase by
phase — this is the map, not a step to do all at once):

```
uav-engine-twin/
  research/                         # existing, read-only spec — do not touch
  sihaimodel-main/                  # existing, read-only UI baseline — do not touch
  docs/
    BUILD_ROADMAP.md                # this file
    engine_seed_params.md           # Appendix A, mirrored as data
  simengine/
    config/
      engine_seed_params.yaml       # Table 15
      fault_library.yaml            # Table 6
    engine/
      geometry.py                   # 3.1-3.5
      thermo.py                     # gamma_of_T, cv
      combustion.py                 # 4.1-4.5
      heat.py                       # 5.1-5.7
      flow.py                       # 6.1-6.4
      turbo.py                      # 6.5-6.7
      atmosphere.py                 # 6.8 ISA
      friction.py                   # 7.1-7.4 Chen-Flynn
      dynamics.py                   # 7.5-7.6 crank/prop
      cycle.py                      # Phase 5 addition: assembles geometry/
                                     # thermo/combustion/heat/flow/friction
                                     # into one closed-cycle (IVC->EVO) Tier A
                                     # run via solver.py's RK4 - this is what
                                     # test_tier_a_regression.py exercises
      lube.py                       # 8.1-8.5
      vibration.py                  # 9.1-9.4
      degradation.py                # 10.1-10.6
      solver.py                     # multi-rate integration, Table 9
    faults/
      library.py                    # loads fault_library.yaml
      injector.py                   # 16.1-16.2 severity shapes + parameter mapping
      campaign.py                   # 16.3 LHS DOE campaign generator
    sensors/
      emulate.py                    # 17.1, Table 11 corruption stages
      bus.py                        # CAN-like framing
    calibration/
      calibrate.py                  # 15.1-15.3 LM fit + SVD identifiability
    validation/
      test_gate1_conservation.py
      test_gate2_external_anchors.py
      test_gate3_sensitivity_sanity.py
      test_gate4_cross_model_agreement.py
      gate5_external_dataset_transfer.py
    twin/
      meanvalue.py                  # 13.1, Tier B 9-12 state ODE system
      residual.py                   # 19.1-19.2
      estimator.py                  # 20.1-20.6 UKF + learned correction
      detection.py                  # 21.1-21.5
      discriminator.py              # 22.1-22.3 parity relations
      graph.py                      # 23.1-23.4 causal health graph
      health_index.py               # 24.1-24.2
      rul.py                        # 25.1-25.5
      mission_risk.py               # 26.1-26.3
      contracts.py                  # 27.4 pipeline data contracts (pydantic)
    tests/
      test_<module>.py              # one per module above, created alongside it
  backend/
    app/
      main.py                       # FastAPI service, WebSocket hub
      pipeline.py                   # wires simengine stages per 27.4 contract chain
      schemas.py                    # API request/response models
    requirements.txt
  frontend/
    (React + Vite app; layout mirrors sihaimodel-main/frontend, see Phase 18)
```

---

## Appendix A — Reference engine & seed parameters (Table 1 + Table 15)

Reference engine: Rotax 914-class, turbocharged 4-cylinder horizontally-opposed,
4-stroke spark-ignition, automatic wastegate (TCU-controlled).

| Parameter | Symbol | Value |
|---|---|---|
| Bore | B | 0.0795 m |
| Stroke | S | 0.0610 m |
| Connecting rod length | l (lrod) | 0.1115 m |
| Number of cylinders | ncyl | 4 |
| Compression ratio | r_c | 9.0 |
| Displacement per cylinder | V_d,cyl | 302.8 cm³ (derived: π/4·B²·S) |
| Total displacement | V_d,tot | 1211.2 cm³ |
| Clearance volume | V_c | 37.9 cm³ (derived: V_d,cyl/(r_c−1)) |
| Gas constant | R_g | 287.0 J/kg·K |
| Fuel LHV | LHV | 43.5e6 J/kg (avgas/mogas) |
| IVC / EVO | — | −140° / +140° ATDC |
| Wiebe shape a_w, m_w | a_w, m_w | 5.0, 2.0 |
| Burn duration | Δθ (dth_burn) | 60° CA (fitted) |
| Ignition timing | θ0 (th_ign) | −22° ATDC (fitted) |
| Combustion efficiency | η_c (eta_c) | 0.94 × O2-limit (fitted, bounded) |
| Woschni C1 | C1 | 2.28 |
| Woschni C2 | C2 | 3.24e-3 |
| Wall temperature | T_wall | 450 K (node-coupled in full model) |
| Chen–Flynn A_f | A | 0.90e5 Pa |
| Chen–Flynn B_f | Bc | 0.012 |
| Chen–Flynn C_f | Cc | 2.0e3 |
| Chen–Flynn D_f | Dc | 120.0 |
| λ take-off | lam | 0.85 |
| λ cruise | lam | 0.95 |
| Stoichiometric AFR | AFRs | 14.6 |
| MAP take-off | MAP | 1.32e5 Pa (39 inHg) |
| MAP max continuous | MAP | 1.20e5 Pa (35.4 inHg) |
| MAP 75% cruise | MAP | 1.05e5 Pa |
| Reduction gearbox ratio | i | 2.43 |
| TBO | — | 2000 h |
| Integration step (Tier A) | Δθ | 0.2° CA, RK4 |
| CUSUM slack / threshold | k_slack, h | 0.5σ, 6.0 |
| Critical altitude | — | ≈4500 m |
| PMEP (assumed) | pmep | 0.25e5 Pa |

**Rated points (calibration anchors — Table 4, must reproduce to within these exact
errors)**:

| Rating | rpm | MAP | λ | Published power | Model power | Error |
|---|---|---|---|---|---|---|
| Take-off | 5800 | 1.32 bar | 0.85 | 84.5 kW | ≈83.9 kW | −0.7% |
| Max continuous | 5500 | 1.20 bar | 0.88 | 73.5 kW | ≈71.7 kW | −2.5% |
| 75% cruise | 5000 | 1.05 bar | 0.95 | 55.1 kW | ≈56.3 kW | +2.2% |

Peak torque 144 N·m @ 4900 rpm (shape check only, not a fit target). BSFC must land
in 240–300 g/kWh across these points. Peak cylinder pressure must land in 50–75 bar.
EGT at high power ≈850–900°C.

---

## Appendix B — Sensor set (Table 3)

| Signal | Rate | Role |
|---|---|---|
| Crank position/RPM | 1/rev events | independent variable of cycle model |
| MAP/boost | 20–50 Hz | trapped-mass boundary condition |
| IAT/airbox temp | 1–5 Hz | charge density, knock margin |
| CHT ×4 (per cylinder) | 1–5 Hz | thermal node output, per-cyl asymmetry |
| EGT ×4 (per cylinder) | 1–5 Hz | combustion phasing/completeness |
| Oil pressure | 5–10 Hz | pump–circuit balance, bearing-clearance proxy |
| Oil temperature | 1 Hz | viscosity → film thickness |
| Coolant temperature | 1 Hz | cooling-circuit effectiveness |
| Fuel pressure & flow | 5–10 Hz | equivalence ratio, energy input |
| Throttle position | 10–20 Hz | context |
| Ambient pressure & temp | 1 Hz | context, corrects every baseline |
| Vibration (3-axis) | 1 kHz raw → 1–2 Hz features | misfire/bearing/gear-mesh |
| Knock | event-gated | detonation margin |

Vibration DSP (FFT + envelope) must run on the edge node — never stream raw
vibration off the aircraft. Output is a 15–25 element feature vector at 1–2 Hz
(see Appendix, Phase 7).

Three sensor-failure classes (used by the discriminator in Phase 15):
Type 1 = control info lost (self-evident); Type 2 = dangerous condition hidden
(sensor plausible while real quantity is out of limits — this is the class
analytical redundancy exists to catch); Type 3 = monitoring lost only.

---

## Appendix C — Fault library (Table 6, 21 modes + sensor faults)

Every row becomes one entry in `simengine/config/fault_library.yaml`.
Format per entry: `{name, parameter_path, equation_ref, first_mover_channels,
discriminator_rule, onset_timescale}`.

| name | parameter perturbed | eq | first mover | discriminator | onset |
|---|---|---|---|---|---|
| cooling_degradation | h_ext·A ↓ | 5.4 | coolant & CHT ↑ together | EGT ≈ 0 | 10–100 h |
| charge_air_cooling_loss | intercooler ε ↓ | 6.5 | IAT ↑ | boost normal, knock integral ↑ | 10–100 h |
| injector_clogging | C_dA_inj ↓ (one cyl) | 4.3, 6.2 | per-cyl EGT split | rail pressure high, flow low | 1–20 h |
| fuel_pump_degradation | Q_pump ↓ | 8.1 | rail pressure ↓ | all cylinders equal, λ ↑ | 1–50 h |
| fuel_restriction | R_h ↑ | 6.2 | pressure ↓ with flow ↓ | move together | min–h |
| ignition_weakening | Δθ ↑ | 4.1 | EGT ↑, p_max ↓ | blow-by flat | 10–200 h |
| misfire | x_b ≡ 0 | 4.1 | 0.5× vibration order | locked to one cylinder phase | instant |
| detonation_knock | I_k → 1 | 4.5 | knock band energy | CHT ↑, EGT down | seconds |
| ring_bore_wear | C_dA_bb ↑ | 6.4 | p_max ↓ | EGT ↑ + oil consumption + crankcase pressure ↑ | 100–1000 h |
| valve_leakage | C_dA_leak ↑, η_v ↓ | 6.1, 6.4 | η_v ↓ at fixed MAP | single-cyl EGT ↑, no crankcase signal | 50–500 h |
| valve_timing_drift | IVC/EVO shift | 3.2, 6.1 | η_v-vs-speed shape | speed- not load-dependent | 200–1000 h |
| turbo_compressor_fouling | η_c ↓ | 6.5 | boost deficit | outlet temp ↑ at same pressure ratio | 50–500 h |
| turbo_bearing_wear | η_m ↓ | 6.7 | spool-up time ↑ | transient only | 20–200 h |
| wastegate_sticking | C_dA_wg frozen | 6.2 | MAP residual | boost doesn't track throttle | instant |
| oil_pump_wear | η_vol ↓ | 8.1 | oil pressure ↓ | scales with speed, temp-independent | 100–1000 h |
| oil_leak | mass ↓ | 8.1, 8.5 | pressure ↓ AND temp ↑ | both move together | min–h |
| oil_degradation | K, θ1 shift | 8.3 | pressure-temp curve departs | neither alone out-of-limits | 100–500 h |
| gallery_blockage | local R_h ↑ | 8.2 | pressure UP | counter-intuitive sign (rises, not falls) | hours |
| main_rod_bearing_wear | c ↑, B_f, C_f ↑ | 7.3, 8.4 | pressure ↓ + temp ↑ + 1× vibration ↑ | 3-channel coincidence | 50–500 h |
| gearbox_tooth_wear | η_g ↓ | 7.5, 9.2 | mesh sidebands ↑ | engine-side clean | 100–1000 h |
| crank_rod_fatigue | stiffness/balance shift | 10.4 | 1×, 2× order growth | no thermal/flow residual | slow → abrupt |
| sensor_drift_bias_stuck | observation model only, no true-state change | 17.1 | one residual moves | coupled channels stay silent (Phase 15 discriminator) | any |

Discriminators are almost always a **relationship between two channels**, not a
level on one — build the discriminator field as a rule referencing ≥2 channels
wherever the table shows one.

---

## Appendix D — DOE campaign axes (Table 10, for the fault-injection campaign)

| Axis | Type | Range/levels |
|---|---|---|
| Fault mode | categorical | 21 rows of Appendix C + healthy |
| Severity end-state | continuous | 2%–60% of parameter range |
| Onset time | continuous | 0–0.9× mission duration |
| Growth shape | categorical | linear / exponential / step |
| Cruise altitude | continuous | 8,000–25,000 ft |
| ISA offset | continuous | −20 to +25 K |
| Power setting | continuous | 55–100% continuous |
| Engine age (initial ϑ) | continuous | 0–1800 h equivalent |
| Sensor nuisance | categorical | none / drift / bias / noise↑ / dropout |
| Multi-fault | categorical | single / two concurrent / fault+sensor fault |

Target campaign size: **9,000–12,000 missions**, sampled via Latin hypercube on
continuous axes + stratified on categorical axes. ~**1/3 of the campaign** must be
contaminated with a concurrent sensor-nuisance fault (this is what teaches Phase 15's
discriminator to separate sensor lies from real faults).

---

## Appendix E — Sensor corruption model (Table 11, eq 17.1)

`y_k = γ_s · h(x_{k−d}) + (b0 + β_d·t_k) + q(·) + v_k`, `v_k ~ N(0, σ_s²)`

| Effect | Model | Typical magnitude |
|---|---|---|
| Thermocouple lag | 1st-order, time constant τ_s | 1–4 s (EGT), 5–20 s (CHT) |
| Random noise | Gaussian | 0.5–2 K, 0.2% FS pressure |
| Bias | constant offset | ±2 K, ±1% FS |
| Drift | ramp or random walk | 0.2–2 K/h |
| Quantization | ADC resolution | 10–12 bit |
| Bus latency & jitter | delay d + jitter | 2–20 ms |
| Dropout | Bernoulli gaps | 0.1–2% of frames |
| Stuck/frozen | hold last value | — (dangerous Type-2 failure) |
| Gain error | scale factor | ±3% |

---

## Appendix F — Deployment tiering (Table 13) & pipeline data contracts (§27.4)

| Function | Tier | Rate |
|---|---|---|
| CAN ingest, time sync, quality flags | Edge | up to 1 kHz |
| Vibration FFT, envelope, feature vector | Edge | 1 kHz in → 1–2 Hz out |
| Mean-value twin + residuals | Edge | 20–50 Hz |
| Misfire & knock detection | Edge | per cycle |
| UKF state/parameter estimation | Edge | 5–10 Hz |
| Causal graph inference | GCS | 0.1–1 Hz |
| RUL, particle filter | GCS | per minute |
| Mission simulation, what-if | GCS | on demand |
| Fleet aggregation, retraining | Ground | post-flight |

Total health telemetry over the link must be **< 1 kB/s**. No safety-relevant
inference may depend on the radio link — edge continues anomaly scoring/misfire
detection/residual logging even if the link is fully degraded.

**Literal pipeline stage chain — these ARE the module boundaries (`simengine/twin/contracts.py`)**:

```
CAN/serial  → ingest    → TelemetryFrame{t, channel[], quality[]}
TelemetryFrame → context → Context{alt, ias, phase, ambient, throttle}
+Context → twin          → Prediction{y_hat[], x_hat[], theta_hat[], P}
+Prediction → residual   → Residual{r[], z[], d2, S[], flags}
+Residual → graph        → Diagnosis{hypotheses[(cause, p, evidence[])]}
+Diagnosis → prognosis   → RUL{component, q05, q50, q95, driver}
+RUL → mission           → Risk{P_success, tier, recommended_action}
                           ↓
                 Dashboard · Reports · Logs
```

---

## Appendix G — Advisory tiers (Table 12)

| Tier | Trigger | Message | Authority |
|---|---|---|---|
| Nominal | HI > 90, no persistent residual | health index and trend only | none |
| Watch | persistent residual, single channel | named parameter drifting, no action | none |
| Advisory | coincidence confirmed, RUL_5% > mission length | ranked cause + recommended setting change | crew decides |
| Caution | RUL_5% < remaining mission | projected exceedance time + counterfactual options | crew decides |
| Warning | cascade projected to a limit, or knock/oil-pressure class | immediate recommended action, with reasoning | crew decides |

**Hard constraint, enforce architecturally everywhere**: no code path may
auto-trigger an aircraft action. Every output is advisory-only, surfaced to a human.
There is no actuator/write API anywhere in this system.

---

# PHASES

## Phase 0 — Repo scaffolding

**Depends on**: nothing.

**Steps**:
1. Create directories: `simengine/{config,engine,faults,sensors,calibration,validation,twin,tests}`, `backend/app`, `docs`.
2. Add `simengine/__init__.py`, `simengine/engine/__init__.py`, `simengine/faults/__init__.py`, `simengine/sensors/__init__.py`, `simengine/calibration/__init__.py`, `simengine/twin/__init__.py` (all empty).
3. Create `simengine/pyproject.toml` (or `setup.cfg`) declaring the package `simengine`, dependencies `numpy`, `scipy`, `pydantic>=2`, `pyyaml`, `pytest`.
4. Create `simengine/config/engine_seed_params.yaml` transcribing **Appendix A** exactly (every row, as YAML key/value pairs, grouped by class: `fixed_from_spec`, `fixed_from_literature`, `fitted`). Use the exact snake_case symbol names shown in `celestia_cycle_model_reference.py` where they already exist (`B, S, lrod, ncyl, rc, Rg, LHV, th_ign, dth_burn, eta_c, Twall`, Chen–Flynn `A, Bc, Cc, Dc`, Woschni `C1, C2`).
5. Create `simengine/config/fault_library.yaml` transcribing **Appendix C** exactly, one YAML list entry per row with keys `name, parameter_path, equation_ref, first_mover_channels, discriminator_rule, onset_timescale_hours: [min, max]`.

**Definition of Done**: `python -c "import yaml; yaml.safe_load(open('simengine/config/engine_seed_params.yaml'))"` and the same for `fault_library.yaml` succeed with no error; the parsed `faults:` list has exactly 21 entries (the physical faults, each with a non-null `parameter_path`), documented to have an implicit 22nd "healthy" state (severity 0 on all of them); `sensor_drift_bias_stuck` is kept in a separate `sensor_nuisances:` section with `parameter_path: null`, since it perturbs the observation model only and is a distinct DOE axis (Table 10) from the 21 physical faults, not a 22nd member of that list.

---

## Phase 1 — Engine geometry & thermodynamic core

**Depends on**: Phase 0.

**Files**: `simengine/engine/geometry.py`, `simengine/engine/thermo.py`, `simengine/engine/solver.py`, `simengine/tests/test_geometry.py`, `simengine/tests/test_solver.py`.

**Spec** — port these functions from `research/celestia_cycle_model_reference.py` verbatim into `geometry.py` (they are already validated, do not rederive):

```
s(theta)      = a*cos(theta) + sqrt(l**2 - (a*sin(theta))**2)              # eq 3.1
volume(theta) = Vc + pi/4*B**2*(l + a - s(theta))                          # eq 3.2
dVdtheta(theta)                                                            # eq 3.3 (analytic derivative, as in reference)
area(theta)   = 2*(pi/4*B**2) + pi*B*x(theta)                              # eq 3.5, head+crown+exposed liner
```
where `a = S/2`, `l = lrod`, loaded from `engine_seed_params.yaml`.

In `thermo.py`:
```
gamma_of_T(T) = 1.38 - 6.0e-5*(T - 300.0)      # linear across 300-2800K
cv(T, Rg) = Rg / (gamma_of_T(T) - 1.0)
```

Governing ODE (eq 3.8–3.10), integrated crank-angle-resolved from IVC to EVO:
```
dT/dtheta = (1/(m*cv))*(dQch/dtheta - dQht/dtheta - p*dV/dtheta) - (T/m)*dm/dtheta
dp/dtheta = p*((1/m)*dm/dtheta + (1/T)*dT/dtheta - (1/V)*dV/dtheta)
```

**Integrator correction vs. the reference file**: the report's §14.1 specifies
**explicit RK4** at step Δθ = 0.2° CA (convergence-study justified: IMEP error
< 0.05%, p_max error < 0.2% relative to a 0.05° reference, at 1/20th the cost).
The existing `celestia_cycle_model_reference.py::run_cycle` uses **RK2** — this is
a known discrepancy to fix, not a design choice to preserve. Build `solver.py`'s
crank-angle loop as full RK4 (4 stages: k1, k2, k3, k4 evaluated at θ, θ+Δθ/2 (×2),
θ+Δθ), not the reference's 2-stage midpoint method.

`solver.py` exposes:
```python
def integrate_closed_cycle(theta_ivc_deg, theta_evo_deg, dtheta_deg,
                            deriv_fn, y0) -> dict:
    """Generic RK4 crank-angle integrator. deriv_fn(theta_rad, y) -> dy/dtheta.
    Returns dict with arrays: theta_deg, y (stacked state history)."""
```
This generic integrator is reused by Phase 2 onward — do not write a second
integrator; every closed-cycle state (p, T, m, plus later combustion/blow-by
extensions) is a component of the same `y` vector integrated by this one function.

**Definition of Done**:
- `test_geometry.py`: `volume(theta)` at θ=0 equals `Vc + Vd_cyl` (TDC... actually at
  θ=0 rad the piston is at BDC per the reference's convention where θ is measured
  ATDC with cos(0)=1 giving minimum `s`, i.e. TDC — assert `volume(0) ≈ Vc` within
  1e-9 relative, and `volume(pi) ≈ Vc + Vd_cyl` within 1e-6 relative, matching the
  slider-crank convention already used in the reference script).
- `test_solver.py`: integrating a trivial `dy/dtheta = 0` returns constant `y`;
  integrating `dy/dtheta = 1` over a known range returns the correct linear ramp
  to within 1e-9.

---

## Phase 2 — Combustion

**Depends on**: Phase 1.

**Files**: `simengine/engine/combustion.py`, `simengine/tests/test_combustion.py`.

**Spec**:
```
# Wiebe (eq 4.1-4.2)
xb(theta, theta0, dtheta_burn, aw=5.0, mw=2.0):
    z = clip((theta - theta0) / dtheta_burn, 0, 1)
    xb = 1 - exp(-aw * z**(mw+1))
    dxb_dtheta = aw*(mw+1)/dtheta_burn * (1-xb) * z**mw
    return xb, dxb_dtheta

# Heat release (eq 4.3)
dQch_dtheta = mf_burn * LHV * eta_c * dxb_dtheta

# Mixture, O2-limited (eq 4.4) — the min() is MANDATORY, do not omit
mf = m_tot / (lam*AFRs + 1.0)
mair = m_tot - mf
mf_burn = min(mf, mair / AFRs)
# Omitting this min() over-predicted take-off power by 19% in the report's own
# first calibration pass — this is a named regression to guard against.

# Knock, Livengood-Wu (eq 4.5)
Ik(t) = integral of d(theta) / (omega * tau(p, T))  where tau = A*p**(-n)*exp(Ba/T)
# knock event when Ik crosses 1.0 during the closed cycle

# Misfire
# Implemented as a PARAMETER OVERRIDE, not a special-cased branch:
# misfire_cylinder_cycle(): call combustion functions with mf_burn = 0 for that
# cylinder's cycle. Do not write a separate misfire code path.
```

**Definition of Done**: `test_combustion.py` asserts (1) `xb(theta0, ...) == 0` and
`xb(theta0 + dtheta_burn, ...) ≈ 1` within 1e-3; (2) removing the `min()` guard and
re-running the take-off case from Appendix A raises predicted power by roughly the
documented ~19% (a regression guard test asserting the *with-min* result is at least
15% lower than the *without-min* result — proves the guard is load-bearing);
(3) a misfire override (`mf_burn=0`) for one cylinder-cycle drives `Qtot=0` for that
cycle and is verified to NOT require any branch in `run_cycle`/solver code, only a
parameter value change.

---

## Phase 3 — Heat transfer and thermal network

**Depends on**: Phase 2.

**Files**: `simengine/engine/heat.py`, `simengine/tests/test_heat.py`.

**Spec**:
```
# Woschni (eq 5.1-5.3) — already validated in reference, port as-is
w = C1*Sp + C2*(Vd*Tivc)/(MAP*V1) * max(p - p_mot, 0.0)     # C1=2.28, C2=3.24e-3
h_g = 3.26 * B**-0.2 * (p/1000.0)**0.8 * T**-0.55 * w**0.8   # p in kPa
dQht_dtheta = h_g * area(theta) * (T - Twall) / omega

# 4-node lumped thermal network (eq 5.4), integrated separately (see Phase 1's
# solver note — thermal network runs on ITS OWN loop at 100ms, backward Euler,
# NOT inside the crank-angle RK4 loop; see Phase 8/13's multi-rate scheduler)
m_i * cp_i * dTi_dt = Qdot_in_i - sum_j((Ti-Tj)/Rij) - h_i*A_i*(Ti - Tinf)
# 4 nodes: head, coolant, oil, liner. Head tau ~30-90s, coolant tau ~60-150s,
# oil tau ~5-15min.

# EGT probe model (eq 5.6-5.7) — do NOT compare in-cylinder T directly to an EGT
# sensor reading; always pass predicted in-cylinder T through this model first.
Tbd    = Tevo * (p_exh/p_evo)**((gamma-1)/gamma)             # blowdown expansion
Tprobe = Tpipe + (Tbd - Tpipe) * exp(-hp*Ap/(mdot*cp))       # probe thermal lag
# Worked check value: Tevo=2148K -> Tbd~=1520K -> Tprobe~=1150K (880 degC)
```

Altitude/airspeed must feed `h_i` for the air-cooled cylinder-barrel node — wire
this node's external `h_i` to the ISA atmosphere model built in Phase 4 (a forward
reference; stub `h_i` as a function parameter here so Phase 4 can supply it without
changing this file's signature).

**Definition of Done**: `test_heat.py` checks: (1) `h_g` and `dQht_dtheta` match the
reference script's `deriv()` computation bit-for-bit on the take-off case (rpm=5800,
MAP=1.32e5, lam=0.85) to 1e-6 relative; (2) the EGT probe worked example
(Tevo=2148K → Tprobe≈1150K) reproduces within 5% using representative
`p_exh/p_evo`, `hp`, `Ap`, `mdot`, `cp` placeholder values documented in the test;
(3) the 4-node network reaches steady state under constant input within the stated
time-constant ranges (assert settling time is within [τ_min, 5·τ_max] per node).

---

## Phase 4 — Gas exchange, sealing, turbocharging, altitude

**Depends on**: Phase 3.

**Files**: `simengine/engine/flow.py`, `simengine/engine/turbo.py`, `simengine/engine/atmosphere.py`, `simengine/tests/test_flow.py`, `simengine/tests/test_turbo.py`, `simengine/tests/test_atmosphere.py`.

**Spec**:
```
# flow.py — speed-density volumetric efficiency (eq 6.1)
mdot_a = eta_v * rho_i * Vd * (N/2)         # rho_i = p_MAP/(Rg*Ti)
# eta_v stored/looked-up as a surface eta_v(N, Pi) — populated later by Tier A
# batch sweeps in Phase 9; for now expose eta_v as an injectable callable/table.

# Universal orifice flow function (eq 6.2-6.3) — ONE function reused for valves,
# wastegate, injectors, leaks, and blow-by. Do not write separate flow functions
# per use site.
def orifice_flow(Cd, A, p_u, p_d, T_u, Rg):
    pi_ratio = p_d / p_u
    pi_crit = 0.528
    if pi_ratio <= pi_crit:
        psi = <choked form>
    else:
        psi = <compressible subsonic form>
    return Cd * A * (p_u / sqrt(Rg*T_u)) * psi

# Blow-by (eq 6.4) — same orifice_flow(), gated by peak pressure, NOT the
# reference script's simplified linear leak term. Upgrade path from reference,
# not a rewrite of correct physics:
dm_dtheta_blowby = -(1/omega) * orifice_flow(Cd_bb, A_bb, p_cylinder, p_crankcase, T, Rg)
# Signature to detect in validation (Phase 10, Gate 3): falling p_max WITH rising EGT.

# turbo.py (eq 6.5-6.7)
T2 = T1 * (1 + (1/eta_c)*(Pi_c**((gamma-1)/gamma) - 1))       # compressor outlet temp
# turbine power eq 6.6 (isentropic expansion analogous form, symmetric to compressor)
J_tc * omega_tc * domega_tc_dt = eta_m * Wdot_turbine - Wdot_compressor   # eq 6.7 shaft

# atmosphere.py — ISA (eq 6.8)
T_amb = T0 - L*h          # L = 6.5 K/km
p_amb = p0 * (T_amb/T0)**(g/(R*L))
# Wastegate holds MAP constant via closed-loop control until critical altitude
# (~4500m per Appendix A), then boost falls with ambient pressure beyond that.
```

**Definition of Done**: `test_flow.py`: `orifice_flow` is continuous at
`pi_ratio == pi_crit` (no discontinuity, checked numerically within 1e-3 relative on
either side of 0.528); blow-by test shows p_max drop AND EGT rise together when
`Cd_bb` is increased, holding all else constant (Gate-3-style sensitivity check).
`test_turbo.py`: compressor outlet temp increases monotonically with `Pi_c` for
fixed `eta_c`, and decreases monotonically with `eta_c` for fixed `Pi_c`.
`test_atmosphere.py`: `T_amb`/`p_amb` at h=0 equal ISA sea-level values (288.15K,
101325 Pa) within 0.01%; MAP stays pinned to its rated value below 4500m and falls
above it in an integration test that ramps altitude through the critical point.

---

## Phase 5 — Mechanical output (friction, crank/prop dynamics) — Tier A closes the loop

**Depends on**: Phase 4.

**Files**: `simengine/engine/friction.py`, `simengine/engine/dynamics.py`, `simengine/tests/test_friction.py`, `simengine/tests/test_dynamics.py`, `simengine/tests/test_tier_a_regression.py`.

**Spec**:
```
# friction.py — Chen-Flynn (eq 7.3), exact seed constants from Appendix A
FMEP = Af + Bc*p_max + Cc*Sp + Dc*Sp**2      # Af=0.90e5, Bc=0.012, Cc=2.0e3, Dc=120.0
IMEP = Wgross / Vd_cyl                        # eq 7.1
BMEP = IMEP - PMEP - FMEP                     # eq 7.2, PMEP=0.25e5
Tb = BMEP * Vd_tot / (4*pi)                   # eq 7.4, torque
Pb = BMEP * Vd_tot * (N/2)                    # eq 7.4, power (N = rev/s)

# dynamics.py — crank/prop coupling (eq 7.5-7.6)
J_eff * domega_dt = Tb(theta, omega, u) - T_prop/(i*eta_g)     # i=2.43
T_prop = CT * rho * n**2 * D**4               # propeller thrust
Q_prop = CQ * rho * n**2 * D**5               # propeller torque
eta_p  = J_adv * CT / (2*pi*CQ)
# Operating point at each timestep = Newton iteration solving for omega that
# balances engine torque against propeller-side load torque/(i*eta_g).
```

**This phase is the primary correctness gate for the entire Tier A model.**
Assemble `simengine/engine/*` into one `run_cycle()`-equivalent (reusing the
`solver.py` RK4 integrator from Phase 1, now with the FULL right-hand side:
combustion heat release from Phase 2, wall heat loss from Phase 3, blow-by mass
loss from Phase 4, evaluated every RK4 stage) and reproduce **Table 4 in Appendix A
exactly**: take-off/max-continuous/75%-cruise power within −0.7%/−2.5%/+2.2%,
BSFC in 240–300 g/kWh, p_max in 50–75 bar.

**Definition of Done**: `test_tier_a_regression.py` runs all three rated points from
Appendix A and asserts power error is within ±0.5 percentage points of the
documented −0.7%/−2.5%/+2.2% figures (i.e. the test tolerates the model landing at
those exact values, not a wider arbitrary band — if your RK4 upgrade from Phase 1
shifts the numbers slightly from the RK2 reference script's printed output, that is
expected and acceptable as long as you remain within the report's stated
50–75 bar / 240–300 g/kWh / few-percent-of-published-power gates). This test **is**
Gate 2 from Appendix F/§18 — do not duplicate it in Phase 10, just re-import and
re-run it there.

---

## Phase 6 — Lubrication and tribology

**Depends on**: Phase 5.

**Files**: `simengine/engine/lube.py`, `simengine/tests/test_lube.py`.

**Spec**:
```
Q_pump = eta_vol * D_p * N - k_l * dP / mu                    # eq 8.1
R_h    = 128 * mu * L / (pi * d**4)                            # eq 8.2, Hagen-Poiseuille
p_oil  = R_h_eff * Q_pump

mu(T) = K * exp(theta1 / (T + theta2))                          # eq 8.3, Vogel

S = (mu*N/P) * (R/c)**2                                          # eq 8.4, Sommerfeld
h_min = c * (1 - epsilon)                                        # film thickness

m_o*co*dTo_dt = Qdot_fric(=FMEP*Vd*N/2) + Qdot_piston - Qdot_cooler   # eq 8.5, oil as calorimeter
```
Four distinct causes of falling oil pressure must be separately representable as
distinct parameter perturbations (not collapsed into one "oil pressure fault"):
pump wear (`eta_vol` ↓), bearing clearance growth (`d`/`c` ↑), leak (mass ↓), and
hot thin oil (`mu` ↓ via Vogel — this one is benign/load-driven, and only a model
with `mu(T)` can distinguish it from the other three).

**Definition of Done**: `test_lube.py` asserts: viscosity decreases monotonically
with temperature (Vogel); Sommerfeld number decreases (film gets thinner) as `c`
increases holding other terms fixed; oil temperature ODE reaches a higher steady
state when `FMEP` is increased holding cooler capacity fixed (proves the
calorimeter coupling works); four independent unit perturbations
(`eta_vol`↓, `c`↑, leak mass term, `mu`↓ via higher T) each drop `p_oil` but are
distinguishable by checking oil temperature's simultaneous response differs across
the four cases (leak → both move; hot-oil → both move together benignly; pump/
clearance wear → pressure moves, temperature does not, at matched load).

---

## Phase 7 — Vibration synthesis

**Depends on**: Phase 5 (uses crank/torque dynamics).

**Files**: `simengine/engine/vibration.py`, `simengine/tests/test_vibration.py`.

**Spec**:
```
# eq 9.1 — torque ripple source
T(theta) = (p(theta) - p_cc) * (pi*B**2/4) * r(theta) - m_rec*xddot(theta)*r(theta)

# Order table (f0 = N/60 Hz):
#   2.0x  firing order (load-dependent)
#   2.0x  2nd-order inertia (balance)
#   0.5x, 1.5x, 2.5x  half-order family -> misfire/injector/weak-cylinder signature
#   z*f0/i  gear mesh (tooth wear), i=2.43
#   non-integer bands -> bearing spall (eq 9.2):
f_BPFO = (n*f_r/2) * (1 - (d/D)*cos(alpha))
f_BPFI = (n*f_r/2) * (1 + (d/D)*cos(alpha))

# Synthesis model for Tier A training-data generation (eq 9.3-9.4)
v(t) = sum_k( A_k * sin(2*pi*k*f0*t + phi_k) )  +  sum_j( impulse_j convolved with g(t) )  +  noise(t)
g(t) = exp(-zeta*omega_n*t) * sin(omega_n*sqrt(1-zeta**2)*t)
# A fault = a change to A_k at the relevant order, OR an added impulse train at a
# defect frequency (bearing BPFO/BPFI, gear mesh). Ground truth is exact by
# construction since you authored the perturbation.

# Edge-side feature extractor (Tier B / real hardware path) — 21 floats @ 1-2Hz:
# RMS+peak per axis, crest factor, kurtosis, band energies at
# (0.5x,1x,1.5x,2x,2.5x,4x,mesh), half-order ratio E_0.5/E_2, spectral centroid,
# BPFO/BPFI envelope peaks, cyclostationary indicator.
def extract_edge_features(raw_signal_1khz) -> np.ndarray:  # returns length-21 vector
    ...
```

Implement TWO functions in this file: `synthesize_vibration(...)` (Tier A, generates
labeled training signals per the order/impulse model) and
`extract_edge_features(raw_signal)` (Tier B, the on-device FFT/envelope DSP that
Appendix B/F require — this is the function later called at 1kHz-in/1-2Hz-out on
the edge tier).

**Definition of Done**: `test_vibration.py` asserts: (1) `synthesize_vibration` with
a misfire-mode perturbation shows increased energy at the 0.5×/1.5×/2.5× order band
relative to the healthy baseline, measured via `extract_edge_features`'s own band-
energy computation (round-trip test: synthesize → extract → check the half-order
ratio feature rose); (2) `extract_edge_features` always returns exactly length-21
output regardless of input signal length; (3) a synthesized bearing-defect impulse
train raises the corresponding BPFO/BPFI envelope-peak feature relative to healthy.

---

## Phase 8 — Degradation (slow-time dynamics)

**Depends on**: Phase 6, Phase 7.

**Files**: `simengine/engine/degradation.py`, `simengine/tests/test_degradation.py`.

**Spec** — one shared health-parameter vector `theta`, updated at 1–60s step,
separate from the fast-state integration of Phases 1–7 (`xdot = f(x,u,theta)`,
`thetadot = eps*g(x,u,theta)`, eq 10.1):
```
# Archard wear (eq 10.2)
dc_dt = (k/H) * (W*Sp/A_app) * Phi(regime)     # Phi~0 hydrodynamic, spikes mixed/boundary

# Arrhenius ageing (eq 10.3)
k_T = A * exp(-Ea/(Ru*T))
D_thermal = integral(k_T dt)                    # +10C oil temp ~doubles ageing rate

# Paris/Miner fatigue (eq 10.4-10.5)
da_dN = C * (delta_K)**m
D_fatigue = sum(n_i / Nf_i)                     # <=1 at failure
# ~1.65e5 cycles/hr/cyl @ 5500rpm; p_max-raising faults consume fatigue life
# superlinearly (m=3-4): "a 5-minute over-boost is not a 5-minute loss of life."

# Fouling (eq 10.6)
dsigma_f_dt = alpha * mdot * (sigma_inf - sigma_f)   # maps onto eta_c, hA, C_dA_inj
```
**Central design point, enforce it**: there is no separate "fault mode" code
branch anywhere in `engine/` — every failure mode in Appendix C is a trajectory
through this same `theta` vector, consumed identically by every other module in
Phases 1–7. `degradation.py` only produces `theta(t)`; it never special-cases a
named fault.

**Definition of Done**: `test_degradation.py`: wear rate `dc_dt` increases sharply
when `Phi(regime)` moves from hydrodynamic to boundary at fixed load (models the
"quiescent then fast" cliff); a +10K constant temperature offset run through
`D_thermal` integration over equal time roughly doubles cumulative ageing versus a
baseline run (assert ratio in [1.7, 2.3]); a fatigue test asserts `D_fatigue` grows
faster than linearly with peak-pressure amplitude increase (superlinear check via
the `m` exponent, m∈[3,4]).

---

## Phase 9 — Calibration

**Depends on**: Phase 5 (needs full Tier A cycle model).

**Files**: `simengine/calibration/calibrate.py`, `simengine/tests/test_calibrate.py`.

**Spec** (eq 15.1–15.3):
```
# Three parameter classes, tagged in engine_seed_params.yaml (Phase 0):
#   fixed_from_spec        - never fitted (bore, stroke, CR, displacement, ratios, rated points)
#   fixed_from_literature   - fitted only within an uncertainty band (Woschni C1/C2,
#                             gamma(T), flow function Psi, Vogel constants for known oil)
#   fitted                  - 8-12 free parameters (burn duration/phasing, combustion
#                             efficiency, eta_v surface, Chen-Flynn coefficients,
#                             heat-transfer multiplier, effective C_dA values)

theta_hat = argmin_theta( sum_k( ||W*(y_k - h(theta,u_k))||**2 ) + lambda*||theta - theta_prior||**2 )   # eq 15.1
# Solve via Levenberg-Marquardt (scipy.optimize.least_squares(method='lm') is
# acceptable) — eq 15.2 gives the LM normal-equation form directly if implementing
# by hand instead.

# Identifiability (eq 15.3): SVD of the sensitivity/Jacobian J = dh/dtheta = U*Sigma*V^T
# condition number kappa = sigma_max/sigma_min
# Directions with sigma_i ~ 0 are NOT fit -> held at prior value, reported as an
# uncertainty contribution. Never force a unique fit along an unidentifiable direction.
```
Fit only against the 3 published power ratings (Appendix A/Table 4) as the
objective; predicted (never-fitted) peak torque, BSFC, and peak cylinder pressure
must independently land in physical ranges as evidence the model structure itself
is correct, not merely curve-fit.

Also implement the **self-calibration** entry point (eq 15.5): a function that
re-runs the LM fit on a *restricted subset* of parameters (η_v surface offset,
friction constant, heat-transfer multiplier only) against a supplied stable
cruise-window telemetry log, for use in service after the initial offline fit.

**Definition of Done**: `test_calibrate.py` runs the full calibration against
synthetic "published" targets equal to Appendix A's Table 4 numbers and asserts the
resulting fit reproduces them within the stated error band; a second test
constructs a deliberately rank-deficient sensitivity matrix (two parameters with
identical effect on all outputs) and asserts the SVD-based identifiability check
flags a near-zero singular value rather than silently returning an arbitrary split
between the two.

---

## Phase 10 — Validation gates

**Depends on**: Phases 1–9 (needs full physics stack + calibration).

**Files**: the five files already listed under `simengine/validation/` in Section 1.

**Spec** (§18, run all five as automated, scripted checks — Gate 1 is a CI unit
test, Gates 2–4 are validation reports, Gate 5 needs an external dataset):

```
# Gate 1 - Conservation (eq 18.1) - RUN ON EVERY COMMIT
abs(mf_burn*LHV*eta_c - closed_cycle_work - integral(Qht) - delta_H_exhaust) < 0.005 * Q_fuel
# mass balance must close the same way (sum of mass flows in/out over a closed
# cycle equals stored mass change to the same tolerance).

# Gate 2 - External anchors (already built as test_tier_a_regression.py in Phase 5
# — re-import and re-run here, do not duplicate): published power at 3 ratings,
# BSFC 240-300 g/kWh, p_max 50-75 bar, EGT ~850-900C at high power, critical
# altitude ~4500m. NONE of these were in the calibration objective except the 3
# power numbers.

# Gate 3 - Sensitivity sanity: for EVERY row in fault_library.yaml (Appendix C),
# perturb its parameter, confirm the "first mover" residual channel moves in the
# documented direction, MONOTONICALLY with severity (sweep severity 0->1 in e.g.
# 5 steps, assert monotonic sign of d(residual)/d(severity)). Automate as a loop
# over all 21 fault rows -- a single test function parameterized over the YAML.

# Gate 4 - Cross-model agreement: Tier B (Phase 13, mean-value) vs Tier A
# (Phases 1-9, crank-resolved) at matched operating points must agree within:
#   MAP within 1%, CHT within 3K, crank speed within 0.5%
# (This gate cannot be implemented until Phase 13 exists -- write the test now,
# skip/xfail it with a clear TODO referencing Phase 13, then un-skip it there.)

# Gate 5 - External dataset transfer: ingest a public bearing-fault/rotating-
# machinery dataset (e.g. CWRU bearing dataset or similar publicly available set)
# through the SAME extract_edge_features() pipeline from Phase 7, confirm it
# discriminates known fault/healthy labels in that external dataset above chance,
# THEN apply the identical pipeline to Phase 7's synthesized engine vibration.
# This validates the feature-extraction + classifier pipeline independent of the
# engine simulation being "correct."
```

**Definition of Done**: Gate 1 passes as a pytest test with the 0.5%-of-Q_fuel
tolerance, wired into whatever CI config this repo uses (if none exists yet,
create a minimal `pytest.ini`/`Makefile test` target and note that CI wiring itself
is out of scope beyond making the command exist and pass). Gate 2 test asserts the
Appendix A numbers (reusing Phase 5's regression test). Gate 3 test iterates all 21
fault rows and passes if 100% show correct-direction, monotonic first-mover
response. Gate 4 exists as an `xfail`-marked stub referencing Phase 13 until that
phase lands, then must be un-skipped and pass there. Gate 5 requires a real
external dataset — if none is available in this environment, implement the
pipeline function and leave the test marked `skip` with a clear docstring
explaining what dataset it needs and where to place it; do not fabricate a fake
"external" dataset to pass this gate.

---

## Phase 11 — Fault injection & DOE campaign generator

**Depends on**: Phase 8, Phase 0 (fault_library.yaml).

**Files**: `simengine/faults/library.py`, `simengine/faults/injector.py`, `simengine/faults/campaign.py`, `simengine/tests/test_injector.py`, `simengine/tests/test_campaign.py`.

**Spec** (§16.1–16.4):
```
# library.py: load fault_library.yaml into typed FaultSpec objects.

# injector.py — severity shapes (eq 16.1)
def severity_linear(t, s0, beta): return s0 + beta*t
def severity_exponential(t, s0, beta): return s0 * exp(beta*t)
def severity_step(t, s0, delta_s, t_f): return s0 + delta_s*(t >= t_f)

# bounded parameter mapping (eq 16.2)
def apply_severity(theta_j0, alpha_j, s_t, theta_min, theta_max):
    return clip(theta_j0 * (1 + alpha_j*s_t), theta_min, theta_max)

# Scenario spec format -- parse EXACTLY this YAML shape (mission + faults + labels):
scenario_schema = """
scenario: str
mission:
  profile: [taxi, takeoff, climb_18kft, cruise_8h, descent, land]
  ambient: {isa_offset_K: float, humidity: float}
faults:
  - mode: str            # must match a fault_library.yaml name
    target: {cylinder: int}   # or {channel: str} for sensor faults
    parameter: str        # e.g. CdA_inj
    shape: linear|exponential|step
    onset_h: float
    end_severity: float
labels:
  root_cause: str
  true_severity_series: auto
  first_detectable_h: auto
"""

# campaign.py — Latin hypercube DOE (§16.3, Appendix D)
def generate_campaign(n_missions=10000, seed=...) -> list[ScenarioSpec]:
    # LHS over continuous axes (severity, onset time, altitude, ISA offset, power
    # setting, engine age), stratified sampling over categorical axes (fault mode
    # incl. healthy, growth shape, sensor nuisance, multi-fault level).
    # ~1/3 of generated scenarios MUST include a co-occurring sensor_nuisance fault.
```

**Definition of Done**: `test_injector.py` checks each severity shape against a
hand-computed value at 2-3 sample points; `apply_severity` respects the
`theta_min`/`theta_max` clip in both directions. `test_campaign.py` generates a
small campaign (e.g. n=200 for test speed) and asserts: every one of the 21 fault
modes plus healthy appears at least once when n is large enough by construction
(stratified, not left to chance); roughly 1/3 (within a tolerance band, e.g.
28–38%) of generated scenarios carry a sensor-nuisance fault; every generated
scenario, when its parameter trajectory is evaluated at any time, stays within
`[theta_min, theta_max]` for every perturbed parameter.

---

## Phase 12 — Sensor and bus emulation

**Depends on**: Phase 0 (Appendix E).

**Files**: `simengine/sensors/emulate.py`, `simengine/sensors/bus.py`, `simengine/tests/test_emulate.py`, `simengine/tests/test_bus.py`.

**Spec** (§17, eq 17.1, Appendix E table) — implement each corruption effect as an
independent, composable stage so they can be chained per channel:
```python
class SensorChannel:
    def __init__(self, lag_tau=None, noise_std=0.0, bias=0.0, drift_rate=0.0,
                 quant_bits=None, delay_samples=0, jitter_ms=0.0,
                 dropout_prob=0.0, gain_error=0.0, freeze=False):
        ...
    def observe(self, true_value_series) -> np.ndarray:
        # applies, in order: delay -> gain error -> bias+drift -> lag filter ->
        # quantization -> noise -> dropout/freeze
        ...
```
`bus.py`: pack multiple `SensorChannel` outputs into CAN-like frames — realistic
identifiers, mixed per-channel rates (per Appendix B), non-simultaneous timestamps,
plus jitter — so the ingestion layer built in Phase 17 is exercised the same way it
would be against a real bus before one is ever connected.

**Definition of Done**: `test_emulate.py` checks each corruption stage in isolation
(e.g. a channel configured with only `freeze=True` outputs a constant value equal
to the last true value before freeze onset regardless of subsequent true-value
changes — this is the dangerous Type-2 case from Appendix B and must be
distinguishable in the raw signal only by the short-window-variance check that
Phase 15 will apply, not caught here). `test_bus.py` asserts frames from
different channels carry distinct, stable identifiers and that per-channel output
rate matches its configured rate within jitter tolerance.

---

## Phase 13 — Tier B: real-time mean-value twin

**Depends on**: Phases 1–9 (needs Tier A model + calibrated surfaces).

**Files**: `simengine/twin/meanvalue.py`, `simengine/tests/test_meanvalue.py`. Also:
un-skip and pass Phase 10's Gate 4 test now.

**Spec** (§13.2, eq 13.1) — a 9–12 state ODE system, cycle-averaged, running at
20–50 Hz, sharing the SAME `theta` health-parameter vector as Tier A, and reading
Tier A's precomputed lookup surfaces (η_v(N,Π), p_max(N,Π,θ), phasing) rather than
recomputing a crank-resolved cycle every step:
```
dp_MAP_dt = (Rg*Ti/V_man) * (mdot_comp - mdot_eng)
mdot_eng  = eta_v(N, Pi) * p_MAP * Vd * N / (2*Rg*Ti)          # eq 13.1

# Combined with: turbo shaft (eq 6.7, Phase 4), crank shaft (eq 7.5, Phase 5),
# 4 thermal nodes (eq 5.4, Phase 3), oil circuit (eq 8.1-8.2, Phase 6)
# = 9-12 ODEs total. This must run comfortably faster than real-time on commodity
# hardware (microseconds per step target per the report's performance note).
```
Build this as a `MeanValueTwin` class exposing `step(dt, u: Context) -> Prediction`
where `Prediction` is the exact type defined in Phase 17's `contracts.py` (build
`contracts.py` alongside this phase if Phase 17 hasn't run yet — the type must
exist before this phase's tests can typecheck; place it in
`simengine/twin/contracts.py` per the Section 1 layout regardless of phase order).

**Definition of Done**: `test_meanvalue.py` runs the Tier B twin at a matched
operating point against Tier A's Phase 5 result and asserts agreement within
Gate 4's tolerances (MAP within 1%, CHT within 3K, crank speed within 0.5%) —
this test IS Phase 10's previously-skipped Gate 4; remove its `xfail`/`skip` marker
now that this phase provides the comparison target, and confirm it passes.
Also assert wall-clock: stepping the twin 1000 times takes well under 1 second on
a typical dev machine (rough real-time-capability smoke test, not a strict SLA).

---

## Phase 14 — Residuals and UKF state estimation

**Depends on**: Phase 13.

**Files**: `simengine/twin/residual.py`, `simengine/twin/estimator.py`, `simengine/tests/test_residual.py`, `simengine/tests/test_estimator.py`.

**Spec**:
```
# residual.py (eq 19.1-19.2)
r_i(t) = y_i(t) - y_hat_i(u(t), theta, x(t))
z_i(t) = (r_i(t) - mu_i(u)) / sigma_i(u)
# mu_i(u), sigma_i(u): context-indexed surfaces learned from confirmed-normal
# (healthy) historical data -- implement as a binned lookup table or low-order
# regression over context u, fit from a supplied healthy-telemetry dataset.

# Four residual dimensions, each a separate function returning part of one
# unified Residual{} structure (per contracts.py):
#   1. output residuals    - per-sensor-channel, as above
#   2. parameter residuals - theta_hat vs confirmed-normal theta value
#   3. relational residuals - deviation of physically-constrained PAIRS
#      (oil pressure-temperature curve from Phase 6, boost-vs-turbo-speed
#      relation from Phase 4) -- these are the Table-6/Appendix-C discriminators
#   4. symmetry residuals  - cylinder-to-cylinder spread in CHT/EGT

# estimator.py -- Unscented Kalman Filter over AUGMENTED state (eq 20.1-20.4)
x_aug = concat(x_physical, theta_health)     # theta given a random-walk process model,
                                              # very small process variance
# Sigma points (eq 20.2): chi_0 = xhat; chi_i = xhat +/- sqrt((n+kappa)*P)_i
# Predict (eq 20.3): xhat_minus = sum(Wm_i * f(chi_i)); P_minus = sum(Wc_i*(...)(...)^T) + Q
# Update (eq 20.4): K = Pxy * Pyy^-1; xhat_plus = xhat_minus + K*(y - yhat_minus)
# Use scipy/numpy linear algebra directly -- do not pull in a third-party UKF
# library, implement the sigma-point/predict/update cycle explicitly per these
# four equations so the augmented-state structure (physical + health params
# together) is transparent and modifiable.

# Learned correction term (eq 20.5-20.6) -- SEPARATE small model, not fused into
# the UKF's f()/h():
y_hat = h_phys(x, theta, u) + g_ML(u, x; W)
# physics-informed loss: L = ||y-yhat||^2 + lambda_p*||N[xhat]||^2 + lambda_b*||B[xhat]||^2
# N[] = residual of the governing ODEs (eq 3.8-3.10, 5.4); B[] = boundary/initial
# condition residual. Train g_ML ONLY on the residual (y - h_phys), never on raw y
# -- this is what keeps physics dominant outside the training envelope. A small
# scikit-learn regressor (e.g. gradient-boosted trees) or a tiny 2-layer MLP is
# sufficient; do not build a large neural network here.
```

**Definition of Done**: `test_residual.py` verifies the normalized residual `z_i`
of a synthetic healthy-baseline signal has near-zero mean and unit variance when
`mu_i(u)`/`sigma_i(u)` are fit from that same healthy data (sanity check on the
normalization, not a claim about real engines); each of the 4 residual dimensions
is independently computable and returns a well-formed array with no NaNs on a
representative simulated trajectory. `test_estimator.py` runs the UKF on a
synthetic trajectory with known injected process/measurement noise and asserts
the filtered state estimate's error is smaller than the raw measurement's error
(the UKF must actually improve on raw noisy observations); a second test injects a
step change in one health parameter and confirms the augmented state estimate
tracks it within a reasonable number of samples (bounded convergence-time check,
not an exact-instant match, since `theta`'s process noise is deliberately small).

---

## Phase 15 — Detection and sensor-vs-engine discrimination

**Depends on**: Phase 14.

**Files**: `simengine/twin/detection.py`, `simengine/twin/discriminator.py`, `simengine/tests/test_detection.py`, `simengine/tests/test_discriminator.py`.

**Spec**:
```
# detection.py
# Mahalanobis distance (eq 21.1): d2(t) = r^T * Sigma^-1 * r ~ chi2_m under H0
# threshold from chi2 quantile for a CHOSEN false-alarm probability alpha (not a
# fixed physical threshold).

# CUSUM (eq 21.2): S_k = max(0, S_{k-1} + z_k - k_slack); alarm if S_k > h_cusum
# Default config from Appendix A: k_slack = 0.5*sigma, h_cusum = 6.0
# ARL0 formula: ARL0 ~= (exp(2*k*h) - 2*k*h - 1) / (2*k**2)
# With k=0.5, h=6 this should give ARL0 ~= 2000 samples (~1 false alarm per 3
# hours per channel at a 0.2 Hz residual rate, BEFORE coincidence gating).

# GLR (eq 21.3): l(t) = max_theta_f( log(p(r_{t-L:t}|theta_f) / p(r_{t-L:t}|0)) )
# over a sliding window of length L. Gives detection AND an onset-time/magnitude
# estimate (feeds Phase 16's RUL prior).

# Alarm policy (eq 21.4-21.5) -- ALL FOUR conditions must hold, implement as an
# explicit AND, not a weighted score:
#  1. statistic exceeds its threshold (Mahalanobis/chi2, chosen alpha)
#  2. persists for N consecutive evaluations (reject single-sample spikes)
#  3. at least one physically-coupled companion channel moves consistent with the
#     hypothesis (the discriminator_rule field from fault_library.yaml)
#  4. sensor-fault hypothesis (discriminator.py below) is tested and ranked LOWER
#     than the engine-fault hypothesis

# discriminator.py (eq 22.1-22.3)
# Parity relations: p(t) = W*(Y_window - Hu*U_window), constrained W*Hx = 0
# (W annihilates the state -- healthy => p~=0 regardless of trajectory).
# Suspicion score (eq 22.2): cos(psi_i) = p^T*(W*e_i) / (||p|| * ||W*e_i||)
#   -> sensor i suspected as cos(psi_i) -> 1
# Physical check (22.2, plain-language rule -- implement as an explicit rule
# engine, not ML): a genuine engine fault must obey conservation -- e.g. genuine
# overheat needs a visible energy source (fuel/boost/phasing rose) OR visible loss
# of removal (coolant/cooling-air fell); if CHT rises with NO energy-balance
# explanation anywhere in the other channels, flag the thermocouple, not the
# engine.
# Stuck/frozen sensor detector: rolling short-window variance per channel; flag
# sigma -> 0 as frozen even if the held value looks plausible (Type-2 failure).
# Bayesian posterior over hypotheses (eq 22.3):
P(Hj|E) = P(E|Hj)*P(Hj) / sum_l(P(E|Hl)*P(Hl))
# Output a RANKED LIST with evidence, e.g.
#   [("injector_3_flow_loss", 0.63, [...evidence...]),
#    ("CHT_2_sensor_drift", 0.24, [...]),
#    ("cooling_circuit_degradation", 0.09, [...])]
# NEVER collapse this to a single binary verdict.
```

**Definition of Done**: `test_detection.py`: with the default `k_slack=0.5, h=6.0`
config, a CUSUM run on synthetic zero-mean unit-variance noise (no injected fault)
yields an empirical average run length in the same order of magnitude as the
analytic ARL0≈2000-samples prediction (e.g. within a factor of 2, over enough
Monte Carlo trials — this is inherently statistical, use a tolerance band, not an
exact match); the 4-condition alarm policy is verified to reject a single-sample
spike (condition 2 fails) and to reject a statistically significant but
uncorroborated single-channel excursion (condition 3 fails) even when condition 1
alone would have fired. `test_discriminator.py`: a synthetic sensor-drift-only
scenario (true engine state constant, one channel's observation model drifting)
produces a suspicion score/posterior favoring the sensor-fault hypothesis; a
synthetic engine-fault scenario (true state change, sensor faithful) produces a
posterior favoring the engine-fault hypothesis; the frozen-sensor detector flags a
channel whose short-window variance collapses to numerically zero while other
channels continue varying.

---

## Phase 16 — Causal graph, health index, RUL, mission risk

**Depends on**: Phase 15.

**Files**: `simengine/twin/graph.py`, `simengine/twin/health_index.py`, `simengine/twin/rul.py`, `simengine/twin/mission_risk.py`, `simengine/tests/test_graph.py`, `simengine/tests/test_health_index.py`, `simengine/tests/test_rul.py`, `simengine/tests/test_mission_risk.py`.

**Spec**:
```
# graph.py (§23) -- directed graph, FOUR node kinds: component, parameter,
# observable, context. Each edge carries gain w_ij, lag tau_ij (from the
# fault_library.yaml discriminator/onset data plus the report's Table 7 cascade
# edges from sections 12.1-12.3), and a Beta(alpha,beta) confidence pair.
# Topology comes from PHYSICS (the fault_library.yaml parameter_path fields and
# the cascade descriptions in the report), never from correlation-mining the data.

# Backward reasoning - root cause (eq 23.1-23.2), noisy-OR combination:
P(e_i=1 | parents) = 1 - prod_j( (1-p_ij)**s_j )
# in log-odds (additive evidence, the dashboard's "causal trace"):
log(P(Hj|E)/P(not Hj|E)) = log(P(Hj)/P(not Hj)) + sum_i( log(P(zi|Hj)/P(zi|not Hj)) )

# Forward reasoning - cascade projection (eq 23.3), delayed sigmoid propagation:
s_i(t) = sigmoid( sum_{j in parents(i)}( w_ij * s_j(t - tau_ij) ) + b_i )
# Counterfactual recommendation = re-run this forward pass under an alternative
# input (e.g. reduced power setting) and compare projected exceedance times.

# Edges that learn (eq 23.4), Beta-Bernoulli conjugate update:
w_ij <- (alpha_ij + n_ij_plus) / (alpha_ij + beta_ij + n_ij)

# record_maintenance_event(component): resets that component's health node AND
# degradation state, invalidates cached edge statistics depending on it, flags
# affected parameters for re-identification (Phase 9's self-calibration) on the
# next confirmed-normal window. Implement this explicitly -- a twin that is not
# maintenance-aware keeps blaming a part that was already replaced.

# health_index.py (§24)
HI(t) = 100 * (1 - sum_i( pi_i * phi(abs(z_i(t))) ))
phi(u) = 1 - exp(-(u/u0)**2)                       # saturating, one wild channel can't dominate
pi_i = (c_i * kappa_i) / sum_j(c_j * kappa_j)       # kappa_i = graph centrality from graph.py,
                                                      # c_i = severity-of-consequence weight
# Must expose a decompose() method returning the per-channel/per-subsystem
# contribution breakdown (since HI is a weighted sum, every term is recoverable
# -- this is what lets the dashboard show "HI 82, of which -11 from oil
# pressure-temperature relation and -7 from cylinder-3 EGT asymmetry").
# Also compute per-SUBSYSTEM indices the same way, over subsystem node subsets.

# rul.py (§25)
# Damage state D(t), failure at D=D_th. Drift+diffusion SDE (eq 25.1):
#   dD = mu(u,D)*dt + sigma_D*dW
# Closed form for constant drift -> inverse Gaussian first-passage distribution:
f_RUL(t) = (Dth-D0) / (sigma_D*sqrt(2*pi*t**3)) * exp(-((Dth-D0-mu*t)**2)/(2*sigma_D**2*t))
# REPORT the 5th percentile as the planning number, not the mean (right-skewed
# distribution -- "quiet then fast").
# Mission-conditioned drift (eq 25.3): integrate mu along a PLANNED profile:
#   E[D(T)] = D0 + integral(mu(u_plan(t), D) dt)
# Nonlinear/non-Gaussian case (eq 25.4) -- particle filter:
#   w_k^(i) proportional to w_{k-1}^(i) * p(y_k | x_k^(i)), N_p ~1000 particles
#   RUL_hat = empirical crossing-time distribution of the N_p particle trajectories
# Reporting: (RUL_5%, RUL_50%, RUL_95%) + dominant degradation driver, per
# component. ENGINE-level RUL = min over components' quantiles, not an average:
RUL_engine(q) = min_j( RUL_j(q) )

# mission_risk.py (§26)
# Survival across a segmented mission profile (eq 26.1):
P_success = prod_s( exp(-integral(lambda(H(t), u_s) dt)) )     # lambda = f_RUL / R (reliability fn)
# Go/no-go as an explicit cost comparison (eq 26.2), operator-adjustable costs:
E_C_go   = (1-P_success)*C_loss + P_success*C_op
E_C_nogo = C_abort + C_maint
# recommend "go" iff E_C_go < E_C_nogo
# Advisory tiers: implement EXACTLY Appendix G's 5-row table as an
# AdvisoryTierClassifier(HI, residual_state, RUL_5pct, mission_length) -> tier.
# HARD CONSTRAINT: no function in this file (or anywhere else in the whole repo)
# may return or trigger an actuator command. Every output is advisory text +
# evidence, surfaced to a human. Add an explicit code comment / docstring
# asserting this in mission_risk.py's module docstring.
```

**Definition of Done**: `test_graph.py`: noisy-OR backward inference on a
synthetic 2-parent-1-child graph produces a higher posterior for the parent whose
associated observable actually moved; forward cascade projection with a known
lag `tau_ij` produces a delayed response matching that lag within one time-step;
`record_maintenance_event` resets the targeted node's state and is verified NOT to
still attribute a post-reset anomaly to the replaced component in a scripted
before/after scenario. `test_health_index.py`: HI decreases monotonically as any
single `z_i` magnitude increases (holding others fixed); `decompose()` sums back
to the same total HI within floating-point tolerance. `test_rul.py`: the
closed-form inverse-Gaussian RUL and a particle-filter RUL run on the SAME
linear-drift synthetic damage process converge to similar quantile estimates
(cross-check, tolerance e.g. ±15% on RUL_50%); engine-level RUL equals the minimum
of at least two synthetic component RULs, verified not to equal their average.
`test_mission_risk.py`: go/no-go recommendation flips from "go" to "no-go" when
`C_loss` is increased sufficiently holding other costs fixed (sanity check on the
cost-comparison direction); the `AdvisoryTierClassifier` returns exactly the tier
Appendix G specifies for each of its 5 documented trigger conditions, tested one
row at a time; a static-analysis-style test (e.g. grep across `simengine/`) confirms
no function name containing `actuate`, `command`, `write_actuator`, `override_fadec`
or similar exists anywhere in the codebase.

---

## Phase 17 — Interface contracts and backend service

**Depends on**: Phase 16 (needs the full pipeline to wire).

**Files**: `simengine/twin/contracts.py` (if not already created in Phase 13),
`backend/app/main.py`, `backend/app/pipeline.py`, `backend/app/schemas.py`,
`backend/requirements.txt`.

**Spec**:
1. `contracts.py`: pydantic models for every stage in Appendix F's pipeline chain
   exactly as named there: `TelemetryFrame`, `Context`, `Prediction`, `Residual`,
   `Diagnosis`, `RUL`, `Risk`. These are the literal module I/O boundaries — every
   other `simengine/twin/*` function should accept/return these types, not ad-hoc
   dicts, by this phase (retrofit earlier modules' return types to use these
   pydantic models if they were built as plain dicts in Phases 13–16).
2. `backend/app/pipeline.py`: a single function
   `run_pipeline(raw_frame) -> Risk` that calls, strictly in Appendix F's order:
   ingest → context → twin (Phase 13) → residual (Phase 14) → estimator (Phase 14)
   → detection+discriminator (Phase 15) → graph (Phase 16) → health_index
   (Phase 16) → rul (Phase 16) → mission_risk (Phase 16), returning the final
   `Risk` object plus every intermediate stage's output attached for the
   dashboard/logs (per Appendix F's closing "Dashboard · Reports · Logs" fan-out).
3. `backend/app/main.py`: study
   `sihaimodel-main/backend/app/main.py` for the pattern to reuse (WebSocket
   broadcast hub with a heartbeat, `active_websockets` set, batch/single
   ingest-endpoint duality) — reimplement that same transport pattern here, but
   have the ingest handler call `pipeline.run_pipeline()` instead of the old
   RandomForest/`reliability.py` heuristics. Expose:
   - `POST /api/telemetry/ingest` (batch or single `TelemetryFrame`)
   - `GET /api/health` (liveness)
   - `WS /ws/telemetry` (broadcasts `Risk` + intermediate stage objects per frame)
   - `GET /api/diagnosis/latest`, `GET /api/rul/latest`, `GET /api/mission-risk/latest`
     as REST fallbacks mirroring the WebSocket payload shape.
4. `backend/app/schemas.py`: request/response wrappers around the `contracts.py`
   pydantic models — keep this as thin adapters, not a second parallel schema
   (unlike `sihaimodel-main`'s 3 duplicated nominal-band tables and bar/kPa
   heuristics called out in the frontend baseline notes — do not repeat that
   duplication here; there must be exactly one place units/aliases are
   normalized, in the ingest handler, reusing `contracts.py` types everywhere
   downstream).
5. Tag every backend route/function with a comment naming its Appendix F tier
   (Edge/GCS/Ground) and target rate — this backend simulates ALL tiers in one
   process for now (a single deployable), but the tier comments document which
   parts would move to an actual edge device vs. ground station in a real
   deployment.

**Definition of Done**: `backend/app/main.py` starts with `uvicorn backend.app.main:app`
without error; a `POST /api/telemetry/ingest` with a synthetic `TelemetryFrame`
returns a well-formed response containing a `Risk` object; a WebSocket client
connected to `/ws/telemetry` receives a broadcast after an ingest call; a test
(`backend/tests/test_pipeline.py`, create this alongside `pipeline.py`) feeds a
known healthy synthetic trajectory through `run_pipeline` and asserts the
resulting tier is "Nominal" (Appendix G), then feeds a trajectory with an injected
Phase 11 fault scenario and asserts the tier escalates to at least "Advisory" and
the `Diagnosis.hypotheses` ranked list's top entry names the correct
`root_cause` from that scenario's label.

---

## Phase 18 — Frontend

**Depends on**: Phase 17 (needs a running backend to point at).

**Files**: new `frontend/` app (Vite + React), built by directly reusing
`sihaimodel-main/frontend`'s structure and assets per the baseline analysis, not
built from a blank slate.

**Steps** (do these in order):
1. Scaffold `frontend/` with the same stack as `sihaimodel-main/frontend/package.json`:
   React 18, Vite, Tailwind, Zustand, react-router-dom v7, @react-three/fiber +
   drei, recharts, framer-motion, lucide-react. Copy
   `sihaimodel-main/frontend/tailwind.config.js` into the new `frontend/` as-is
   (it is an already-good, reusable design system per the baseline analysis).
2. Copy the route/page skeleton from `sihaimodel-main/frontend/src/router.jsx`
   into the new `frontend/src/router.jsx`, RESOLVING the two known baseline
   inconsistencies rather than reproducing them: (a) `Tasks.jsx` had no route in
   the original — decide it is superseded by `MaintenancePage.jsx` and do not
   port it; (b) `EngineViewPage.jsx` and `DigitalTwinPage.jsx` overlapped in
   responsibility — merge them into one `/twin` route in the new app.
3. Port the 3D digital twin: copy the sub-assembly decomposition, material
   palette (`MAT` object), and animation-helper functions
   (`thermalTarget`, `vibrationJitter`, `rpmToSpeed`/`easeRpm`) from
   `sihaimodel-main/frontend/src/Components/engine/Rotax912Twin.jsx` and
   `Components/twin/engineAnimation.js` into the new
   `frontend/src/Components/engine/EngineTwin3D.jsx` — these are pure rendering
   primitives, safe to reuse verbatim. **Replace their data source**: instead of
   the baseline's hand-offset per-cylinder CHT split (`cylCht` in the original,
   a cosmetic scalar-offset hack) and the three-fixed-frequency vibration jitter,
   drive the new component from the real per-cylinder `Prediction`/`Residual`
   values returned by the Phase 17 backend (per-cylinder CHT/EGT are real outputs
   of the Tier B twin by this point; vibration jitter amplitude should be driven
   by the real `extract_edge_features` RMS feature from Phase 7, not a synthetic
   sine sum).
4. Rebuild the Zustand store (`frontend/src/store/useEngineStore.js`) so it holds
   a live WebSocket connection to the Phase 17 backend's `/ws/telemetry` and
   stores the received `Prediction`/`Residual`/`Diagnosis`/`RUL`/`Risk` objects
   directly (matching `contracts.py`'s field names) — DELETE the baseline's
   inline `computePhysicsExpected`/`computeSOH` heuristic functions entirely;
   the store should hold real backend output, not recompute a fake health score
   client-side.
5. Keep, port verbatim: `sihaimodel-main/frontend/src/lib/localDataSource.js`
   (its `FIELD_ALIASES`, `normalizeRecord`, `RingBuffer`, and poller/WS/SSE
   client classes are generic and framework-agnostic per the baseline analysis)
   for any local-file/offline data source page; the `DigitalTwinPanel`'s
   self-disclosure UX pattern (labeling model outputs like
   "[SIMULATED ESTIMATE]" / a "Why this score?" breakdown modal) — reimplement
   this pattern against the REAL `HealthIndex.decompose()` output from Phase 16,
   since that call already returns exactly the per-channel breakdown this UI
   pattern needs.
6. Do NOT port: the baseline's `simulation/*.ts` and `ai/*.ts` dead-code layer
   (it was never wired into the app and is superseded entirely by the real
   `simengine` backend); the baseline's `PRESETS`/scripted fault-propagation
   log strings (replace "run a fault scenario" in the new
   `RunSimulationDrawer`-equivalent with an API call that asks the Phase 17
   backend to run an actual Phase 11 fault-injection scenario against the
   simulation and stream real resulting telemetry, not canned text).
7. Wire every page from the baseline's IA (Dashboard, Telemetry, Analytics,
   Maintenance, Settings, Sensors, Faults/simulate, Health, Connection, Startup,
   Mission Control) to the corresponding real backend data: KPI tiles and the
   health index number to `HealthIndex`/`decompose()`; the alert feed to
   `Diagnosis.hypotheses`; RUL displays to `RUL{q05,q50,q95,driver}`;
   maintenance tasks to graph `record_maintenance_event` triggers; mission
   control's go/no-go to `Risk{P_success, tier, recommended_action}`.

**Definition of Done**: `npm run dev` in `frontend/` starts the app against a
running Phase 17 backend; opening the dashboard shows live-updating values
sourced from an actual backend WebSocket message (verified by injecting a known
synthetic telemetry frame via the backend's ingest endpoint and confirming the
UI updates to match, e.g. health index number changes); running a fault
injection from the UI's simulate page results in the 3D twin's thermal glow and
the health index visibly reflecting that fault within a few seconds; no
component in `frontend/src/` imports from a `simulation/` or `ai/` directory
carried over unmodified from the baseline (grep check).

---

## Phase 19 — End-to-end integration & demo

**Depends on**: Phase 18.

**Steps**:
1. Run the full Phase 11 DOE campaign (or a representative subset, e.g. 500
   missions, for turnaround time) through the Phase 17 backend's `pipeline.py`
   offline, logging every stage's output per mission.
2. Confirm, across the campaign: every fault scenario's `Diagnosis` top
   hypothesis matches its scripted `root_cause` label above a documented
   accuracy bar (choose and record a specific number, e.g. ≥80% top-1 accuracy,
   as this project's own acceptance bar — the report does not mandate a specific
   number here, but one must be fixed and tested against once real, not left
   open-ended).
3. Confirm detection latency: for scenarios with a labeled `first_detectable_h`
   (Phase 11's auto-computed label), the pipeline's actual detection time is
   close to that label (within a documented tolerance), and is demonstrably
   earlier than a naive fixed-threshold baseline would have fired (reproduce the
   report's own worked example pattern: CUSUM-based detection ahead of a fixed
   red-line threshold on the same data).
4. Re-run all five Phase 10 validation gates against the final, fully-assembled
   system (not just the isolated modules they were first written against) and
   confirm all five still pass (Gate 5 may remain `skip`ped if no external
   dataset was ever supplied — do not silently pass it without one).
5. Record a short operator-facing walkthrough (mirroring
   `sihaimodel-main/README.md`'s existing narration-script pattern, updated to
   describe the REAL pipeline rather than the prototype's scripted demo) as
   `docs/DEMO_SCRIPT.md`.

**Definition of Done**: a single command (documented in a root-level `README.md`
you create in this phase, if one does not already exist for the new build) starts
`backend/` and `frontend/` together and runs a scripted fault scenario end to end,
visibly producing: a correct top-ranked diagnosis, a health index that visibly
drops, an RUL estimate, and a mission-risk tier escalation — all traceable back to
a specific named fault from Appendix C.
