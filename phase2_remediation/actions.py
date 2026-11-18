"""
KubePulse AI — Phase 2 Action Catalog & Data Schemas
====================================================
Defines strict Pydantic schemas, action enums, and the deterministic SRE fallback matrix.
"""

from enum import Enum
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field, field_validator


class ActionType(str, Enum):
    SCALE_DEPLOYMENT = "SCALE_DEPLOYMENT"
    PATCH_RESOURCES = "PATCH_RESOURCES"
    RESTART_POD = "RESTART_POD"
    CORDON_AND_RELOCATE = "CORDON_AND_RELOCATE"
    APPLY_TRAFFIC_SHAPING = "APPLY_TRAFFIC_SHAPING"
    NO_ACTION = "NO_ACTION"
    NO_OP = "NO_OP"


class RemediationParameters(BaseModel):
    replicas: Optional[int] = Field(None, ge=1, le=5, description="Target replica count (bounded [1, 5])")
    memory_limit_mi: Optional[int] = Field(None, ge=64, le=1024, description="Memory limit in MiB (capped at 1024Mi)")
    cpu_limit_m: Optional[int] = Field(None, ge=100, le=2000, description="CPU limit in millicores (capped at 2000m)")
    target_node: Optional[str] = Field(None, description="Worker node to cordon for node-level failures")
    timeout_ms: Optional[int] = Field(None, ge=100, le=5000, description="Client timeout in ms for traffic shaping")


class RemediationPlan(BaseModel):
    """Structured Pydantic schema enforced on LLM output."""
    diagnosed_root_cause: str = Field(..., description="Brief technical root-cause diagnosis")
    target_service: str = Field(..., description="Target microservice (e.g. 'checkoutservice')")
    target_namespace: str = Field("hipster", description="K8s namespace (must be 'hipster' or 'kubepulse-lab')")
    selected_action: ActionType = Field(..., description="Action from strictly allowed catalog")
    parameters: RemediationParameters = Field(default_factory=RemediationParameters)
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score [0.0 - 1.0]")
    reasoning_summary: str = Field(..., description="SRE reasoning citing metrics, slopes, and log signals")

    @field_validator("target_service")
    def validate_service(cls, v):
        valid = [
            "frontend", "checkoutservice", "cartservice", "paymentservice",
            "productcatalogservice", "currencyservice", "shippingservice",
            "recommendationservice", "adservice", "emailservice"
        ]
        v_clean = v.lower().strip()
        if v_clean not in valid:
            raise ValueError(f"Service '{v}' not recognized among OnlineBoutique services: {valid}")
        return v_clean


class GuardrailValidationResult(BaseModel):
    passed: bool
    violations: list[str] = Field(default_factory=list)
    cooldown_remaining_sec: float = 0.0
    dry_run_passed: bool = False


class RemediationExecutionResult(BaseModel):
    action_type: ActionType
    target_service: str
    target_namespace: str
    executed_at: float
    status: str  # SUCCESS, REJECTED_BY_GUARDRAIL, AWAITING_APPROVAL, FAILED
    details: Dict[str, Any] = Field(default_factory=dict)
    message: str = ""


# ──────────────────────────────────────────────────────────────────────────────
# DETERMINISTIC SRE RULE-BASED FALLBACK MATRIX
# ──────────────────────────────────────────────────────────────────────────────
class FaultToActionMatrix:
    """
    Deterministic rule-based fallback matrix executing safe, verified remediation
    when the LLM is offline, times out, or fails schema validation.
    """
    @staticmethod
    def resolve_action(fault_class: str, target_service: str, telemetry: Dict[str, Any]) -> RemediationPlan:
        ns = "hipster"
        
        if fault_class == "CPU_EXHAUSTION":
            # Scale deployment to distribute load across replicas
            return RemediationPlan(
                diagnosed_root_cause=f"High CPU saturation on {target_service} detected by Phase 1 Fast Brain",
                target_service=target_service,
                target_namespace=ns,
                selected_action=ActionType.SCALE_DEPLOYMENT,
                parameters=RemediationParameters(replicas=3),
                confidence=0.92,
                reasoning_summary="Rule Fallback: Scaling replicas to 3 to distribute saturated CPU load."
            )
            
        elif fault_class == "MEMORY_EXHAUSTION":
            # Proactively patch memory limit before container hits OOMKilled
            return RemediationPlan(
                diagnosed_root_cause=f"Monotonic memory climb / leak detected on {target_service}",
                target_service=target_service,
                target_namespace=ns,
                selected_action=ActionType.PATCH_RESOURCES,
                parameters=RemediationParameters(memory_limit_mi=512),
                confidence=0.94,
                reasoning_summary="Rule Fallback: Raising container memory limit to 512Mi to prevent OOM crash."
            )

        elif fault_class == "DISK_EXHAUSTION":
            # Cordon degraded node and relocate pod to healthy node
            return RemediationPlan(
                diagnosed_root_cause=f"Disk saturation / Syscall write pressure impacting {target_service}",
                target_service=target_service,
                target_namespace=ns,
                selected_action=ActionType.CORDON_AND_RELOCATE,
                parameters=RemediationParameters(target_node="kind-worker"),
                confidence=0.88,
                reasoning_summary="Rule Fallback: Cordoning saturated worker node and evicting pod to healthy node."
            )

        elif fault_class == "NETWORK_DEGRADATION":
            # Apply traffic shaping (circuit breaker timeout reduction)
            return RemediationPlan(
                diagnosed_root_cause=f"Upstream inter-service RPC latency degradation on {target_service}",
                target_service=target_service,
                target_namespace=ns,
                selected_action=ActionType.APPLY_TRAFFIC_SHAPING,
                parameters=RemediationParameters(timeout_ms=1000),
                confidence=0.85,
                reasoning_summary="Rule Fallback: Adjusting client call timeout to 1000ms to break cascade latency."
            )

        elif fault_class == "SERVICE_DISRUPTION_LOG":
            # Rolling restart pod to clear corrupted application state or leaked sockets
            return RemediationPlan(
                diagnosed_root_cause=f"Application exception / unhandled error logs in {target_service}",
                target_service=target_service,
                target_namespace=ns,
                selected_action=ActionType.RESTART_POD,
                parameters=RemediationParameters(),
                confidence=0.89,
                reasoning_summary="Rule Fallback: Initiating zero-downtime rolling restart to clear corrupted memory/sockets."
            )

        else:
            return RemediationPlan(
                diagnosed_root_cause=f"Cluster state normal on {target_service}",
                target_service=target_service,
                target_namespace=ns,
                selected_action=ActionType.NO_ACTION,
                parameters=RemediationParameters(),
                confidence=0.99,
                reasoning_summary="Rule Fallback: Cluster metrics within healthy baseline bounds. No action taken."
            )
