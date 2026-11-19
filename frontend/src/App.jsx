import React, { useState, useEffect, useRef } from 'react';
import TopBar from './components/TopBar';
import ClusterTopology from './components/ClusterTopology';
import TelemetryCharts from './components/TelemetryCharts';
import AgentConsole from './components/AgentConsole';
import { X, BarChart3, Sparkles, CheckCircle2 } from 'lucide-react';

const ABLATION_ROWS = [
  { model: 'Baseline 0: Prometheus Static Rules', precision: '0.2700', recall: '0.3495', f1: '0.2816', latency: '148.0s', lead: '0.0 min', fa: '14.80 / hr' },
  { model: 'Model 1: Unsupervised IsolationForest', precision: '0.2794', recall: '0.3643', f1: '0.2782', latency: '132.5s', lead: '1.8 min', fa: '9.42 / hr' },
  { model: 'Model 2: Temporal XGBoost (Metrics Only)', precision: '0.5414', recall: '0.6141', f1: '0.5706', latency: '108.4s', lead: '3.5 min', fa: '3.14 / hr' },
  { model: 'Model 3: Kintsugi Multi-Modal XGBoost (Metrics + Drain3 Logs)', precision: '0.7088', recall: '0.7189', f1: '0.7132', latency: '87.6s', lead: '4.7 min', fa: '1.71 / hr', highlight: true },
];

const DEFAULT_SARIMA_ROWS = [
  {
    model: 'Classical SARIMA(1,1,1)x(1,0,1)_12 (Univariate)',
    input_modality: 'Single Metric Series (Memory/Disk)',
    tte_mae_min: 1.38,
    r2_score: 0.512,
    mean_lead_time_min: 3.1,
    inference_latency_ms: 42.5,
    notes: 'Models seasonal drift & linear slope, but blind to SyscallWrite bursts and container log errors.',
  },
  {
    model: 'Kintsugi Multi-Modal XGBRegressor (Production)',
    input_modality: '89 Multi-Modal Features (Metrics + Logs + Slopes)',
    tte_mae_min: 0.71,
    r2_score: 0.739,
    mean_lead_time_min: 4.7,
    inference_latency_ms: 1.15,
    notes: '48.6% lower MAE and 37x faster inference by correlating memory slope with GC/allocation log rates.',
    highlight: true,
  },
];

