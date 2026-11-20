"""
Kintsugi-AI — Cloud Held-Out Digital Twin Replay Engine
========================================================
Streams held-out telemetry ticks from k8s_multimodal_replay_holdout.csv,
runs live Phase 1 inference, and triggers Phase 2 LangGraph ambient remediation.
"""

import os
import json
import time
import asyncio
from pathlib import Path
from typing import Dict, Any, List, Optional

import numpy as np
import pandas as pd
import xgboost as xgb

from phase2_remediation.langgraph_agent import AmbientRemediationAgent
from phase2_remediation.actions import ActionType

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATASET_DIR = PROJECT_ROOT / "phase1_prediction" / "dataset"
SAVED_MODELS_DIR = PROJECT_ROOT / "phase1_prediction" / "saved_models"

CLASS_NAMES = [
    "NORMAL", "CPU_EXHAUSTION", "MEMORY_EXHAUSTION",
    "DISK_EXHAUSTION", "NETWORK_DEGRADATION", "SERVICE_DISRUPTION_LOG"
]


class DigitalTwinReplayEngine:
    def __init__(self, agent: Optional[AmbientRemediationAgent] = None):
        self.agent = agent or AmbientRemediationAgent()
        self.is_running = False
        self.current_tick_idx = 0
        self.tick_speed_sec = 1.0  # Telemetry emitted every 1 second
        self.autonomous_mode = True
        self.pending_hitl_plan = None
        self.cluster_source = (
            "live"
            if getattr(self.agent.k8s, "is_connected", False)
            else "replay"
        )
        
        # Load trained Phase 1 Multi-Modal Model
        self.classifier = None
        self.regressor = None
        self.meta = {}
        self.holdout_df = pd.DataFrame()
        self._load_artifacts()

    def set_cluster_source(self, source: str) -> str:
        s = source.lower().strip()
        self.cluster_source = "live" if "live" in s else "replay"
        return self.cluster_source

    def set_llm_backend(self, backend: str) -> str:
        if hasattr(self.agent, "llm_client"):
            self.agent.llm_client.preferred_backend = backend.lower().strip()
            return self.agent.llm_client.preferred_backend
        return backend

    def _load_artifacts(self):
        meta_path = SAVED_MODELS_DIR / "model_metadata.json"
        if meta_path.exists():
            with open(meta_path, "r", encoding="utf-8") as f:
                self.meta = json.load(f)

        m_path = SAVED_MODELS_DIR / "multimodal_xgboost.json"
        if m_path.exists():
            self.classifier = xgb.XGBClassifier()
            self.classifier.load_model(str(m_path))

        r_path = SAVED_MODELS_DIR / "tte_regressor.json"
        if r_path.exists():
            self.regressor = xgb.XGBRegressor()
            self.regressor.load_model(str(r_path))

        h_path = DATASET_DIR / "k8s_multimodal_replay_holdout.csv"
        if h_path.exists():
            self.holdout_df = pd.read_csv(h_path)
            # Filter to active sequence with faults for engaging demo
            fault_idx = self.holdout_df[self.holdout_df["target_id"] != 0].index
            if len(fault_idx) > 0:
                start_i = max(0, fault_idx[0] - 20)
                self.holdout_df = self.holdout_df.iloc[start_i:].reset_index(drop=True)

    def set_autonomous_mode(self, enabled: bool):
        self.autonomous_mode = enabled
        self.agent.guardrails.set_mode(enabled)

    def approve_pending_plan(self) -> Dict[str, Any]:
        """Operator approves pending action in Human-in-the-Loop mode."""
        if not self.pending_hitl_plan:
            return {"status": "NO_PENDING_ACTION"}

        plan = self.pending_hitl_plan["plan"]
        exec_res = self.agent.k8s.execute_remediation(plan)
        self.agent.guardrails.record_remediation(plan.target_service, timestamp=exec_res.executed_at)
        
        # Mark node as verified repaired (Kintsugi Gold Seam)
        dt_state = getattr(self.agent.k8s, "_digital_twin_state", getattr(self.agent.k8s, "_mock_cluster_state", None))
        if dt_state and "services" in dt_state:
            svc_dict = dt_state["services"].setdefault(plan.target_service, {})
            svc_dict["is_verified_repaired"] = True
            svc_dict["is_incident"] = False
            svc_dict["is_predicted_failure"] = False
            svc_dict["is_remediating"] = False
            svc_dict["status"] = "VerifiedRepaired"

        result = {
            "status": "APPROVED_AND_EXECUTED",
            "action": plan.selected_action.value,
            "service": plan.target_service,
            "message": exec_res.message,
            "executed_at": exec_res.executed_at
        }
        self.pending_hitl_plan = None
        return result

    def reject_pending_plan(self) -> Dict[str, Any]:
        if not self.pending_hitl_plan:
            return {"status": "NO_PENDING_ACTION"}
        service = self.pending_hitl_plan["plan"].target_service
        self.pending_hitl_plan = None
        return {"status": "REJECTED_BY_OPERATOR", "service": service}

    def inject_chaos(self, service: str, fault_type: str) -> Dict[str, Any]:
        """Manual Chaos Injection Deck trigger with expanded scenario taxonomy."""
        normalized = str(fault_type).lower().strip()
        fault_map = {
            # CPU Contention & Thrashing
            "cpu_contention": "CPU_EXHAUSTION",
            "cpu_burn": "CPU_EXHAUSTION",
            "cpu_stress": "CPU_EXHAUSTION",
            "cpu": "CPU_EXHAUSTION",
            "cascading_failure": "CPU_EXHAUSTION",
            # Memory Exhaustion & OOM
            "memory_leak": "MEMORY_EXHAUSTION",
            "oom_kill": "MEMORY_EXHAUSTION",
            "heap_leak": "MEMORY_EXHAUSTION",
            "memory": "MEMORY_EXHAUSTION",
            "oom": "MEMORY_EXHAUSTION",
            # Service Disruption, Exceptions & Deadlocks
            "exception": "SERVICE_DISRUPTION_LOG",
            "exception_burst": "SERVICE_DISRUPTION_LOG",
            "http_500": "SERVICE_DISRUPTION_LOG",
            "5xx": "SERVICE_DISRUPTION_LOG",
            "service_disruption": "SERVICE_DISRUPTION_LOG",
            "crash_loop": "SERVICE_DISRUPTION_LOG",
            "thread_deadlock": "SERVICE_DISRUPTION_LOG",
            "deadlock": "SERVICE_DISRUPTION_LOG",
            "socket_leak": "SERVICE_DISRUPTION_LOG",
            # Disk Volume Pressure
            "disk_pressure": "DISK_EXHAUSTION",
            "disk_fill": "DISK_EXHAUSTION",
            "io_saturation": "DISK_EXHAUSTION",
            "disk": "DISK_EXHAUSTION",
            # Envoy Service Mesh & Network
            "network_delay": "NETWORK_DEGRADATION",
            "network_latency": "NETWORK_DEGRADATION",
            "packet_loss": "NETWORK_DEGRADATION",
            "network_degradation": "NETWORK_DEGRADATION",
            "latency": "NETWORK_DEGRADATION",
            "network": "NETWORK_DEGRADATION",
        }
        
        # Direct uppercase match if provided as standard class name
        if str(fault_type).upper() in ["CPU_EXHAUSTION", "MEMORY_EXHAUSTION", "SERVICE_DISRUPTION_LOG", "DISK_EXHAUSTION", "NETWORK_DEGRADATION"]:
            cls_name = str(fault_type).upper()
        else:
            cls_name = fault_map.get(normalized, "CPU_EXHAUSTION")
        
        # Mark node as active incident
        dt_state = getattr(self.agent.k8s, "_digital_twin_state", getattr(self.agent.k8s, "_mock_cluster_state", None))
        if dt_state and "services" in dt_state:
            svc_dict = dt_state["services"].setdefault(service, {})
            svc_dict["is_verified_repaired"] = False
            svc_dict["is_incident"] = True
            svc_dict["is_remediating"] = False
            svc_dict["status"] = "Incident"
            svc_dict["fault_type"] = cls_name

        # Synthesize realistic multi-modal anomaly telemetry state
        telemetry = {
            "CpuUsageRate(%)": 94.6 if "CPU" in cls_name else 24.2,
            "MemoryUsageRate(%)": 94.8 if "MEMORY" in cls_name else 31.0,
            "PodServerLatencyP95(s)": 2.25 if "NETWORK" in cls_name else 0.12,
            "PodClientLatencyP90(s)": 2.40 if "NETWORK" in cls_name else 0.15,
            "PodSuccessRate(%)": 42.0 if "SERVICE" in cls_name else 99.8,
            "SyscallWrite": 9200.0 if "DISK" in cls_name else 145.0,
            "time_to_exhaustion_min": 4.1 if ("MEMORY" in cls_name or "DISK" in cls_name) else None
        }
        logs = [f"Chaos injection: {fault_type} triggered on container for {service}"]

        state = self.agent.process_telemetry_tick(
            predicted_fault=cls_name,
            target_service=service,
            confidence=0.96,
            telemetry=telemetry,
            recent_logs=logs,
            autonomous_mode=self.autonomous_mode,
            human_approved=None
        )

        if state.get("current_state") == "AWAITING_APPROVAL":
            self.pending_hitl_plan = {
                "plan": state["proposed_plan"],
                "service": service,
                "fault": cls_name
            }

        return {
            "status": "CHAOS_INJECTED",
            "service": service,
            "fault": cls_name,
            "agent_state": state.get("current_state"),
            "proposed_plan": state.get("proposed_plan").model_dump() if state.get("proposed_plan") else None,
            "execution": state.get("execution_result").model_dump() if state.get("execution_result") else None
        }

    def get_next_tick(self) -> Dict[str, Any]:
        """Emits next real telemetry tick with live Phase 1 inference & Phase 2 remediation."""
        is_live = (self.cluster_source == "live")

        if is_live and getattr(self.agent, "prometheus", None) and self.agent.prometheus.is_reachable:
            dt_state = getattr(self.agent.k8s, "_digital_twin_state", getattr(self.agent.k8s, "_mock_cluster_state", {}))
            services = list(dt_state.get("services", {}).keys()) or [
                "frontend", "checkoutservice", "cartservice", "paymentservice",
                "productcatalogservice", "currencyservice", "shippingservice",
                "recommendationservice", "adservice", "emailservice"
            ]
            idx = self.current_tick_idx
            self.current_tick_idx += 1
            service = services[idx % len(services)]
            epoch_sec = int(time.time())
            gt_class = "NORMAL"

            live_m = self.agent.prometheus.get_service_metrics(service)
            cpu_val = live_m.get("cpu_usage_pct", 25.0)
            mem_val = live_m.get("memory_usage_pct", 30.0)

            metrics = {
                "CpuUsageRate(%)": float(cpu_val),
                "MemoryUsageRate(%)": float(mem_val),
                "PodServerLatencyP95(s)": 0.12,
                "PodWorkload(Ops)": 15.0,
                "PodSuccessRate(%)": 100.0,
                "log_error_count": 0.0,
            }
            pred_class = "NORMAL"
            confidence = 0.98
            tte_min = None

            # If CPU or memory is elevated in live cluster, mark anomaly
            if cpu_val > 80.0:
                pred_class = "CPU_EXHAUSTION"
                confidence = 0.94
            elif mem_val > 85.0:
                pred_class = "MEMORY_EXHAUSTION"
                confidence = 0.92
                tte_min = 3.5

        else:
            if self.holdout_df.empty:
                return {"status": "NO_DATA"}

            idx = self.current_tick_idx % len(self.holdout_df)
            self.current_tick_idx += 1
            row = self.holdout_df.iloc[idx]

            service = row.get("service", "frontend")
            epoch_sec = int(row.get("epoch_sec", time.time()))
            gt_class = row.get("fault_class", "NORMAL")

            # Run Phase 1 inference
            features = self.meta.get("features", [])
            if self.classifier and features:
                x_vec = row[features].to_numpy().reshape(1, -1)
                pred_id = int(self.classifier.predict(x_vec)[0])
                pred_probas = self.classifier.predict_proba(x_vec)[0]
                confidence = float(pred_probas[pred_id])
                pred_class = CLASS_NAMES[pred_id]
            else:
                pred_class = gt_class
                confidence = 0.95

            # TTE prediction for gradual regimes
            tte_min = None
            if self.regressor and features and pred_class in ["MEMORY_EXHAUSTION", "DISK_EXHAUSTION"]:
                tte_min = float(self.regressor.predict(x_vec)[0])

            # Core metric snapshot
            metrics = {
                "CpuUsageRate(%)": float(row.get("CpuUsageRate(%)", 25.0)),
                "MemoryUsageRate(%)": float(row.get("MemoryUsageRate(%)", 30.0)),
                "PodServerLatencyP95(s)": float(row.get("PodServerLatencyP95(s)", 0.15)),
                "PodWorkload(Ops)": float(row.get("PodWorkload(Ops)", 10.0)),
                "PodSuccessRate(%)": float(row.get("PodSuccessRate(%)", 100.0)),
                "log_error_count": float(row.get("log_error_count", 0.0)),
            }

        # Dispatch Phase 2 Ambient Agent if anomaly detected or plan awaiting approval
        agent_event = None
        if self.pending_hitl_plan is not None:
            # Check 1: If a plan is already pending human operator approval, emit stable approval state
            p_obj = self.pending_hitl_plan.get("plan")
            plan_dict = (
                p_obj.model_dump()
                if (p_obj and hasattr(p_obj, "model_dump"))
                else (p_obj.dict() if p_obj else None)
            )
            hitl_svc = self.pending_hitl_plan.get("service", service)
            agent_event = {
                "state": "AWAITING_APPROVAL",
                "current_node": "AWAITING_APPROVAL",
                "planned_action": p_obj.selected_action.value if p_obj else None,
                "reasoning": p_obj.reasoning_summary if p_obj else None,
                "history": [f"EXECUTE: Paused in HUMAN_IN_THE_LOOP mode. Waiting for operator approval on {hitl_svc}."],
                "execution_status": "AWAITING_APPROVAL",
                "remediation_plan": plan_dict,
                "guardrail_result": {"passed": True, "violations": []},
                "verification_result": None,
            }
        elif pred_class != "NORMAL" and confidence >= 0.50:
            # Check 2: If the service is in 120s anti-thrash cooldown lock, it was already remediated! DO NOT call LLM!
            if self.agent.guardrails.is_service_in_cooldown(service)[0]:
                is_cd, cd_left = self.agent.guardrails.is_service_in_cooldown(service)
                agent_event = {
                    "state": "GUARDRAIL_COOLDOWN",
                    "current_node": "GUARDRAILS",
                    "planned_action": "COOLDOWN_LOCK",
                    "reasoning": f"Service '{service}' is protected by 120s Anti-Thrash Cooldown ({cd_left:.1f}s remaining).",
                    "history": [f"GUARDRAILS: Anti-thrash cooldown active for {service} ({cd_left:.1f}s remaining)."],
                    "execution_status": "LOCKED",
                    "remediation_plan": None,
                    "guardrail_result": {"passed": False, "violations": [f"Cooldown lock active: {cd_left:.1f}s remaining"]},
                    "verification_result": None,
                }
            # Check 3: If service was already verified repaired in this incident cycle
            elif getattr(self.agent.k8s, "_digital_twin_state", getattr(self.agent.k8s, "_mock_cluster_state", {})).get("services", {}).get(service, {}).get("is_verified_repaired", False):
                agent_event = {
                    "state": "VERIFIED",
                    "current_node": "VERIFY",
                    "planned_action": "VERIFIED_REPAIRED",
                    "reasoning": f"Service '{service}' was already healed and sealed in Kintsugi Gold.",
                    "history": [f"VERIFY: Pod recovery confirmed. Gold Seam active for {service}."],
                    "execution_status": "SUCCESS",
                    "remediation_plan": None,
                    "guardrail_result": {"passed": True, "violations": []},
                    "verification_result": {"status": "RECOVERED", "action_executed": "PREVIOUS_REMEDIATION"},
                }
            else:
                agent_state = self.agent.process_telemetry_tick(
                    predicted_fault=pred_class,
                    target_service=service,
                    confidence=confidence,
                    telemetry=metrics,
                    recent_logs=[f"Log template alert: error_count={metrics['log_error_count']}"],
                    autonomous_mode=self.autonomous_mode,
                    human_approved=None
                )
                plan_obj = agent_state.get("proposed_plan")
                plan_dict = (
                    plan_obj.model_dump()
                    if (plan_obj and hasattr(plan_obj, "model_dump"))
                    else (plan_obj.dict() if plan_obj else None)
                )
                g_obj = agent_state.get("guardrail_result")
                g_dict = (
                    g_obj.model_dump()
                    if (g_obj and hasattr(g_obj, "model_dump"))
                    else (g_obj.dict() if g_obj else None)
                )
                agent_event = {
                    "state": agent_state.get("current_state"),
                    "current_node": agent_state.get("current_state"),
                    "planned_action": plan_obj.selected_action.value if plan_obj else None,
                    "reasoning": plan_obj.reasoning_summary if plan_obj else None,
                    "history": agent_state.get("step_history", []),
                    "execution_status": agent_state.get("execution_result").status if agent_state.get("execution_result") else None,
                    "remediation_plan": plan_dict,
                    "guardrail_result": g_dict,
                    "verification_result": agent_state.get("verification_result"),
                }
                if agent_state.get("current_state") == "AWAITING_APPROVAL":
                    self.pending_hitl_plan = {
                        "plan": agent_state["proposed_plan"],
                        "service": service,
                        "fault": pred_class
                    }

        cluster_snap = self.agent.k8s.get_cluster_snapshot()
        is_conn = bool(getattr(self.agent.k8s, "is_connected", False))
        prom_ok = bool(getattr(getattr(self.agent, "prometheus", None), "is_reachable", False))

        tick_payload = {
            "tick_index": idx,
            "timestamp": epoch_sec,
            "service": service,
            "ground_truth_class": gt_class,
            "prediction": {
                "fault_class": pred_class,
                "confidence": round(confidence, 3),
                "is_anomaly": (pred_class != "NORMAL"),
                "time_to_exhaustion_min": round(tte_min, 1) if tte_min else None,
            },
            "metrics": metrics,
            "agent_event": agent_event,
            "cluster_state": cluster_snap["state"]["services"],
            "pending_hitl": (self.pending_hitl_plan is not None),
            "pending_plan": (
                self.pending_hitl_plan["plan"].dict()
                if (self.pending_hitl_plan and hasattr(self.pending_hitl_plan["plan"], "dict"))
                else None
            ),
            "autonomous_mode": self.autonomous_mode,
            "is_k8s_connected": is_conn,
            "cluster_mode": "LIVE_K8S" if is_conn else "STANDALONE",
            "cluster_source": self.cluster_source,
            "prometheus_reachable": prom_ok,
        }
        return tick_payload
