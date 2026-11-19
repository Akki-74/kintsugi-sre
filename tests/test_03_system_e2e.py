"""
Tier 3: System & Web E2E Test Suite
===================================
Tests:
  1. Full REST API Contract: All endpoints (/health, /api/status, /api/topology,
     /api/benchmark, /api/chaos/inject, /api/agent/mode, /api/agent/backend,
     /api/cluster/source, /api/cluster/snapshot).
  2. Live WebSocket Telemetry Contract: Connects to /ws/telemetry and validates
     the tick payload schema.
  3. Webpage & Static Asset Integrity: Verifies /app/ and /assets/*.js / .css serve
     with 200 OK and proper content headers.
"""

import os
import sys
import pytest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


# ──────────────────────────────────────────────────────────────────────────────
# 1. Full REST API E2E Contract Tests
# ──────────────────────────────────────────────────────────────────────────────
class TestRestApiContract:
    def test_health_endpoint(self):
        res = client.get("/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "healthy"
        assert "cluster_mode" in data
        assert "autonomous_mode" in data

    def test_api_status_endpoint(self):
        res = client.get("/api/status")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "healthy"
        assert "llm_backend" in data

    def test_topology_graph_endpoint(self):
        res = client.get("/api/topology")
        assert res.status_code == 200
        data = res.json()
        assert "nodes" in data
        assert "edges" in data
        assert len(data["nodes"]) == 10
        service_ids = [n["id"] for n in data["nodes"]]
        assert "frontend" in service_ids
        assert "checkoutservice" in service_ids
        assert "cartservice" in service_ids

    def test_benchmark_metadata_endpoint(self):
        res = client.get("/api/benchmark")
        assert res.status_code == 200
        data = res.json()
        assert "phase1_prediction" in data
        assert "phase2_remediation" in data
        p1 = data["phase1_prediction"]
        # Confirm SARIMA vs XGBoost is included
        assert "sarima_vs_xgboost" in p1
        assert "ablation_results" in p1

    def test_agent_mode_toggle(self):
        # Autonomous -> False
        res = client.post("/api/agent/mode", json={"autonomous": False})
        assert res.status_code == 200
        assert res.json()["autonomous_mode"] is False

        # Autonomous -> True
        res = client.post("/api/agent/mode", json={"autonomous": True})
        assert res.status_code == 200
        assert res.json()["autonomous_mode"] is True

    def test_agent_backend_hot_swap(self):
        # Switch to lmstudio
        res = client.post("/api/agent/backend", json={"backend": "lmstudio"})
        assert res.status_code == 200
        assert res.json()["preferred_backend"] == "lmstudio"

        # Switch back to groq
        res = client.post("/api/agent/backend", json={"backend": "groq"})
        assert res.status_code == 200
        assert res.json()["preferred_backend"] == "groq"

    def test_cluster_source_hot_swap(self):
        # Switch to replay
        res = client.post("/api/cluster/source", json={"source": "replay"})
        assert res.status_code == 200
        assert res.json()["cluster_source"] == "replay"

    def test_chaos_injection_endpoint(self):
        res = client.post("/api/chaos/inject", json={"service": "checkoutservice", "fault_type": "cpu_contention"})
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "CHAOS_INJECTED"
        assert data["service"] == "checkoutservice"
        assert data["fault"] == "CPU_EXHAUSTION"

    def test_cluster_snapshot_endpoint(self):
        res = client.get("/api/cluster/snapshot")
        assert res.status_code == 200
        data = res.json()
        assert "state" in data
        assert "services" in data["state"]
        assert "nodes" in data["state"]


# ──────────────────────────────────────────────────────────────────────────────
# 2. Live WebSocket Telemetry Contract Test
# ──────────────────────────────────────────────────────────────────────────────
class TestWebSocketTelemetryContract:
    def test_websocket_telemetry_streaming(self):
        with client.websocket_connect("/ws/telemetry") as websocket:
            data = websocket.receive_json()
            assert "tick_index" in data
            assert "service" in data
            assert "metrics" in data
            assert "prediction" in data
            assert "cluster_state" in data

            # Validate metrics schema
            metrics = data["metrics"]
            assert "CpuUsageRate(%)" in metrics
            assert "MemoryUsageRate(%)" in metrics


# ──────────────────────────────────────────────────────────────────────────────
# 3. Webpage & Static Asset Integrity Tests
# ──────────────────────────────────────────────────────────────────────────────
class TestWebpageAndStaticAssets:
    def test_app_spa_delivery(self):
        res = client.get("/app/")
        assert res.status_code == 200
        assert "Kintsugi" in res.text
        assert '<div id="root">' in res.text

    def test_static_assets_resolved_200(self):
        dist_assets = PROJECT_ROOT / "frontend" / "dist" / "assets"
        assert dist_assets.exists(), "frontend/dist/assets does not exist"

        js_files = list(dist_assets.glob("*.js"))
        css_files = list(dist_assets.glob("*.css"))

        assert len(js_files) > 0, "No compiled JS bundle found"
        assert len(css_files) > 0, "No compiled CSS bundle found"

        # Verify JS asset serves with 200
        js_name = js_files[0].name
        res_js = client.get(f"/assets/{js_name}")
        assert res_js.status_code == 200
        assert "javascript" in res_js.headers.get("content-type", "").lower()

        # Verify CSS asset serves with 200
        css_name = css_files[0].name
        res_css = client.get(f"/assets/{css_name}")
        assert res_css.status_code == 200
        assert "css" in res_css.headers.get("content-type", "").lower()
