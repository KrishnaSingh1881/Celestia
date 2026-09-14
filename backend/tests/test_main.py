import pytest
from fastapi.testclient import TestClient

from backend.app.main import app


def _frame(t=0.0, **channel_overrides):
    channel = {
        "MAP": 1.32e5, "CHT": 350.0, "coolant_temp": 340.0, "oil_pressure": 3.0e5,
        "oil_temp": 330.0, "EGT_proxy": 2100.0, "rpm": 5800.0,
    }
    channel.update(channel_overrides)
    return {"t": t, "channel": channel, "context": {"throttle_pct": 100.0}, "dt_s": 0.02}


def test_health_endpoint():
    client = TestClient(app)
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_single_ingest_returns_a_full_pipeline_result():
    client = TestClient(app)
    client.post("/api/session/reset")
    response = client.post("/api/telemetry/ingest", json=_frame())
    assert response.status_code == 200
    result = response.json()["results"][0]
    for key in ("prediction", "residual", "diagnosis", "rul", "risk"):
        assert key in result
    assert result["risk"]["authority"] in ("none", "crew decides")


def test_batch_ingest_returns_one_result_per_frame():
    client = TestClient(app)
    client.post("/api/session/reset")
    batch = {"frames": [_frame(t=float(i) * 0.02) for i in range(10)]}
    response = client.post("/api/telemetry/ingest/batch", json=batch)
    assert response.status_code == 200
    assert len(response.json()["results"]) == 10


def test_latest_endpoints_reflect_the_most_recent_ingest():
    client = TestClient(app)
    client.post("/api/session/reset")
    client.post("/api/telemetry/ingest", json=_frame())

    diag = client.get("/api/diagnosis/latest").json()
    rul = client.get("/api/rul/latest").json()
    risk = client.get("/api/mission-risk/latest").json()
    assert "hypotheses" in diag
    assert "component" in rul
    assert "tier" in risk


def test_websocket_receives_a_broadcast_after_ingest():
    client = TestClient(app)
    client.post("/api/session/reset")
    with client.websocket_connect("/ws/telemetry") as websocket:
        client.post("/api/telemetry/ingest", json=_frame())
        message = websocket.receive_json()
        assert "risk" in message
        assert "tier" in message["risk"]


def test_session_reset_clears_latest_result():
    client = TestClient(app)
    client.post("/api/telemetry/ingest", json=_frame())
    assert client.get("/api/rul/latest").json() is not None

    client.post("/api/session/reset")
    assert client.get("/api/rul/latest").json() is None


def test_graph_topology_returns_nodes_and_edges():
    client = TestClient(app)
    client.post("/api/session/reset")
    client.post("/api/telemetry/ingest", json=_frame())
    response = client.get("/api/graph/topology")
    assert response.status_code == 200
    body = response.json()
    assert len(body["nodes"]) > 0
    assert len(body["edges"]) > 0
    kinds = {n["kind"] for n in body["nodes"]}
    assert kinds <= {"component", "parameter", "observable", "context"}
    for edge in body["edges"]:
        assert 0.0 <= edge["confidence"] <= 1.0


def test_health_breakdown_sums_back_to_deficit():
    client = TestClient(app)
    client.post("/api/session/reset")
    client.post("/api/telemetry/ingest", json=_frame())
    response = client.get("/api/health/breakdown")
    assert response.status_code == 200
    body = response.json()
    assert "health_index" in body
    total_contribution = sum(body["contributions"].values())
    assert total_contribution == pytest.approx(body["health_index"] - 100.0, abs=1e-6)


def test_mission_plan_computes_per_segment_and_overall_survival():
    client = TestClient(app)
    client.post("/api/session/reset")
    client.post("/api/telemetry/ingest", json=_frame())

    plan_request = {
        "segments": [
            {"name": "Climb", "duration_h": 0.5, "power_pct": 100.0},
            {"name": "Cruise", "duration_h": 4.0, "power_pct": 70.0},
            {"name": "Descent", "duration_h": 0.5, "power_pct": 40.0},
        ]
    }
    response = client.post("/api/mission/plan", json=plan_request)
    assert response.status_code == 200
    body = response.json()
    assert len(body["segments"]) == 3
    assert body["total_duration_h"] == pytest.approx(5.0)
    assert 0.0 <= body["overall_survival_probability"] <= 1.0
    assert body["overall_tier"] in ("Nominal", "Watch", "Advisory", "Caution", "Warning")

    # a higher-power segment must show lower (or equal) survival probability
    # than a lower-power segment of the same duration, holding RUL fixed
    high_power = client.post(
        "/api/mission/plan",
        json={"segments": [{"name": "A", "duration_h": 1.0, "power_pct": 100.0}]},
    ).json()
    low_power = client.post(
        "/api/mission/plan",
        json={"segments": [{"name": "A", "duration_h": 1.0, "power_pct": 30.0}]},
    ).json()
    assert high_power["segments"][0]["survival_probability"] <= low_power["segments"][0]["survival_probability"]

    # GET reflects the most recently POSTed plan
    fetched = client.get("/api/mission/plan").json()
    assert fetched["total_duration_h"] == pytest.approx(1.0)
