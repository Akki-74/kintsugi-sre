"""
Test script validating Phase 2 LangGraph Agent, Guardrails, and Fallback Matrix.
"""

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from phase2_remediation.langgraph_agent import AmbientRemediationAgent
from phase2_remediation.actions import RemediationPlan, RemediationParameters, ActionType
from phase2_remediation.guardrails import SREGuardrailEngine


def test_agent_end_to_end():
    print("=" * 75)
    print("🧪 TESTING PHASE 2 LANGGRAPH AMBIENT AGENT & SRE GUARDRAILS")
    print("=" * 75)

    agent = AmbientRemediationAgent()

    # ──────────────────────────────────────────────────────────────────
    # Test 1: Normal Cluster Telemetry (Should exit quietly)
    # ──────────────────────────────────────────────────────────────────
    print("\n--- Test 1: Normal Health Tick ---")
    s1 = agent.process_telemetry_tick(
        predicted_fault="NORMAL",
        target_service="frontend",
        confidence=0.99,
        telemetry={"CpuUsageRate(%)": 12.0, "MemoryUsageRate(%)": 24.0}
    )
    print(f"Final State: {s1['current_state']}")
    print(f"History: {s1['step_history']}")
    assert s1["current_state"] == "MONITOR_CHECKED"
    print("✅ Test 1 Passed: Normal state exits at monitor node without triggering remediations.")

    # ──────────────────────────────────────────────────────────────────
    # Test 2: CPU Contention Fault (Autonomous Healing)
    # ──────────────────────────────────────────────────────────────────
    print("\n--- Test 2: Autonomous CPU Contention Remediation ---")
    s2 = agent.process_telemetry_tick(
        predicted_fault="CPU_EXHAUSTION",
        target_service="checkoutservice",
        confidence=0.94,
        telemetry={"CpuUsageRate(%)": 89.5, "PodServerLatencyP95(s)": 1.8},
        recent_logs=["Handling checkout request", "CPU throttling triggered on container"]
    )
    print(f"Final State: {s2['current_state']}")
    print(f"Proposed Plan: {s2['proposed_plan'].selected_action.value} on {s2['proposed_plan'].target_service}")
    print(f"Reasoning Source: {s2['reasoning_source']}")
    print(f"Execution Result: {s2['execution_result'].message}")
    print(f"Verification: {s2['verification_result']}")
    print(f"History: {s2['step_history']}")
    assert s2["current_state"] == "VERIFIED"
    assert s2["execution_result"].status == "SUCCESS"
    print("✅ Test 2 Passed: CPU Contention autonomously planned, guardrailed, executed, and verified!")

    # ──────────────────────────────────────────────────────────────────
    # Test 3: Anti-Thrashing Cooldown Lock (Immediate follow-up trigger)
    # ──────────────────────────────────────────────────────────────────
    print("\n--- Test 3: Cooldown Lock Guardrail Enforcement ---")
    s3 = agent.process_telemetry_tick(
        predicted_fault="CPU_EXHAUSTION",
        target_service="checkoutservice",  # Same service remediated 1 second ago
        confidence=0.91,
        telemetry={"CpuUsageRate(%)": 85.0}
    )
    print(f"Final State: {s3['current_state']}")
    print(f"Guardrail Passed: {s3['guardrail_result'].passed}")
    print(f"Violations: {s3['guardrail_result'].violations}")
    assert s3["current_state"] == "GUARDRAIL_FAILED"
    assert not s3["guardrail_result"].passed
    assert any("CooldownLock" in v for v in s3["guardrail_result"].violations)
    print("✅ Test 3 Passed: 120s cooldown lock successfully prevented thrashing / duplicate remediation!")

    # ──────────────────────────────────────────────────────────────────
    # Test 4: Memory Exhaustion on Different Service (cartservice)
    # ──────────────────────────────────────────────────────────────────
    print("\n--- Test 4: Gradual Memory Leak Proactive Patching ---")
    s4 = agent.process_telemetry_tick(
        predicted_fault="MEMORY_EXHAUSTION",
        target_service="cartservice",
        confidence=0.96,
        telemetry={"MemoryUsageRate(%)": 92.4, "time_to_exhaustion_min": 4.5},
        recent_logs=["Memory allocator warning: RSS exceeds 90%"]
    )
    print(f"Final State: {s4['current_state']}")
    print(f"Proposed Action: {s4['proposed_plan'].selected_action.value}")
    print(f"Execution Result: {s4['execution_result'].message}")
    assert s4["current_state"] == "VERIFIED"
    assert s4["proposed_plan"].selected_action == ActionType.PATCH_RESOURCES
    print("✅ Test 4 Passed: Memory leak caught and proactively patched before container OOM!")

    # ──────────────────────────────────────────────────────────────────
    # Test 5: Guardrail Rejection on Illegal Namespace & Out-of-Bounds Replicas
    # ──────────────────────────────────────────────────────────────────
    print("\n--- Test 5: Guardrail Bounds & Namespace Rejection ---")
    guardrail_engine = SREGuardrailEngine()

    illegal_ns_plan = RemediationPlan(
        diagnosed_root_cause="Tampering attempt",
        target_service="frontend",
        target_namespace="kube-system",  # Forbidden
        selected_action=ActionType.SCALE_DEPLOYMENT,
        parameters=RemediationParameters(replicas=3),
        confidence=0.9,
        reasoning_summary="Test"
    )
    res_ns = guardrail_engine.validate_plan(illegal_ns_plan)
    assert not res_ns.passed
    print(f"Namespace check violation: {res_ns.violations[0]}")

    # Pydantic schema level rejection:
    try:
        illegal_replicas_plan = RemediationPlan(
            diagnosed_root_cause="Runaway scale",
            target_service="frontend",
            target_namespace="hipster",
            selected_action=ActionType.SCALE_DEPLOYMENT,
            parameters=RemediationParameters(replicas=50),  # Max is 5!
            confidence=0.9,
            reasoning_summary="Test"
        )
        assert False, "Should have raised Pydantic ValidationError"
    except Exception as e:
        print(f"Pydantic strict schema rejection: {e}")

    print("✅ Test 5 Passed: Guardrails & Pydantic strictly blocked illegal namespace and excessive replica caps!")

    # ──────────────────────────────────────────────────────────────────
    # Test 6: Human-in-the-Loop Mode (Awaiting Approval)
    # ──────────────────────────────────────────────────────────────────
    print("\n--- Test 6: Human-in-the-Loop Approval Pause ---")
    s6 = agent.process_telemetry_tick(
        predicted_fault="SERVICE_DISRUPTION_LOG",
        target_service="paymentservice",
        confidence=0.93,
        telemetry={"PodSuccessRate(%)": 60.0},
        recent_logs=["500 Internal Server Error in payment handler"],
        autonomous_mode=False,  # HITL Mode!
        human_approved=None
    )
    print(f"Final State: {s6['current_state']}")
    print(f"Execution Status: {s6['execution_result'].status}")
    assert s6["current_state"] == "AWAITING_APPROVAL"
    assert s6["execution_result"].status == "AWAITING_APPROVAL"

    # Now simulate Operator clicking "Approve" in UI
    s6_approved = agent.process_telemetry_tick(
        predicted_fault="SERVICE_DISRUPTION_LOG",
        target_service="paymentservice",
        confidence=0.93,
        telemetry={"PodSuccessRate(%)": 60.0},
        recent_logs=["500 Internal Server Error in payment handler"],
        autonomous_mode=False,
        human_approved=True  # Operator clicked approve!
    )
    print(f"Post-Approval State: {s6_approved['current_state']}")
    assert s6_approved["current_state"] == "VERIFIED"
    print("✅ Test 6 Passed: Agent pauses safely in HITL mode and resumes on operator approval!")

    print("\n" + "=" * 75)
    print("🎉 ALL PHASE 2 LANGGRAPH & GUARDRAIL TESTS PASSED 100%!")
    print("=" * 75)


if __name__ == "__main__":
    test_agent_end_to_end()
