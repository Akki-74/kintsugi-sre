# 🚀 KubePulse AI
**Autonomous Multi-Modal Kubernetes Failure Prediction & Ambient Remediation System**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Python: 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)](https://fastapi.tiangolo.com)
[![LangGraph](https://img.shields.io/badge/LangGraph-StateGraph-orange.svg)](https://github.com/langchain-ai/langgraph)
[![XGBoost](https://img.shields.io/badge/XGBoost-2.0+-red.svg)](https://xgboost.readthedocs.io)
[![Cost](https://img.shields.io/badge/Total%20Cost-%240.00%20(Free%20Tier)-brightgreen.svg)]()

> **KubePulse AI** combines a **Fast Brain** (Multi-Modal XGBoost & Resource Trajectory Regressor) for sub-second onset detection and gradual horizon forecasting with a **Slow Brain** (Guardrailed LangGraph Ambient SRE Agent) that autonomously diagnoses container telemetry, enforces 5 deterministic SRE safety checks, and remediates live Kubernetes clusters via the official Kubernetes Python API.

---

## 📊 Benchmark Verification Checkpoint

| Metric | Multi-Modal XGBoost (Model 3) | Prometheus Thresholds (Baseline 0) | Delta / Engineering Gain |
| :--- | :--- | :--- | :--- |
| **Overall Macro-F1** | **0.7065** | 0.2335 | **+0.4730 Macro-F1 (+202%)** |
| **Regime A Detection Latency ($\Delta t$)** | **86.1 seconds** | 121.1 seconds | **-35.0s Faster Root-Cause Alert** |
| **Root-Cause Localization (Top-1)** | **62.5%** | 4.2% | **14.8x Higher Localization Accuracy** |
| **Regime B Forecasting Lead Time** | **5.6 minutes** | 0.0 minutes | **+5.6 min Early Crash Warning** |
| **False Alarm Rate (FA/hr)** | **0.19 / hr** | 9.30 / hr | **98.0% Noise Reduction (Zero Alert Fatigue)** |
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
|  [3. SRE Safety Guardrails] -> Namespace Lock, Allowlist, Replica Caps (<=5),     |
|            |                   120s Cooldown, K8s API `dry_run="All"` Check       |
|            v                                                                      |
|  [4. Execution Engine] -> Autonomous Mode (Auto-runs K8s API) OR                  |
|            |              Human-in-the-Loop Mode (Awaits React UI Approval)       |
|            v                                                                      |
|  [5. Closed-Loop Verifier] -> Checks post-action metrics at t+60s to log MTTR     |
+-----------------------------------------------------------------------------------+
```

---

## 🛡️ SRE Safety Guardrails (`phase2_remediation/guardrails.py`)
Every proposed action must strictly pass 5 deterministic checks before execution:
1. **Namespace Isolation:** Target namespace locked to `["hipster", "kubepulse-lab"]`. `kube-system` is hard-blocked.
2. **Action Allowlist:** Actions must belong to the approved catalog (`SCALE_DEPLOYMENT`, `PATCH_RESOURCES`, `RESTART_POD`, `CORDON_AND_RELOCATE`, `APPLY_TRAFFIC_SHAPING`).
3. **Parameter Bounds:** $1 \le replicas \le 5$; memory limit patches cannot exceed `1024Mi`.
4. **120s Anti-Thrashing Cooldown:** A service cannot be modified more than once within 120 seconds to prevent cascading oscillations.
5. **K8s Dry-Run Verification:** All mutations execute with `dry_run="All"` against the API server prior to commit.
6. **Operating Mode Check:** Respects the UI toggle between `AUTONOMOUS` (self-healing) and `HUMAN_IN_THE_LOOP` (awaits operator approval).

---

## ⚡ Quickstart Guide

### 1. Installation
```bash
git clone https://github.com/your-username/kubepulse-ai.git
cd kubepulse-ai
pip install -r requirements.txt
```

### 2. Run Phase 1 Data Pipeline & Ablation Suite
```bash
# 1. Inspect Nezha benchmark telemetry
python scripts/inspect_nezha.py

# 2. Build leak-free Z-scored multi-modal datasets
python phase1_prediction/data_pipeline.py

# 3. Train all 4 ablation models & generate diagnostic plots
python phase1_prediction/evaluate.py
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
Open **`http://localhost:3000`** in your browser.

---

## 📦 Project Structure

```text
kubepulse-ai/
├── backend/
│   ├── main.py                     # FastAPI REST API & WebSocket Stream
│   └── replay_engine.py            # Digital Twin Cloud Replay Engine
├── docs/
│   ├── PRD.md                      # Product Requirements Document
│   ├── PHASE1_REPORT.md            # Formal Phase 1 ML Benchmark Report
│   └── REMEDIATION_BENCHMARK.md    # Formal Phase 2 MTTR Benchmark Report
├── frontend/                       # React 19 + Tailwind CSS + Recharts
│   ├── src/
│   │   ├── App.jsx                 # Interactive SRE Command Center
│   │   └── main.jsx
│   └── dist/                       # Production Static Build
├── k8s_manifests/
│   ├── deployment.yaml             # K8s Deployment Manifest
│   ├── service.yaml                # K8s Service Manifest
│   ├── rbac.yaml                   # Least-privilege ServiceAccount & Roles
│   └── Dockerfile                  # Container packaging ($0 Hugging Face Spaces)
├── phase1_prediction/
│   ├── data_pipeline.py            # Leak-free Z-score & Drain3 feature pipeline
│   ├── evaluate.py                 # 4-model Ablation study & diagnostic plots
│   ├── dataset/                    # Compact partitioned CSVs (<15MB each)
│   ├── plots/                      # Diagnostic plots (confusion matrix, ablation)
│   └── saved_models/               # Serialized models (XGBoost, Regressor, Stats)
├── phase2_remediation/
│   ├── actions.py                  # Pydantic schemas & Rule Fallback Matrix
│   ├── guardrails.py               # 5 mandatory SRE Safety Guardrails
│   ├── llm_client.py               # LM Studio (Qwen2.5-3B) + Groq + Fallback
│   ├── k8s_adapter.py              # Official K8s Python SDK + Digital Twin
│   ├── langgraph_agent.py          # StateGraph State Machine
│   └── remediation_benchmark.py    # Pre/Post recovery & MTTR evaluation
└── scripts/
    ├── inspect_nezha.py            # Telemetry inspector
    └── test_remediation_agent.py   # Full unit test suite
```

---

## 🏆 Hackathon Milestone Checklist

- [x] **Milestone 1:** Empirical Data Inspection, Z-Score Baseline Normalization, Drain3 Log Signals, Strict Chronological Split (Train: Day 1, Test: Day 2 First 75%, Holdout: Day 2 Final 25%), Synthetic Gradual Exhaustion Traces.
- [x] **Milestone 2:** 4-Model Ablation Study (B0 Thresholds vs M1 IsolationForest vs M2 Temporal XGBoost vs M3 Multi-Modal XGBoost), Honest Evaluation across Regime A (Latency $\Delta t$) and Regime B (Horizon Lead Time), Alert Fatigue ($0.19$ FA/hr).
- [x] **Milestone 3:** Phase 1 Diagnostic Visualizations (`ablation_comparison.png`, `confusion_matrix.png`, `feature_importance.png`, `lead_time_distribution.png`), `docs/PHASE1_REPORT.md`.
- [x] **Milestone 4:** Constrained LangGraph Ambient Agent (`Monitor -> Diagnose -> Plan -> Guardrails -> Execute -> Verify`), Pydantic Action Catalog, Deterministic Fallback Matrix, 5 Mandatory SRE Safety Guardrails.
- [x] **Milestone 5:** High-Fidelity Kubernetes Cluster Adapter, Multi-Service Chaos Scenarios, Empirical MTTR Benchmark ($27.6$s average), `docs/REMEDIATION_BENCHMARK.md`.
- [x] **Milestone 6:** FastAPI + WebSocket Real-Time Backend, React Interactive SRE Command Center (OnlineBoutique Topology Map, Live Forecast Charts, Chaos Deck, HITL Approval Terminal), Kubernetes Manifests (`k8s_manifests/`), $0 Cloud Deployment Config.
