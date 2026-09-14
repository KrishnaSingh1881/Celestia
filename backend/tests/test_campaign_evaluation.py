"""Phase 19: run a small representative campaign through the REAL pipeline
(EngineSession driven by an independent "truth" MeanValueTwin) and check
top-1 diagnosis accuracy.

Honest scope: simengine.faults.campaign.generate_campaign() can produce a
scenario for any of the 21 physical fault modes, but simengine.twin.
meanvalue.MeanValueTwin only exposes FOUR theta hooks today
(eta_v_mult, friction_mult, eta_vol_pump, cooling_mult) - not one per fault.
Two of backend.app.pipeline.EngineSession's 8 wired faults have a theta hook
that was verified (by hand, before writing this test) to actually drive
their OWN declared first-mover channels correctly:
  - cooling_degradation -> theta={"cooling_mult": <1.0}  (coolant_temp + CHT rise)
  - oil_pump_wear       -> theta={"eta_vol_pump": <1.0}  (oil_pressure falls)
A third candidate (main_rod_bearing_wear via friction_mult) was tried and
rejected: friction_mult moves oil_pressure far more than oil_temp in this
model, so it gets diagnosed as oil_pump_wear instead of
main_rod_bearing_wear - a real model limitation (friction_mult is not
actually a clean proxy for bearing wear's declared signature), documented
here rather than silently worked around. Extending the remaining 6 wired
faults (and the other 13 unavailable ones) to real theta hooks is future
work - see backend/app/pipeline.py's own scope note.

This test therefore evaluates exactly 3 classes: healthy, cooling_degradation,
oil_pump_wear.
"""
import numpy as np
import pytest

from backend.app.pipeline import EngineSession
from simengine.twin.meanvalue import Context as TwinContext
from simengine.twin.meanvalue import MeanValueTwin

FAULT_THETA_INJECTORS = {
    "healthy": {},
    "cooling_degradation": {"cooling_mult": 0.35},
    "oil_pump_wear": {"eta_vol_pump": 0.4},
}

TAKEOFF_MAP_Pa = 1.32e5
N_MISSIONS_PER_CLASS = 5
N_WARMUP_STEPS = 3000
N_FAULT_STEPS = 2000
DT_S = 0.02


def _measured_from_state(twin: MeanValueTwin, state: dict) -> dict:
    rpm = state["omega_engine_rad_s"] * 60.0 / (2.0 * np.pi)
    surf = twin.surface.interpolate(rpm, state["p_MAP_Pa"])
    return {
        "MAP": state["p_MAP_Pa"], "CHT": state["T_head_K"], "coolant_temp": state["T_coolant_K"],
        "oil_pressure": state["p_oil_Pa"], "oil_temp": state["T_oil_K"],
        "EGT_proxy": surf["T_evo_K"], "rpm": rpm,
    }


def _run_one_mission(true_label: str, seed: int) -> str:
    """Returns the pipeline's top-1 diagnosed cause after N_FAULT_STEPS of
    the labeled condition, having warmed up healthy first."""
    session = EngineSession()
    ctx_session = TwinContext(MAP_command_Pa=TAKEOFF_MAP_Pa)
    ctx_truth_healthy = TwinContext(MAP_command_Pa=TAKEOFF_MAP_Pa)
    ctx_truth_labeled = TwinContext(
        MAP_command_Pa=TAKEOFF_MAP_Pa, theta=FAULT_THETA_INJECTORS[true_label]
    )
    truth = MeanValueTwin()

    for _ in range(N_WARMUP_STEPS):
        session.twin.step(DT_S, ctx_session)
        truth.step(DT_S, ctx_truth_healthy)

    top_cause = "healthy"
    for _ in range(N_FAULT_STEPS):
        state = truth.step(DT_S, ctx_truth_labeled)
        measured = _measured_from_state(truth, state)
        _pred, _res, diagnosis, _rul, _risk = session.step(measured, ctx_session, DT_S)
        if diagnosis.hypotheses and diagnosis.hypotheses[0].probability > 0.5:
            top_cause = diagnosis.hypotheses[0].cause
        else:
            top_cause = "healthy"
    return top_cause


@pytest.mark.parametrize("true_label", list(FAULT_THETA_INJECTORS.keys()))
def test_diagnosis_matches_label_across_a_small_campaign(true_label):
    correct = 0
    for i in range(N_MISSIONS_PER_CLASS):
        diagnosed = _run_one_mission(true_label, seed=i)
        if diagnosed == true_label:
            correct += 1
    accuracy = correct / N_MISSIONS_PER_CLASS
    assert accuracy >= 0.8, f"{true_label}: top-1 accuracy {accuracy:.0%} across {N_MISSIONS_PER_CLASS} missions"
