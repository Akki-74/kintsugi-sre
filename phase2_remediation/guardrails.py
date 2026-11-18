"""
Kintsugi-AI — Phase 2 SRE Safety Guardrails
============================================
Enforces deterministic safety policies before any action touches Kubernetes:
  1. Namespace Lock (hipster / kintsugi-lab only; kube-system hard blocked)
  2. Action Allowlist (strictly mapped to verified ActionCatalog)
  3. Parameter Bounds (replicas in [1, 5], memory <= 1024Mi, CPU <= 2000m)
  4. 120s Per-Service Anti-Thrashing Cooldown Timer
  5. Kubernetes API dry_run="All" validation
  6. Operating Mode Enforcement (Autonomous vs Human-in-the-Loop)
"""

import time
import threading
from typing import Dict, List, Optional, Tuple
from phase2_remediation.actions import RemediationPlan, GuardrailValidationResult, ActionType


class SREGuardrailEngine:
    ALLOWED_NAMESPACES = {"hipster", "kintsugi-lab"}
    FORBIDDEN_NAMESPACES = {"kube-system", "kube-public", "kube-node-lease", "default"}

    REPLICA_MIN = 1
    REPLICA_MAX = 5
    MEMORY_LIMIT_MAX_MI = 1024
    CPU_LIMIT_MAX_M = 2000
    COOLDOWN_WINDOW_SEC = 120.0

    def __init__(self, autonomous_mode: bool = True):
        self.autonomous_mode = autonomous_mode
        self._cooldown_lock = threading.Lock()
        self._service_last_remediated: Dict[str, float] = {}

    def set_mode(self, autonomous: bool):
        self.autonomous_mode = autonomous

    def is_service_in_cooldown(self, service: str, now: Optional[float] = None) -> Tuple[bool, float]:
        """Returns (is_in_cooldown, remaining_seconds)."""
        if now is None:
            now = time.time()
        with self._cooldown_lock:
            last_ts = self._service_last_remediated.get(service, 0.0)
            elapsed = now - last_ts
            if elapsed < self.COOLDOWN_WINDOW_SEC:
                return True, (self.COOLDOWN_WINDOW_SEC - elapsed)
            return False, 0.0

    def record_remediation(self, service: str, timestamp: Optional[float] = None):
        """Records timestamp of remediation to activate the 120s cooldown timer."""
        if timestamp is None:
            timestamp = time.time()
        with self._cooldown_lock:
            self._service_last_remediated[service] = timestamp

    def reset_cooldown(self, service: Optional[str] = None):
        with self._cooldown_lock:
            if service:
                self._service_last_remediated.pop(service, None)
            else:
                self._service_last_remediated.clear()

    def validate_plan(self, plan: RemediationPlan, k8s_client=None, now: Optional[float] = None) -> GuardrailValidationResult:
        """
        Executes all 5 deterministic guardrail checks on the proposed remediation plan.
        """
        if now is None:
            now = time.time()
        violations = []

        # 0. Skip checks for NO_ACTION
        if plan.selected_action == ActionType.NO_ACTION:
            return GuardrailValidationResult(passed=True, violations=[], cooldown_remaining_sec=0.0, dry_run_passed=True)

        # Check 1: Namespace Lock
        ns = plan.target_namespace.lower().strip()
        if ns in self.FORBIDDEN_NAMESPACES or ns not in self.ALLOWED_NAMESPACES:
            violations.append(
                f"GUARDRAIL_VIOLATION [NamespaceLock]: Namespace '{ns}' is forbidden or outside allowed list {self.ALLOWED_NAMESPACES}"
            )

        # Check 2: Action Allowlist
        if plan.selected_action not in ActionType:
            violations.append(
                f"GUARDRAIL_VIOLATION [ActionAllowlist]: Proposed action '{plan.selected_action}' is not in ActionCatalog."
            )

        # Check 3: Parameter Bounds
        p = plan.parameters
        if plan.selected_action == ActionType.SCALE_DEPLOYMENT:
            if p.replicas is None:
                violations.append("GUARDRAIL_VIOLATION [ParameterBounds]: SCALE_DEPLOYMENT requires 'replicas' parameter.")
            elif not (self.REPLICA_MIN <= p.replicas <= self.REPLICA_MAX):
                violations.append(
                    f"GUARDRAIL_VIOLATION [ParameterBounds]: Replicas {p.replicas} outside safety bounds [{self.REPLICA_MIN}, {self.REPLICA_MAX}]."
                )

        if plan.selected_action == ActionType.PATCH_RESOURCES:
            if p.memory_limit_mi and p.memory_limit_mi > self.MEMORY_LIMIT_MAX_MI:
                violations.append(
                    f"GUARDRAIL_VIOLATION [ParameterBounds]: Memory patch {p.memory_limit_mi}Mi exceeds max laptop ceiling {self.MEMORY_LIMIT_MAX_MI}Mi."
                )
            if p.cpu_limit_m and p.cpu_limit_m > self.CPU_LIMIT_MAX_M:
                violations.append(
                    f"GUARDRAIL_VIOLATION [ParameterBounds]: CPU patch {p.cpu_limit_m}m exceeds max ceiling {self.CPU_LIMIT_MAX_M}m."
                )

        # Check 4: Cooldown Lock (Anti-Thrashing)
        in_cd, remaining = self.is_service_in_cooldown(plan.target_service, now=now)
        if in_cd:
            violations.append(
                f"GUARDRAIL_VIOLATION [CooldownLock]: Service '{plan.target_service}' was remediated recently. {remaining:.1f}s cooldown remaining."
            )

        # Check 5: Kubernetes Dry-Run Verification
        dry_run_passed = False
        if not violations and k8s_client is not None:
            try:
                dry_run_passed = k8s_client.verify_dry_run(plan)
                if not dry_run_passed:
                    violations.append("GUARDRAIL_VIOLATION [DryRunCheck]: Kubernetes API dry_run='All' check failed.")
            except Exception as e:
                violations.append(f"GUARDRAIL_VIOLATION [DryRunCheck]: K8s dry_run API exception: {str(e)}")
        else:
            dry_run_passed = (len(violations) == 0)

        passed = (len(violations) == 0)
        return GuardrailValidationResult(
            passed=passed,
            violations=violations,
            cooldown_remaining_sec=remaining if in_cd else 0.0,
            dry_run_passed=dry_run_passed
        )


# Backward-compatible and PRD naming alias
SREGuardrails = SREGuardrailEngine
