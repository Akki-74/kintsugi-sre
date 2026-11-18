"""
KubePulse AI — FastAPI & WebSocket Command Center Backend
=========================================================
Bridges Phase 1 Multi-Modal Predictions, Phase 2 LangGraph Agent,
and the React SRE Command Center UI.
"""

import os
import sys
import json
import asyncio
from pathlib import Path
from typing import Dict, Any, Optional

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from backend.replay_engine import DigitalTwinReplayEngine

app = FastAPI(
    title="KubePulse AI Backend",
    description="Autonomous Multi-Modal Kubernetes Failure Prediction & Ambient Remediation Engine",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global replay & agent instance
engine = DigitalTwinReplayEngine()

# Active WebSocket subscribers
active_connections: list[WebSocket] = []

# Mount static frontend build if present
frontend_dist = PROJECT_ROOT / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/app", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")


class ChaosRequest(BaseModel):
    service: str
    fault_type: str  # cpu_contention, memory_leak, exception, disk_pressure, network_delay


class ModeRequest(BaseModel):
    autonomous: bool


@app.get("/")
def root():
    return {
        "system": "KubePulse AI",
        "tagline": "Autonomous Multi-Modal Kubernetes Failure Prediction & Ambient Remediation System",
        "status": "ONLINE",
        "mode": engine.agent.k8s.mode,
        "autonomous_mode": engine.autonomous_mode,
        "active_connections": len(active_connections)
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "cluster_mode": engine.agent.k8s.mode,
        "is_k8s_connected": engine.agent.k8s.is_connected,
        "dataset_rows": len(engine.holdout_df),
        "autonomous_mode": engine.autonomous_mode,
    }


@app.get("/api/topology")
def get_topology():
    """Returns the 10-service Google OnlineBoutique topology graph."""
    nodes = [
        {"id": "frontend", "name": "Frontend", "type": "gateway", "layer": 0},
        {"id": "checkoutservice", "name": "CheckoutService", "type": "core", "layer": 1},
        {"id": "cartservice", "name": "CartService", "type": "cache", "layer": 2},
        {"id": "productcatalogservice", "name": "ProductCatalog", "type": "catalog", "layer": 2},
        {"id": "currencyservice", "name": "CurrencyService", "type": "finance", "layer": 2},
        {"id": "paymentservice", "name": "PaymentService", "type": "finance", "layer": 2},
        {"id": "shippingservice", "name": "ShippingService", "type": "logistics", "layer": 2},
        {"id": "recommendationservice", "name": "Recommendation", "type": "ml", "layer": 2},
        {"id": "adservice", "name": "AdService", "type": "ads", "layer": 2},
        {"id": "emailservice", "name": "EmailService", "type": "notification", "layer": 2},
    ]

    edges = [
        {"source": "frontend", "target": "checkoutservice"},
        {"source": "frontend", "target": "cartservice"},
        {"source": "frontend", "target": "productcatalogservice"},
        {"source": "frontend", "target": "currencyservice"},
        {"source": "frontend", "target": "recommendationservice"},
        {"source": "frontend", "target": "shippingservice"},
        {"source": "frontend", "target": "adservice"},
        {"source": "checkoutservice", "target": "paymentservice"},
        {"source": "checkoutservice", "target": "emailservice"},
        {"source": "checkoutservice", "target": "shippingservice"},
        {"source": "checkoutservice", "target": "cartservice"},
        {"source": "checkoutservice", "target": "currencyservice"},
        {"source": "checkoutservice", "target": "productcatalogservice"},
        {"source": "recommendationservice", "target": "productcatalogservice"},
    ]

    return {"nodes": nodes, "edges": edges}


@app.get("/api/benchmark")
def get_benchmark_results():
    """Returns Phase 1 Ablation and Phase 2 Remediation metrics."""
    phase1_meta_path = PROJECT_ROOT / "phase1_prediction" / "saved_models" / "model_metadata.json"
    phase2_bench_path = PROJECT_ROOT / "docs" / "remediation_benchmark.json"

    p1 = {}
    p2 = []
    if phase1_meta_path.exists():
        with open(phase1_meta_path, "r", encoding="utf-8") as f:
            p1 = json.load(f)
    if phase2_bench_path.exists():
        with open(phase2_bench_path, "r", encoding="utf-8") as f:
            p2 = json.load(f)

    return {
        "phase1_prediction": p1,
        "phase2_remediation": p2
    }


@app.post("/api/chaos/inject")
def inject_chaos(req: ChaosRequest):
    """Trigger manual chaos injection on a specific microservice."""
    result = engine.inject_chaos(req.service, req.fault_type)
    return result


@app.post("/api/agent/mode")
def set_agent_mode(req: ModeRequest):
    """Toggle between Autonomous mode and Human-in-the-Loop mode."""
    engine.set_autonomous_mode(req.autonomous)
    return {"autonomous_mode": engine.autonomous_mode}


@app.post("/api/agent/approve")
def approve_action():
    """Operator approval in Human-in-the-Loop mode."""
    return engine.approve_pending_plan()


@app.post("/api/agent/reject")
def reject_action():
    """Operator rejection in Human-in-the-Loop mode."""
    return engine.reject_pending_plan()


@app.get("/api/cluster/snapshot")
def get_cluster_snapshot():
    return engine.agent.k8s.get_cluster_snapshot()


# ──────────────────────────────────────────────────────────────────────────────
# REAL-TIME TELEMETRY WEBSOCKET STREAM
# ──────────────────────────────────────────────────────────────────────────────
@app.websocket("/ws/telemetry")
async def websocket_telemetry_stream(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    print(f"WebSocket client connected. Active: {len(active_connections)}")

    try:
        while True:
            # Generate next telemetry tick from held-out digital twin replay
            tick_data = engine.get_next_tick()
            await websocket.send_json(tick_data)
            await asyncio.sleep(engine.tick_speed_sec)
    except WebSocketDisconnect:
        active_connections.remove(websocket)
        print(f"WebSocket client disconnected. Remaining: {len(active_connections)}")
    except Exception as e:
        if websocket in active_connections:
            active_connections.remove(websocket)
        print(f"WebSocket error: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
