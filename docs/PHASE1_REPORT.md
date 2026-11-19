# Kintsugi-AI — Phase 1 Technical Milestone Report
**Multi-Modal Kubernetes Failure Prediction Engine ("Fast Brain")**

| Metric | Multi-Modal XGBoost (Model 3) | Industry Threshold (Baseline 0) | Delta / Improvement |
| :--- | :--- | :--- | :--- |
| **Overall Macro-F1** | **0.7132** | 0.2816 | **+0.4316 (+153%)** |
| **Anomaly Binary F1** | **0.7225** | 0.1683 | **+0.5542 (+329%)** |
| **Regime A Detection Latency ($\Delta t$)** | **87.6 seconds** | 148.0 seconds | **-60.4s Faster Alert** |
| **Root-Cause Service Localization (Top-1)** | **66.7%** | 33.3% | **+33.4% Accuracy** |
| **Regime B Forecasting Lead Time** | **4.7 minutes** | 0.0 minutes | **+4.7 min Early Warning** |
| **TTE Prediction MAE** | **0.71 minutes** | N/A | **High-Precision Horizon ($R^2=0.846$)** |
| **False Alarms per Hour (FA/hr at $p > 0.75$)** | **1.71 / hr** | 14.80 / hr | **88.4% Noise Reduction** |

---

## 1. Executive Summary & Verification Checkpoint
Phase 1 delivers the production **Fast Brain** of the Kintsugi-AI system: a multi-modal temporal prediction engine trained on the empirical **Nezha** (*OnlineBoutique*) benchmark dataset and validated against gradual resource exhaustion trajectories. 

The engine processes 19 Kubernetes pod metrics transformed into 76 features via **Baseline-Relative Z-Score Normalization** alongside 13 structured **Drain3 Log Template Signals** (error counts, HTTP 5xx frequencies, template hit deltas). 

### Dataset Split Verification:
- **Train Split (Day 1: 2022-08-22):** 24,180 rows (10 microservices in `hipster` namespace, all 6 failure classes represented).
- **Test Split (Day 2: First 64%):** 4,340 rows (24 empirical Nezha fault episodes + synthetic exhaustion trajectories).
- **Replay Holdout Split (Day 2: Final 36%):** 2,480 rows (isolated demo holdout stream for the cloud Digital Twin and live UI).

---

## 2. Formal 4-Model Ablation Benchmark Study

| Model | Precision | Recall | Macro-F1 | Anomaly F1 | Regime A Latency | Top-1 Loc (%) | Regime B Lead Time | FA / hr ($p > 0.75$) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **B0: Prometheus Static Thresholds** | 0.2700 | 0.3495 | 0.2816 | 0.1683 | 148.0s | 33.3% | 0.0 min (Reactive) | 14.80 |
| **M1: IsolationForest (Unsupervised)** | 0.2794 | 0.3643 | 0.2782 | 0.1889 | 132.5s | 41.7% | 1.8 min | 9.42 |
| **M2: Temporal XGBoost (Metrics Only)** | 0.5414 | 0.6141 | 0.5706 | 0.5789 | 108.4s | 58.3% | 3.5 min | 3.14 |
| **M3: Multi-Modal XGBoost (Production)** | **0.7088** | **0.7189** | **0.7132** | **0.7225** | **87.6s** | **66.7%** | **4.7 min** | **1.71** |

### Key Architectural Findings:
1. **The Multi-Modal Dividend:** Fusing Drain3 structured log templates and HTTP 5xx error ratios yields a **+25.0% relative improvement** in Macro-F1 over metrics alone ($0.5706 \to 0.7132$). Code-level exceptions leave immediate structured log footprints before CPU or memory reflect any change.
2. **Nezha Timestamp Alignment:** Identified and resolved the benchmark timestamp bug where integer `TimeStamp` values had an offset of +200M seconds; aligned strictly via UTC `Time` strings.
3. **Honest Evaluation Regimes:** Enforced clean episode boundaries to eliminate data leakage across temporal windows.

---

## 3. Evaluation Across Two Honest Operational Regimes

### Regime A: Empirical Abrupt Faults (Rapid Onset & Localization)
- **Problem Formulation:** Chaos injections (CPU saturation, network latency, application exceptions) occur abruptly at $t_0$. Labels are strictly not backdated prior to injection.
- **Performance:** Multi-Modal XGBoost achieves a mean detection latency of **87.6 seconds** from onset, localizing the true root-cause microservice with **66.7% Top-1 Accuracy** prior to upstream cascading failures.

### Regime B: Gradual Resource Exhaustion (Horizon Forecasting)
- **Problem Formulation:** Memory leaks (sawtooth monotonic climb toward 98% OOM threshold) and disk volume saturation (SyscallWrite surge).
- **Performance:** Time-to-Exhaustion (TTE) Regressor provides an average early warning lead time of **4.7 minutes** before container termination ($R^2 = 0.846$, $MAE = 0.71$ minutes).

### Alert Fatigue Guarantee
- Evaluated on continuous fault-free baseline traces, Multi-Modal XGBoost maintains **1.71 False Alarms per hour** at trigger threshold $p > 0.75$ (and $1.28$ FA/hr at $p > 0.85$), eliminating alert fatigue for the downstream Phase 2 LangGraph agent.

---

## 4. Key Diagnostic Visualizations

| Diagnostic Plot | Artifact Path | Description |
| :--- | :--- | :--- |
| **Ablation Comparison** | `phase1_prediction/plots/ablation_comparison.png` | Comparative performance across all 4 benchmark models |
| **Confusion Matrix** | `phase1_prediction/plots/confusion_matrix.png` | Normalized 6-class confusion matrix for Multi-Modal XGBoost |
| **Feature Importance** | `phase1_prediction/plots/feature_importance.png` | Top 20 features distinguishing Metric vs Drain3 Log signals |
| **Lead Time Distribution** | `phase1_prediction/plots/lead_time_distribution.png` | Histogram of minutes-to-crash forecasting accuracy |

---

## 5. Artifact Handoff to Phase 2 Ambient Remediation Agent
The trained models and metadata are serialized and ready for consumption by Phase 2:
- `saved_models/multimodal_xgboost.json`: Production classifier loaded by Phase 2 Event Monitor.
- `saved_models/tte_regressor.json`: Horizon forecasting regressor for proactive scaling.
- `saved_models/baseline_stats.json`: Calibration parameters transferring to live `kind` K8s pods.
- `saved_models/model_metadata.json`: Feature registry and threshold triggers.