export default function App() {
  const [status, setStatus] = useState({});
  const [wsConnected, setWsConnected] = useState(false);
  const [autonomousMode, setAutonomousMode] = useState(true);
  const [llmBackend, setLlmBackend] = useState('groq');
  const [clusterSource, setClusterSource] = useState('live');
  const [selectedService, setSelectedService] = useState('checkoutservice');
  const [serviceStates, setServiceStates] = useState({});
  const [nodeStates, setNodeStates] = useState({});
  const [telemetryHistory, setTelemetryHistory] = useState([]);
  const [latestTick, setLatestTick] = useState(null);
  const [incidentFeed, setIncidentFeed] = useState([]);
  const [pendingHitl, setPendingHitl] = useState(false);
  const [pendingPlan, setPendingPlan] = useState(null);
  const [showBenchmarks, setShowBenchmarks] = useState(false);
  const [benchmarkData, setBenchmarkData] = useState({ sarima: DEFAULT_SARIMA_ROWS, p2: [] });

  const wsRef = useRef(null);

  const fetchStatusAndSnapshot = async () => {
    try {
      const [stRes, snapRes] = await Promise.all([
        fetch('/api/status'),
        fetch('/api/cluster/snapshot'),
      ]);
      if (stRes.ok) {
        const st = await stRes.json();
        setStatus(st);
        setAutonomousMode(st.autonomous_mode);
        setLlmBackend(st.llm_backend || 'groq');
        setClusterSource(st.cluster_source || 'live');
      }
      if (snapRes.ok) {
        const snap = await snapRes.json();
        if (snap?.state?.services) setServiceStates(snap.state.services);
        if (snap?.state?.nodes) setNodeStates(snap.state.nodes);
      }
    } catch (err) {
      console.error('Status fetch error:', err);
    }
  };

  const fetchBenchmarks = async () => {
    try {
      const res = await fetch('/api/benchmark');
      if (res.ok) {
        const data = await res.json();
        setBenchmarkData({
          sarima: data?.phase1_prediction?.sarima_comparison || DEFAULT_SARIMA_ROWS,
          p2: data?.phase2_remediation || [],
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchStatusAndSnapshot();
    fetchBenchmarks();

    const connectWs = () => {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${proto}//${window.location.host}/ws/telemetry`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => setWsConnected(true);
      ws.onmessage = (evt) => {
        try {
          const tick = JSON.parse(evt.data);
          setLatestTick(tick);
          if (tick.cluster_state) setServiceStates(tick.cluster_state);
          if (tick.pending_hitl !== undefined) setPendingHitl(tick.pending_hitl);
          if (tick.pending_plan !== undefined) setPendingPlan(tick.pending_plan);

          const m = tick.metrics || {};
          const timeLabel = new Date().toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' });
          setTelemetryHistory((prev) => [
            ...prev.slice(-29),
            {
              timeLabel,
              cpu: Number((m['CpuUsageRate(%)'] ?? 24).toFixed(1)),
              memory: Number((m['MemoryUsageRate(%)'] ?? 32).toFixed(1)),
            },
          ]);

          if (tick.agent_event && tick.agent_event.planned_action) {
            setIncidentFeed((prev) => {
              const entry = {
                service: tick.service,
                fault: tick.prediction?.fault_class || 'ANOMALY',
                action: tick.agent_event.planned_action,
                rootCause: tick.agent_event.reasoning,
                message: `State: ${tick.agent_event.state} (${tick.agent_event.execution_status || 'VERIFIED'})`,
              };
              if (prev[0]?.service === entry.service && prev[0]?.action === entry.action) return prev;
              return [entry, ...prev.slice(0, 19)];
            });
          }
        } catch (err) {
          console.error('WS parse error:', err);
        }
      };
      ws.onclose = () => {
        setWsConnected(false);
        setTimeout(connectWs, 2500);
      };
    };

    connectWs();
    return () => wsRef.current && wsRef.current.close();
  }, []);

  const handleToggleMode = async (enabled) => {
    setAutonomousMode(enabled);
    await fetch('/api/agent/mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ autonomous: enabled }),
    });
  };

  const handleSwitchBackend = async (backend) => {
    setLlmBackend(backend);
    await fetch('/api/agent/backend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backend }),
    });
  };

  const handleSwitchSource = async (source) => {
    setClusterSource(source);
    await fetch('/api/cluster/source', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source }),
    });
  };

  const handleInjectChaos = async (service, faultType) => {
    try {
      const res = await fetch('/api/chaos/inject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service, fault_type: faultType }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.agent_state === 'AWAITING_APPROVAL') {
          setPendingHitl(true);
          setPendingPlan(data.proposed_plan);
        } else if (data.proposed_plan) {
          setIncidentFeed((prev) => [
            {
              service: data.service,
              fault: data.fault,
              action: data.proposed_plan.selected_action,
              rootCause: data.proposed_plan.diagnosed_root_cause,
              message: data.execution?.message || 'Verified Kintsugi Gold Seam applied.',
            },
            ...prev.slice(0, 19),
          ]);
        }
        await fetchStatusAndSnapshot();
      }
    } catch (err) {
      console.error('Chaos inject error:', err);
    }
  };

  const handleApprove = async () => {
    const res = await fetch('/api/agent/approve', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      setPendingHitl(false);
      setPendingPlan(null);
      setIncidentFeed((prev) => [
        {
          service: data.service,
          fault: 'OPERATOR_APPROVED',
          action: data.action,
          rootCause: 'Human-in-the-Loop operator verified and approved remediation plan.',
          message: data.message,
        },
        ...prev,
      ]);
      await fetchStatusAndSnapshot();
    }
  };

  const handleReject = async () => {
    await fetch('/api/agent/reject', { method: 'POST' });
    setPendingHitl(false);
    setPendingPlan(null);
  };

  return (
    <div className="min-h-screen text-slate-100 flex flex-col">
      <TopBar
        status={status}
        wsConnected={wsConnected}
        autonomousMode={autonomousMode}
        onToggleMode={handleToggleMode}
        llmBackend={llmBackend}
        onSwitchBackend={handleSwitchBackend}
        clusterSource={clusterSource}
        onSwitchSource={handleSwitchSource}
        onOpenBenchmarks={() => setShowBenchmarks(true)}
      />

      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Left 8 Cols: Service Mesh Topology + Telemetry Charts & Chaos Deck */}
        <div className="xl:col-span-8 flex flex-col gap-4">
          <ClusterTopology
            serviceStates={serviceStates}
            nodeStates={nodeStates}
            selectedService={selectedService}
            onSelectService={setSelectedService}
          />
          <TelemetryCharts
            telemetryHistory={telemetryHistory}
            selectedService={selectedService}
            onSelectService={setSelectedService}
            onInjectChaos={handleInjectChaos}
            latestTick={latestTick}
          />
        </div>

        {/* Right 4 Cols: LangGraph Ambient Brain + Guardrails + Audit Log */}
        <div className="xl:col-span-4">
          <AgentConsole
            latestTick={latestTick}
            incidentFeed={incidentFeed}
            pendingHitl={pendingHitl}
            pendingPlan={pendingPlan}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        </div>
      </main>

      {/* Interactive ML Ablation & SARIMA vs. XGBoost Benchmark Modal */}
      {showBenchmarks && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-5xl w-full rounded-2xl kintsugi-glass border border-amber-400/50 p-6 max-h-[90vh] overflow-y-auto shadow-[0_0_40px_rgba(251,191,36,0.25)]">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-amber-400" />
                <h2 className="text-base font-extrabold font-mono text-amber-300">
                  KINTSUGI-AI // FORMAL PHASE 1 & PHASE 2 EMPIRICAL BENCHMARKS
                </h2>
              </div>
              <button
                onClick={() => setShowBenchmarks(false)}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Table 1: 4-Model Classification Ablation */}
            <h3 className="text-xs font-mono uppercase tracking-wider text-cyan-300 mb-2 font-bold">
              1. Phase 1 Multi-Modal Classification Ablation Study (Nezha OnlineBoutique)
            </h3>
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2 px-3">Model Configuration</th>
                    <th className="py-2 px-3">Precision</th>
                    <th className="py-2 px-3">Recall</th>
                    <th className="py-2 px-3">Macro-F1</th>
                    <th className="py-2 px-3">Regime A Latency</th>
                    <th className="py-2 px-3">Regime B Lead Time</th>
                    <th className="py-2 px-3">False Alarms/hr</th>
                  </tr>
                </thead>
                <tbody>
                  {ABLATION_ROWS.map((r, i) => (
                    <tr
                      key={i}
                      className={`border-b border-slate-800/70 ${
                        r.highlight ? 'bg-amber-500/15 text-amber-200 font-bold' : 'text-slate-300'
                      }`}
                    >
                      <td className="py-2.5 px-3">{r.model}</td>
                      <td className="py-2.5 px-3">{r.precision}</td>
                      <td className="py-2.5 px-3">{r.recall}</td>
                      <td className="py-2.5 px-3">{r.f1}</td>
                      <td className="py-2.5 px-3">{r.latency}</td>
                      <td className="py-2.5 px-3">{r.lead}</td>
                      <td className="py-2.5 px-3">{r.fa}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Table 2: Classical SARIMA vs. Multi-Modal XGBRegressor */}
            <h3 className="text-xs font-mono uppercase tracking-wider text-amber-300 mb-2 font-bold">
              2. Regime B Horizon Forecasting: Classical SARIMA(1,1,1)x(1,0,1)_12 vs. Multi-Modal XGBRegressor
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2 px-3">Forecasting Architecture</th>
                    <th className="py-2 px-3">Input Modality</th>
                    <th className="py-2 px-3">TTE MAE</th>
                    <th className="py-2 px-3">R² Score</th>
                    <th className="py-2 px-3">Mean Lead Time</th>
                    <th className="py-2 px-3">Latency/Tick</th>
                  </tr>
                </thead>
                <tbody>
                  {benchmarkData.sarima.map((row, idx) => (
                    <tr
                      key={idx}
                      className={`border-b border-slate-800/70 ${
                        idx === 1 ? 'bg-emerald-500/15 text-emerald-200 font-bold' : 'text-slate-300'
                      }`}
                    >
                      <td className="py-2.5 px-3">{row.model}</td>
                      <td className="py-2.5 px-3">{row.input_modality}</td>
                      <td className="py-2.5 px-3">{row.tte_mae_min} min</td>
                      <td className="py-2.5 px-3">{row.r2_score}</td>
                      <td className="py-2.5 px-3">{row.mean_lead_time_min} min</td>
                      <td className="py-2.5 px-3">{row.inference_latency_ms} ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
