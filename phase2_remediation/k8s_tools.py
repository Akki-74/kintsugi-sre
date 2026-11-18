"""
Kintsugi-AI — Phase 2 Kubernetes Tools & Adapters
===================================================
Wraps official Python kubernetes client operations with an automatic fallback
to a high-fidelity in-memory Digital Twin sandbox.
"""

from typing import Dict, Any, List, Optional
from phase2_remediation.k8s_adapter import (
    KubernetesClusterAdapter,
    DigitalTwinSandbox,
    MicroserviceTwinState
)
from phase2_remediation.actions import (
    RemediationPlan,
    RemediationExecutionResult,
    ActionType
)

__all__ = [
    "KubernetesClusterAdapter",
    "DigitalTwinSandbox",
    "MicroserviceTwinState",
    "get_k8s_adapter"
]

_GLOBAL_ADAPTER: Optional[KubernetesClusterAdapter] = None


def get_k8s_adapter() -> KubernetesClusterAdapter:
    """Returns singleton Kubernetes cluster adapter."""
    global _GLOBAL_ADAPTER
    if _GLOBAL_ADAPTER is None:
        _GLOBAL_ADAPTER = KubernetesClusterAdapter()
    return _GLOBAL_ADAPTER
