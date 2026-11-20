import os
import re
import json
import time
import logging
from typing import Dict, Any, Optional, Tuple, List

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from openai import OpenAI
from phase2_remediation.actions import RemediationPlan, FaultToActionMatrix, ActionType

logger = logging.getLogger("Kintsugi.LLMClient")

SYSTEM_PROMPT = """You are Kintsugi SRE Brain, an autonomous Kubernetes Site Reliability Engineering agent.
Your mission is to diagnose multi-modal Kubernetes telemetry anomalies and select the safest, most effective remediation action.

You MUST respond strictly with a valid JSON object matching the following schema.
Do NOT output Markdown code blocks or text outside the JSON object.

Allowed Actions:
- "SCALE_DEPLOYMENT": for CPU contention/saturation or elevated workload traffic. Parameters: {"replicas": int [1, 5]}.
- "PATCH_RESOURCES": for gradual memory leaks or resource exhaustion. Parameters: {"memory_limit_mi": int [64, 1024]}.
- "RESTART_POD": for application exceptions, HTTP 500 bursts, or transient code errors.
- "CORDON_AND_RELOCATE": for node disk pressure or node degradation. Parameters: {"target_node": "desktop-worker"}.
- "APPLY_TRAFFIC_SHAPING": for network latency or downstream timeout cascade. Parameters: {"timeout_ms": int [100, 5000]}.
- "NO_ACTION": if metrics are healthy and within baseline bounds.

JSON Schema:
{
  "diagnosed_root_cause": "Detailed technical root cause referencing the exact metrics and logs",
  "target_service": "string",
  "target_namespace": "hipster",
  "selected_action": "SCALE_DEPLOYMENT" | "PATCH_RESOURCES" | "RESTART_POD" | "CORDON_AND_RELOCATE" | "APPLY_TRAFFIC_SHAPING" | "NO_ACTION",
  "parameters": {"replicas": 3, "memory_limit_mi": null, "cpu_limit_m": null, "target_node": null, "timeout_ms": null},
  "confidence": 0.95,
  "reasoning_summary": "Concise SRE justification for why this specific action fixes the root cause"
}
"""


