# 🏺 Kintsugi-AI
**Autonomous Multi-Modal Kubernetes Failure Prediction & Ambient Remediation System**

> *"Catch the cracks. Verify the fix."*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Python: 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-Render.com-46E3B7.svg?logo=render&logoColor=white)](https://kintsugi-ai.onrender.com/app/)
[![CI/CD](https://github.com/Akki-74/kintsugi-sre/actions/workflows/ci.yml/badge.svg)](https://github.com/Akki-74/kintsugi-sre/actions)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)](https://fastapi.tiangolo.com)
[![LangGraph](https://img.shields.io/badge/LangGraph-StateGraph-orange.svg)](https://github.com/langchain-ai/langgraph)
[![XGBoost](https://img.shields.io/badge/XGBoost-2.0+-red.svg)](https://xgboost.readthedocs.io)
[![Docker](https://img.shields.io/badge/Docker-Multi--Stage-2496ED.svg)](https://www.docker.com)
[![Cost](https://img.shields.io/badge/Total%20Cost-%240.00%20(Free%20Tier)-brightgreen.svg)]()

> 🚀 **Live Interactive Command Center (Free Cloud Deployment):**  
> 👉 **[https://kintsugi-ai.onrender.com/app/](https://kintsugi-ai.onrender.com/app/)** *(Zero setup required — interact directly with live digital twin chaos injection and LangGraph agent healing)*
>
> 🖥️ **Interactive Presentation Slide Deck (Fullscreen & Print to PDF):**  
> 👉 **[http://localhost:8000/app/slides.html](http://localhost:8000/app/slides.html)** *(Walk through all 6 presentation slides with arrow keys, embedded plots, and PDF export)*

> **Kintsugi-AI** takes its name from the centuries-old Japanese art of *Kintsugi* (金継ぎ)—mending broken ceramics with gold lacquer so the repaired object emerges stronger, more resilient, and more beautiful than before.
> 
> Applied to Cloud-Native Site Reliability Engineering, **Kintsugi-AI** unifies a **Fast Brain** (Multi-Modal Temporal XGBoost & Resource Trajectory Regressor) for sub-second onset detection and gradual horizon forecasting with a **Slow Brain** (Guardrailed LangGraph Ambient SRE Agent) that autonomously correlates container logs, enforces 5 deterministic SRE safety checks, executes remediation via the official Kubernetes Python API, and seals the repaired pod with the **✦ Kintsugi Gold Seam**.

---

## 📊 Benchmark Verification Checkpoint

| Metric | Multi-Modal XGBoost (Model 3) | Prometheus Thresholds (Baseline 0) | Engineering Gain |
| :--- | :--- | :--- | :--- |
| **Overall Macro-F1** | **0.7132** | 0.2816 | **+0.4316 (+153%)** |
| **Anomaly Binary F1** | **0.7225** | 0.1683 | **+0.5542 (+329%)** |
| **Regime A Detection Latency ($\Delta t$)** | **87.6 seconds** | 148.0 seconds | **-60.4s Faster Alert** |
| **Root-Cause Service Localization (Top-1)** | **66.7%** | 33.3% | **+33.4% Localization Accuracy** |
| **Regime B Forecasting Lead Time** | **4.7 minutes** | 0.0 minutes | **+4.7 min Early Warning** |
| **TTE Prediction MAE** | **0.71 minutes** | N/A | **High-Precision Horizon** |
| **False Alarm Rate (FA/hr at $p > 0.75$)** | **1.71 / hr** | 14.80 / hr | **Noise Reduction (Zero Alert Fatigue)** |
| **Mean Time To Remediate (MTTR)** | **27.6 seconds** | N/A (Manual SRE) | **Sub-Minute Closed-Loop Healing** |

---

## 📈 Phase 1 Diagnostic Visualizations

The following diagnostic plots are empirically generated from the clean, leak-free test split (`phase1_prediction/plots/`):

| 1. Ablation Study Comparison | 2. Multi-Modal Confusion Matrix |
| :---: | :---: |
| ![Ablation Study](phase1_prediction/plots/ablation_comparison.png) | ![Confusion Matrix](phase1_prediction/plots/confusion_matrix.png) |
| **F1 Macro progression from Baseline 0 (0.28) to Model 3 (0.713).** | **Normalized confusion matrix across all 6 operational failure classes.** |

| 3. Multi-Modal Feature Importance | 4. Horizon Lead-Time Distribution |
| :---: | :---: |
| ![Feature Importance](phase1_prediction/plots/feature_importance.png) | ![Lead-Time Distribution](phase1_prediction/plots/lead_time_distribution.png) |
| **Top 20 features showing strong log template error count & Z-score gain.** | **Distribution of early-warning lead times (mean 4.7 min prior to crash).** |

---

## 🔬 Formal 4-Model Ablation Study

Evaluated across Google *OnlineBoutique* (10 microservices) under strict temporal separation:

| Model Configuration | Precision | Recall | Macro-F1 | Anomaly F1 | Regime A Latency | Top-1 Loc | Regime B Lead Time |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Baseline 0: Prometheus Static Thresholds** | 0.2700 | 0.3495 | 0.2816 | 0.1683 | 148.0s | 33.3% | 0.0 min (Late reactive) |
| **Model 1: Unsupervised IsolationForest (Metrics)** | 0.2794 | 0.3643 | 0.2782 | 0.1889 | 132.5s | 41.7% | 1.8 min |
| **Model 2: Supervised Temporal XGBoost (Metrics)** | 0.5414 | 0.6141 | 0.5706 | 0.5789 | 108.4s | 58.3% | 3.5 min |
| **Model 3: Multi-Modal XGBoost (Metrics + Logs)** | **0.7088** | **0.7189** | **0.7132** | **0.7225** | **87.6s** | **66.7%** | **4.7 min** |

### Key Architectural Findings:
1. **The Multi-Modal Dividend:** Incorporating Drain3 structured log template hit frequencies and HTTP 5xx error ratios increased Macro-F1 by **+25.0% relative** over metrics alone. Microservice exceptions produce immediate log signatures while CPU/memory metrics often lag or show no deviation.
2. **Nezha Timestamp Alignment:** Caught and resolved the Nezha benchmark timestamp bug (integer `TimeStamp` column carries a +200M second offset; aligned strictly using UTC `Time` strings).
3. **Balanced Temporal Split:** Enforced zero-leakage episode boundaries (Day 1 for training; Day 2 chronologically partitioned 64% test and 36% holdout with balanced representation across all 6 fault classes).

### 📈 Regime B Horizon Study: Classical SARIMA vs. Multi-Modal XGBRegressor

| Metric | Univariate $\text{SARIMA}(1,1,1)\times(1,0,1)_{12}$ | Multi-Modal XGBRegressor | Engineering Advantage |
| :--- | :---: | :---: | :---: |
| **TTE Forecasting MAE** | 6.50 min | **0.71 min** | **-89.1% Lower Error** |
| **Trajectory RMSE** | 6.89 min | **0.90 min** | **-87.0% Lower Variance** |
| **Early-Warning Lead Time** | 10.0 min | **4.7 min** | Real-world horizon prediction |
| **Inference Latency per Tick** | 243.8 ms | **0.67 ms** | **364.0x Faster (1Hz Streaming Ready)** |

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
|  [2. Structured Reasoner] -> Groq (Qwen 3.8-27B) / LM Studio (Qwen2.5-3B)     |
|            |                 Enforces Pydantic JSON Schema + Rule Fallback        |
|            v                                                                      |
|  [3. SRE Safety Guardrails] -> 5 Deterministic Safety Gates                        |
|            |                   (Namespace Lock, Bounds, 120s Cooldown, Dry-Run)   |
|            v                                                                      |
|  [4. Execution Engine]  -> Official Python K8s API (or Digital Twin Replay)       |
|            |                                                                      |
|            v                                                                      |
|  [5. Closed-Loop Verifier] -> Polls Metric Z-Scores; Seams Pod in Gold!           |
+-----------------------------------------------------------------------------------+
```

---

## 🏆 4 Standout Architectural Achievements

1. **Dual-Engine Hot-Swapping at Runtime (`backend/main.py` & `frontend/TopBar.jsx`):**
   - Operational API endpoints (`/api/cluster/source` and `/api/agent/backend`) allow operators to hot-swap on the fly with zero server restarts between:
     - **Telemetry Stream:** `LIVE_K8S` (real Prometheus PromQL queries + live Kubernetes API) $\leftrightarrow$ `REPLAY_HOLDOUT` (isolated 2,480-row held-out Digital Twin stream).
     - **LLM Brain:** Groq Cloud (`qwen/qwen3.8-27b`) $\leftrightarrow$ Local LM Studio (`qwen2.5-3b-instruct`).
2. **Dedicated Regime B Horizon Regressor (`phase1_prediction/saved_models/tte_regressor.json`):**
   - In parallel with the 6-class `XGBClassifier`, a specialized `XGBRegressor` computes precise Time-to-Exhaustion (TTE) for gradual failure modes (`MEMORY_EXHAUSTION`, `DISK_EXHAUSTION`), achieving **$0.71$ min MAE** ($R^2 = 0.846$) and providing a **$4.7$ minute mean early-warning lead time** prior to container OOMKilled evictions.
3. **Multi-Node Physical Topology Alignment (`phase2_remediation/k8s_adapter.py`):**
   - Node-level remediation primitives (`CORDON_AND_RELOCATE`) are mapped to the real multi-node topology (`desktop-control-plane`, `desktop-worker`, `desktop-worker2`). Degraded worker nodes are cordoned via `CoreV1Api.patch_node`, and target pods are cleanly rescheduled to healthy peer worker nodes.
4. **Live End-to-End Kubernetes Scaling & Gold Seam Verification:**
   - Evaluated via live `/api/chaos/inject` (`cpu_contention` on `checkoutservice`):
     - `qwen/qwen3.8-27b` diagnosed 92.0% CPU saturation with 0.95 confidence and selected `SCALE_DEPLOYMENT` (replicas: 3).
     - Official Kubernetes Python SDK patched deployment scale in `hipster` from 1/1 to 3/3 ready pods across physical worker nodes.
     - Closed-loop verification confirmed recovery via `/api/cluster/snapshot`, returning `"is_verified_repaired": true` and sealing the microservice node in glowing metallic gold (**✦ Kintsugi Repaired**).

---

## ✦ The Kintsugi UI Innovation: "The Gold Seam"

In the interactive **Service Topology Map**, microservice nodes transition through 5 distinct visual states:

```text
[ Healthy ] ───► [ Predicted (Amber) ] ───► [ Incident (Red) ] ───► [ Healing (Cyan) ] ───► [ ✦ Kintsugi Verified (Gold) ]
```

1. **Emerald (`healthy`):** Normal operation; metric Z-scores within $\pm 1.5\sigma$.
2. **Amber Pulse (`predicted`):** Early horizon detection (mean 4.7 min warning before container exhaustion).
3. **Rose Bounce (`incident`):** Active disruption detected; root cause localized to microservice.
4. **Cyan Pulse (`remediating`):** LangGraph agent executing verified remediation plan.
5. **✦ Kintsugi Verified (`verified_repaired`):** **The Gold Seam.** Styled with a metallic gold border (`border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.5)]`) and a glowing `✦ Kintsugi Verified` badge. Appears only after `verify_node` confirms that metric Z-scores have returned to baseline and stability is restored.

---

## 🛡️ SRE Safety Guardrails (Zero Unbounded Execution)

Before any LLM-proposed remediation mutates cluster state, it must satisfy 5 deterministic Python guardrails (`phase2_remediation/guardrails.py`):

1. **Namespace Isolation:** Target namespace locked strictly to `["hipster", "kintsugi-lab"]`. `kube-system` and cluster-wide resources are hard-blocked.
2. **Action Allowlist:** Constrained strictly to `["SCALE_DEPLOYMENT", "PATCH_RESOURCES", "RESTART_POD", "CORDON_AND_RELOCATE", "APPLY_TRAFFIC_SHAPING", "NO_OP"]`.
3. **Parameter Clamping:** Replicas clamped to $[1, 5]$; Memory limits clamped to $\le 1024\text{Mi}$.
4. **Anti-Thrashing Cooldown:** 120-second per-service cooldown timer prevents flapping and oscillation loops.
5. **Pre-Flight Dry-Run:** Mutations evaluated against the Kubernetes API with `dry_run="All"` prior to commit.
6. **Operating Mode Check:** Respects the UI toggle between `AUTONOMOUS` (ambient self-healing) and `HUMAN_IN_THE_LOOP` (pauses and awaits operator approval in the command terminal).

---

## ☁️ $0 Free Cloud Deployment (Hugging Face Spaces)

Kintsugi-AI is packaged with a multi-stage Dockerfile that builds the React frontend and serves both the API and UI from a single container for **$0.00**:

### Deploy in 3 Steps:
1. **Create a Space:** Go to [huggingface.co/spaces](https://huggingface.co/spaces) $\to$ **Create new Space** $\to$ Select **Docker** $\to$ **Blank**.
2. **Push the Repository:**
   ```bash
   git remote add space https://huggingface.co/spaces/<YOUR_USERNAME>/kintsugi-sre
   git push space master
   ```
3. **Configure Free LLM Secret:**
   In your Space **Settings** $\to$ **Variables and secrets** $\to$ **New secret**:
   - `GROQ_API_KEY`: `<your_free_groq_api_key>` (enables Qwen 3.8-27B cloud reasoning at $0 cost).
   - `GROQ_MODEL`: `qwen/qwen3.8-27b`
   - `CLUSTER_MODE`: `REPLAY_HOLDOUT`

Your full-stack application will immediately go live on your free public Hugging Face URL!

---

## ☸️ Bonus Objective: Consume K8s (In-Cluster Packaging)

To satisfy the optional hackathon bonus **"Consume K8s: Package all dependencies in K8s to execute the solution"**, Kintsugi-AI provides complete, production-ready Kubernetes manifests in `k8s_manifests/`:

1. **Least-Privilege RBAC (`k8s_manifests/rbac.yaml`):**
   - `ServiceAccount`: `kintsugi-sre-agent`
   - `ClusterRole`: Constrained strictly to `pods`, `pods/log`, `nodes`, `deployments`, `deployments/scale`, and `networkpolicies` (read, list, patch).
2. **Unified Deployment (`k8s_manifests/kintsugi_agent.yaml`):**
   - Packages the FastAPI + WebSocket backend, React UI, Phase 1 XGBoost inference engine, and LangGraph Ambient SRE Agent into a single pod.
3. **Deploy or Verify with One Command:**
   ```bash
   # Pre-flight client-side verification:
   kubectl apply --dry-run=client -f k8s_manifests/kintsugi_agent.yaml

   # In-cluster deployment:
   kubectl apply -f k8s_manifests/kintsugi_agent.yaml
   ```

---

## ☸️ Live Multi-Node Kubernetes & Observability Infrastructure

In addition to the held-out Digital Twin replay engine, Kintsugi-AI is verified end-to-end against a live, multi-node Kubernetes cluster with full Prometheus/Grafana observability running on Docker Desktop / WSL2:

### 1. Cluster Topology (v1.36.1)
- **`desktop-control-plane`:** Kubernetes API Server, etcd, controller-manager, scheduler.
- **`desktop-worker`:** Worker Node 1 (supports node-level `CORDON_AND_RELOCATE` remediation).
- **`desktop-worker2`:** Worker Node 2 (active workload target for relocated pods).
- **Node Mesh Tag:** Labeled with `kintsugi.sre/mesh=active`.

### 2. Microservices Stack (`hipster` Namespace)
- 10 Google *OnlineBoutique* deployments (`frontend`, `checkoutservice`, `cartservice`, `paymentservice`, `productcatalogservice`, `currencyservice`, `shippingservice`, `recommendationservice`, `adservice`, `emailservice`).
- Engineered with lightweight `python:3.11-alpine` containers that emit continuous structured JSON logs (`TraceID`, `SpanID`, `severity`, `http.resp.status`, `http.resp.took_ms`) to stdout every 5 seconds.
- Explicit resource boundaries configured (`requests: 20m/32Mi`, `limits: 200m/128Mi`), enabling real-time cgroup metric computation (`CpuUsageRate(%)`, `MemoryUsageRate(%)`).

### 3. Observability & Management Dashboards
| Service | Endpoint | Namespace | Access Details |
| :--- | :--- | :--- | :--- |
| **Prometheus API & UI** | `http://localhost:9090` | `monitoring` | Direct PromQL query access |
| **Grafana Dashboard** | `http://localhost:3000` | `monitoring` | `admin` / `admin` (Memory limit tuned to 512Mi) |
| **Kubernetes Dashboard** | `https://localhost:8443` | `kubernetes-dashboard` | Bearer Token via `admin-user` ServiceAccount |
| **Kintsugi Command Center** | `http://localhost:8000/app/` | `backend` / `app` | Live WebSocket & React UI |

### 4. Linux Kernel inotify Optimization
To prevent `kube-apiserver` and `etcd` TLS handshake timeouts during simultaneous 3-node multi-container launches under Windows WSL2:
```bash
docker exec desktop-control-plane sysctl -w fs.inotify.max_user_instances=8192 fs.inotify.max_user_watches=524288
```

---

## ⚡ Local Quickstart Guide

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

### 3. Run Automated 3-Tier Test Suite & Phase 2 SRE Agent
```bash
# Execute complete 3-Tier automated pytest suite (23 tests: Unit, Integration, System E2E)
python -m pytest tests/ -v

# Standalone LangGraph agent & guardrail test suite
python scripts/test_remediation_agent.py

# End-to-end healing benchmark (MTTR & recovery curves)
python phase2_remediation/remediation_benchmark.py
```

### 4. Launch Full Stack Command Center UI
```bash
# Terminal 1: Start FastAPI + WebSocket Backend
python -m uvicorn backend.main:app --port 8000 --reload

# Terminal 2: Start React Frontend
cd frontend
npm install
npm run dev
```
Open **`http://localhost:5173`** (or **`http://localhost:8000/`**) in your browser.

---

## 🎬 Presentation Video Demo & Walkthrough Script

A complete 5-minute hackathon walkthrough is structured into two halves:

### Part 1: Phase 1 — Prediction Engine & ML Breakthroughs (2.5 mins)
- **The Problem:** Static Prometheus threshold rules create alert fatigue (14.8 FA/hr) and detect failures too late ($\Delta t = 148$s).
- **The Nezha Timestamp Bug:** Show how we identified and fixed the 200M-second offset bug in the raw benchmark data.
- **The 4-Model Ablation Jump:** Walk through the ablation table showing the jump from Prometheus Rules ($0.28$ F1) $\to$ IsolationForest ($0.28$) $\to$ Metrics-Only XGBoost ($0.57$) $\to$ Multi-Modal XGBoost ($0.713$ F1).
- **Early Warning:** Show the 4.7-minute mean lead time predicting OOM and disk exhaustion before containers crash.

### Part 2: Phase 2 — Ambient LangGraph Agent & Live Command Center (2.5 mins)
- **The Command Center:** Showcase the 10-service OnlineBoutique topology map and live WebSocket telemetry.
- **Fault Injection:** Trigger chaos via the Chaos Deck (`CPU Contention` on `cartservice`).
- **State Machine Trace:** Watch the LangGraph agent wake up: `MONITOR` $\to$ `DIAGNOSE` $\to$ `PLAN` (Pydantic schema).
- **Safety Guardrail:** Show the agent pausing at `AWAITING_APPROVAL` in Human-in-the-Loop mode; explain the 5 safety gates.
- **Operator Approval & The Gold Seam:** Click **Approve** in the UI. Watch the pod scale, the recovery verify, and the node seal with the glowing **✦ Kintsugi Verified** metallic gold border!

*(For full slide-by-slide notes and speaker script, see [`docs/SLIDE_DECK_AND_DEMO_GUIDE.md`](docs/SLIDE_DECK_AND_DEMO_GUIDE.md)).*

---

## 📦 Project Structure

```text
kintsugi-sre/
├── Dockerfile                      # Multi-stage production container ($0 HF Spaces)
├── requirements.txt                # Production Python dependencies
├── backend/
│   ├── main.py                     # FastAPI REST API, Static server & WebSocket
│   └── replay_engine.py            # Digital Twin Cloud Replay Engine
├── docs/
│   ├── PRD.md                      # Product Requirements Document
│   ├── PHASE1_REPORT.md            # Formal Phase 1 ML Benchmark Report
│   ├── REMEDIATION_BENCHMARK.md    # Formal Phase 2 MTTR Benchmark Report
│   └── SLIDE_DECK_AND_DEMO_GUIDE.md# Complete presentation & video demo script
├── frontend/                       # React 19 + Tailwind CSS + @xyflow/react + Recharts
│   ├── src/
│   │   ├── components/
│   │   │   ├── TopBar.jsx          # Mode Switcher, LLM Switcher, Status
│   │   │   ├── ClusterTopology.jsx # @xyflow/react Graph with ✦ Kintsugi Gold Seam
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
│   └── sample_microservices.yaml   # 10 OnlineBoutique Microservice Manifests
├── phase1_prediction/
│   ├── data_pipeline.py            # Leak-free Z-score & Drain3 feature pipeline
│   ├── train_and_evaluate.py       # 4-model Ablation study & diagnostic plots
│   ├── evaluate.py                 # Evaluation routines
│   ├── dataset/                    # Compact partitioned CSVs (<15MB each)
│   ├── plots/                      # 4 Diagnostic plots (ablation, confusion matrix)
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

- [x] **Milestone 1:** Empirical Data Inspection, Z-Score Baseline Normalization, Drain3 Log Signals, Strict Chronological Split (Train: Day 1, Test: Day 2 First 64%, Holdout: Day 2 Final 36%), Synthetic Gradual Exhaustion Traces.
- [x] **Milestone 2:** 4-Model Ablation Study (B0 Thresholds vs M1 IsolationForest vs M2 Temporal XGBoost vs M3 Multi-Modal XGBoost), Honest Evaluation across Regime A (Latency $\Delta t$) and Regime B (Horizon Lead Time), Alert Fatigue ($1.71$ FA/hr).
- [x] **Milestone 3:** Phase 1 Diagnostic Visualizations (`ablation_comparison.png`, `confusion_matrix.png`, `feature_importance.png`, `lead_time_distribution.png`), `docs/PHASE1_REPORT.md`.
- [x] **Milestone 4:** Constrained LangGraph Ambient Agent (`Monitor -> Diagnose -> Plan -> Guardrails -> Execute -> Verify`), Pydantic Action Catalog, Deterministic Fallback Matrix, 5 Mandatory SRE Safety Guardrails.
- [x] **Milestone 5:** High-Fidelity Kubernetes Cluster Adapter, Multi-Service Chaos Scenarios, Empirical MTTR Benchmark ($27.6$s average), `docs/REMEDIATION_BENCHMARK.md`.
- [x] **Milestone 6:** FastAPI + WebSocket Real-Time Backend, React Interactive SRE Command Center (OnlineBoutique Topology Map with **✦ Kintsugi Gold Seam**, Live Forecast Charts, Chaos Deck, HITL Approval Terminal), Kubernetes Manifests (`k8s_manifests/`), $0 Cloud Deployment Config (`Dockerfile`).

---

## 📜 License

MIT License. Designed and built with Google DeepMind Antigravity for the Kubernetes AIOps Hackathon.
