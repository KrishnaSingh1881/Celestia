# AeroTwin (Celestia SIH26054) Technical Documentation

Welcome to the technical documentation suite for **AeroTwin**, a physics-grounded digital twin for MALE-UAV aero piston engines.

---

## Documentation Index

| # | Document | Description |
|---|---|---|
| **01** | [Architecture Overview](01_architecture_overview.md) | High-level system architecture, tier breakdown (Tier A, Tier B, Edge/GCS), and telemetry pipeline flow. |
| **02** | [Physics Engine Spec](02_physics_engine_spec.md) | Crank-angle-resolved thermodynamic cycle equations (kinematics, Wiebe combustion, Woschni heat transfer, Chen-Flynn friction). |
| **03** | [Twin & Estimation Spec](03_twin_and_estimation_spec.md) | Real-time Tier B 8-state ODE twin, 4D residual calculation, UKF state estimator, and parity space discriminator. |
| **04** | [Fault Diagnosis & Prognosis](04_fault_diagnosis_and_prognosis.md) | 21 fault library modes, dynamic causal health graph inference, Health Index (HI), RUL prognosis, and advisory risk classifier. |
| **05** | [Backend API & Telemetry](05_backend_api_and_telemetry.md) | FastAPI REST service specifications, Pydantic contracts, batch telemetry ingest, and WebSocket streaming protocol. |
| **06** | [Frontend Dashboard Guide](06_frontend_dashboard_guide.md) | React 19 / TypeScript architecture, Zustand state store, Three.js 3D twin canvas, and telemetry diagnostic views. |
| **07** | [Validation & Testing Suite](07_validation_and_testing_suite.md) | Breakdown of the 5 validation gates (conservation, external ratings, sensitivity, model agreement) and pytest execution guide. |
| **08** | [Deployment & Operations](08_deployment_and_ops_guide.md) | Quick start with `./start.sh`, manual step-by-step setup, configuration parameters, and honest technical limitations. |

---

## Quick Reference Links

- **Main Repository README**: [`../README.md`](../README.md)
- **Build Roadmap**: [`../docs/BUILD_ROADMAP.md`](../docs/BUILD_ROADMAP.md)
- **Demo Walkthrough Script**: [`../docs/DEMO_SCRIPT.md`](../docs/DEMO_SCRIPT.md)
- **Launcher Script**: [`../start.sh`](../start.sh)
