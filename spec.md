# Celestia — Frontend Implementation Specification

## 1. Product

**Celestia** is an engine-agnostic UAV piston-engine Digital Twin and mission health-monitoring interface.

The submission is a **frontend-first working prototype** for demonstration. It must communicate:

> A modular engine digital twin that connects mission context, telemetry, component state, causal diagnosis, prognosis, intervention analysis, and maintenance reconciliation in one continuous mission.

The product should feel like an **aerospace engineering / mission-control workstation**, not a generic SaaS dashboard and not a game.

### Important product framing

- Celestia is **engine-agnostic**.
- Do **not** expose a specific engine name anywhere in the visible UI.
- The UI should communicate:
  - `ENGINE DIGITAL TWIN`
  - `MODULAR ENGINE ARCHITECTURE`
  - `MODULAR ENGINE SUPPORT — COMING SOON`
- A deterministic internal reference engine/state may be used to drive the demo, but this implementation detail must not leak into the visible product.
- The current submission uses deterministic local/synthetic scenario data for demonstration.
- Real-flight evidence is represented separately through the ALFA replay experience.
- The prototype does not need production infrastructure.

---

# 2. Implementation Base

Use the existing friend repository:

`uav-engine-twin-main`

Do not rebuild the application from scratch unless an existing piece genuinely cannot be reused.

Inspect the existing repository first and reuse working components wherever practical, especially:

- React application structure
- Three.js / React Three Fiber engine model
- `EngineTwin3D.tsx`
- mission simulation concepts
- `FlightSimulation.tsx`
- `FlightSimulationPanel.tsx`
- `FlightMap.tsx`
- existing telemetry components
- existing health/RUL concepts
- existing causal graph patterns
- existing styling/layout primitives

The goal is to **adapt and integrate**, not replace working code unnecessarily.

---

# 3. Architecture Constraint

## Frontend only

For this submission:

- No new backend.
- No database requirement.
- No API requirement.
- No Kafka/Redis/etc.
- No authentication work.
- No production deployment infrastructure.
- No unnecessary test-suite expansion.

Use a deterministic local mission state/model.

If an existing backend/API is already required by a working component, do not spend the implementation phase building a new backend around it. Prefer a local deterministic replacement for the demo.

---

# 4. Single Shared Mission State

The entire application represents **one continuous mission**.

Every screen is another view into the same mission.

The following must be driven by the same shared state:

- mission time
- UAV position
- route
- mission phase
- engine health
- component health
- telemetry
- sensor state
- active faults
- causal graph evidence
- root-cause hypotheses
- cascade state
- prognosis/RUL
- mission risk
- alerts
- intervention state
- maintenance state

Changing mission time must update the relevant state everywhere.

Changing scenario must reset the complete deterministic mission state.

Applying an intervention must change the same mission state seen by every screen.

Applying maintenance must reconcile the same mission state rather than simply wiping all history.

---

# 5. Deterministic Scenarios

Provide these scenarios:

1. **Nominal Patrol**
2. **Thermal Degradation**
3. **Lubrication Degradation**
4. **Sensor Anomaly**
5. **Cascading Failure**

Default scenario:

**Cascading Failure**

The scenario selector may be a horizontal draggable carousel/card strip.

Each scenario must have deterministic state progression.

Do **not** use random values that change every reload.

Scenario selection must affect the complete mission:

- telemetry
- component state
- graph
- diagnosis
- prognosis
- risk
- alerts
- mission consequences
- intervention options

The scenario UI should remain fault-agnostic and professional.

---

# 6. Mission Timeline / Mini-Player

Every screen except the full Mission screen should contain a **draggable Mission Mini-Player**.

The Mini-Player contains:

- compact 2D mission map
- UAV position
- mission phase
- engine health
- selected/key telemetry
- timeline
- `-10 sec`
- play/pause
- `+10 sec`
- scrubber

The Mini-Player itself must be draggable around the screen.

Most importantly:

> The Mini-Player controls the SAME mission timeline used by every screen.

If the user scrubs from 40s to 70s:

- map position changes
- engine state changes
- telemetry changes
- graph evidence changes
- alerts change
- prognosis changes
- mission risk changes

Do not create separate fake timelines per page.

---

# 7. Mission Screen

The Mission screen is the primary operational view.

It should contain:

### Left / approximately 45–50%

**2D Tactical Mission Map**

Show:

- UAV
- route
- waypoints
- current position
- mission phase
- altitude
- heading
- deterministic environment context

