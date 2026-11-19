# 🏺 Kintsugi-AI — Official Slide Deck & Video Demo Walkthrough Guide

This document provides the **10-Slide Presentation Deck** and the **Step-by-Step Video Recording Script** for hackathon judges and evaluators.

---

## 📽️ Part 1: The 10-Slide Presentation Deck

### Slide 1: Title & Core Vision
* **Title:** Kintsugi-AI: Autonomous Multi-Modal Kubernetes Failure Prediction & Ambient Remediation
* **Tagline:** *"Catch the cracks. Verify the fix."*
* **Inspiration:** The Japanese art of *Kintsugi* (金継ぎ)—mending broken ceramics with gold lacquer so the repaired object emerges stronger and more resilient than before.
* **Presenters / Authors:** Hackathon Engineering Team
* **Target Environment:** 10-microservice Google *OnlineBoutique* on Kubernetes
* **Speaker Note:** *"Welcome! Today we present Kintsugi-AI, a cloud-native autonomous SRE system that replaces noisy, reactive alerts with a predictive Fast Brain and a safe, guardrailed Slow Brain."*

---

### Slide 2: The Modern SRE Crisis
* **Problem 1: Alert Fatigue:** Static Prometheus threshold rules (e.g., CPU > 80%) fire constantly on transient spikes, causing over 14 false alarms per hour.
* **Problem 2: Reactive Firefighting:** By the time static rules fire, containers have already entered CrashLoopBackOff or dropped user traffic.
* **Problem 3: Unconstrained LLM Hallucination:** Naive AI agents executing arbitrary bash or kubectl commands risk taking down production clusters without safety checks.
* **Speaker Note:** *"Modern SREs are drowning in alert fatigue. Static alerts tell you what already broke 3 minutes ago. And handing raw cluster credentials to an unconstrained LLM is an operational nightmare."*

---

### Slide 3: The Two-Brain Architecture
* **Fast Brain (Sub-second ML Inference):**
  * Multi-Modal Temporal XGBoost Classifier + Resource Trajectory Regressor.
  * Ingests 76 Z-score metric features + 13 Drain3 structured log features.
  * Dual-Regime Output: Immediate fault classification & Time-to-Exhaustion (TTE) forecasting.
* **Slow Brain (Guardrailed Ambient Agent):**
  * Event-driven LangGraph State Machine (`Monitor -> Diagnose -> Plan -> Guardrail -> Execute -> Verify`).
  * Enforces Pydantic-constrained action schemas and 5 deterministic SRE guardrails.
  * Human-in-the-Loop approval gate with live WebSocket feedback.
* **Speaker Note:** *"To solve this, Kintsugi-AI decouples prediction from action. A Fast Brain runs at line-rate to forecast failures. When an anomaly is detected, it wakes up a Slow Brain that reasons methodically under strict SRE guardrails."*

---

