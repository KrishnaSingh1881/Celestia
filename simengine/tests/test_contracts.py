import pytest

from simengine.twin.contracts import (
    Context,
    Diagnosis,
    Hypothesis,
    Prediction,
    Residual,
    Risk,
    RUL,
    TelemetryFrame,
)


def test_telemetry_frame_round_trips_through_json():
    frame = TelemetryFrame(t=12.5, channel={"CHT": 380.0, "oil_pressure": 2.8e5}, quality={"CHT": 1.0})
    restored = TelemetryFrame.model_validate_json(frame.model_dump_json())
    assert restored == frame


def test_context_defaults_are_sensible():
    ctx = Context()
    assert ctx.ambient_T_K == pytest.approx(288.15)
    assert ctx.ambient_p_Pa == pytest.approx(101325.0)


def test_diagnosis_holds_a_ranked_hypothesis_list_not_a_single_verdict():
    diag = Diagnosis(
        hypotheses=[
            Hypothesis(cause="injector_clogging", probability=0.63, evidence=["CHT split"]),
            Hypothesis(cause="sensor_drift", probability=0.24, evidence=["single channel"]),
        ]
    )
    assert len(diag.hypotheses) == 2
    assert diag.hypotheses[0].probability > diag.hypotheses[1].probability


def test_rul_and_risk_construct_with_required_fields():
    rul = RUL(component="bearing", q05_h=50.0, q50_h=80.0, q95_h=120.0, driver="wear")
    risk = Risk(P_success=0.9, tier="Advisory", recommended_action="reduce power to 65%")
    assert rul.component == "bearing"
    assert risk.authority == "crew decides"


def test_prediction_and_residual_default_to_empty_not_none():
    pred = Prediction()
    res = Residual()
    assert pred.y_hat == {}
    assert res.flags == {}
