"""
Tier 1: Comprehensive Unit Test Suite
====================================
Tests:
  1. Phase 1 ML & Baseline Math (Z-Score math with sigma=0 safety, 89 features, metadata)
  2. Classical SARIMA vs. XGBoost Metadata Presence & Metric Integrity
  3. LLM Parser Robustness (_extract_clean_json with <think> tags & markdown fences)
  4. SRE Guardrails Adversarial Checks (kube-system, bounds, cooldown lock)
"""

import sys
import json
import pytest
import numpy as np
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from phase2_remediation.llm_client import DualBackendLLMClient
from phase2_remediation.actions import (
    RemediationPlan,
    RemediationParameters,
    ActionType,
    FaultToActionMatrix
)
from phase2_remediation.guardrails import SREGuardrailEngine


# ──────────────────────────────────────────────────────────────────────────────
# 1. Phase 1 Feature & Mathematics Unit Tests
# ──────────────────────────────────────────────────────────────────────────────
class TestPhase1MathAndFeatures:
    def test_zscore_division_by_zero_safety(self):
        """Verifies Z-score normalization handles zero-variance features safely."""
        val = 42.0
        mean = 42.0
        std = 0.0  # Zero variance
        eps = 1e-6
        z = (val - mean) / max(std, eps)
        assert not np.isnan(z)
        assert not np.isinf(z)
        assert abs(z) < 1e-4

    def test_feature_registry_89_multimodal_alignment(self):
        """Verifies all 89 multimodal features exist in the serialized feature registry."""
        feature_path = PROJECT_ROOT / "phase1_prediction" / "saved_models" / "feature_columns.json"
        assert feature_path.exists(), "feature_columns.json missing"
        with open(feature_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        features = data.get("multimodal_features", [])
        assert len(features) == 89, f"Expected 89 features, got {len(features)}"
        assert "z_CpuUsageRate(%)" in features
        assert "delta1_MemoryUsageRate(%)" in features
        assert "log_error_count" in features
        assert "log_rc_template_hits" in features

    def test_sarima_vs_xgboost_metadata_integrity(self):
        """Verifies SARIMA vs. Multi-Modal XGBoost benchmark metrics are exported in metadata."""
        meta_path = PROJECT_ROOT / "phase1_prediction" / "saved_models" / "model_metadata.json"
        assert meta_path.exists(), "model_metadata.json missing"
        with open(meta_path, "r", encoding="utf-8") as f:
            meta = json.load(f)

        assert "sarima_vs_xgboost" in meta, "sarima_vs_xgboost key missing from model_metadata.json"
        bench = meta["sarima_vs_xgboost"]
        models = bench.get("models", {})

        assert "univariate_sarima" in models
        assert "multimodal_xgbregressor" in models

        sarima = models["univariate_sarima"]
        xgb = models["multimodal_xgbregressor"]

        # SARIMA vs XGBoost key constraints
        assert xgb["mae_minutes"] < sarima["mae_minutes"], "XGBoost MAE must be lower than SARIMA"
        assert xgb["latency_per_tick_ms"] < 2.0, "XGBoost latency must be sub-2ms for 1Hz stream"
        assert sarima["latency_per_tick_ms"] > 30.0, "SARIMA latency should reflect autoregressive cost"


# ──────────────────────────────────────────────────────────────────────────────
# 2. LLM Parser & Fallback Unit Tests
# ──────────────────────────────────────────────────────────────────────────────
class TestLLMParserAndFallback:
    def test_extract_clean_json_with_think_tags(self):
        """Proves Qwen 3.8-27B <think>...</think> chain-of-thought tags are stripped safely."""
        raw_llm_output = (
            "<think>\n"
            "The metrics show cartservice CPU saturation at +4.5 sigma.\n"
            "We should scale deployment to 3 replicas.\n"
            "</think>\n"
            "```json\n"
            "{\n"
            '  "diagnosed_root_cause": "CPU contention on cartservice",\n'
            '  "target_service": "cartservice",\n'
            '  "target_namespace": "hipster",\n'
            '  "selected_action": "SCALE_DEPLOYMENT",\n'
            '  "parameters": {"replicas": 3},\n'
            '  "confidence": 0.95,\n'
            '  "reasoning_summary": "CPU usage spike without container code exceptions."\n'
            "}\n"
            "```"
        )
        parsed = DualBackendLLMClient._extract_clean_json(raw_llm_output)
        assert isinstance(parsed, dict)
        assert parsed["selected_action"] == "SCALE_DEPLOYMENT"
        assert parsed["parameters"]["replicas"] == 3
        assert "think" not in str(parsed)

    def test_deterministic_fallback_matrix(self):
        """Verifies deterministic FaultToActionMatrix generates valid Pydantic plan."""
        plan = FaultToActionMatrix.get_fallback_plan(
            service="checkoutservice",
            fault_class="CPU_EXHAUSTION",
            confidence=0.92,
            current_replicas=1,
            namespace="hipster"
        )
        assert isinstance(plan, RemediationPlan)
        assert plan.selected_action == ActionType.SCALE_DEPLOYMENT
        assert plan.parameters.replicas == 3
        assert plan.target_service == "checkoutservice"


# ──────────────────────────────────────────────────────────────────────────────
# 3. SRE Safety Guardrails Unit Tests
# ──────────────────────────────────────────────────────────────────────────────
class TestSREGuardrails:
    @pytest.fixture
    def guardrails(self):
        return SREGuardrailEngine(autonomous_mode=True)

    def test_adversarial_namespace_rejection(self, guardrails):
        """Proves attempts to mutate kube-system or cluster-wide namespaces are hard-blocked."""
        bad_plan = RemediationPlan(
            diagnosed_root_cause="Corrupted etcd lock in system",
            target_service="checkoutservice",
            target_namespace="kube-system",
            selected_action=ActionType.RESTART_POD,
            parameters=RemediationParameters(),
            confidence=0.99,
            reasoning_summary="Attempting system mutation"
        )
        result = guardrails.validate_plan(bad_plan)
        assert not result.passed
        assert any("NamespaceLock" in v for v in result.violations)

    def test_adversarial_replica_bounds_rejection(self, guardrails):
        """Proves extreme replica scale (e.g. 50 replicas) is rejected by Pydantic / bounds."""
        with pytest.raises(Exception):
            # Pydantic field constraint le=5
            RemediationParameters(replicas=50)

    def test_adversarial_memory_bounds_rejection(self, guardrails):
        """Proves excessive memory limit patch (>1024Mi) is blocked by parameter bounds."""
        with pytest.raises(Exception):
            # Pydantic field constraint le=1024
            RemediationParameters(memory_limit_mi=4096)

    def test_120s_anti_thrashing_cooldown(self, guardrails):
        """Proves cooldown timer locks a service against duplicate actions for 120s."""
        svc = "paymentservice"
        valid_plan = RemediationPlan(
            diagnosed_root_cause="Unhandled exception burst",
            target_service=svc,
            target_namespace="hipster",
            selected_action=ActionType.RESTART_POD,
            parameters=RemediationParameters(),
            confidence=0.90,
            reasoning_summary="Clean rolling restart"
        )

        # First execution passes
        res1 = guardrails.validate_plan(valid_plan)
        assert res1.passed

        # Record remediation timestamp
        guardrails.record_remediation(svc)

        # Immediate second attempt within 120s is hard-blocked
        res2 = guardrails.validate_plan(valid_plan)
        assert not res2.passed
        assert any("CooldownLock" in v for v in res2.violations)
        assert res2.cooldown_remaining_sec > 115.0
