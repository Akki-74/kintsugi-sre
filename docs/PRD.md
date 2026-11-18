# Product Requirements Document (PRD): Kintsugi-AI
**Autonomous Multi-Modal Kubernetes Failure Prediction & Ambient Remediation System**

| Metadata | Details |
| :--- | :--- |
| **Project Scope** | Phase 1 (Predictive Multi-Modal ML) & Phase 2 (LangGraph Ambient Remediation Agent) |
| **Benchmark Dataset** | `Nezha` (FSE'23) Google *OnlineBoutique* Multi-Modal Telemetry + Synthetic Exhaustion Traces |
| **Target Infrastructure** | Local `kind` Kubernetes Cluster & Cloud Held-Out Digital Replay Engine |
| **Budget & Licensing** | $0.00 Total Cost — 100% Open-Source & Free-Tier Cloud Infrastructure |
| **Hardware Target** | Lenovo ThinkPad P14s Gen 5 (Intel Core Ultra 5 125H, 16GB RAM, RTX 500 Ada 4GB VRAM) |

---

## 1. Problem Statement & Engineering Philosophy
Kubernetes clusters experience multi-layered operational failures ranging from abrupt traffic/CPU saturation and network degradation to gradual memory leaks and code-level exceptions. Standard threshold alerting is either **too late** (firing only after SLA violation) or **too noisy** (causing alert fatigue). Furthermore, manual diagnosis and remediation inflate Mean Time to Resolution (MTTR).

**Kintsugi-AI** solves this using a disciplined **Two-Brain Architecture**:
1. **Phase 1 — The Fast Brain (Multi-Modal Tabular ML):** Continuously monitors baseline-normalized container metrics and parsed container log templates. It distinguishes between **Rapid Onset Detection** (catching abrupt faults within seconds of onset before cascading failure) and **Horizon Forecasting** (predicting gradual resource exhaustion minutes before pod death).
2. **Phase 2 — The Slow Brain (Guardrailed Ambient Agent):** An event-driven **LangGraph** state machine that wakes up only on high-confidence predictions, inspects pod logs/events, selects a verified remediation from a strict action catalog via structured LLM inference, enforces deterministic SRE safety guardrails, and verifies post-action cluster recovery.

---

## 2. End-to-End System Architecture

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
|        |  Outputs: Fault Class (5 states), Target Service, Confidence %, |        |
|        |           Regime (Onset Detection vs. Time-to-Exhaustion)       |        |
|        +--------------------------------+--------------------------------+        |
+-----------------------------------------|-----------------------------------------+
                                          | (Wakes Agent if Confidence > Threshold
                                          |  AND Cooldown Lock == False)
                                          v
+-----------------------------------------------------------------------------------+
|               PHASE 2: LANGGRAPH AMBIENT SRE AGENT ("Slow Brain")                 |
|                                                                                   |
|  [1. Context Collector] -> Pulls K8s Pod Status, Resource Specs & Last 30 Logs    |
|            |                                                                      |
|            v                                                                      |
|  [2. Structured Reasoner] -> LM Studio (Qwen2.5-3B) / Groq (Llama-3.3-70B)      |
|            |                 Enforces Pydantic JSON Schema + Rule Fallback        |
|            v                                                                      |
|  [3. SRE Safety Guardrails] -> Namespace Lock, Allowlist, Replica Caps (<=5),     |
|            |                   120s Cooldown, K8s API `dry_run="All"` Check       |
|            v                                                                      |
|  [4. Execution Engine] -> Autonomous Mode (Auto-runs K8s API) OR                  |
|            |              Human-in-the-Loop Mode (Awaits React UI Approval)       |
|            v                                                                      |
|  [5. Closed-Loop Verifier] -> Checks post-action metrics at t+60s to log MTTR    |
+-----------------------------------------------------------------------------------+
```

---

## 3. Data Strategy & Zero-Leakage Protocol

### 3.1 Dataset Composition
We utilize the **Nezha** (hipster / Google OnlineBoutique) dataset, comprising 10 microservices: `frontend`, `checkoutservice`, `cartservice`, `paymentservice`, `productcatalogservice`, `currencyservice`, `shippingservice`, `recommendationservice`, `adservice`, `emailservice`.

**Empirical Nezha Classes:**
- `NORMAL` (from `construct_data` fault-free runs and non-fault intervals).
- `CPU_CONTENTION` (`cpu_contention` & `cpu_consumed` injections).
- `NETWORK_DELAY` (`network_delay` latency injections).
- `SERVICE_EXCEPTION` (`return` & `exception` inner-service code/log faults).

**Augmented Synthetic Gradual Classes** (Clearly Flagged in Dataset & Evaluation):
- `MEMORY_EXHAUSTION` (Monotonic sawtooth memory leak leading to OOMKilled).
- `DISK_PRESSURE` (Gradual unrotated log/volume saturation leading to node/pod eviction).

### 3.2 Anti-Leakage Splitting Rules
To prevent sliding-window autocorrelation leakage:

- **No Random Row Splits:** Data is partitioned strictly by chronological Day / Fault Episode.
- **Train Partition:** 2022-08-22 fault episodes + Day 1 fault-free baseline.
- **Evaluation/Test Partition:** First 75% of 2022-08-23 fault episodes + Day 2 fault-free baseline.
- **Demo Replay Holdout Partition:** Final 25% of 2022-08-23 fault episodes (strictly isolated from training and hyperparameter tuning).
- **Repository Size Control:** Only the processed, feature-engineered tabular datasets (<15 MB total) and a deterministic reproduction script are committed to GitHub.

### 3.3 Distribution-Shift Mitigation (Nezha ↔ Local kind K8s)
Raw metric magnitudes vary across clusters. All continuous features $x_t$ for service $s$ are transformed relative to that service's healthy calibration baseline $(\mu_{s,\text{healthy}}, \sigma_{s,\text{healthy}})$:

$$z_{s,t} = \frac{x_{s,t} - \mu_{s,\text{healthy}}}{\max(\sigma_{s,\text{healthy}}, \epsilon)}$$

This allows the same trained model to evaluate both Nezha telemetry and live local `kind` containers after a 2-minute baseline calibration window.

---

## 4. Phase 1 Requirements: Prediction & Ablation Benchmark

### 4.1 Two Honest Prediction Regimes

**Regime A — Rapid Onset & Pre-Cascade Detection** (Empirical Abrupt Faults):
- Because external chaos injections (CPU, Network, Exception) start abruptly at $t_0$ without prior physical clues, labels are not artificially shifted prior to $t_0$.
- **Metric:** Detection Latency ($\Delta t = t_{\text{detect}} - t_0$) — measuring how quickly the model identifies the root-cause service after fault onset before cascading errors hit upstream services.

**Regime B — Horizon Forecasting** (Gradual Exhaustion Faults):
- For gradual degradation (`MEMORY_EXHAUSTION`, `DISK_PRESSURE`), labels include a warning horizon window prior to threshold breach.
- **Metric:** Lead-Time Before Failure (minutes prior to 95% critical capacity / OOM).

### 4.2 Required Ablation Study
The Phase 1 evaluation script (`evaluate.py`) must automatically generate a comparative ablation table across:

| Model | Description |
|-------|-------------|
| **B0** | Static Threshold Rules (Industry status quo) |
| **M1** | Unsupervised IsolationForest (Metrics only) |
| **M2** | Supervised XGBoost (Engineered temporal metric features: lags, slopes, rolling stats) |
| **M3** | Multi-Modal XGBoost (Temporal metric features + Drain3 log template error rates) |

### 4.3 Evaluation Metrics
- Per-Class Precision, Recall, and F1-Score (reported separately for Empirical Nezha classes vs. Synthetic Gradual classes).
- Root-Cause Service Localization Accuracy (Top-1 and Top-3 Service Accuracy).
- Alert Quality: False Alarms per Hour (FA/hr) evaluated on continuous fault-free runs.

---

## 5. Phase 2 Requirements: Guardrailed Ambient Remediation

### 5.1 Structured LLM Output & Fallback Reliability
To ensure 100% reliability on small local models (Qwen2.5-3B-Instruct via LM Studio on 4GB VRAM) as well as cloud models (Llama-3.3-70B via Groq):

- The LLM does **not** write arbitrary shell scripts or raw Python code.
- The LLM must output a strict Pydantic-validated JSON object:

```json
{
  "diagnosed_root_cause": "CPU contention on checkoutservice causing latency spike",
  "target_service": "checkoutservice",
  "selected_action": "SCALE_DEPLOYMENT",
  "parameters": {"replicas": 3},
  "confidence": 0.91,
  "reasoning_summary": "CPU usage is +4.2 sigma above baseline with zero code exceptions in logs."
}
```

**Deterministic Fallback:** If the LLM times out or fails schema validation after 1 retry, a deterministic Fault-to-Action Matrix selects the safe remediation action.

### 5.2 Action Catalog (Kubernetes Python SDK)

| Action Enum | Target Faults | K8s API Implementation |
|---|---|---|
| `SCALE_DEPLOYMENT` | CPU_CONTENTION | `AppsV1Api.patch_namespaced_deployment_scale` (increases replicas) |
| `PATCH_RESOURCES` | MEMORY_EXHAUSTION, CPU_CONTENTION | `AppsV1Api.patch_namespaced_deployment` (raises memory/CPU limits) |
| `RESTART_POD` | SERVICE_EXCEPTION, transient leak | Rolling restart annotation patch or `CoreV1Api.delete_namespaced_pod` |
| `CORDON_AND_RELOCATE` | DISK_PRESSURE, node degradation | Cordons degraded worker node (multi-node kind) & evicts target pod |
| `APPLY_TRAFFIC_SHAPING` | NETWORK_DELAY | Applies circuit-breaker/timeout configMap patch & restarts worker |

### 5.3 Mandatory SRE Safety Guardrails (`guardrails.py`)
Every proposed action must pass 5 deterministic checks before execution:

1. **Namespace Isolation:** Target namespace must be in `["hipster", "kintsugi-lab"]`. `kube-system` is hard-blocked.
2. **Parameter Bounds:** `replicas` must be between 1 and 5; memory limit patches cannot exceed `1024Mi` on the local laptop cluster.
3. **Cooldown Lock:** A service cannot be modified more than once within a 120-second window to prevent thrashing.
4. **K8s Dry-Run Verification:** All patches run with `dry_run="All"` against the Kubernetes API server first.
5. **Operating Mode Check:** Respects the UI toggle between `AUTONOMOUS` (auto-execute) and `HUMAN_IN_THE_LOOP` (pause LangGraph state and wait for user approval).

### 5.4 Honest Remediation Effectiveness Evaluation
Remediation effectiveness is evaluated and documented in two distinct tables:

- **Live Local `kind` Cluster Benchmark (Primary Proof):** Measures real pod recovery time (MTTR), CPU/Memory stabilization within 60 seconds of real Kubernetes API actions against real `stress-ng` / leak loads.
- **Held-Out Cloud Replay Demo:** Clearly labeled in the UI and docs as a *Digital Twin Replay* for browser accessibility on the free cloud URL.

---

## 6. Interactive React Command Center & Packaging

- **Frontend** (`frontend/`): React (Vite) + Tailwind CSS + React Flow (live 10-service OnlineBoutique dependency graph with color-coded health states) + Recharts (real-time metric & anomaly probability curves) + Chaos Control Deck + Agent Reasoning & Approval Console.
- **Backend** (`backend/`): FastAPI with WebSockets streaming telemetry ticks, Phase 1 predictions, and Phase 2 LangGraph state updates.
- **Consume K8s Bonus** (`k8s_manifests/`): Includes Dockerfile, Deployment, Service, and least-privilege Role / RoleBinding (ServiceAccount) so Kintsugi-AI runs natively inside Kubernetes.
