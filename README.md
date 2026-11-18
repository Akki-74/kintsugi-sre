# 🏺 Kintsugi-AI
**Autonomous Multi-Modal Kubernetes Failure Prediction & Ambient Remediation System**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Python: 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)](https://fastapi.tiangolo.com)
[![LangGraph](https://img.shields.io/badge/LangGraph-StateGraph-orange.svg)](https://github.com/langchain-ai/langgraph)
[![XGBoost](https://img.shields.io/badge/XGBoost-2.0+-red.svg)](https://xgboost.readthedocs.io)
[![Cost](https://img.shields.io/badge/Total%20Cost-%240.00%20(Free%20Tier)-brightgreen.svg)]()

> **Kintsugi-AI** takes its name from the traditional Japanese art of *Kintsugi* (金継ぎ)—mending broken ceramics with gold lacquer so the repaired object emerges stronger and more resilient than before.
> 
> Applied to Site Reliability Engineering, **Kintsugi-AI** combines a **Fast Brain** (Multi-Modal XGBoost & Resource Trajectory Regressor) for sub-second onset detection and gradual horizon forecasting with a **Slow Brain** (Guardrailed LangGraph Ambient SRE Agent) that autonomously diagnoses container telemetry, enforces 5 deterministic SRE safety checks, and remediates live Kubernetes clusters via the official Kubernetes Python API.

---

## 📊 Benchmark Verification Checkpoint

| Metric | Multi-Modal XGBoost (Model 3) | Prometheus Thresholds (Baseline 0) | Delta / Engineering Gain |
| :--- | :--- | :--- | :--- |
| **Overall Macro-F1** | **0.7052** | 0.2715 | **+0.4337 Macro-F1 (+159%)** |
| **Anomaly Binary F1** | **0.7610** | 0.1977 | **+0.5633 (+285%)** |
| **Regime A Detection Latency ($\Delta t$)** | **90.1 seconds** | 148.0 seconds | **-57.9s Faster Root-Cause Alert** |
| **Root-Cause Localization (Top-1)** | **70.8%** | 33.3% | **+37.5% Localization Accuracy** |
| **Regime B Forecasting Lead Time** | **4.6 minutes** | 0.0 minutes | **+4.6 min Early Crash Warning** |
| **False Alarm Rate (FA/hr)** | **2.73 / hr** | 14.80 / hr | **Noise Reduction (Zero Alert Fatigue)** |
| **Mean Time To Remediate (MTTR)** | **27.6 seconds** | N/A (Manual SRE) | **Sub-Minute Closed-Loop Healing** |

---

## 🏛️ Two-Brain System Architecture

```text
+-----------------------------------------------------------------------------------+
|                   DATA SOURCES & KUBERNETES ENVIRONMENTS                          |
|  Mode A: Nezha OnlineBoutique Multi-Modal Dataset (Train / Test / Demo Holdout)   |
|  Mode B: Live Local `kind` Kubernetes Cluster (Prometheus + K8s API + Chaos Pods) |
+---------------------+-----------------------------------------+-------------------+
                      | (Metrics Stream)                        | (Logs & K8s Events)
                      v                                         v
+-----------------------------------------------------------------------------------+
|                 PHASE 1: MULTI-MODAL PREDICTION ENGINE ("Fast Brain")             |
|                                                                                   |
|  1. Baseline-Relative Feature Pipeline      2. Drain3 Log Template Extractor      |
|     (Z-score vs healthy baseline, slopes,      (Sliding window error counts,      |
|      rolling means/stds, lag deltas)            exception & warning frequencies)  |
|                        \                                   /                      |
|                         v                                 v                       |
|        +-----------------------------------------------------------------+        |
|        |  Multi-Modal XGBoost Classifier + Resource Trajectory Regressor |        |
|        |  Outputs: Fault Class (6 states), Target Service, Confidence %, |        |
|        |           Regime (Onset Detection vs. Time-to-Exhaustion)       |        |
|        +--------------------------------+--------------------------------+        |
+-----------------------------------------|-----------------------------------------+
                                          | (Wakes Agent if Confidence >= 0.50
                                          |  AND Cooldown Lock == False)
                                          v
+-----------------------------------------------------------------------------------+
|               PHASE 2: LANGGRAPH AMBIENT SRE AGENT ("Slow Brain")                 |
|                                                                                   |
|  [1. Context Collector] -> Pulls K8s Pod Status, Resource Specs & Last 30 Logs    |
|            |                                                                      |
|            v                                                                      |
|  [2. Structured Reasoner] -> LM Studio (Qwen2.5-3B) / Groq (Llama-3.3-70B)        |
|            |                 Enforces Pydantic JSON Schema + Rule Fallback        |
|            v                                                                      |
|  [3. SRE Safety Guardrails] -> 5 Deterministic Safety Gates                        |
|            |                   (Namespace Lock, Bounds, 120s Cooldown, Dry-Run)   |
|            v                                                                      |
|  [4. Execution Engine]  -> Official Python K8s API (or Digital Twin Replay)       |
|            |                                                                      |
|            v                                                                      |
|  [5. Closed-Loop Verifier] -> Polls 60s Post-Heal Stability & Records MTTR        |
+-----------------------------------------------------------------------------------+
```

---

## 🛡️ SRE Safety Guardrails (Zero Unbounded Execution)

Before any proposed action mutates the cluster, it must pass through 5 deterministic Python guardrails:

1. **Namespace Isolation:** Target namespace locked to `["hipster", "kintsugi-lab"]`. `kube-system` is hard-blocked.
2. **Action Allowlist:** Constrained strictly to `["SCALE_DEPLOYMENT", "PATCH_RESOURCES", "RESTART_POD", "CORDON_AND_RELOCATE", "APPLY_TRAFFIC_SHAPING", "NO_OP"]`.
3. **Parameter Clamping:** Replica counts clamped to $[1, 5]$; Memory limits clamped to $\le 1024\text{Mi}$.
4. **Anti-Thrashing Cooldown:** 120-second per-service cooldown timer prevents flapping and oscillation loops.
5. **Pre-Flight Dry-Run:** Mutations evaluated against Kubernetes API with `dry_run="All"` parameter prior to commit.
6. **Operating Mode Check:** Respects the UI toggle between `AUTONOMOUS` (self-healing) and `HUMAN_IN_THE_LOOP` (awaits operator approval).

---

## ⚡ Quickstart Guide

### 1. Installation
```bash
git clone https://github.com/Akki-74/kintsugi-sre.git
cd kintsugi-sre
pip install -r requirements.txt
```

### 2. Run Phase 1 Data Pipeline & Ablation Suite
```bash
# 1. Inspect Nezha benchmark telemetry
python scripts/inspect_nezha.py

# 2. Build leak-free Z-scored multi-modal datasets
python phase1_prediction/data_pipeline.py

# 3. Train all 4 ablation models & generate diagnostic plots
python phase1_prediction/train_and_evaluate.py
```

### 3. Run Phase 2 LangGraph SRE Agent Benchmark
```bash
# Unit & integration test suite (Agent, Guardrails, Fallback Matrix)
python scripts/test_remediation_agent.py

# End-to-end healing benchmark (MTTR & recovery curves)
python phase2_remediation/remediation_benchmark.py
```

### 4. Launch Full Stack SRE Command Center
```bash
# Terminal 1: Start FastAPI + WebSocket Backend
python -m uvicorn backend.main:app --port 8000 --reload

# Terminal 2: Start React Frontend
cd frontend
npm install
npm run dev
```
Open **`http://localhost:5173`** (or **`http://localhost:8000/app/`**) in your browser.

---

## 📦 Project Structure

```text
kintsugi-sre/
├── backend/
│   ├── main.py                     # FastAPI REST API & WebSocket Stream
│   └── replay_engine.py            # Digital Twin Cloud Replay Engine
├── docs/
│   ├── PRD.md                      # Product Requirements Document
│   ├── PHASE1_REPORT.md            # Formal Phase 1 ML Benchmark Report
│   └── REMEDIATION_BENCHMARK.md    # Formal Phase 2 MTTR Benchmark Report
├── frontend/                       # React 19 + Tailwind CSS + @xyflow/react + Recharts
│   ├── src/
│   │   ├── components/
│   │   │   ├── TopBar.jsx          # Mode Switcher, LLM Switcher, Status
│   │   │   ├── ClusterTopology.jsx # @xyflow/react Interactive Topology Graph
│   │   │   ├── TelemetryCharts.jsx # Recharts Live Area Chart & Chaos Deck
│   │   │   └── AgentConsole.jsx    # LangGraph Trace & HITL Approval Terminal
│   │   ├── App.jsx                 # Command Center Orchestrator
│   │   └── main.jsx
│   └── dist/                       # Production Static Build
├── k8s_manifests/
│   ├── deployment.yaml             # K8s Deployment Manifest
│   ├── service.yaml                # K8s Service Manifest
│   ├── rbac.yaml                   # Least-privilege ServiceAccount & Roles
│   ├── kintsugi_agent.yaml         # Unified Deployment Spec
│   ├── sample_microservices.yaml   # 10 OnlineBoutique Microservice Manifests
│   └── Dockerfile                  # Container packaging ($0 Hugging Face Spaces)
├── phase1_prediction/
│   ├── data_pipeline.py            # Leak-free Z-score & Drain3 feature pipeline
│   ├── train_and_evaluate.py       # 4-model Ablation study & diagnostic plots
│   ├── evaluate.py                 # Evaluation routines
│   ├── dataset/                    # Compact partitioned CSVs (<15MB each)
│   ├── plots/                      # Diagnostic plots (confusion matrix, ablation)
│   └── saved_models/               # Serialized models (XGBoost, Regressor, Stats)
├── phase2_remediation/
│   ├── actions.py                  # Pydantic schemas & Rule Fallback Matrix
│   ├── guardrails.py               # 5 mandatory SRE Safety Guardrails
│   ├── llm_client.py               # LM Studio (Qwen2.5-3B) + Groq + Fallback
│   ├── k8s_adapter.py              # Official K8s Python SDK + Digital Twin
│   ├── k8s_tools.py                # Kubernetes client wrappers
│   ├── agent_graph.py              # LangGraph State Machine Architecture
│   ├── langgraph_agent.py          # StateGraph State Machine
│   └── remediation_benchmark.py    # Pre/Post recovery & MTTR evaluation
└── scripts/
    ├── inspect_nezha.py            # Telemetry inspector
    └── test_remediation_agent.py   # Full unit test suite
```

---

## 🏆 Hackathon Milestone Checklist

- [x] **Milestone 1:** Empirical Data Inspection, Z-Score Baseline Normalization, Drain3 Log Signals, Strict Chronological Split (Train: Day 1, Test: Day 2 First 75%, Holdout: Day 2 Final 25%), Synthetic Gradual Exhaustion Traces.
- [x] **Milestone 2:** 4-Model Ablation Study (B0 Thresholds vs M1 IsolationForest vs M2 Temporal XGBoost vs M3 Multi-Modal XGBoost), Honest Evaluation across Regime A (Latency $\Delta t$) and Regime B (Horizon Lead Time), Alert Fatigue ($2.73$ FA/hr).
- [x] **Milestone 3:** Phase 1 Diagnostic Visualizations (`ablation_comparison.png`, `confusion_matrix.png`, `feature_importance.png`, `lead_time_distribution.png`), `docs/PHASE1_REPORT.md`.
- [x] **Milestone 4:** Constrained LangGraph Ambient Agent (`Monitor -> Diagnose -> Plan -> Guardrails -> Execute -> Verify`), Pydantic Action Catalog, Deterministic Fallback Matrix, 5 Mandatory SRE Safety Guardrails.
- [x] **Milestone 5:** High-Fidelity Kubernetes Cluster Adapter, Multi-Service Chaos Scenarios, Empirical MTTR Benchmark ($27.6$s average), `docs/REMEDIATION_BENCHMARK.md`.
- [x] **Milestone 6:** FastAPI + WebSocket Real-Time Backend, React Interactive SRE Command Center (OnlineBoutique Topology Map, Live Forecast Charts, Chaos Deck, HITL Approval Terminal), Kubernetes Manifests (`k8s_manifests/`), $0 Cloud Deployment Config.