The map must remain a first-class element but must not dominate the entire screen.

### Right / approximately 50–55%

**3D Engine Twin**

Show:

- 3D engine
- live engine state
- component condition
- selectable/highlightable components
- health/state information

The existing Three.js / React Three Fiber engine model should be reused where possible.

### Below

**Live Engine Telemetry**

Include useful engineering telemetry rather than decorative charts.

Examples:

- RPM
- temperature-related values
- pressure-related values
- vibration
- fuel/engine parameters
- sensor status
- residual/deviation indicators

Use whatever telemetry already exists in the repository where appropriate.

### Bottom / Event State

Show:

- active alert
- current event
- mission phase
- engine health
- mission consequence

---

# 8. Engine Twin Screen

The Engine Twin screen focuses on the engine itself.

Requirements:

- large 3D engine
- rotate
- zoom
- select component
- highlight component
- show component state
- show component health
- show associated telemetry
- show associated sensors
- show upstream/downstream dependencies

Selecting a component should expose meaningful engineering information.

Do not make the 3D model decorative.

The model is an interactive representation of the digital twin state.

---

# 9. Telemetry

Telemetry should be tied to mission time and scenario state.

Show:

- current value
- expected/reference value where meaningful
- deviation/residual
- trend
- sensor status

Avoid fake precision.

The visual language should distinguish:

- nominal
- warning
- critical
- unavailable/faulty sensor

Telemetry should support the diagnostic story rather than exist as unrelated charts.

---

# 10. Prognosis

The Prognosis screen should communicate a clear chain:

`CURRENT STATE → OBSERVED TREND → PROJECTED STATE → DEGRADATION/RUL → MISSION CONSEQUENCE → RECOMMENDATION`

Include:

- current engine health
- degradation trend
- projected state
- RUL / remaining operational margin
- confidence/uncertainty where useful
- mission consequence
- recommended action

Do not imply unjustified precision.

Use ranges or qualitative confidence when appropriate.

Do not make prognosis a generic AI prediction card.

---

# 11. Root Cause / Causal Intelligence

This is a major differentiating feature.

The page should contain a large, readable, interactive force-directed causal graph.

The graph must represent **actual Celestia relationships**, not invented placeholder semantics.

The graph should be able to express chains such as:

`CAUSE → COMPONENT/SUBSYSTEM → OBSERVED DEVIATION → SENSOR/EVIDENCE → DOWNSTREAM EFFECT → ENGINE IMPACT → MISSION IMPACT`

The graph should support:

- draggable nodes
- force-directed layout
- readable edges
- hover information
- node selection
- node inspection
- upstream tracing
- downstream tracing
- cascade highlighting
- evidence inspection

Clicking a node should reveal:

- what it is
- what it does
- current state
- health
- relevant telemetry
- evidence
- upstream dependencies
- downstream effects

### OrbitGraph reference

Keep the OrbitGraph implementation/pattern in the project as a **reference for graph interaction and local physics**.

It is a reference implementation, not the Celestia data model.

The graph must not copy fake/mock semantics from an old graph HTML demo.

The Celestia graph data must come from the actual engine/component/sensor/cause relationships represented by the application's state.

OrbitGraph principles to preserve:

- local force simulation
- draggable nodes
- spring-like edge attraction
- node repulsion
- damping
- seeded/stable layout where practical
- SVG rendering is acceptable
- hover/click reads attached data
- no network writes from the visualization

The graph should be visually impressive, dense, and technically rich. Populate it with meaningful engineering entities and derived causal/evidence relationships from the available mission state, including components, subsystems, sensors, deviations, evidence, states, risks, downstream effects, and mission impacts where applicable. Derived nodes are encouraged when they make the causal chain clearer or improve graph readability. Do not add arbitrary decorative/filler nodes that have no meaningful relationship to the engine, telemetry, diagnosis, or mission state.

---

# 12. Intervention Analysis

Use the term:

**INTERVENTION ANALYSIS**

Do not use "What-If" in the UI.

Show:

`CURRENT STATE → ACTION → PROJECTED STATE`

Compare:

- engine health
- affected component(s)
- RUL / operational margin
- mission risk
- downstream consequences

Example conceptual actions:

- continue mission
- reduce operating demand
- return/abort mission
- maintenance intervention

The exact actions can follow the existing repository implementation.

Applying an intervention must update the shared mission state.

Other screens must reflect the resulting state.

---

# 13. Maintenance / Reconciliation

Maintenance must not simply reset the engine to 100%.

Show:

