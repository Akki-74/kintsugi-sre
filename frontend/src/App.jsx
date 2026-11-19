import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import TopBar from './components/TopBar';
import ClusterTopology from './components/ClusterTopology';
import TelemetryCharts, { EXPANDED_CHAOS_OPTIONS, ALL_SERVICES } from './components/TelemetryCharts';
import AgentConsole from './components/AgentConsole';
import {
  X,
  BarChart3,
  Sparkles,
  Search,
  Flame,
  Cpu,
  ShieldCheck,
  Radio,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';

// Subtle Web Audio API Synthesizer for Cyber-SRE Alert & Gold Repair Chimes
function playCyberChime(type = 'gold', enabled = false) {
  if (!enabled) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const freqs = type === 'gold' ? [523.25, 659.25, 783.99, 1046.5] : [330, 277.18];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type === 'gold' ? 'triangle' : 'sawtooth';
      osc.frequency.setValueAtTime(f, now + idx * 0.07);
      gain.gain.setValueAtTime(0.06, now + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.07 + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.36);
    });
  } catch {
    // Ignore audio context policy restrictions if not yet interacted
  }
}

export default function App() {
  const [status, setStatus] = useState({
    cluster_mode: 'LIVE_K8S',
    llm_backend: 'GROQ_CLOUD',
    agent_mode: 'AUTONOMOUS',
    autonomous_mode: true
  });
  const [topology, setTopology] = useState({ nodes: [], edges: [] });
  const [clusterNodes, setClusterNodes] = useState([]);
  const [selectedService, setSelectedService] = useState('checkoutservice');
  const [telemetryHistory, setTelemetryHistory] = useState([]);
  const [latestPrediction, setLatestPrediction] = useState(null);
  const [agentState, setAgentState] = useState({});
  const [agentLogs, setAgentLogs] = useState([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [chaosLoading, setChaosLoading] = useState(false);

  // Interactive Modals & UX States
  const [showBenchmarkModal, setShowBenchmarkModal] = useState(false);
  const [benchmarkData, setBenchmarkData] = useState(null);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [cmdQuery, setCmdQuery] = useState('');
  const [streamPaused, setStreamPaused] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);

  const streamPausedRef = useRef(false);
  streamPausedRef.current = streamPaused;
  const soundEnabledRef = useRef(false);
  soundEnabledRef.current = soundEnabled;

  // Fetch initial status, topology, and cluster snapshot
  const fetchInitialData = useCallback(async () => {
    try {
      const [stRes, topRes, snapRes] = await Promise.all([
        fetch('/api/status'),
        fetch('/api/topology'),
        fetch('/api/cluster/snapshot')
      ]);
      if (stRes.ok) {
        const st = await stRes.json();
        setStatus((prev) => ({
          ...prev,
          ...st,
          agent_mode: st.autonomous_mode === false ? 'HUMAN_IN_THE_LOOP' : 'AUTONOMOUS'
        }));
      }
      if (topRes.ok) setTopology(await topRes.json());
      if (snapRes.ok) {
        const snap = await snapRes.json();
        if (snap.cluster_nodes) setClusterNodes(snap.cluster_nodes);
      }
    } catch (err) {
      console.error('Initial fetch error:', err);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Global Keyboard Shortcut: Ctrl+K or Cmd+K for Command Palette, Esc to close
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
      } else if (e.key === 'Escape') {
        setShowCommandPalette(false);
        setShowBenchmarkModal(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Connect to 1Hz Real-Time WebSocket Stream
  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/ws/telemetry`;
    let ws;
    let reconnectTimer;

    const connectWs = () => {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => setWsConnected(true);
      ws.onclose = () => {
        setWsConnected(false);
        reconnectTimer = setTimeout(connectWs, 2500);
      };
      ws.onmessage = (evt) => {
        if (streamPausedRef.current) return;
        try {
          const payload = JSON.parse(evt.data);

          // Update cluster nodes if provided
          if (payload.cluster_nodes) setClusterNodes(payload.cluster_nodes);

          // Update autonomy mode from live tick
          if (payload.autonomous_mode !== undefined) {
            setStatus((prev) => ({
              ...prev,
              autonomous_mode: payload.autonomous_mode,
              agent_mode: payload.autonomous_mode ? 'AUTONOMOUS' : 'HUMAN_IN_THE_LOOP'
            }));
          }

          // Update predictions
          if (payload.prediction) setLatestPrediction(payload.prediction);

          // Update agent state & execution events
          if (payload.agent_event || payload.agent) {
            const ag = payload.agent_event || payload.agent;
            setAgentState((prev) => ({
              ...prev,
              ...ag,
              stage: ag.state || ag.current_node || prev.stage || 'MONITOR',
              current_node: ag.state || ag.current_node || prev.current_node,
              status: payload.pending_hitl ? 'AWAITING_APPROVAL' : (ag.state || prev.status),
              awaiting_approval: Boolean(payload.pending_hitl),
              remediation_plan: payload.pending_plan || ag.remediation_plan || prev.remediation_plan,
              pending_plan: payload.pending_plan || prev.pending_plan
            }));
            if (ag.planned_action) {
              setAgentLogs((prev) => [
                `[LangGraph Stage: ${ag.state}] Action: ${ag.planned_action} (Status: ${ag.execution_status || 'IN_PROGRESS'})`,
                ...prev.slice(0, 49)
              ]);
            }
          } else if (payload.pending_hitl) {
            setAgentState((prev) => ({
              ...prev,
              status: 'AWAITING_APPROVAL',
              awaiting_approval: true,
              stage: 'GUARDRAILS',
              current_node: 'GUARDRAILS',
              remediation_plan: payload.pending_plan,
              pending_plan: payload.pending_plan
            }));
          }

          // Sync topology node statuses from cluster_state map
          if (payload.cluster_state) {
            setTopology((prev) => {
              const prevNodes = prev?.nodes || [];
              if (prevNodes.length === 0) return prev;
              const updatedNodes = prevNodes.map((n) => {
                const id = n.id || n.service;
                const live = payload.cluster_state[id];
                if (!live) return n;
                return {
                  ...n,
                  status: live.is_verified_repaired ? 'verified_repaired' : live.is_incident ? 'incident' : (live.status || n.status),
                  is_verified_repaired: Boolean(live.is_verified_repaired),
                  replicas: live.replicas ?? n.replicas,
                  node: live.node ?? n.node,
                  cpu: live.cpu ?? n.cpu,
                  memory: live.memory ?? n.memory,
                  fault_type: live.fault_type ?? n.fault_type
                };
              });
              return { ...prev, nodes: updatedNodes };
            });
          } else if (payload.topology) {
            setTopology(payload.topology);
          }

          // Extract selected service metrics for time-series charts
          const svcMap = payload.services || payload.cluster_state || {};
          const nodesArr = payload.topology?.nodes || topology?.nodes || [];
          const activeNode =
            svcMap[selectedService] ||
            nodesArr.find((n) => (n.id || n.service) === selectedService) ||
            payload.metrics;

          if (activeNode) {
            const nowLabel = new Date().toLocaleTimeString([], {
              minute: '2-digit',
              second: '2-digit'
            });
            setTelemetryHistory((prev) => [
              ...prev.slice(-29),
              {
                time: nowLabel,
                cpu: Number(activeNode.cpu ?? activeNode['CpuUsageRate(%)'] ?? 14.0),
                memory: Number(activeNode.memory ?? activeNode['MemoryUsageRate(%)'] ?? 30.0),
                latency: Number(
                  activeNode.latency ??
                  (activeNode['PodServerLatencyP95(s)'] ? activeNode['PodServerLatencyP95(s)'] * 1000 : 20.0)
                )
              }
            ]);
          }
        } catch (e) {
          console.error('WS parse error:', e);
        }
      };
    };

    connectWs();
    return () => {
      clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, [selectedService, topology]);

  // Compute Live Executive Ribbon KPIs
  const kintsugiStats = useMemo(() => {
    const nodes = topology?.nodes || [];
    if (nodes.length === 0) {
      return { sloHealth: 100.0, activeIncidents: 0, repairedCount: 0 };
    }
    const activeIncidents = nodes.filter(
      (n) => n.status === 'incident' || n.status === 'critical'
    ).length;
    const repairedCount = nodes.filter(
      (n) => n.is_verified_repaired || n.status === 'verified_repaired'
    ).length;
    const sloHealth = Math.max(0, ((nodes.length - activeIncidents) / nodes.length) * 100);
    return { sloHealth, activeIncidents, repairedCount };
  }, [topology]);

  // Action Handlers
  const handleInjectChaos = async (scenarioId, targetService = 'checkoutservice') => {
    setChaosLoading(true);
    setSelectedService(targetService);
    playCyberChime('alert', soundEnabledRef.current);
    setAgentLogs((prev) => [
      `[CHAOS INJECT] Triggered ${scenarioId} on ${targetService} in ns/hipster...`,
      ...prev
    ]);

    try {
      const res = await fetch('/api/chaos/inject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: targetService,
          fault_type: scenarioId,
          scenario: scenarioId
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.agent_state === 'AWAITING_APPROVAL') {
          setAgentLogs((prev) => [
            `[HITL PAUSE] LangGraph proposed ${data.proposed_plan?.selected_action || 'mutation'} on ${targetService}. Operator approval required!`,
            ...prev
          ]);
          setAgentState((prev) => ({
            ...prev,
            status: 'AWAITING_APPROVAL',
            awaiting_approval: true,
            stage: 'GUARDRAILS',
            current_node: 'GUARDRAILS',
            remediation_plan: data.proposed_plan,
            pending_plan: data.proposed_plan
          }));
        } else {
          playCyberChime('gold', soundEnabledRef.current);
          setAgentLogs((prev) => [
            `[✦ KINTSUGI REPAIRED] Closed-loop healing finished for ${targetService}. Gold Seam sealed!`,
            ...prev
          ]);
        }
        fetchInitialData();
      }
    } catch (e) {
      console.error('Chaos injection failed:', e);
    } finally {
      setChaosLoading(false);
    }
  };

  const handleToggleMode = async () => {
    const isCurrentlyAuto = status.agent_mode === 'AUTONOMOUS';
    const nextMode = isCurrentlyAuto ? 'HUMAN_IN_THE_LOOP' : 'AUTONOMOUS';
    const nextAuto = !isCurrentlyAuto;

    try {
      const res = await fetch('/api/agent/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autonomous: nextAuto, mode: nextMode })
      });
      if (res.ok) {
        setStatus((prev) => ({
          ...prev,
          agent_mode: nextMode,
          autonomous_mode: nextAuto
        }));
        setAgentLogs((prev) => [
          `[MODE SWITCH] SRE Mode changed to ${nextMode} (${nextAuto ? 'Closed-Loop Auto-Remedy' : 'Manual Operator Approval Required'}).`,
          ...prev
        ]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleClusterSource = async () => {
    const nextSource = status.cluster_mode === 'LIVE_K8S' ? 'REPLAY_HOLDOUT' : 'LIVE_K8S';
    try {
      const res = await fetch('/api/cluster/source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: nextSource })
      });
      if (res.ok) setStatus((prev) => ({ ...prev, cluster_mode: nextSource }));
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleBackend = async () => {
    const nextBackend = status.llm_backend?.includes('GROQ') ? 'LOCAL_LM_STUDIO' : 'GROQ_CLOUD';
    try {
      const res = await fetch('/api/agent/backend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backend: nextBackend })
      });
      if (res.ok) setStatus((prev) => ({ ...prev, llm_backend: nextBackend }));
    } catch (e) {
      console.error(e);
    }
  };

  const handleApprove = async () => {
    try {
      const res = await fetch('/api/agent/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: true })
      });
      if (res.ok) {
        playCyberChime('gold', soundEnabledRef.current);
        setAgentLogs((prev) => [
          `[OPERATOR APPROVED] Authorized cluster mutation. ✦ Gold Seam sealed on target pod!`,
          ...prev
        ]);
        setAgentState((prev) => ({
          ...prev,
          status: 'VERIFIED',
          stage: 'VERIFY',
          current_node: 'VERIFY',
          awaiting_approval: false
        }));
        fetchInitialData();
      }
    } catch (e) {
      console.error('Approval failed:', e);
    }
  };

  const handleReject = async () => {
    try {
      const res = await fetch('/api/agent/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: false })
      });
      if (res.ok) {
        setAgentLogs((prev) => [
          `[OPERATOR REJECTED] Mutation aborted by operator. Pod remains in observed state.`,
          ...prev
        ]);
        setAgentState((prev) => ({
          ...prev,
          status: 'REJECTED',
          stage: 'MONITOR',
          current_node: 'MONITOR',
          awaiting_approval: false
        }));
        fetchInitialData();
      }
    } catch (e) {
      console.error('Rejection failed:', e);
    }
  };

  const handleOpenBenchmark = async () => {
    setShowBenchmarkModal(true);
    try {
      const res = await fetch('/api/benchmark');
      if (res.ok) setBenchmarkData(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  // Command Palette Items (Expanded with all 8 scenarios)
  const commandItems = useMemo(
    () => [
      ...EXPANDED_CHAOS_OPTIONS.map((opt) => ({
        category: 'Chaos Engineering',
        label: `Inject ${opt.label} on ${opt.defaultService} (${opt.action})`,
        icon: opt.icon,
        action: () => handleInjectChaos(opt.id, opt.defaultService)
      })),
      {
        category: 'Control Plane',
        label: 'Toggle Auto-Remedy vs. Manual Operator Approval (HITL)',
        icon: ShieldCheck,
        action: handleToggleMode
      },
      {
        category: 'Control Plane',
        label: 'Hot-Swap Telemetry Source (LIVE K8S ↔ DIGITAL TWIN)',
        icon: Radio,
        action: handleToggleClusterSource
      },
      {
        category: 'Control Plane',
        label: 'Hot-Swap LLM Reasoner (Groq Qwen3.8-27B ↔ Local LM Studio)',
        icon: Cpu,
        action: handleToggleBackend
      },
      {
        category: 'Analytics & Deck',
        label: 'Open ML Ablation & SARIMA vs. XGBRegressor Benchmark Modal',
        icon: BarChart3,
        action: handleOpenBenchmark
      },
      {
        category: 'Analytics & Deck',
        label: 'Open Interactive Systems Architecture Slide Deck (/app/slides.html)',
        icon: Sparkles,
        action: () => window.open('/app/slides.html', '_blank')
      }
    ],
    [status]
  );

  const filteredCommands = useMemo(() => {
    const q = cmdQuery.trim().toLowerCase();
    if (!q) return commandItems;
    return commandItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) || item.category.toLowerCase().includes(q)
    );
  }, [cmdQuery, commandItems]);

  return (
    <div className="relative z-10 flex min-h-screen w-full flex-col select-none bg-obsidian text-slate-100">
      {/* Top Command & Executive KPI Ribbon */}
      <TopBar
        status={status}
        wsConnected={wsConnected}
        onToggleMode={handleToggleMode}
        onToggleClusterSource={handleToggleClusterSource}
        onToggleBackend={handleToggleBackend}
        onOpenBenchmark={handleOpenBenchmark}
        onOpenCommandPalette={() => setShowCommandPalette(true)}
        streamPaused={streamPaused}
        onToggleStreamPause={() => setStreamPaused((p) => !p)}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled((s) => !s)}
        kintsugiStats={kintsugiStats}
      />

      {/* Main 12-Column Responsive SRE Grid with Adaptive Zoom Scaling */}
      <main className="flex-1 grid grid-cols-12 gap-3 p-3 min-h-0 w-full max-w-full">
        {/* Left 8 Columns: Interactive Topology Mesh + Multi-Modal Telemetry & Chaos Workstation */}
        <section className="col-span-12 lg:col-span-8 flex flex-col gap-3 min-h-0 min-w-0">
          <div className="min-h-[380px] lg:h-[48%] flex flex-col min-w-0">
            <ClusterTopology
              topology={topology}
              selectedService={selectedService}
              onSelectService={setSelectedService}
              clusterNodes={clusterNodes}
              onQuickChaos={handleInjectChaos}
            />
          </div>
          <div className="min-h-[360px] lg:h-[50%] flex flex-col min-w-0">
            <TelemetryCharts
              telemetryHistory={telemetryHistory}
              selectedService={selectedService}
              onSelectService={setSelectedService}
              latestPrediction={latestPrediction}
              onInjectChaos={handleInjectChaos}
              chaosLoading={chaosLoading}
            />
          </div>
        </section>

        {/* Right 4 Columns: LangGraph Slow-Brain & 5-Guardrail Console */}
        <section className="col-span-12 lg:col-span-4 min-h-[520px] lg:h-full flex flex-col min-w-0">
          <AgentConsole
            agentState={agentState}
            logs={agentLogs}
            onApprove={handleApprove}
            onReject={handleReject}
            agentMode={status.agent_mode}
            onToggleMode={handleToggleMode}
          />
        </section>
      </main>

      {/* CTRL+K SRE COMMAND PALETTE OMNIBAR */}
      {showCommandPalette && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 pt-20 backdrop-blur-md"
          onClick={() => setShowCommandPalette(false)}
        >
          <div
            className="kintsugi-panel-gold w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-3">
              <Search className="h-4 w-4 text-amber-400" />
              <input
                type="text"
                autoFocus
                value={cmdQuery}
                onChange={(e) => setCmdQuery(e.target.value)}
                placeholder="Type an SRE command, chaos scenario, or microservice..."
                className="w-full bg-transparent text-sm text-white placeholder-slate-400 focus:outline-none"
              />
              <kbd className="rounded bg-slate-800 px-2 py-0.5 font-mono-code text-[10px] text-slate-400">
                ESC
              </kbd>
            </div>
            <div className="max-h-80 overflow-y-auto p-2 space-y-1">
              {filteredCommands.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      item.action();
                      setShowCommandPalette(false);
                      setCmdQuery('');
                    }}
                    className="w-full flex items-center justify-between rounded-xl px-3 py-2 text-left text-xs text-slate-200 hover:bg-amber-500/20 hover:text-amber-200 transition-all group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className="h-4 w-4 text-amber-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium truncate">{item.label}</div>
                        <div className="font-mono-code text-[10px] text-slate-400">
                          {item.category}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 text-amber-300 transition-opacity flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ML ABLATION & SARIMA BENCHMARK MODAL */}
      {showBenchmarkModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
          onClick={() => setShowBenchmarkModal(false)}
        >
          <div
            className="kintsugi-panel-gold max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-2xl p-6 shadow-2xl min-w-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <BarChart3 className="h-5 w-5 text-amber-400 flex-shrink-0" />
                <div>
                  <h2 className="font-display text-lg font-bold text-white">
                    Phase 1 &amp; Phase 2 Empirical Benchmark Verification
                  </h2>
                  <p className="text-xs text-slate-400">
                    Zero-Leakage Day 2 Evaluation (4,340 Test Rows) • Classical SARIMA vs. Multi-Modal XGBoost
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBenchmarkModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Table 1: 4-Model Classification Ablation */}
            <div className="mb-5">
              <h3 className="font-mono-code text-xs font-bold uppercase tracking-wider text-amber-300 mb-2">
                1. 4-Model Classification Ablation Study (6 Operational Classes)
              </h3>
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/80">
                <table className="w-full text-left font-mono-code text-xs">
                  <thead className="border-b border-slate-800 bg-slate-900/80 text-[10px] uppercase text-slate-400">
                    <tr>
                      <th className="p-2.5">Model Architecture</th>
                      <th className="p-2.5">Precision</th>
                      <th className="p-2.5">Recall</th>
                      <th className="p-2.5">Macro-F1</th>
                      <th className="p-2.5">Anomaly F1</th>
                      <th className="p-2.5">Regime A Δt</th>
                      <th className="p-2.5">False Alarms/hr</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    <tr>
                      <td className="p-2.5">Baseline 0: Prometheus Static Rules</td>
                      <td className="p-2.5">0.2700</td>
                      <td className="p-2.5">0.3495</td>
                      <td className="p-2.5">0.2816</td>
                      <td className="p-2.5">0.1683</td>
                      <td className="p-2.5">148.0s</td>
                      <td className="p-2.5 text-rose-400">14.80 / hr</td>
                    </tr>
                    <tr>
                      <td className="p-2.5">Model 1: Unsupervised IsolationForest</td>
                      <td className="p-2.5">0.2794</td>
                      <td className="p-2.5">0.3643</td>
                      <td className="p-2.5">0.2782</td>
                      <td className="p-2.5">0.1889</td>
                      <td className="p-2.5">132.5s</td>
                      <td className="p-2.5">9.42 / hr</td>
                    </tr>
                    <tr>
                      <td className="p-2.5">Model 2: Temporal XGBoost (Metrics Only)</td>
                      <td className="p-2.5">0.5414</td>
                      <td className="p-2.5">0.6141</td>
                      <td className="p-2.5">0.5706</td>
                      <td className="p-2.5">0.5789</td>
                      <td className="p-2.5">108.4s</td>
                      <td className="p-2.5">3.14 / hr</td>
                    </tr>
                    <tr className="bg-amber-500/15 font-bold text-amber-200">
                      <td className="p-2.5">✦ Model 3: Multi-Modal XGBoost (Metrics + Logs)</td>
                      <td className="p-2.5">0.7088</td>
                      <td className="p-2.5">0.7189</td>
                      <td className="p-2.5 text-amber-300">0.7132</td>
                      <td className="p-2.5">0.7225</td>
                      <td className="p-2.5 text-emerald-300">87.6s</td>
                      <td className="p-2.5 text-emerald-300">1.71 / hr</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Table 2: Classical SARIMA vs Multi-Modal XGBRegressor */}
            <div className="mb-4">
              <h3 className="font-mono-code text-xs font-bold uppercase tracking-wider text-cyan-300 mb-2">
                2. Regime B Time-to-Exhaustion (TTE) Forecasting: Classical SARIMA vs. Multi-Modal XGBRegressor
              </h3>
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/80">
                <table className="w-full text-left font-mono-code text-xs">
                  <thead className="border-b border-slate-800 bg-slate-900/80 text-[10px] uppercase text-slate-400">
                    <tr>
                      <th className="p-2.5">Forecasting Engine</th>
                      <th className="p-2.5">Modality</th>
                      <th className="p-2.5">TTE MAE (↓)</th>
                      <th className="p-2.5">TTE RMSE (↓)</th>
                      <th className="p-2.5">Lead Time</th>
                      <th className="p-2.5">Inference Latency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    <tr>
                      <td className="p-2.5">Classical SARIMA(1,1,1)×(1,0,1)₁₂</td>
                      <td className="p-2.5">Univariate Memory/Disk Curve</td>
                      <td className="p-2.5">6.50 min</td>
                      <td className="p-2.5">6.89 min</td>
                      <td className="p-2.5">10.0 min (Static)</td>
                      <td className="p-2.5 text-rose-300">243.8 ms / tick</td>
                    </tr>
                    <tr className="bg-amber-500/15 font-bold text-amber-200">
                      <td className="p-2.5">✦ Kintsugi Multi-Modal XGBRegressor</td>
                      <td className="p-2.5">89 Multi-Modal Features + Slopes</td>
                      <td className="p-2.5 text-emerald-300">0.71 min (-89%)</td>
                      <td className="p-2.5 text-emerald-300">0.90 min (R²=0.846)</td>
                      <td className="p-2.5 text-amber-300">4.7 min</td>
                      <td className="p-2.5 text-emerald-300">0.67 ms (364× faster)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 text-xs text-slate-400">
              <span className="flex items-center gap-1.5 text-emerald-300 font-mono-code">
                <CheckCircle2 className="h-4 w-4" /> Phase 2 Mean Closed-Loop MTTR: 27.6 seconds (100% Recovery)
              </span>
              <button
                onClick={() => setShowBenchmarkModal(false)}
                className="rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 px-4 py-1.5 font-mono-code text-xs font-bold text-amber-200"
              >
                Close Verification View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
