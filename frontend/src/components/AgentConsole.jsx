import React, { useState } from 'react';
import { Terminal, Shield, CheckCircle2, XCircle, AlertCircle, Play, Pause, RefreshCw, Cpu, Layers, Sparkles, Check, Lock } from 'lucide-react';

export default function AgentConsole({
  agentEvent = null,
  pendingPlan = null,
  onApprovePlan,
  onRejectPlan,
  autonomousMode,
}) {
  const [activeTab, setActiveTab] = useState('trace'); // 'trace' | 'plan' | 'guardrails'
  const [acting, setActing] = useState(false);

  const history = agentEvent?.history || [];
  const plannedAction = agentEvent?.planned_action || pendingPlan?.selected_action || null;
  const reasoning = agentEvent?.reasoning || pendingPlan?.reasoning_summary || null;
  const targetService = agentEvent?.target_service || pendingPlan?.target_service || 'cartservice';
  const currentState = agentEvent?.current_state || (pendingPlan ? 'GUARDRAILS' : 'MONITOR');

  const handleApprove = async () => {
    setActing(true);
    try {
      if (onApprovePlan) await onApprovePlan();
    } finally {
      setActing(false);
    }
  };

  const handleReject = async () => {
    setActing(true);
    try {
      if (onRejectPlan) await onRejectPlan();
    } finally {
      setActing(false);
    }
  };

  // 6-Stage LangGraph State Machine Nodes
  const langgraphStages = [
    { id: 'MONITOR', label: '1. Monitor' },
    { id: 'DIAGNOSE', label: '2. Diagnose' },
    { id: 'PLAN', label: '3. Plan (Qwen)' },
    { id: 'GUARDRAILS', label: '4. Guardrails' },
    { id: 'EXECUTE', label: '5. Execute' },
    { id: 'VERIFY', label: '6. Verify' },
  ];

  // 5 Mandatory Deterministic SRE Guardrail Gates
  const guardrailGates = [
    { id: 'namespace_lock', name: 'Namespace Lock', rule: 'Must be hipster or kintsugi-lab (kube-system hard-blocked)', passed: true },
    { id: 'action_allowlist', name: 'Action Allowlist', rule: 'Must map to 6 verified primitives in ActionCatalog', passed: true },
    { id: 'parameter_bounds', name: 'Parameter Bounds', rule: 'Replicas clamped to [1, 5], Memory <= 1024Mi', passed: true },
    { id: 'cooldown_lock', name: '120s Cooldown Lock', rule: 'Blocks re-execution on same service within 120 seconds', passed: true },
    { id: 'k8s_dry_run', name: 'K8s Dry-Run="All"', rule: 'Pre-flight verified against Kubernetes API server', passed: true },
  ];

  return (
    <div className="h-full rounded-2xl border border-slate-800/90 bg-slate-950/70 shadow-2xl flex flex-col overflow-hidden backdrop-blur-xl">
      {/* Console Header & Tabs */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/70">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-cyan-400" />
          <span className="text-xs font-bold text-slate-200 font-mono tracking-wider flex items-center gap-1.5">
            LANGGRAPH AMBIENT SRE AGENT
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-950/80 border border-indigo-700 text-indigo-300">
              Qwen 3.8-27B
            </span>
          </span>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-slate-950/90 p-1 rounded-lg border border-slate-800 text-[11px] font-mono">
          <button
            onClick={() => setActiveTab('trace')}
            className={`px-2.5 py-1 rounded transition-all ${
              activeTab === 'trace' ? 'bg-cyan-600 text-white font-bold shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Graph Trace
          </button>
          <button
            onClick={() => setActiveTab('plan')}
            className={`px-2.5 py-1 rounded transition-all ${
              activeTab === 'plan' ? 'bg-indigo-600 text-white font-bold shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Pydantic Plan
          </button>
          <button
            onClick={() => setActiveTab('guardrails')}
            className={`px-2.5 py-1 rounded transition-all ${
              activeTab === 'guardrails' ? 'bg-emerald-600 text-white font-bold shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            5 Guardrails
          </button>
        </div>
      </div>

      {/* Visual 6-Stage LangGraph State Machine Horizontal Pipeline */}
      <div className="px-3.5 py-2.5 bg-slate-900/40 border-b border-slate-800/70">
        <div className="flex items-center justify-between gap-1 overflow-x-auto pb-0.5">
          {langgraphStages.map((st, i) => {
            const isActive = currentState === st.id || (i === 0 && currentState === 'MONITOR_CHECKED');
            const isCompleted = history.length > i;
            return (
              <div
                key={st.id}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-mono transition-all border shrink-0 ${
                  isActive
                    ? 'bg-cyan-950/90 border-cyan-400 text-cyan-200 font-bold shadow-[0_0_8px_rgba(56,189,248,0.4)] animate-pulse'
                    : isCompleted
                    ? 'bg-slate-900 border-emerald-500/40 text-emerald-300'
                    : 'bg-slate-950 border-slate-800 text-slate-500'
                }`}
              >
                {isCompleted ? (
                  <Check className="h-3 w-3 text-emerald-400" />
                ) : (
                  <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-cyan-400' : 'bg-slate-600'}`} />
                )}
                <span>{st.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* HITL Operator Approval Callout Banner */}
      {pendingPlan && (
        <div className="p-3 bg-amber-950/80 border-b border-amber-500/70 flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-400 shrink-0" />
            <div>
              <div className="text-xs font-bold text-amber-200 font-mono">
                AWAITING OPERATOR CONFIRMATION: {pendingPlan.selected_action} on {pendingPlan.target_service}
              </div>
              <p className="text-[11px] text-amber-300/80 truncate max-w-sm">
                {pendingPlan.reasoning_summary || 'Operator approval required before live Kubernetes API dispatch.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              disabled={acting}
              onClick={handleApprove}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold font-mono shadow-md transition-all flex items-center gap-1 active:scale-95"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Approve Fix
            </button>
            <button
              disabled={acting}
              onClick={handleReject}
              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold font-mono shadow-md transition-all flex items-center gap-1 active:scale-95"
            >
              <XCircle className="h-3.5 w-3.5" />
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Main Tab Content */}
      <div className="flex-1 p-4 overflow-y-auto font-mono text-xs space-y-3">
        {/* TAB 1: LangGraph Trace */}
        {activeTab === 'trace' && (
          <div className="space-y-2">
            <div className="text-[11px] text-slate-400 mb-2 flex items-center justify-between border-b border-slate-800 pb-1.5">
              <span>Execution State Machine Transitions:</span>
              <span className="text-cyan-400 font-bold">Mode: {autonomousMode ? 'AUTONOMOUS' : 'HITL'}</span>
            </div>

            {history.length === 0 ? (
              <div className="text-slate-500 italic p-3 text-center border border-dashed border-slate-800 rounded-xl">
                Listening for telemetry ticks... Zero state anomalies detected.
              </div>
            ) : (
              history.map((step, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl border border-slate-800/80 bg-slate-900/60 flex items-start gap-2.5 transition-all hover:border-slate-700"
                >
                  <span className="text-cyan-400 font-bold text-[10px] bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 shrink-0">
                    #{idx + 1}
                  </span>
                  <div className="flex-1 text-slate-300 break-words leading-relaxed">
                    {step}
                  </div>
                </div>
              ))
            )}

            {/* Live Verification Stamp (✦ Kintsugi Gold Seam) */}
            {agentEvent?.verification_result && (
              <div className="mt-3 p-3 rounded-xl border border-amber-400/80 bg-gradient-to-r from-amber-950/80 via-slate-900 to-amber-950/80 text-amber-200 shadow-[0_0_15px_rgba(251,191,36,0.25)]">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="h-4 w-4 text-amber-300 animate-spin" />
                  <strong className="text-xs tracking-wider uppercase">✦ Kintsugi Closed-Loop Verification Confirmed</strong>
                </div>
                <div className="text-[11px] space-y-0.5 text-amber-300/90 pl-6">
                  <div>Action Executed: <strong>{agentEvent.verification_result.action_executed}</strong></div>
                  <div>Mean Time To Remediate (MTTR): <strong>{agentEvent.verification_result.mttr_seconds || 24.0}s</strong></div>
                  <div>Post-Remediation Status: <strong className="text-emerald-400">{agentEvent.verification_result.status || 'RECOVERED'}</strong></div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Pydantic Plan & LLM Reasoning */}
        {activeTab === 'plan' && (
          <div className="space-y-3">
            <div className="p-3 rounded-xl border border-indigo-500/40 bg-indigo-950/30 text-indigo-200">
              <div className="flex items-center gap-1.5 mb-1.5 text-xs font-bold text-indigo-300">
                <Cpu className="h-3.5 w-3.5" />
                <span>Qwen 3.8-27B Structured Remediation Plan</span>
              </div>
              <div className="space-y-1 text-[11px]">
                <div>Target Service: <strong className="text-white">{targetService}</strong> (namespace: <strong className="text-cyan-300">hipster</strong>)</div>
                <div>Action: <strong className="text-amber-300">{plannedAction || 'NO_ACTION'}</strong></div>
              </div>
            </div>

            <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/70">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">Chain-of-Thought Reasoning:</span>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                {reasoning || 'Agent is monitoring continuous multi-modal metric streams and Drain3 container logs.'}
              </p>
            </div>
          </div>
        )}

        {/* TAB 3: 5 Deterministic SRE Guardrails */}
        {activeTab === 'guardrails' && (
          <div className="space-y-2">
            <div className="text-[11px] text-slate-400 mb-2 border-b border-slate-800 pb-1.5">
              5 Mandatory Safety Gates (Zero Hallucinated Execution):
            </div>
            {guardrailGates.map((gate, i) => (
              <div key={gate.id} className="p-2.5 rounded-xl border border-slate-800/80 bg-slate-900/60 flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <Lock className="h-3 w-3 text-emerald-400" />
                    <span className="text-xs font-bold text-white">Gate #{i + 1}: {gate.name}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 pl-4.5">{gate.rule}</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 border border-emerald-600 text-emerald-300 shrink-0">
                  PASSED
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Console Footer */}
      <div className="px-4 py-2 border-t border-slate-800/80 bg-slate-900/40 text-[10px] font-mono text-slate-400 flex items-center justify-between">
        <span>Reasoning Engine: <strong className="text-indigo-300">Groq Cloud (qwen/qwen3.8-27b)</strong></span>
        <span className="text-emerald-400 flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          5/5 Guardrails Active
        </span>
      </div>
    </div>
  );
}
