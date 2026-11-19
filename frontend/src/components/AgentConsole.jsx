import React from 'react';
import { Shield, Terminal, CheckCircle2, AlertTriangle, Sparkles, Lock, Play, X } from 'lucide-react';

const LANGGRAPH_STAGES = [
  'MONITOR',
  'DIAGNOSE',
  'PLAN',
  'GUARDRAILS',
  'EXECUTE',
  'VERIFY',
];

const GUARDRAIL_CHECKS = [
  'Namespace Lock (hipster)',
  'Action Allowlist (6 Primitives)',
  'Bounds Clamp (1-5 Pods / ≤1024Mi)',
  '120s Cooldown Anti-Thrash',
  'K8s API dry_run="All"',
];

export default function AgentConsole({
  latestTick,
  incidentFeed = [],
  pendingHitl = false,
  pendingPlan = null,
  onApprove,
  onReject,
}) {
  const pred = latestTick?.prediction || {};
  const activeState = latestTick?.agent_event?.state || (pendingHitl ? 'AWAITING_APPROVAL' : 'MONITOR');

  const getStageActive = (stage, idx) => {
    if (activeState === 'VERIFIED') return true;
    if (activeState === 'AWAITING_APPROVAL' && idx <= 3) return true;
    if (activeState === 'MONITOR' && idx === 0) return true;
    return false;
  };

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Phase 1 Fast Brain + 6-Stage LangGraph Pipeline Card */}
      <div className="rounded-2xl kintsugi-glass p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
              LANGGRAPH AMBIENT SRE BRAIN
            </h3>
          </div>
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded border font-bold ${
              pred.is_anomaly
                ? 'bg-rose-950 border-rose-500 text-rose-300 animate-pulse'
                : 'bg-emerald-950 border-emerald-600 text-emerald-300'
            }`}
          >
            {pred.fault_class || 'NORMAL'} ({pred.confidence ? `${(pred.confidence * 100).toFixed(0)}%` : '98%'})
          </span>
        </div>

        {/* 6-Stage LangGraph State Bar */}
        <div className="grid grid-cols-6 gap-1 my-2.5">
          {LANGGRAPH_STAGES.map((stage, idx) => {
            const lit = getStageActive(stage, idx);
            return (
              <div
                key={stage}
                className={`text-center py-1 px-1 rounded-lg border text-[9px] font-mono font-bold transition-all ${
                  lit
                    ? stage === 'VERIFY'
                      ? 'bg-amber-500/25 border-amber-400 text-amber-200 shadow-[0_0_10px_rgba(251,191,36,0.4)]'
                      : 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                    : 'bg-slate-950/70 border-slate-800 text-slate-500'
                }`}
              >
                {stage}
              </div>
            );
          })}
        </div>

        {/* 5 Deterministic SRE Safety Guardrail Badges */}
        <div className="pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 mb-1.5">
            <Lock className="h-3 w-3 text-emerald-400" />
            <span>5 Deterministic SRE Safety Guardrails:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {GUARDRAIL_CHECKS.map((chk) => (
              <span
                key={chk}
                className="text-[9px] font-mono px-2 py-0.5 rounded-md bg-emerald-950/70 border border-emerald-600/50 text-emerald-300 flex items-center gap-1"
              >
                <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" />
                {chk}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Human-in-the-Loop (HITL) Approval Terminal (Visible when paused) */}
      {pendingHitl && pendingPlan && (
        <div className="rounded-2xl border-2 border-amber-400 bg-amber-950/40 backdrop-blur-xl p-4 shadow-[0_0_25px_rgba(251,191,36,0.3)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono font-bold text-amber-300 flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-amber-400 animate-bounce" />
              AWAITING OPERATOR APPROVAL (HITL GATE)
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-400/50">
              {pendingPlan.selected_action}
            </span>
          </div>
          <p className="text-xs text-slate-200 mb-2 leading-relaxed">
            <strong>Target:</strong> <code className="text-amber-300">{pendingPlan.target_service}</code> — {pendingPlan.reasoning_summary}
          </p>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={onApprove}
              className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold flex items-center justify-center gap-1.5 shadow-lg cursor-pointer"
            >
              <Play className="h-3.5 w-3.5" />
              Approve & Seal Gold Seam
            </button>
            <button
              onClick={onReject}
              className="py-2 px-3 rounded-xl bg-rose-950 hover:bg-rose-900 border border-rose-500 text-rose-200 text-xs font-mono font-bold flex items-center justify-center gap-1 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Live Remediation & Gold Seam Audit Feed */}
      <div className="flex-1 rounded-2xl kintsugi-glass p-4 flex flex-col min-h-[360px] max-h-[580px]">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-amber-400" />
            <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
              QWEN 3.8-27B DIAGNOSIS & KINTSUGI AUDIT LOG
            </h3>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            {incidentFeed.length} Verified Events
          </span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {incidentFeed.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-800 rounded-xl text-slate-400">
              <Sparkles className="h-6 w-6 text-amber-400/70 mb-2" />
              <p className="text-xs font-mono">
                Ambient Agent monitoring 10 microservices at 1Hz.
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Use the Chaos Fault Injection Deck to trigger a live Kubernetes incident and watch Qwen 3.8-27B heal & seal the pod in gold.
              </p>
            </div>
          ) : (
            incidentFeed.map((item, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-slate-950/85 border border-amber-500/35 hover:border-amber-400/70 transition-all"
              >
                <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                  <span className="font-bold text-amber-300 flex items-center gap-1">
                    ✦ {item.service} // {item.fault}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-400/40 text-amber-200 text-[10px]">
                    {item.action}
                  </span>
                </div>
                {item.rootCause && (
                  <p className="text-[11px] text-slate-300 leading-relaxed mb-1.5">
                    <strong className="text-cyan-300">Diagnosis:</strong> {item.rootCause}
                  </p>
                )}
                {item.message && (
                  <div className="text-[10px] font-mono text-emerald-300 bg-emerald-950/50 border border-emerald-700/50 px-2 py-1 rounded">
                    ✓ {item.message}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
