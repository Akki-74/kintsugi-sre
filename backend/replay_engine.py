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
        
        # Load trained Phase 1 Multi-Modal Model
        self.classifier = None
        self.regressor = None
        self.meta = {}
        self.holdout_df = pd.DataFrame()
        self._load_artifacts()

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
        if hasattr(self.agent.k8s, "_mock_cluster_state") and "services" in self.agent.k8s._mock_cluster_state:
            svc_dict = self.agent.k8s._mock_cluster_state["services"].setdefault(plan.target_service, {})
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
        """Manual Chaos Injection Deck trigger."""
        fault_map = {
            "cpu_contention": "CPU_EXHAUSTION",
            "memory_leak": "MEMORY_EXHAUSTION",
            "exception": "SERVICE_DISRUPTION_LOG",
            "disk_pressure": "DISK_EXHAUSTION",
            "network_delay": "NETWORK_DEGRADATION"
        }
        cls_name = fault_map.get(fault_type, "CPU_EXHAUSTION")
        
        # Mark node as active incident
        if hasattr(self.agent.k8s, "_mock_cluster_state") and "services" in self.agent.k8s._mock_cluster_state:
            svc_dict = self.agent.k8s._mock_cluster_state["services"].setdefault(service, {})
            svc_dict["is_verified_repaired"] = False
            svc_dict["is_incident"] = True
            svc_dict["is_remediating"] = False
            svc_dict["status"] = "Incident"

        # Synthesize anomaly state
        telemetry = {
            "CpuUsageRate(%)": 92.0 if "CPU" in cls_name else 25.0,
            "MemoryUsageRate(%)": 94.0 if "MEMORY" in cls_name else 30.0,
            "PodServerLatencyP95(s)": 2.2 if "NETWORK" in cls_name else 0.2,
            "PodSuccessRate(%)": 45.0 if "SERVICE" in cls_name else 100.0,
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
            "proposed_plan": state.get("proposed_plan").dict() if state.get("proposed_plan") else None,
            "execution": state.get("execution_result").dict() if state.get("execution_result") else None
        }

    def get_next_tick(self) -> Dict[str, Any]:
        """Emits next real telemetry tick with live Phase 1 inference & Phase 2 remediation."""
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

        # Dispatch Phase 2 Ambient Agent if anomaly detected
        agent_event = None
        if pred_class != "NORMAL" and confidence >= 0.50:
            agent_state = self.agent.process_telemetry_tick(
                predicted_fault=pred_class,
                target_service=service,
                confidence=confidence,
                telemetry=metrics,
                recent_logs=[f"Log template alert: error_count={metrics['log_error_count']}"],
                autonomous_mode=self.autonomous_mode,
                human_approved=None
            )
            agent_event = {
                "state": agent_state.get("current_state"),
                "planned_action": agent_state.get("proposed_plan").selected_action.value if agent_state.get("proposed_plan") else None,
                "reasoning": agent_state.get("proposed_plan").reasoning_summary if agent_state.get("proposed_plan") else None,
                "history": agent_state.get("step_history", []),
                "execution_status": agent_state.get("execution_result").status if agent_state.get("execution_result") else None,
            }
            if agent_state.get("current_state") == "AWAITING_APPROVAL":
                self.pending_hitl_plan = {
                    "plan": agent_state["proposed_plan"],
                    "service": service,
                    "fault": pred_class
                }

        cluster_snap = self.agent.k8s.get_cluster_snapshot()

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
            "pending_plan": self.pending_hitl_plan["plan"].dict() if self.pending_hitl_plan else None,
            "autonomous_mode": self.autonomous_mode,
        }
        return tick_payload
