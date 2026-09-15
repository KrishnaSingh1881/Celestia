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
    assert kinds <= {"component", "parameter", "observable", "context", "equation", "output"}
    for edge in body["edges"]:
        assert 0.0 <= edge["confidence"] <= 1.0


def test_graph_topology_includes_the_full_architecture_layer():
    """The fault causal graph alone only covers component<->observable -
    /api/graph/topology also merges in the static input/equation/output
    layer (backend.app.pipeline.architecture_nodes_and_edges()), so a
    client sees the whole real pipeline, not just the fault-diagnosis slice."""
    client = TestClient(app)
    client.post("/api/session/reset")
    client.post("/api/telemetry/ingest", json=_frame())
    body = client.get("/api/graph/topology").json()

    nodes_by_kind: dict[str, set[str]] = {}
    for n in body["nodes"]:
        nodes_by_kind.setdefault(n["kind"], set()).add(n["id"])

    assert nodes_by_kind["context"] == {
        "altitude_m", "airspeed_m_s", "phase", "ambient_T_K", "ambient_p_Pa", "throttle_pct",
    }
    assert {"thermal_network", "oil_circuit", "causal_diagnosis", "rul_estimation", "mission_risk"} <= nodes_by_kind["equation"]
    assert nodes_by_kind["output"] == {"residual_out", "diagnosis_out", "rul_out", "risk_out"}

    node_ids = {n["id"] for n in body["nodes"]}
    for edge in body["edges"]:
        assert edge["source"] in node_ids
        assert edge["target"] in node_ids


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


def _wait_for_simulation_to_finish(client, timeout_s=15.0):
    import time

    deadline = time.monotonic() + timeout_s
    status = client.get("/api/simulation/status").json()
    while status["running"] and time.monotonic() < deadline:
        time.sleep(0.2)
        status = client.get("/api/simulation/status").json()
    return status


def test_simulation_start_runs_healthy_and_reports_progress():
    with TestClient(app) as client:
        client.post("/api/session/reset")
        start = client.post(
            "/api/simulation/start",
            json={
                "phases": [
                    {"name": "Climb", "duration_h": 0.02, "throttle_pct": 100.0},
                    {"name": "Cruise", "duration_h": 0.05, "throttle_pct": 65.0},
                ],
                "fault": {"mode": "none"},
                "real_seconds_per_sim_hour": 5.0,
            },
        )
        assert start.status_code == 200
        assert start.json()["running"] is True

        status = _wait_for_simulation_to_finish(client)
        assert status["running"] is False
        assert status["error"] is None
        assert status["progress_pct"] == pytest.approx(100.0, abs=1.0)

        # A healthy scripted flight must not surface a confident diagnosis -
        # regression guard for a real bug found in development where the
        # session-side twin started cold relative to an already-warmed-up
        # truth twin and was misdiagnosed as cooling_degradation.
        diagnosis = client.get("/api/diagnosis/latest").json()
        top = diagnosis["hypotheses"][0] if diagnosis["hypotheses"] else None
        assert top is None or top["probability"] < 0.5

        risk = client.get("/api/mission-risk/latest").json()
        assert risk["health_index"] == pytest.approx(100.0, abs=1.0)


def test_simulation_with_cooling_fault_is_diagnosed_and_lowers_health():
    with TestClient(app) as client:
        client.post("/api/session/reset")
        client.post(
            "/api/simulation/start",
            json={
                "phases": [{"name": "Cruise", "duration_h": 0.12, "throttle_pct": 80.0}],
                "fault": {"mode": "cooling_degradation", "onset_frac": 0.1, "end_severity": 0.6, "shape": "linear"},
                "real_seconds_per_sim_hour": 5.0,
            },
        )
        status = _wait_for_simulation_to_finish(client)
        assert status["error"] is None

        diagnosis = client.get("/api/diagnosis/latest").json()
        top = diagnosis["hypotheses"][0]
        assert top["cause"] == "cooling_degradation"
        assert top["probability"] > 0.5

        risk = client.get("/api/mission-risk/latest").json()
        assert risk["health_index"] < 100.0


def test_simulation_stop_halts_a_running_simulation():
    with TestClient(app) as client:
        client.post("/api/session/reset")
        client.post(
            "/api/simulation/start",
            json={
                "phases": [{"name": "Cruise", "duration_h": 5.0, "throttle_pct": 70.0}],
                "real_seconds_per_sim_hour": 90.0,
            },
        )
        assert client.get("/api/simulation/status").json()["running"] is True

        stop = client.post("/api/simulation/stop")
        assert stop.status_code == 200
        assert stop.json()["running"] is False
        assert client.get("/api/simulation/status").json()["running"] is False


def test_simulation_start_rejects_empty_phase_list():
    with TestClient(app) as client:
        response = client.post("/api/simulation/start", json={"phases": []})
        assert response.status_code == 422