class DualBackendLLMClient:
    """Dual-backend LLM client (Groq Qwen3.8-27B + Local LM Studio) with deterministic safety net."""

    def __init__(self,
                 preferred_backend: Optional[str] = None,
                 groq_api_key: Optional[str] = None,
                 groq_model: Optional[str] = None,
                 local_url: Optional[str] = None,
                 local_model: Optional[str] = None):
        load_dotenv(override=True)
        backend_env = os.environ.get("LLM_PROVIDER", "groq")
        self.preferred_backend = (preferred_backend or backend_env).lower().strip()

        self.groq_api_key = groq_api_key or os.environ.get("GROQ_API_KEY", "")
        self.groq_model = groq_model or os.environ.get("GROQ_MODEL", "qwen/qwen3.8-27b")
        self.groq_base_url = "https://api.groq.com/openai/v1"

        raw_local = local_url or os.environ.get("LM_STUDIO_BASE_URL", "http://localhost:1234/v1")
        self.local_base_url = raw_local.replace("/chat/completions", "").rstrip("/")
        self.local_model = local_model or os.environ.get("LM_STUDIO_MODEL", "qwen2.5-3b-instruct")

        self.last_backend_used: Optional[str] = None
        self.last_error: Optional[str] = None
        self._groq_client: Optional[OpenAI] = None
        self._local_client: Optional[OpenAI] = None
        self._plan_cache: Dict[str, Tuple[float, RemediationPlan]] = {}

    @staticmethod
    def _extract_clean_json(raw_text: str) -> dict:
        """Strips <think>...</think> tags and markdown fences from Qwen/LLM output and parses JSON."""
        cleaned = re.sub(r"<think>.*?</think>", "", raw_text, flags=re.DOTALL).strip()
        cleaned = re.sub(r"^`(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*`$", "", cleaned).strip()
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1 and end > start:
            cleaned = cleaned[start : end + 1]
        return json.loads(cleaned)

    def _call_openai_compatible(self, base_url: str, api_key: str, model: str, user_prompt: str) -> RemediationPlan:
        # Persistent client reuse to eliminate connection & TLS handshake overhead
        if "groq.com" in base_url:
            if not self._groq_client:
                self._groq_client = OpenAI(base_url=base_url, api_key=api_key, timeout=7.0)
            client = self._groq_client
        else:
            if not self._local_client:
                self._local_client = OpenAI(base_url=base_url, api_key=api_key, timeout=4.0)
            client = self._local_client

        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.1,
            max_tokens=1024,
        )
        content = response.choices[0].message.content or ""
        parsed_dict = self._extract_clean_json(content)

        # Normalize action aliases if needed
        act = parsed_dict.get("selected_action", "")
        if act == "NO_OP":
            parsed_dict["selected_action"] = "NO_ACTION"

        return RemediationPlan(**parsed_dict)

    def generate_remediation_plan(self,
                                   service: str,
                                   fault_class: str,
                                   confidence: float,
                                   metrics_summary: Dict[str, Any],
                                   recent_logs: Optional[List[str]] = None,
                                   current_replicas: int = 1,
                                   namespace: str = "hipster") -> Tuple[RemediationPlan, str]:
        # Deduplication cache: if the exact same service & fault was planned within 15s, re-use it!
        cache_key = f"{service}:{fault_class}"
        now = time.time()
        if cache_key in self._plan_cache:
            ts, cached_plan = self._plan_cache[cache_key]
            if now - ts < 15.0:
                logger.info(f"Re-using cached plan for {cache_key} (age: {now - ts:.1f}s)")
                return cached_plan, self.last_backend_used or f"GROQ_CLOUD ({self.groq_model})"

        user_prompt = json.dumps({
            "target_service": service,
            "target_namespace": namespace,
            "phase1_predicted_fault": fault_class,
            "phase1_confidence": round(float(confidence), 4),
            "current_replicas": current_replicas,
            "telemetry_metrics": metrics_summary,
            "recent_pod_logs": (recent_logs or [])[-10:],
        }, indent=2)

        # Do not hang on localhost LM Studio if Groq was preferred
        backends = ["groq"] if self.preferred_backend != "lm_studio" else ["lm_studio", "groq"]
        errors = []

        for b in backends:
            try:
                if b == "groq":
                    if not self.groq_api_key or "PASTE" in self.groq_api_key:
                        raise ValueError("GROQ_API_KEY not configured")
                    plan = self._call_openai_compatible(
                        base_url=self.groq_base_url,
                        api_key=self.groq_api_key,
                        model=self.groq_model,
                        user_prompt=user_prompt,
                    )
                    self.last_backend_used = f"GROQ_CLOUD ({self.groq_model})"
                    self.last_error = None
                    self._plan_cache[cache_key] = (now, plan)
                    return plan, self.last_backend_used
                elif b == "lm_studio":
                    plan = self._call_openai_compatible(
                        base_url=self.local_base_url,
                        api_key="lm-studio",
                        model=self.local_model,
                        user_prompt=user_prompt,
                    )
                    self.last_backend_used = f"LM_STUDIO_LOCAL ({self.local_model})"
                    self.last_error = None
                    self._plan_cache[cache_key] = (now, plan)
                    return plan, self.last_backend_used
            except Exception as e:
                errors.append(f"{b}: {str(e)}")

        self.last_error = " | ".join(errors)
        logger.warning(f"LLM backends failed ({self.last_error}) -> using deterministic SRE matrix.")
        fallback_plan = FaultToActionMatrix.get_fallback_plan(
            service=service,
            fault_class=fault_class,
            confidence=confidence,
            current_replicas=current_replicas,
            namespace=namespace,
        )
        self.last_backend_used = "DETERMINISTIC_FALLBACK_MATRIX"
        self._plan_cache[cache_key] = (now, fallback_plan)
        return fallback_plan, self.last_backend_used

    def plan_remediation(self,
                          fault_class: str,
                          predicted_service: str,
                          confidence: float,
                          telemetry_summary: Dict[str, Any],
                          recent_logs: Optional[List[str]] = None,
                          current_replicas: int = 1,
                          namespace: str = "hipster") -> Tuple[RemediationPlan, str]:
        """LangGraph agent compatibility wrapper."""
        return self.generate_remediation_plan(
            service=predicted_service,
            fault_class=fault_class,
            confidence=confidence,
            metrics_summary=telemetry_summary,
            recent_logs=recent_logs,
            current_replicas=current_replicas,
            namespace=namespace
        )

    def get_status(self) -> Dict[str, Any]:
        """Returns status of current LLM configuration for health checks."""
        return {
            "preferred_backend": self.preferred_backend,
            "groq_configured": bool(self.groq_api_key and "PASTE" not in self.groq_api_key),
            "groq_model": self.groq_model,
            "local_url": self.local_base_url,
            "local_model": self.local_model,
            "last_backend_used": self.last_backend_used,
            "last_error": self.last_error,
        }


# Backward-compatible alias
LLMRemediationClient = DualBackendLLMClient
