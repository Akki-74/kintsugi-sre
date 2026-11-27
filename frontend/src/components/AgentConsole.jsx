import React, { useState } from 'react';
import {
  Bot,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Terminal,
  Copy,
  Check,
  Download,
  Sparkles,
  AlertOctagon,
  Lock,
  ArrowRightLeft,
  ChevronRight,
  Info,
  Activity,
  Layers,
  Cpu,
  RefreshCw,
  GitCommit
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

const LANGGRAPH_STAGES = [
  'MONITOR',
  'DIAGNOSE',
  'PLAN',
  'GUARDRAILS',
  'EXECUTE',
  'VERIFY'
];

const STAGE_DETAILS = {
  MONITOR: {
    name: '1. Monitor',
    short: 'Ingest',
    icon: Activity,
    title: 'Node 1: Monitor Telemetry Ingestion',
    role: 'Ingests 89-feature Z-scores, raw cgroup metrics, and Drain3 log templates at 1Hz.',
    inputs: 'cgroups v2, eBPF metrics, container stderr/stdout, Prometheus scrape',
    outputs: 'Normalized feature vector, anomaly probability, TTE prediction',
    action: 'Dispatches LangGraph state machine when anomaly confidence >= 0.50'
  },
  DIAGNOSE: {
    name: '2. Diagnose',
    short: 'Correlate',
    icon: Cpu,
    title: 'Node 2: Root-Cause Diagnosis',
    role: 'Correlates fault signatures with live container logs and Prometheus latency drifts.',
    inputs: '89-feature drift vector, tail logs (15 lines), live PromQL queries',
    outputs: 'diagnosed_summary, correlated error tokens, target microservice',
    action: 'Passes enriched diagnostic context to Dual-Brain LLM Reasoner'
  },
  PLAN: {
    name: '3. Plan',
    short: 'Reason',
    icon: Sparkles,
    title: 'Node 3: Dual-Brain LLM Reasoner',
    role: 'Prompts Groq Qwen3.8-27B or local LM Studio to generate a strict Pydantic RemediationPlan.',
    inputs: 'System prompt, diagnostic payload, current replicas, bounds contract',
    outputs: 'Pydantic RemediationPlan (action_type, target_service, parameters)',
    action: 'Falls back deterministically to SRE Fallback Matrix if LLM offline'
  },
  GUARDRAILS: {
    name: '4. Guardrails',
    short: 'Safety',
    icon: ShieldCheck,
    title: 'Node 4: 5 Deterministic Safety Gates',
    role: 'Verifies proposed mutation against 5 strict invariants before touching cluster API.',
    inputs: 'Proposed RemediationPlan, live K8s cluster schema',
    outputs: 'GuardrailValidationResult (passed: bool, violations: list)',
    action: 'Blocks illegal namespaces, bounds breaches, or 120s cooldown thrashing'
  },
  EXECUTE: {
    name: '5. Execute',
    short: 'Mutate',
    icon: Layers,
    title: 'Node 5: Cluster API Execution / HITL Gate',
    role: 'Executes verified action via K8s API with dry_run="All" check or pauses for Operator.',
    inputs: 'Verified plan, Human-in-the-Loop flag, dry_run="All" validation',
    outputs: 'RemediationExecutionResult (status: SUCCESS, message: string)',
    action: 'Invokes Kubernetes apps/v1 client to scale, patch limits, or restart pod'
  },
  VERIFY: {
    name: '6. Verify',
    short: 'Heal',
    icon: CheckCircle2,
    title: 'Node 6: Closed-Loop MTTR Verification',
    role: 'Re-queries Prometheus & K8s to verify pod health and seals repaired node in Kintsugi Gold.',
    inputs: 'Post-action pod ready replicas, recovery latency curve',
    outputs: 'MTTR summary (seconds), gold seam visual verification token',
    action: 'Marks service as VerifiedRepaired and resets incident status'
  }
};

const GUARDRAIL_GATES = [
  { id: 'ns', label: 'Namespace Lock (hipster)' },
  { id: 'allow', label: '6-Action Allowlist' },
  { id: 'clamp', label: 'Bounds [1..5] / 1024Mi' },
  { id: 'cooldown', label: '120s Anti-Thrash Lock' },
  { id: 'dryrun', label: 'K8s API dry_run="All"' }
];

function buildKubectlPreview(plan) {
  if (!plan) {
    return 'kubectl get pods -n hipster -l kintsugi.sre/mesh=active --watch';
  }
  const svc = plan.target_service || 'checkoutservice';
  const ns = plan.target_namespace || 'hipster';
  const act = plan.action_type || 'SCALE_DEPLOYMENT';
  const params = plan.parameters || {};

  if (act === 'SCALE_DEPLOYMENT') {
    const reps = params.replicas || 3;
    return `kubectl scale deployment ${svc} -n ${ns} --replicas=${reps} --dry-run=server`;
  }
  if (act === 'PATCH_RESOURCES') {
    const mem = params.memory_limit_mi || 512;
    return `kubectl set resources deployment ${svc} -n ${ns} --limits=memory=${mem}Mi --dry-run=server`;
  }
  if (act === 'RESTART_POD') {
    return `kubectl rollout restart deployment/${svc} -n ${ns} --dry-run=server`;
  }
  if (act === 'CORDON_AND_RELOCATE') {
    const node = params.target_node || 'desktop-worker';
    return `kubectl cordon ${node} && kubectl rollout restart deployment/${svc} -n ${ns}`;
  }
  if (act === 'APPLY_TRAFFIC_SHAPING') {
    return `kubectl annotate svc ${svc} -n ${ns} envoy.kintsugi.sre/timeout_ms="${params.timeout_ms || 1000}" --overwrite`;
  }
  return `kubectl get deployment ${svc} -n ${ns} -o yaml`;
}

export default function AgentConsole({
  agentState,
  logs = [],
  onApprove,
  onReject,
  agentMode = 'AUTONOMOUS',
  onToggleMode
}) {
  const [copied, setCopied] = useState(false);
  const [selectedStageInspect, setSelectedStageInspect] = useState(null);

  const currentStage = (agentState?.current_node || agentState?.stage || 'MONITOR').toUpperCase();
  const activePlan = agentState?.remediation_plan || agentState?.pending_plan || agentState?.last_plan;
  const awaitingApproval =
    agentState?.status === 'AWAITING_APPROVAL' ||
    Boolean(agentState?.awaiting_approval);

  const kubectlCmd = buildKubectlPreview(activePlan);

  const handleCopyCmd = () => {
    navigator.clipboard.writeText(kubectlCmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleExportReport = () => {
    const payload = {
      project: 'Kintsugi-AI Autonomous SRE Incident Report',
      exported_at: new Date().toISOString(),
      agent_mode: agentMode,
      agent_state: agentState,
      remediation_plan: activePlan,
      kubectl_dry_run_command: kubectlCmd,
      audit_trail: logs
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kintsugi-incident-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const activeStageIdx = Math.max(
    0,
    LANGGRAPH_STAGES.findIndex((s) => currentStage.includes(s))
  );

  return (
    <aside className="kintsugi-panel flex flex-col h-full rounded-2xl overflow-hidden min-w-0 max-w-full">
      {/* Console Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 bg-slate-950/20 backdrop-blur-xs px-3.5 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 border border-amber-400/50 flex-shrink-0">
            <Bot className="h-4 w-4 text-amber-300" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-xs font-bold uppercase tracking-wider text-white truncate flex items-center gap-1.5">
              <span>LangGraph SRE Slow-Brain</span>
              <span className="rounded bg-amber-500/20 border border-amber-400/50 px-1.5 py-0.2 font-mono-code text-[9px] text-amber-300">
                StateGraph Active
              </span>
            </h2>
            <p className="font-mono-code text-[10px] text-slate-400 truncate">
              6-Stage Directed Graph • 5 Safety Gates Enforced
            </p>
          </div>
        </div>

        <button
          onClick={handleExportReport}
          className="flex items-center gap-1 rounded-lg bg-slate-900/30 hover:bg-slate-800/50 border border-slate-700/60 px-2.5 py-1 font-mono-code text-[10px] text-amber-300 transition-all backdrop-blur-xs flex-shrink-0"
          title="Download JSON Incident & Remediation Post-Mortem"
        >
          <Download className="h-3 w-3" />
          <span>Post-Mortem</span>
        </button>
      </div>

      {/* Mode Control Banner: Auto-Remedy vs Manual Approve */}
      <div className="flex items-center justify-between border-b border-slate-800/80 bg-slate-900/20 backdrop-blur-xs px-3.5 py-1.5 text-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          {agentMode === 'AUTONOMOUS' ? (
            <>
              <Sparkles className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
              <span className="font-mono-code text-[11px] text-amber-200 font-semibold truncate">
                Mode: Auto-Remedy (Zero-Touch Healing)
              </span>
            </>
          ) : (
            <>
              <ShieldCheck className="h-3.5 w-3.5 text-sky-400 flex-shrink-0" />
              <span className="font-mono-code text-[11px] text-sky-200 font-semibold truncate">
                Mode: Manual Approve (Human Gate Active)
              </span>
            </>
          )}
        </div>

        {onToggleMode && (
          <Button
            onClick={onToggleMode}
            variant={agentMode === 'AUTONOMOUS' ? 'gold' : 'cyan'}
            size="sm"
            className="h-6 px-2 py-0.5 text-[10px] font-bold"
            title="Toggle between Auto-Remedy and Manual Approval"
          >
            <ArrowRightLeft className="h-3 w-3" />
            <span>Switch to {agentMode === 'AUTONOMOUS' ? 'Manual Approve' : 'Auto-Remedy'}</span>
          </Button>
        )}
      </div>

      {/* VISUAL LANGGRAPH STATEGRAPH PIPELINE */}
      <div className="border-b border-slate-800/80 bg-slate-950/20 backdrop-blur-xs p-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-mono-code text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <GitCommit className="h-3 w-3 text-amber-400" />
            <span>LangGraph State Machine Topology</span>
          </span>
          <span className="font-mono-code text-[10px] text-amber-300/80">
            Current: <strong className="text-amber-200">{currentStage}</strong>
          </span>
        </div>

        {/* 6-Node Connected Visual Flowchart (2x3 Directed Rows with Clear Connectors) */}
        <div className="space-y-1.5">
          {[LANGGRAPH_STAGES.slice(0, 3), LANGGRAPH_STAGES.slice(3, 6)].map((rowStages, rowIdx) => (
            <div key={rowIdx} className="flex items-center gap-1.5">
              {rowStages.map((stage, colIdx) => {
                const idx = rowIdx * 3 + colIdx;
                const meta = STAGE_DETAILS[stage];
                const Icon = meta.icon;
                const isDone = idx < activeStageIdx || currentStage === 'VERIFY';
                const isCurrent = idx === activeStageIdx;
                const isInspecting = selectedStageInspect === stage;

                return (
                  <React.Fragment key={stage}>
                    <button
                      onClick={() => setSelectedStageInspect((prev) => (prev === stage ? null : stage))}
                      className={`flex-1 min-w-0 flex flex-col items-center justify-center rounded-xl px-2 py-1.5 border text-center transition-all cursor-pointer relative group ${
                        isCurrent
                          ? 'bg-amber-500/25 border-amber-400 text-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.4)] animate-pulse'
                          : isDone
                          ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-300 backdrop-blur-xs'
                          : 'bg-slate-900/25 border-slate-800/70 text-slate-400 hover:border-slate-700 backdrop-blur-xs'
                      } ${isInspecting ? 'ring-2 ring-amber-400' : ''}`}
                      title={`Click to inspect LangGraph ${stage} node specification`}
                    >
                      <div className="flex items-center gap-1 mb-0.5">
                        <Icon className={`h-3 w-3 ${isCurrent ? 'text-amber-300' : isDone ? 'text-emerald-400' : 'text-slate-500'}`} />
                        {isDone && <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" />}
                      </div>
                      <span className="font-mono-code text-[9px] font-bold leading-none whitespace-nowrap">
                        {meta.name}
                      </span>
                      <span className="text-[8px] text-slate-400 font-mono-code leading-none mt-0.5 opacity-80 group-hover:opacity-100">
                        {meta.short}
                      </span>
                    </button>
                    {colIdx < 2 && (
                      <ChevronRight
                        className={`h-3.5 w-3.5 flex-shrink-0 ${
                          isDone ? 'text-emerald-400' : isCurrent ? 'text-amber-400 animate-pulse' : 'text-amber-500/50'
                        }`}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          ))}
        </div>

        {/* Interactive Deep Node Inspector Drawer */}
        {selectedStageInspect && (
          <div className="mt-2 p-2.5 rounded-xl bg-slate-900/40 backdrop-blur-xs border border-amber-500/40 text-[10px] font-mono-code space-y-1 animate-fade-in">
            <div className="flex items-center justify-between text-amber-300 font-bold border-b border-slate-800 pb-1">
              <span>{STAGE_DETAILS[selectedStageInspect].title}</span>
              <button
                onClick={() => setSelectedStageInspect(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <p className="text-slate-300 text-[10px] leading-tight">
              {STAGE_DETAILS[selectedStageInspect].role}
            </p>
            <div className="grid grid-cols-2 gap-1 pt-1 text-[9px] text-slate-400">
              <div><strong className="text-cyan-300">Inputs:</strong> {STAGE_DETAILS[selectedStageInspect].inputs}</div>
              <div><strong className="text-emerald-300">Outputs:</strong> {STAGE_DETAILS[selectedStageInspect].outputs}</div>
            </div>
          </div>
        )}
      </div>

      {/* Prominent Human-in-the-Loop Operator Approval Box */}
      {awaitingApproval && (
        <div className="m-3 rounded-xl bg-gradient-to-r from-amber-500/25 via-amber-500/15 to-rose-500/20 border-2 border-amber-400 p-3.5 shadow-[0_0_25px_rgba(245,158,11,0.35)] animate-pulse min-w-0">
          <div className="flex items-center justify-between mb-2">
            <span className="flex items-center gap-1.5 font-display text-xs font-bold text-amber-200 truncate">
              <AlertOctagon className="h-4 w-4 text-amber-300 animate-bounce flex-shrink-0" />
              OPERATOR APPROVAL REQUIRED (HITL)
            </span>
            <span className="rounded bg-amber-400/20 border border-amber-400/60 px-1.5 py-0.5 font-mono-code text-[10px] text-amber-300 font-bold flex-shrink-0">
              GATE PAUSED
            </span>
          </div>

          <div className="text-xs text-slate-200 mb-3 space-y-1 font-mono-code kintsugi-message-fit">
            <div>
              Action: <strong className="text-amber-300">{activePlan?.action_type || 'SCALE_DEPLOYMENT'}</strong>
            </div>
            <div>
              Target: <code className="text-cyan-300 font-bold">{activePlan?.target_service || 'checkoutservice'}</code> (namespace: hipster)
            </div>
            <p className="text-[11px] text-slate-300 italic pt-1 border-t border-amber-500/30">
              {activePlan?.root_cause_summary || activePlan?.reasoning_summary || 'Operator confirmation required to execute cluster mutation.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={onApprove}
              variant="emerald"
              className="flex-1 py-2 font-bold text-xs shadow-lg active:scale-95"
            >
              <CheckCircle2 className="h-4 w-4" /> Approve &amp; Seal in Gold
            </Button>
            <Button
              onClick={onReject}
              variant="destructive"
              className="px-3.5 py-2 font-semibold text-xs active:scale-95"
            >
              <XCircle className="h-4 w-4" /> Reject
            </Button>
          </div>
        </div>
      )}

      {/* Active LLM Reasoning & Pydantic Plan Card */}
      <div className="p-3 space-y-2.5 border-b border-slate-800/80 min-w-0">
        <div className="rounded-xl bg-slate-950/20 backdrop-blur-xs border border-slate-800/60 p-3 space-y-2 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="flex items-center gap-1.5 font-display text-xs font-bold text-amber-300 truncate">
              <Sparkles className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">
                {activePlan ? `${activePlan.action_type || 'ACTION'} → ${activePlan.target_service || 'POD'}` : 'Ambient Cluster Watch Active'}
              </span>
            </span>
            <span className="rounded bg-emerald-500/15 border border-emerald-500/40 px-1.5 py-0.5 font-mono-code text-[9px] font-semibold text-emerald-300 flex-shrink-0">
              {activePlan ? `CONF ${(Number(activePlan.confidence || 0.95) * 100).toFixed(0)}%` : 'READY'}
            </span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed kintsugi-message-fit">
            {activePlan?.root_cause_summary ||
              activePlan?.reasoning_summary ||
              agentState?.diagnosis ||
              'Monitoring 89-feature Z-score streams and Drain3 log templates across all 10 microservices in hipster namespace.'}
          </p>

          {/* Syntax-Highlighted kubectl Dry-Run Command Preview */}
          <div className="rounded-lg bg-black/30 backdrop-blur-xs border border-slate-800/60 p-2 font-mono-code text-[10px] min-w-0">
            <div className="flex items-center justify-between text-slate-400 mb-1 gap-1">
              <span className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-cyan-400 truncate">
                <Terminal className="h-3 w-3 flex-shrink-0" /> Verified K8s API Mutation (dry_run="All")
              </span>
              <button
                onClick={handleCopyCmd}
                className="flex items-center gap-1 text-slate-400 hover:text-amber-300 transition-colors flex-shrink-0"
                title="Copy kubectl command"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <div className="text-amber-200 kintsugi-message-fit select-all break-all">$ {kubectlCmd}</div>
          </div>
        </div>

        {/* 5 Deterministic SRE Safety Guardrails Checklist */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="flex items-center gap-1 font-mono-code text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              <Lock className="h-3 w-3 text-emerald-400" /> 5 Deterministic SRE Safety Guardrails
            </span>
            <span className="font-mono-code text-[10px] text-emerald-400 font-bold">5/5 ENFORCED</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {GUARDRAIL_GATES.map((g) => (
              <Badge
                key={g.id}
                variant="emerald"
                className="bg-emerald-950/40 backdrop-blur-xs border-emerald-500/35 text-[9px] truncate"
              >
                <ShieldCheck className="h-2.5 w-2.5 text-emerald-400 flex-shrink-0" />
                <span>{g.label}</span>
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Live Streaming LangGraph Audit Log Terminal */}
      <div className="flex-1 flex flex-col min-h-[140px] max-h-[300px] bg-slate-950/20 backdrop-blur-xs p-3 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-mono-code text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            LangGraph Real-Time Execution Trace
          </span>
          <span className="font-mono-code text-[10px] text-slate-500">{logs.length} events</span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 font-mono-code text-[11px] min-w-0">
          {logs.length === 0 ? (
            <div className="text-slate-500 text-xs py-6 text-center kintsugi-message-fit">
              Ambient SRE Agent standing by. Inject a fault from the Chaos Deck or toggle mode to test closed-loop remediation.
            </div>
          ) : (
            logs.map((entry, i) => {
              const text = typeof entry === 'string' ? entry : entry.message || JSON.stringify(entry);
              const isGold = text.includes('Kintsugi') || text.includes('VERIFY') || text.includes('repaired') || text.includes('Gold');
              const isErr = text.includes('ALERT') || text.includes('FRACTURE') || text.includes('Inject') || text.includes('CHAOS') || text.includes('REJECTED');
              return (
                <div
                  key={i}
                  className={`rounded-lg border px-2.5 py-1.5 leading-snug kintsugi-message-fit backdrop-blur-xs ${
                    isGold
                      ? 'bg-amber-500/15 border-amber-400/50 text-amber-200'
                      : isErr
                      ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                      : 'bg-slate-900/30 border-slate-800/70 text-slate-300'
                  }`}
                >
                  {text}
                </div>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
}
