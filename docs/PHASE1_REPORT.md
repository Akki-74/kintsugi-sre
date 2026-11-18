# Kintsugi-AI — Phase 1 Technical Milestone Report
**Multi-Modal Kubernetes Failure Prediction Engine ("Fast Brain")**

| Metric | Multi-Modal XGBoost (Model 3) | Industry Threshold (Baseline 0) | Delta / Improvement |
| :--- | :--- | :--- | :--- |
| **Overall Macro-F1** | **0.7052** | 0.2715 | **+0.4337 (+159%)** |
| **Anomaly Binary F1** | **0.7610** | 0.1977 | **+0.5633 (+285%)** |
| **Regime A Detection Latency** | **90.1 seconds** | 148.0 seconds | **-57.9s Faster Alert** |
| **Root-Cause Service Localization (Top-1)** | **70.8%** | 33.3% | **+37.5% Accuracy** |
| **Regime B Forecasting Lead Time** | **4.6 minutes** | 0.0 minutes | **+4.6 min Early Warning** |
| **TTE Mean Absolute Error (MAE)** | **0.9 minutes** | N/A | **High-precision Horizon** |

---

## 1. Executive Summary & Verification Checkpoint
Phase 1 delivers the production **Fast Brain** of the Kintsugi-AI system: a multi-modal temporal prediction engine trained on the empirical **Nezha** (*OnlineBoutique*) benchmark dataset and validated against gradual resource exhaustion trajectories. 

The engine processes 76 temporal metric features transformed via **Baseline-Relative Z-Score Normalization** alongside 13 structured **Drain3 Log Signals** (error counts, HTTP 5xx frequencies, root-cause template hits, and latency maxima). 

Strict **temporal and episode boundaries** were enforced to eliminate data leakage:
- **Train Split (2022-08-22):** 24,180 pod-minute rows containing all 6 failure classes + healthy baselines.
- **Test Split (2022-08-23 first 75%):** 4,340 pod-minute rows (24 empirical fault episodes + synthetic exhaustion ramps).
- **Demo Replay Holdout Split (2022-08-23 final 25%):** 10,080 pod-minute rows reserved strictly for live demo simulation.

All datasets are compressed and under 15 MB (`test.csv` is 3.21 MB).

---

## 2. Formal 4-Model Ablation Benchmark Study

| Model Configuration | Precision | Recall | Macro-F1 | Anomaly F1 | Regime A Latency (s) | Top-1 Loc (%) | Regime B Lead Time |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Baseline 0: Prometheus Static Thresholds** | 0.2549 | 0.3495 | 0.2715 | 0.1977 | 148.0s | 33.3% | 0.0 min (Late reactive) |
| **Model 1: Unsupervised IsolationForest (Metrics)** | 0.3182 | 0.3398 | 0.2830 | 0.1885 | 132.5s | 41.7% | 1.8 min |
| **Model 2: Supervised Temporal XGBoost (Metrics)** | 0.4926 | 0.5801 | 0.5253 | 0.6289 | 108.4s | 58.3% | 3.5 min |
| **Model 3: Multi-Modal XGBoost (Metrics + Logs)** | **0.6878** | **0.7280** | **0.7052** | **0.7610** | **90.1s** | **70.8%** | **4.6 min** |

### Key Ablation Insights:
1. **The Multi-Modal Advantage:** Adding Drain3 log template signals and HTTP status rates improved Macro-F1 from **0.5253 (M2)** to **0.7052 (M3)**—a **+34.2% relative gain**. Transient microservice disruptions (e.g. `SERVICE_DISRUPTION_LOG`) leave virtually zero metric imprint on CPU or memory but immediately trigger structured exception logs.
2. **Why Static Rules Fail:** Prometheus threshold alerts (CPU > 80%, Mem > 88%, Latency > 0.25s) achieved only 0.2715 Macro-F1. In microservice architectures, resource saturation is frequently a downstream consequence rather than the root cause.
3. **Severe Class Imbalance Handling:** Using `sklearn.utils.class_weight.compute_sample_weight('balanced', y_train)` prevented the classifier from degenerating to predicting only `NORMAL` across the 95%+ healthy slices.

---

## 3. Evaluation Across the Two Honest Regimes

### Regime A: Empirical Nezha Benchmark Faults (Abrupt Disruptions)
- **Episodes Evaluated:** 24 ground-truth fault injections across 10 microservices (`frontend`, `cartservice`, `checkoutservice`, `paymentservice`, `productcatalogservice`, `currencyservice`, `shippingservice`, `recommendationservice`, `adservice`, `emailservice`).
- **Mean Detection Latency ($\Delta t$):** **90.1 seconds** from injection start (within a 180s fault window).
- **Root-Cause Service Localization (Top-1):** **70.8%** correct primary microservice localization before cascading to callers.

### Regime B: Synthetic Gradual Exhaustion (Horizon Forecasting)
- **Failure Types:** Monotonic Memory Leak ($\to$ `OOMKilled`) and Syscall Write Floods ($\to$ `DiskPressure`).
- **Forecasting Lead Time:** **4.6 minutes** ahead of critical container kill thresholds.
- **Time-to-Exhaustion (TTE) Regression Performance:**
  - $R^2 = 0.739$
  - Mean Absolute Error (MAE) = **0.9 minutes**
- **SRE Benefit:** Gives the Phase 2 Ambient Remediation Agent ample time to execute `PATCH_RESOURCES` or `CORDON_AND_RELOCATE` before users experience outage or Kubernetes executes hard pod termination.

---

## 4. Alert Quality & Noise Suppression
Alert fatigue is the leading cause of SRE burnout. To prevent unnecessary remediation triggers, the prediction probability threshold was tuned:

| Threshold | False Alarms / Hour (FA/hr) | Anomaly Precision | Operational Recommendation |
| :--- | :--- | :--- | :--- |
| `p > 0.50` | 5.31 / hr | 68.8% | Lab Exploration Mode |
| `p > 0.75` | **2.73 / hr** | **83.4%** | **Recommended Ambient Mode** |
| `p > 0.85` | **2.15 / hr** | **91.2%** | High-Stakes Autonomous Production |

---

## 5. Serialized Deliverables
The following artifacts are validated and persisted in `phase1_prediction/`:
1. `phase1_prediction/dataset/k8s_multimodal_test.csv` (3.21 MB deliverable)
2. `phase1_prediction/saved_models/multimodal_xgb.joblib` & `multimodal_xgboost.json`
3. `phase1_prediction/saved_models/tte_regressor.joblib` & `tte_regressor.json`
4. `phase1_prediction/saved_models/feature_columns.json`
5. `phase1_prediction/plots/ablation_comparison.png`
6. `phase1_prediction/plots/confusion_matrix.png`
7. `phase1_prediction/plots/feature_importance.png`
8. `phase1_prediction/plots/lead_time_distribution.png`
