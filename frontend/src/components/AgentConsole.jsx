import React, { useState } from 'react';
import { Terminal, Shield, CheckCircle, XCircle, AlertCircle, Play, Pause, RefreshCw, FileText } from 'lucide-react';

export default function AgentConsole({
  agentEvent = null,
  pendingPlan = null,
  onApprovePlan,
  onRejectPlan,
  autonomousMode,
}) {
  const [activeTab, setActiveTab] = useState('agent'); // 'agent' | 'plan' | 'logs'
  const [acting, setActing] = useState(false);

  const history = agentEvent?.history || [];
  const plannedAction = agentEvent?.planned_action || pendingPlan?.selected_action || null;
  const reasoning = agentEvent?.reasoning || pendingPlan?.reasoning_summary || null;

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

  return (
    <div className="h-full rounded-2xl border border-slate-800 bg-slate-950/80 shadow-2xl flex flex-col overflow-hidden">
      {/* Console Header & Tabs */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-cyan-400" />
          <span className="text-xs font-bold text-slate-200 font-mono tracking-wider">
            SRE AMBIENT AGENT CONSOLE
          </span>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px] font-mono">
          <button
            onClick={() => setActiveTab('agent')}
            className={`px-2.5 py-1 rounded transition-colors ${
              activeTab === 'agent' ? 'bg-cyan-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Graph Trace
          </button>
          <button
            onClick={() => setActiveTab('plan')}
            className={`px-2.5 py-1 rounded transition-colors ${
              activeTab === 'plan' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Pydantic Plan
          </button>
          <button
            onClick={() => setActiveTab('guardrails')}
            className={`px-2.5 py-1 rounded transition-colors ${
              activeTab === 'guardrails' ? 'bg-emerald-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Guardrails
          </button>
        </div>
      </div>

      {/* HITL Operator Approval Callout Banner (when paused in Human-in-the-Loop) */}
      {pendingPlan && (
        <div className="p-3 bg-amber-950/70 border-b border-amber-500/50 flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-400 shrink-0" />
            <div>
              <div className="text-xs font-bold text-amber-200 font-mono">
                APPROVAL REQUIRED: {pendingPlan.selected_action} on {pendingPlan.target_service}
              </div>
              <p className="text-[11px] text-amber-300/80 truncate max-w-sm">
                {pendingPlan.reasoning_summary || 'Operator confirmation required before live dispatch.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={acting}
              onClick={handleApprove}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold font-mono shadow-md transition-all flex items-center gap-1"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              Approve Fix
            </button>
            <button
              disabled={acting}
              onClick={handleReject}
              className="px-2.5 py-1.5 rounded-lg bg-rose-800 hover:bg-rose-700 text-rose-100 text-xs font-bold font-mono shadow-md transition-all flex items-center gap-1"
            >
              <XCircle className="h-3.5 w-3.5" />
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Main Console Body */}
      <div className="flex-1 p-4 overflow-y-auto font-mono text-xs space-y-2">
        {activeTab === 'agent' && (
          <div className="space-y-2.5">
            <div className="text-[11px] text-slate-500 pb-1 border-b border-slate-900">
              LangGraph State Machine Trace (Monitor → Diagnose → Plan → Guardrail → Execute → Verify):
            </div>

            {history.length > 0 ? (
              history.map((step, idx) => {
                const isMonitor = step.startsWith('MONITOR');
                const isDiagnose = step.startsWith('DIAGNOSE') || step.startsWith('INVESTIGATE');
                const isPlan = step.startsWith('PLAN');
                const isGuard = step.startsWith('GUARDRAIL');
                const isExec = step.startsWith('EXECUTE');
                const isVerify = step.startsWith('VERIFY');

                let badgeColor = 'text-cyan-400 border-cyan-800 bg-cyan-950/40';
                if (isDiagnose) badgeColor = 'text-amber-400 border-amber-800 bg-amber-950/40';
                if (isPlan) badgeColor = 'text-indigo-400 border-indigo-800 bg-indigo-950/40';
                if (isGuard) badgeColor = 'text-emerald-400 border-emerald-800 bg-emerald-950/40';
                if (isExec) badgeColor = 'text-sky-300 border-sky-800 bg-sky-950/40';
                if (isVerify) badgeColor = 'text-teal-300 border-teal-800 bg-teal-950/40';

                return (
                  <div key={idx} className="p-2.5 rounded-lg border border-slate-900 bg-slate-900/60 leading-relaxed">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border mr-2 ${badgeColor}`}>
                      STEP {idx + 1}
                    </span>
                    <span className="text-slate-300">{step}</span>
                  </div>
                );
              })
            ) : (
              <div className="text-slate-500 py-8 text-center">
                Telemetry stream running. Standing by for anomalous state triggers.
              </div>
            )}
          </div>
        )}

        {activeTab === 'plan' && (
          <div className="space-y-3">
            <div className="text-[11px] text-slate-500">
              Constrained Pydantic RemediationPlan JSON:
            </div>
            {plannedAction ? (
              <pre className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-cyan-300 overflow-x-auto text-[11px] leading-relaxed">
                {JSON.stringify(
                  pendingPlan || {
                    diagnosed_root_cause: reasoning || 'Resource contention identified',
                    target_service: agentEvent?.target_service || 'checkoutservice',
                    selected_action: plannedAction,
                    parameters: { replicas: 3, timeout_ms: 1000 },
                    confidence: 0.95,
                    reasoning_summary: reasoning || 'Automated remediation triggered'
                  },
                  null,
                  2
                )}
              </pre>
            ) : (
              <div className="text-slate-500 py-8 text-center">
                No active plan formulated. System is in steady-state monitoring.
              </div>
            )}
          </div>
        )}

        {activeTab === 'guardrails' && (
          <div className="space-y-3">
            <div className="text-[11px] text-slate-500">
              Deterministic SRE Safety Guardrails (Zero Unbounded Execution):
            </div>
            <div className="space-y-2">
              <div className="p-2.5 rounded-lg bg-slate-900/80 border border-emerald-800/40 flex items-center justify-between">
                <span className="text-slate-300 font-semibold">1. Namespace Lock</span>
                <span className="text-emerald-400 font-bold text-[10px] px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700">
                  hipster / kintsugi-lab ONLY
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900/80 border border-emerald-800/40 flex items-center justify-between">
                <span className="text-slate-300 font-semibold">2. Replica Clamping Bounds</span>
                <span className="text-emerald-400 font-bold text-[10px] px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700">
                  Bounded [1, 5]
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900/80 border border-emerald-800/40 flex items-center justify-between">
                <span className="text-slate-300 font-semibold">3. Anti-Thrashing Cooldown Timer</span>
                <span className="text-emerald-400 font-bold text-[10px] px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700">
                  120s per-service lock
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900/80 border border-emerald-800/40 flex items-center justify-between">
                <span className="text-slate-300 font-semibold">4. Kubernetes API Dry-Run Check</span>
                <span className="text-emerald-400 font-bold text-[10px] px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700">
                  dry_run="All" Pre-Flight
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900/80 border border-emerald-800/40 flex items-center justify-between">
                <span className="text-slate-300 font-semibold">5. Memory Limit Cap</span>
                <span className="text-emerald-400 font-bold text-[10px] px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700">
                  Max 1024Mi
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Status Bar */}
      <div className="px-4 py-2 border-t border-slate-800/80 bg-slate-900/60 flex items-center justify-between text-[11px] font-mono text-slate-400">
        <span className="flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-cyan-400" />
          Operating Mode: <strong className={autonomousMode ? 'text-emerald-400' : 'text-amber-400'}>
            {autonomousMode ? 'Autonomous' : 'HITL Approval'}
          </strong>
        </span>
        <span>Safe Fallback: Active</span>
      </div>
    </div>
  );
}