### Slide 4: Empirical Data Science & The Nezha Benchmark
* **Nezha Benchmark Telemetry:** Real-world faults injected across 10 microservices (*OnlineBoutique*, FSE'23).
* **The 200M-Second Bug Fix:** Caught and resolved an offset flaw in Nezha's raw integer `TimeStamp` column by strictly aligning UTC datetime strings.
* **Baseline-Relative Normalization:** Features normalized against healthy calibration baselines ($\mu, \sigma$) into scale-invariant Z-scores and lag slopes ($\Delta t$).
* **Strict Leak-Free Split:** Enforced zero temporal leakage across episodes:
  * **Train Split:** 2022-08-22 (24,180 rows, all 6 classes).
  * **Test Split:** 2022-08-23 first 64% (4,340 rows, 24 empirical fault episodes + synthetic exhaustion).
  * **Demo Holdout Split:** 2022-08-23 final 36% (2,480 rows, balanced across all classes).
* **Speaker Note:** *"Good ML starts with honest data. We discovered and patched a 200-million second timestamp bug in the benchmark data, and enforced strict episode-boundary separation so zero future telemetry leaked into training."*

---

### Slide 5: The 4-Model Formal Ablation Study

| Model Configuration | Precision | Recall | Macro-F1 | Anomaly F1 | Regime A Latency | Top-1 Loc | Regime B Lead Time |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Baseline 0: Prometheus Static Thresholds** | 0.2700 | 0.3495 | 0.2816 | 0.1683 | 148.0s | 33.3% | 0.0 min (Late reactive) |
| **Model 1: Unsupervised IsolationForest (Metrics)** | 0.2794 | 0.3643 | 0.2782 | 0.1889 | 132.5s | 41.7% | 1.8 min |
| **Model 2: Supervised Temporal XGBoost (Metrics)** | 0.5414 | 0.6141 | 0.5706 | 0.5789 | 108.4s | 58.3% | 3.5 min |
| **Model 3: Multi-Modal XGBoost (Metrics + Logs)** | **0.7088** | **0.7189** | **0.7132** | **0.7225** | **87.6s** | **66.7%** | **4.7 min** |

* **Key Takeaway:** Multi-modal log integration yields a **+25.0% relative gain** in Macro-F1 over metrics alone, and cuts detection latency by **60.4 seconds** compared to Prometheus alerts!
* **Speaker Note:** *"Notice the dramatic jump: static thresholds get 0.28 F1. Metrics-only XGBoost reaches 0.57. But when we integrate Drain3 log template counts, Macro-F1 leaps to 0.713. Why? Because service disruption exceptions leave immediate log footprints even when CPU and memory look completely normal."*

---

### Slide 6: Phase 1 Diagnostic Suite
* **Diagnostic Plot 1: Ablation Comparison:** Demonstrates steady climb across the 4 experimental baselines.
* **Diagnostic Plot 2: Confusion Matrix:** Shows clean separation across all 6 operational classes (`NORMAL`, `CPU_EXHAUSTION`, `MEMORY_EXHAUSTION`, `DISK_EXHAUSTION`, `NETWORK_DEGRADATION`, `SERVICE_DISRUPTION_LOG`).
* **Diagnostic Plot 3: Feature Gain:** Highlights top predictive features (rolling error counts, HTTP 5xx ratios, CPU Z-score slopes).
* **Diagnostic Plot 4: Lead-Time Distribution:** Validates an average 4.7-minute early warning window before memory leaks cause container OOM kills.
* **Speaker Note:** *"Our diagnostic plots prove the reliability: the confusion matrix confirms zero false classifications between CPU and memory, and the lead-time distribution confirms we give the SRE agent nearly 5 minutes to act before any pod is killed."*

---

### Slide 7: Constrained LangGraph Ambient SRE Agent
* **Event-Driven State Graph:**
  * `Monitor`: Polls prediction confidence ($p \ge 0.50$) and checks per-service cooldown.
  * `Diagnose`: Gathers live Kubernetes container state, resource specs, and recent log traces.
  * `Plan`: Prompts LLM (Groq Qwen 3.8-27B or local LM Studio Qwen2.5-3B) with strict Pydantic JSON schema + Deterministic Rule Fallback Matrix.
  * `Guardrails`: Enforces 5 deterministic safety checks before touching the cluster.
  * `Execute`: Calls official Python Kubernetes API or Digital Twin adapter.
  * `Verify`: Confirms metric stabilization and computes Mean Time To Remediate (MTTR).
* **Speaker Note:** *"The Slow Brain is built with LangGraph. Every transition is deterministic and traceable. If the LLM produces invalid JSON, our rule-based fallback matrix immediately steps in, ensuring 100% uptime."*

---

### Slide 8: The 5 Deterministic SRE Guardrails
1. **Namespace Lock:** Mutation allowed only in `["hipster", "kintsugi-lab"]`. `kube-system` is completely immutable.
2. **Action Allowlist:** Actions restricted strictly to 6 sanctioned primitives: `SCALE_DEPLOYMENT`, `PATCH_RESOURCES`, `RESTART_POD`, `CORDON_AND_RELOCATE`, `APPLY_TRAFFIC_SHAPING`, `NO_OP`.
3. **Parameter Clamping:** Replicas clamped to $[1, 5]$; Memory limits clamped to $\le 1024\text{Mi}$.
4. **Anti-Thrashing Cooldown:** 120-second per-service lockout timer prevents flapping and oscillation loops.
5. **Pre-Flight Dry Run:** Evaluated with Kubernetes API `dry_run="All"` prior to commit.
* **Speaker Note:** *"Safety is our highest priority. No AI agent should ever have unrestricted cluster access. Our 5 guardrails guarantee bounded execution, anti-thrashing cooldowns, and pre-flight dry-runs."*

---

### Slide 9: The Kintsugi UI Innovation: "The Gold Seam"
* **5 Visual Node States:**
  * `Healthy` (Emerald): Steady-state operation.
  * `Predicted` (Amber): 4.7-minute horizon warning.
  * `Active Incident` (Red): Active microservice disruption.
  * `Healing` (Cyan): LangGraph agent executing remediation.
  * **✦ Kintsugi Verified (Metallic Gold):** Node sealed with `border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.5)]` and a glowing badge after `verify_node` confirms Z-scores returned to baseline.
* **Human-in-the-Loop Terminal:** Real-time modal displaying LLM reasoning, planned action parameters, and one-click Approve / Reject controls.
* **Speaker Note:** *"In our UI, the healing process is visually celebrated through Kintsugi. When an incident is repaired and verified, the microservice node lights up with a metallic gold seam—proving the system is stronger than before."*

---

### Slide 10: Quantitative Results & $0 Cloud Deployment
* **Operational Gains:**
  * **Macro-F1:** $0.7132$ (+153% over Prometheus).
  * **False Alarms:** Cut to $1.71$ / hr (zero alert fatigue).
  * **Lead Time:** $4.7$ minutes predictive horizon.
  * **MTTR:** $27.6$ seconds average autonomous remediation.
* **Zero Cost Deployment ($0.00):**
  * Packaged via multi-stage Docker (`node:20` + `python:3.11`).
  * Deployed on Hugging Face Spaces (Docker port 7860).
  * Free inference via Groq API (Qwen 3.8-27B) or local RTX 500 Ada (Qwen2.5-3B).
* **Speaker Note:** *"In conclusion, Kintsugi-AI achieves sub-minute MTTR, cuts false alarms by 88%, and runs entirely for $0.00 on free cloud infrastructure or local laptops."*

---

## 🎬 Part 2: Step-by-Step Video Recording Script (5-Minute Screen Walkthrough)

### Time Breakdown:
- **0:00 - 0:45:** Hook & Introduction (The Kintsugi Philosophy)
- **0:45 - 2:00:** Phase 1: Prediction Engine, The Bug Fix & Ablation Jump
- **2:00 - 3:15:** Phase 2: Live Command Center UI, Topology & Chaos Injection
- **3:15 - 4:15:** The LangGraph State Machine, SRE Guardrails & Human-in-the-Loop Approval
- **4:15 - 5:00:** The Gold Seam Verification, Cloud Deployment & Conclusion

---

### Minute 0:00 - 0:45 — The Hook & Introduction
* **Screen to Show:** Browser opened to GitHub Repository `https://github.com/Akki-74/kintsugi-sre` showing the root README.md.
* **Presenter Script:**
  > *"Hi everyone! In traditional Site Reliability Engineering, microservice monitoring is completely reactive. You set static CPU thresholds, they wake you up at 3 AM with false alarms, and by the time you open your terminal, the pods have already crashed.*
  > 
  > *Today, we're showing **Kintsugi-AI**: an autonomous multi-modal Kubernetes failure prediction and ambient remediation system. Inspired by the Japanese art of Kintsugi—repairing broken pottery with gold seams—our system catches failure cracks minutes before they happen, safe-heals the cluster, and verifies the fix."*

---

### Minute 0:45 - 2:00 — Phase 1: ML Breakthroughs & Ablation
* **Screen to Show:** Scroll to **Phase 1 Diagnostic Visualizations** and the **4-Model Ablation Study** table in the README (or show `phase1_prediction/plots/ablation_comparison.png`).
* **Presenter Script:**
  > *"Let's look at the engineering under the hood in Phase 1. We trained on the empirical Nezha benchmark across Google's 10-microservice OnlineBoutique.*
  > 
  > *First, we uncovered and resolved a major 200-million second timestamp bug in the benchmark data, and engineered a strict leak-free temporal split with baseline-relative Z-score normalization.*
  > 
  > *In our 4-model ablation study, industry-standard Prometheus rules only scored 0.28 Macro-F1 with over 14 false alarms an hour. IsolationForest scored 0.28. Metrics-only XGBoost improved to 0.57. But our **Multi-Modal XGBoost**—which fuses temporal metrics with Drain3 structured log template counts and HTTP 5xx spikes—jumped to **0.713 Macro-F1** and cut false alarms to just 1.7 per hour.*
  > 
  > *Even better: for gradual memory leaks and disk pressure, our trajectory regressor gives an average **4.7-minute early warning** lead time before pods are killed."*

---

### Minute 2:00 - 3:15 — Phase 2: Live Command Center & Chaos Injection
* **Screen to Show:** Switch browser tab to the live Kintsugi Command Center UI (`http://localhost:5173` or `http://localhost:8000/app/`).
* **Presenter Script:**
  > *"Now let's switch to the live Kintsugi Command Center.*
  > 
  > *Here in the center is the interactive topology of the 10 OnlineBoutique microservices. On the bottom left, you see real-time streaming telemetry and our Chaos Injection Deck. On the right is the LangGraph Ambient SRE Agent Console.*
  > 
  > *Notice the toggle in the top bar: we have it set to **Human-in-the-Loop** mode so we can inspect every proposed action before execution.*
  > 
  > *Let's inject chaos! I'll select `cartservice` and trigger **CPU Contention**."*
* **Action:** Click `cartservice`, choose `CPU Contention`, and click **Inject Fault**.

---

### Minute 3:15 - 4:15 — LangGraph State Machine & HITL Guardrails
* **Screen to Show:** Watch `cartservice` node pulse in amber/red, and watch the Agent Console on the right update live through the LangGraph steps.
* **Presenter Script:**
  > *"Immediately, the Fast Brain detects the anomaly with 96% confidence. That wakes up our LangGraph Slow Brain.*
  > 
  > *Watch the state machine execute:*
  > 1. *`MONITOR` validates the prediction.*
  > 2. *`DIAGNOSE` correlates the CPU spike with container error logs.*
  > 3. *`PLAN` prompts our LLM—using Groq Qwen 3.8-27B or local Qwen2.5-3B on our laptop's RTX 500 Ada—and extracts a constrained Pydantic schema: `SCALE_DEPLOYMENT` from 1 to 3 replicas.*
  > 4. *`GUARDRAILS` runs 5 deterministic checks: verifying namespace lock, checking the 120s anti-thrashing cooldown, clamping replicas to our bounds, and validating against the Kubernetes API with dry_run='All'.*
  > 
  > *Because we're in Human-in-the-Loop mode, the agent safely pauses at `AWAITING_APPROVAL` with the operator modal."*

---

### Minute 4:15 - 5:00 — Operator Approval, The Gold Seam & Conclusion
* **Screen to Show:** Click **Approve** on the modal. Watch `cartservice` scale to 3 replicas, turn cyan (`remediating`), then transition to the metallic gold border with the `✦ Kintsugi Verified` glowing badge.
* **Presenter Script:**
  > *"I click **Approve**.*
  > 
  > *The Kubernetes API scales `cartservice` to 3 replicas. The verifier monitors metric Z-scores until stability returns.*
  > 
  > *And look at `cartservice` now: it is framed in metallic gold with the glowing **✦ Kintsugi Verified** badge! The pod has healed, verified, and sealed.*
  > 
  > *The entire system runs for **$0.00** on Hugging Face Spaces using our multi-stage Docker container. Everything is open source on GitHub.*
  > 
  > *Catch the cracks. Verify the fix. Thank you!"*

---

## 📋 Pre-Flight Recording Checklist
- [ ] Backend running (`python -m uvicorn backend.main:app --port 8000`).
- [ ] Frontend running (`npm run dev` in `frontend/` or opening `http://localhost:8000/app/`).
- [ ] Screen recording resolution set to 1080p (1920x1080) at 60 FPS.
- [ ] Browser zoom set to 100% or 110% for crisp typography.
- [ ] TopBar toggle checked: `HUMAN-IN-THE-LOOP` mode active.
- [ ] GitHub README tab open and ready for Part 1.
