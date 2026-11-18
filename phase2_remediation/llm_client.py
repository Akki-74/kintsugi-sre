"""
Kintsugi-AI — Phase 2 Dual-Backend Structured LLM Client & Fallback Engine
============================================================================
Provides structured reasoning selecting strictly from the ActionCatalog.
Supports three execution backends (tried in order based on preferred_backend):
  1. Free Cloud Groq API (Llama-3.3-70B-Versatile) — $0.00, 0 RAM
  2. Local LM Studio / Ollama (Qwen2.5-3B-Instruct on RTX 500 Ada 4GB VRAM)
  3. Deterministic SRE Rule-Based Fallback Matrix (100% offline / failure-proof)

The LLM is constrained via Pydantic JSON Schema (RemediationPlan) so it can
NEVER output arbitrary kubectl/bash commands — only validated action enums.
"""

import os
import json
import logging
from typing import Dict, Any, Optional, Tuple

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

import urllib.request
import urllib.error
from phase2_remediation.actions import RemediationPlan, FaultToActionMatrix, ActionType

logger = logging.getLogger("Kintsugi.LLMClient")


SYSTEM_PROMPT = """You are Kintsugi-AI SRE Brain, an autonomous Kubernetes Site Reliability Engineering agent.
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


class DualBackendLLMClient:
    """Dual-backend LLM client with automatic failover and deterministic safety net."""

    def __init__(self,
                 preferred_backend: Optional[str] = None,
                 groq_api_key: Optional[str] = None,
                 groq_model: Optional[str] = None,
                 local_url: Optional[str] = None,
                 local_model: Optional[str] = None):
        backend_env = os.environ.get("LLM_PROVIDER", "groq")
        self.preferred_backend = (preferred_backend or backend_env).lower().strip()

        # Groq Cloud Config
        self.groq_api_key = groq_api_key or os.environ.get("GROQ_API_KEY", "")
        self.groq_model = groq_model or os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
        self.groq_url = "https://api.groq.com/openai/v1/chat/completions"

        # LM Studio / Ollama Local Config
        self.local_url = local_url or os.environ.get(
            "LM_STUDIO_BASE_URL",
            os.environ.get("LM_STUDIO_URL", "http://localhost:1234/v1")
        ).rstrip("/")
        if not self.local_url.endswith("/chat/completions"):
            self.local_url = f"{self.local_url}/chat/completions"
        self.local_model = local_model or os.environ.get("LM_STUDIO_MODEL", "qwen2.5-3b-instruct")

        # Track last successful backend for status reporting
        self.last_backend_used = None
        self.last_error = None

    def generate_remediation_plan(self,
                                   service: str,
                                   fault_class: str,
                                   confidence: float,
                                   metrics_summary: Dict[str, Any],
                                   recent_logs: list[str],
                                   current_replicas: int = 1) -> Tuple[RemediationPlan, str]:
        """Public API matching the user's Step 2.2 test interface."""
        return self.plan_remediation(
            fault_class=fault_class,
            predicted_service=service,
            confidence=confidence,
            telemetry_summary={**metrics_summary, "current_replicas": current_replicas},
            recent_logs=recent_logs
        )

    def plan_remediation(self,
                          fault_class: str,
                          predicted_service: str,
                          confidence: float,
                          telemetry_summary: Dict[str, Any],
                          recent_logs: list[str]) -> Tuple[RemediationPlan, str]:
        """
        Attempts structured reasoning in priority order based on preferred_backend:
          - If preferred_backend is 'groq': Groq -> LM Studio -> Fallback
          - If preferred_backend is 'lm_studio': LM Studio -> Groq -> Fallback
          - Else: Groq -> LM Studio -> Fallback
        Returns (RemediationPlan, source_used)
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

        # Determine backend order
        if self.preferred_backend in ("lm_studio", "lmstudio", "local", "ollama"):
            backend_order = [
                ("LM_STUDIO", self._try_local, {}),
                ("GROQ", self._try_groq, {}),
            ]
        else:
            backend_order = [
                ("GROQ", self._try_groq, {}),
                ("LM_STUDIO", self._try_local, {}),
            ]

        # Try each backend in order
        for backend_name, try_fn, kwargs in backend_order:
            plan, err = try_fn(user_prompt)
            if plan:
                self.last_backend_used = backend_name
                self.last_error = None
                label = (
                    f"GROQ ({self.groq_model})" if backend_name == "GROQ"
                    else f"LM_STUDIO ({self.local_model})"
                )
                logger.info(f"LLM plan generated via {label}")
                return plan, label
            else:
                self.last_error = err
                logger.info(f"{backend_name} failed: {err}")

        # 3. Deterministic SRE Rule-Based Fallback Matrix (never fails)
        logger.info("All LLM backends failed. Using deterministic SRE fallback matrix.")
        self.last_backend_used = "FALLBACK_MATRIX"
        fallback_plan = FaultToActionMatrix.resolve_action(
            fault_class=fault_class,
            target_service=predicted_service,
            telemetry=telemetry_summary
        )
        return fallback_plan, "DETERMINISTIC_FALLBACK_MATRIX"

    def _try_groq(self, user_prompt: str) -> Tuple[Optional[RemediationPlan], Optional[str]]:
        """Attempt Groq Cloud API."""
        if not self.groq_api_key or "PASTE" in self.groq_api_key or len(self.groq_api_key.strip()) < 10:
            return None, "GROQ_API_KEY not configured in .env"
        return self._call_openai_compatible(
            url=self.groq_url,
            api_key=self.groq_api_key,
            model=self.groq_model,
            user_prompt=user_prompt,
            timeout_sec=8.0
        )

    def _try_local(self, user_prompt: str) -> Tuple[Optional[RemediationPlan], Optional[str]]:
        """Attempt local LM Studio / Ollama."""
        return self._call_openai_compatible(
            url=self.local_url,
            api_key="not-needed",
            model=self.local_model,
            user_prompt=user_prompt,
            timeout_sec=6.0
        )

    def _call_openai_compatible(self, url: str, api_key: str, model: str,
                                 user_prompt: str, timeout_sec: float):
        """Calls any OpenAI-compatible chat/completions endpoint."""
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": 0.1,
            "max_tokens": 400,
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

                # Strip markdown code fences if LLM wraps response
                if raw_text.startswith("```"):
                    lines = raw_text.split("\n")
                    # Remove first and last fence lines
                    lines = [l for l in lines if not l.strip().startswith("```")]
                    raw_text = "\n".join(lines).strip()

                # Parse and validate with Pydantic
                clean_json = json.loads(raw_text)
                plan = RemediationPlan(**clean_json)
                return plan, None
        except json.JSONDecodeError as e:
            return None, f"JSON parse error: {e}"
        except Exception as e:
            return None, str(e)

    def get_status(self) -> Dict[str, Any]:
        """Returns current LLM client configuration status."""
        return {
            "preferred_backend": self.preferred_backend,
            "groq_configured": bool(self.groq_api_key),
            "groq_model": self.groq_model,
            "local_url": self.local_url,
            "local_model": self.local_model,
            "last_backend_used": self.last_backend_used,
            "last_error": self.last_error,
        }


# Backward-compatible alias
LLMRemediationClient = DualBackendLLMClient
