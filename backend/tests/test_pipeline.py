import numpy as np

from backend.app.pipeline import AVAILABLE_CHANNELS, EngineSession
from simengine.faults.library import FAULT_MODE_NAMES
from simengine.twin.meanvalue import Context as TwinContext
from simengine.twin.meanvalue import MeanValueTwin

TAKEOFF_MAP_Pa = 1.32e5


def _measured_from_state(twin: MeanValueTwin, state: dict) -> dict:
    rpm = state["omega_engine_rad_s"] * 60.0 / (2.0 * np.pi)
    surf = twin.surface.interpolate(rpm, state["p_MAP_Pa"])
    return {
        "MAP": state["p_MAP_Pa"], "CHT": state["T_head_K"], "coolant_temp": state["T_coolant_K"],
        "oil_pressure": state["p_oil_Pa"], "oil_temp": state["T_oil_K"],
        "EGT_proxy": surf["T_evo_K"], "rpm": rpm,
    }


def test_graph_wires_at_least_some_faults_and_documents_the_rest():
    session = EngineSession()
    assert len(session.fault_first_movers) >= 5
    assert len(session.unavailable_faults) + len(session.fault_first_movers) == len(FAULT_MODE_NAMES)
    for name in session.unavailable_faults:
        assert name in FAULT_MODE_NAMES


def test_healthy_trajectory_stays_nominal():
    session = EngineSession()
    ctx = TwinContext(MAP_command_Pa=TAKEOFF_MAP_Pa)
    truth_twin = MeanValueTwin()

    for _ in range(3000):
        session.twin.step(0.02, ctx)
        truth_twin.step(0.02, ctx)

    tiers = []
    for _ in range(200):
        state = truth_twin.step(0.02, ctx)
        measured = _measured_from_state(truth_twin, state)
        _pred, _res, _diag, _rul, risk = session.step(measured, ctx, 0.02)
        tiers.append(risk.tier)

    assert tiers[-1] == "Nominal"
    assert all(t in ("Nominal", "Watch") for t in tiers)  # never a false escalation on healthy data


def test_injected_cooling_fault_is_correctly_diagnosed_and_escalates():
    session = EngineSession()
    ctx_session = TwinContext(MAP_command_Pa=TAKEOFF_MAP_Pa)
    ctx_truth = TwinContext(MAP_command_Pa=TAKEOFF_MAP_Pa, theta={"cooling_mult": 0.35})
    truth_twin = MeanValueTwin()

    for _ in range(3000):
        session.twin.step(0.02, ctx_session)
        truth_twin.step(0.02, ctx_session)  # healthy warm-up for both

    final_diag = None
    final_risk = None
    for _ in range(4000):
        state = truth_twin.step(0.02, ctx_truth)  # fault active from here on
        measured = _measured_from_state(truth_twin, state)
        _pred, _res, diag, _rul, risk = session.step(measured, ctx_session, 0.02)
        final_diag, final_risk = diag, risk

    assert final_diag.hypotheses[0].cause == "cooling_degradation"
    assert final_risk.tier in ("Advisory", "Caution", "Warning")
    assert final_risk.authority == "crew decides"
