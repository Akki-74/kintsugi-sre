"""
KubePulse AI — Phase 2 Structured LLM Client & Fallback Engine
==============================================================
Provides structured reasoning selecting strictly from the ActionCatalog.
Supports:
  1. Local LM Studio (Qwen2.5-3B-Instruct on RTX 500 Ada 4GB VRAM)
  2. Free Cloud Groq API (Llama-3.3-70B-Versatile)
  3. Deterministic SRE Matrix Fallback (100% offline / failure-proof)
"""

import os
import json
import logging
from typing import Dict, Any, Optional, Tuple

import urllib.request
import urllib.error
from phase2_remediation.actions import RemediationPlan, FaultToActionMatrix, ActionType

logger = logging.getLogger("KubePulse.LLMClient")


SYSTEM_PROMPT = """You are KubePulse AI SRE Brain, an autonomous Kubernetes Site Reliability Engineering agent.
Your mission is to diagnose multi-modal Kubernetes telemetry anomalies and select the safest, most effective remediation action.

You MUST respond strictly with a valid JSON object matching the following schema.
Do NOT output Markdown code blocks, markdown text, or any explanations outside the JSON object.

Allowed Actions:
- "SCALE_DEPLOYMENT": for CPU contention/saturation or elevated workload traffic. Parameters: {"replicas": int [1, 5]}.
- "PATCH_RESOURCES": for gradual memory leaks or resource exhaustion. Parameters: {"memory_limit_mi": int [64, 1024]}.
- "RESTART_POD": for application exceptions, HTTP 500 bursts, or transient code errors.
- "CORDON_AND_RELOCATE": for node disk pressure or node degradation. Parameters: {"target_node": "kind-worker"}.
- "APPLY_TRAFFIC_SHAPING": for network latency or downstream timeout cascade. Parameters: {"timeout_ms": int [100, 5000]}.
- "NO_ACTION": if metrics are healthy and within baseline bounds.

JSON Schema:
{
  "diagnosed_root_cause": "string",
  "target_service": "string",
  "target_namespace": "hipster",
  "selected_action": "SCALE_DEPLOYMENT" | "PATCH_RESOURCES" | "RESTART_POD" | "CORDON_AND_RELOCATE" | "APPLY_TRAFFIC_SHAPING" | "NO_ACTION",
  "parameters": {"replicas": 3, "memory_limit_mi": 512, "timeout_ms": 1000},
  "confidence": 0.95,
  "reasoning_summary": "string"
}
"""


class LLMRemediationClient:
    def __init__(self,
                 local_url: str = "http://localhost:1234/v1/chat/completions",
                 groq_api_key: Optional[str] = None):
        self.local_url = os.environ.get("LM_STUDIO_URL", local_url)
        self.groq_api_key = os.environ.get("GROQ_API_KEY", groq_api_key)
        self.groq_url = "https://api.groq.com/openai/v1/chat/completions"

    def plan_remediation(self,
                          fault_class: str,
                          predicted_service: str,
                          confidence: float,
                          telemetry_summary: Dict[str, Any],
                          recent_logs: list[str]) -> Tuple[RemediationPlan, str]:
        """
        Attempts structured reasoning via:
          1. Local LM Studio (Qwen2.5-3B)
          2. Cloud Groq API (Llama-3.3-70B)
          3. Deterministic Fallback Matrix
        Returns (RemediationPlan, source_used: 'LM_STUDIO' | 'GROQ' | 'FALLBACK_MATRIX')
        """
        user_prompt = f"""Target Anomaly Observation:
- Predicted Fault Class: {fault_class}
- Primary Microservice: {predicted_service}
- ML Classifier Confidence: {confidence:.2f}

Recent Metric Telemetry:
{json.dumps(telemetry_summary, indent=2)}

Recent Container Logs / Events:
{json.dumps(recent_logs[-5:] if recent_logs else ["No recent error logs recorded."], indent=2)}

Diagnose root cause and output strict JSON remediation plan:"""

        # 1. Try Local LM Studio
        plan, err = self._call_openai_compatible(
            url=self.local_url,
            api_key="not-needed",
            model="qwen2.5-3b-instruct",
            user_prompt=user_prompt,
            timeout_sec=4.0
        )
        if plan:
            return plan, "LM_STUDIO (Qwen2.5-3B)"

        # 2. Try Groq Free API if key provided
        if self.groq_api_key:
            plan, err = self._call_openai_compatible(
                url=self.groq_url,
                api_key=self.groq_api_key,
                model="llama-3.3-70b-versatile",
                user_prompt=user_prompt,
                timeout_sec=5.0
            )
            if plan:
                return plan, "GROQ (Llama-3.3-70B)"

        # 3. Deterministic SRE Rule-Based Fallback Matrix
        fallback_plan = FaultToActionMatrix.resolve_action(
            fault_class=fault_class,
            target_service=predicted_service,
            telemetry=telemetry_summary
        )
        return fallback_plan, "DETERMINISTIC_FALLBACK_MATRIX"

    def _call_openai_compatible(self, url: str, api_key: str, model: str, user_prompt: str, timeout_sec: float):
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": 0.1,
            "max_tokens": 350,
            "response_format": {"type": "json_object"}
        }

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }

        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers=headers,
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                raw_text = data["choices"][0]["message"]["content"].strip()
                # Parse and validate with Pydantic
                clean_json = json.loads(raw_text)
                plan = RemediationPlan(**clean_json)
                return plan, None
        except Exception as e:
            return None, str(e)