`CURRENT STATE → MAINTENANCE ACTION → TWIN RECONCILIATION → UPDATED STATE → MISSION CONTINUES`

The system should visibly distinguish:

- repaired component
- remaining degradation
- updated health
- updated causal state
- updated prognosis
- continued mission context

Maintenance changes the digital twin's state and evidence rather than erasing mission history.

---

# 14. Real Flight Replay

Include a Real Flight Replay experience based on the ALFA dataset concepts already available in the project.

The UI must clearly label this as:

**REAL FLIGHT REPLAY**

Do not present it as the same thing as controlled simulation.

ALFA is used as operational/real-flight replay evidence.

It is not being claimed as validation of heavy-fuel piston-engine thermodynamics.

Where useful, communicate that the replay uses real UAV flight data and a different propulsion architecture.

No new backend is required for this.

A locally prepared deterministic replay is acceptable.

---

# 15. Engine Studio

Create/retain an Engine Studio / configuration view.

Visible language:

`ENGINE DIGITAL TWIN`

`MODULAR ENGINE ARCHITECTURE`

Configuration concepts may include:

- cylinder count
- displacement
- bore/stroke
- compression ratio
- firing order
- cycle
- combustion architecture
- fuel architecture
- injection/ignition
- cooling
- lubrication
- aspiration
- operating envelope
- sensor configuration

Do not expose a hardcoded engine name.

End the configuration experience with:

**MODULAR ENGINE SUPPORT — COMING SOON**

The point is to communicate the architecture, not to pretend that every arbitrary engine can already be configured perfectly.

---

# 16. Mission Environment

Use deterministic environment context.

Examples:

- altitude
- heading
- ambient temperature
- wind
- mission phase
- operating demand

No live weather integration is required.

---

# 17. Visual Design

The interface should look like an aerospace engineering workstation.

### Preferred visual language

- near-black / graphite background
- warm white / light gray text
- amber as primary operational accent
- muted cyan for telemetry
- green for nominal
- amber/orange for warning
- red for critical
- dense but readable technical information
- restrained borders
- clear hierarchy
- engineering-console feel

### Avoid

- neon cyberpunk
- purple gradients
- generic AI SaaS dashboards
- excessive blue glow
- glassmorphism
- giant decorative cards
- game HUD styling
- unnecessary animations
- decorative SVGs that communicate nothing
- huge text blocks

War Thunder may be used only as inspiration for operator interaction/mission awareness.

Do not make Celestia look like a game.

---

# 18. Navigation

Provide clear access to:

- Mission
- Engine Twin
- Telemetry
- Prognosis
- Root Cause / Causal Intelligence
- Intervention Analysis
- Maintenance
- Real Flight Replay
- Engine Studio

Every page should preserve mission context.

Do not make each page feel like a separate application.

---

# 19. Scope Rules

## Must do

- reuse the friend repository
- implement a coherent shared mission state
- make the timeline actually drive state
- make scenarios deterministic
- make the 3D engine interactive
- make the mission map functional
- make telemetry time-dependent
- make prognosis tied to state
- make the causal graph inspectable
- make interventions affect state
- make maintenance reconcile state
- provide Real Flight Replay
- provide Engine Studio
- maintain aerospace-console visual language

## Do not do

- do not build a new backend
- do not add production infrastructure
- do not add authentication
- do not introduce databases unless an existing implementation absolutely requires one
- do not replace working components without reason
- do not use random telemetry
- do not create disconnected page-specific mock data
- do not invent causal relationships just to fill the graph
- do not expose the internal demo engine name
- do not claim ALFA validates piston-engine physics
- do not turn the product into a generic AI dashboard
- do not turn the product into a game
- do not over-engineer
- do not expand scope without approval

---

# 20. Definition of Done

The prototype is successful when a judge can:

1. Open Mission.
2. See the UAV mission and 3D engine simultaneously.
3. Start or scrub the mission.
4. See the same mission state reflected across the application.
5. Observe a deterministic failure/degradation scenario.
6. Inspect telemetry deviations.
7. Open the engine and inspect affected components.
8. Open causal intelligence and trace the failure through the graph.
9. Inspect prognosis and mission consequence.
10. Compare an intervention.
11. Apply an intervention and see the mission state change.
12. Inspect maintenance/reconciliation.
13. Open Real Flight Replay and understand that it is separate real-flight evidence.
14. Open Engine Studio and understand the modular architecture direction.

The experience should tell one continuous engineering story rather than a collection of unrelated pages.
