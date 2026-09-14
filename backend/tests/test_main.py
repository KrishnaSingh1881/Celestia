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
