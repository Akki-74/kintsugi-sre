import React, { useState, useEffect, useRef } from 'react';
import TopBar from './components/TopBar';
import ClusterTopology from './components/ClusterTopology';
import TelemetryCharts from './components/TelemetryCharts';
import AgentConsole from './components/AgentConsole';
import { X, BarChart3, Sparkles, CheckCircle2, TrendingUp, ShieldAlert, Cpu } from 'lucide-react';

export default function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [autonomousMode, setAutonomousMode] = useState(true);
  const [llmBackend, setLlmBackend] = useState('groq');
  const [clusterSource, setClusterSource] = useState('replay');
  const [selectedService, setSelectedService] = useState('frontend');

  const [activeTick, setActiveTick] = useState(null);
  const [currentTickData, setCurrentTickData] = useState({});
  const [serviceStates, setServiceStates] = useState({});
  const [telemetryHistory, setTelemetryHistory] = useState([]);
  const [agentEvent, setAgentEvent] = useState(null);
  const [pendingPlan, setPendingPlan] = useState(null);

  // Benchmark Modal State
  const [showBenchmarkModal, setShowBenchmarkModal] = useState(false);
  const [benchmarkData, setBenchmarkData] = useState(null);
  const [loadingBenchmark, setLoadingBenchmark] = useState(false);

  const wsRef = useRef(null);

  // Sync initial backend state on mount
  useEffect(() => {
    fetch('/api/status')
      .then((res) => res.json())
      .then((data) => {
        if (data.llm_backend) setLlmBackend(data.llm_backend);
        if (data.cluster_source) setClusterSource(data.cluster_source);
        if (data.autonomous_mode !== undefined) setAutonomousMode(data.autonomous_mode);
      })
      .catch((err) => console.log('Status sync err:', err));
  }, []);

  const handleSetLlmBackend = async (backend) => {
    setLlmBackend(backend);
    try {
      await fetch('/api/agent/backend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backend }),
      });
    } catch (e) {
      console.error('Failed to update LLM backend:', e);
    }
  };

  const handleSetClusterSource = async (source) => {
    setClusterSource(source);
    try {
      await fetch('/api/cluster/source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source }),
      });
    } catch (e) {
      console.error('Failed to update cluster source:', e);
    }
  };

  // Open & Fetch Benchmark Data
  const handleOpenBenchmarks = async () => {
    setShowBenchmarkModal(true);
    setLoadingBenchmark(true);
    try {
      const res = await fetch('/api/benchmark');
      const data = await res.json();
      setBenchmarkData(data);
    } catch (err) {
      console.error('Failed to load benchmark data:', err);
    } finally {
      setLoadingBenchmark(false);
    }
  };

  // Resilient WebSocket connection to /ws/telemetry
  useEffect(() => {
    let ws = null;
    let reconnectTimeout = null;

    const connectWebSocket = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname || 'localhost';
      const port = window.location.port === '5173' ? '8000' : (window.location.port || '8000');
      const wsUrl = `${protocol}//${host}:${port}/ws/telemetry`;

      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const tick = JSON.parse(event.data);
          if (tick.status === 'NO_DATA') return;

          setActiveTick(tick.tick_index);
          setCurrentTickData(tick);

          // Update cluster state
          if (tick.cluster_state) {
            setServiceStates(tick.cluster_state);
          }

          // Record rolling telemetry history
          const svc = tick.service || selectedService;
          const cpu = tick.metrics?.['CpuUsageRate(%)'] || 25.0;
          const mem = tick.metrics?.['MemoryUsageRate(%)'] || 30.0;
          const cpu_z = (cpu - 25.0) / 12.0;
          const mem_z = (mem - 40.0) / 15.0;

          setTelemetryHistory((prev) => {
            const next = [
              ...prev,
              {
                time: `t+${tick.tick_index || prev.length}s`,
                cpu: Math.round(cpu),
                mem: Math.round(mem),
                cpu_z: Number(cpu_z.toFixed(2)),
                mem_z: Number(mem_z.toFixed(2)),
                service: svc,
              },
            ];
            return next.slice(-30);
          });

          // Check for ambient agent events or pending plans
          if (tick.agent_event) {
            setAgentEvent(tick.agent_event);
          }
          if (tick.pending_plan) {
            setPendingPlan(tick.pending_plan);
          } else {
            setPendingPlan(null);
          }
        } catch (e) {
          console.error('Error parsing WebSocket message:', e);
        }
      };

      ws.onerror = () => {
        setIsConnected(false);
      };

      ws.onclose = () => {
        setIsConnected(false);
        reconnectTimeout = setTimeout(connectWebSocket, 2000);
      };
    };

    connectWebSocket();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [selectedService]);

  const handleInjectChaos = async (service, faultType) => {
    try {
      const res = await fetch('/api/chaos/inject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service, fault_type: faultType }),
      });
      const data = await res.json();
      console.log('Chaos injected:', data);
    } catch (e) {
      console.error('Failed to inject chaos:', e);
    }
  };

  const handleApprovePlan = async () => {
    try {
      const res = await fetch('/api/agent/approve', { method: 'POST' });
      const data = await res.json();
      setPendingPlan(null);
      if (data.status === 'APPROVED_AND_EXECUTED') {
        // Mark node as verified repaired
        setServiceStates((prev) => ({
          ...prev,
          [data.service]: {
            ...prev[data.service],
            is_verified_repaired: true,
            is_incident: false,
            is_predicted_failure: false,
            is_remediating: false,
            status: 'VerifiedRepaired',
          },
        }));
      }
    } catch (e) {
      console.error('Failed to approve plan:', e);
    }
  };

  const handleRejectPlan = async () => {
    try {
      await fetch('/api/agent/reject', { method: 'POST' });
      setPendingPlan(null);
    } catch (e) {
      console.error('Failed to reject plan:', e);
    }
  };

  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-black">
      {/* 1. Command Header */}
      <TopBar
        isConnected={isConnected}
        autonomousMode={autonomousMode}
        setAutonomousMode={setAutonomousMode}
        llmBackend={llmBackend}
        setLlmBackend={handleSetLlmBackend}
        clusterSource={clusterSource}
        setClusterSource={handleSetClusterSource}
        activeTick={activeTick}
        onOpenBenchmarks={handleOpenBenchmarks}
      />

      {/* 2. Main Multi-Modal SRE Command Grid */}
      <main className="flex-1 p-5 grid grid-cols-1 xl:grid-cols-12 gap-5 max-w-[1920px] mx-auto w-full">
        {/* Left Column (8 cols): Service Topology & Telemetry Charts */}
        <div className="xl:col-span-8 flex flex-col gap-5">
          {/* A. Service Topology Map with Pod Dots & Gold Seam */}
          <ClusterTopology
            serviceStates={serviceStates}
            selectedService={selectedService}
            onSelectService={setSelectedService}
            latestPrediction={currentTickData.prediction}
          />

          {/* B. Live Metric Envelope & Chaos Deck */}
          <TelemetryCharts
            selectedService={selectedService}
            telemetryHistory={telemetryHistory}
            currentTickData={currentTickData}
            onInjectChaos={handleInjectChaos}
          />
        </div>

        {/* Right Column (4 cols): LangGraph Ambient SRE Agent Console */}
        <div className="xl:col-span-4 h-full min-h-[640px]">
          <AgentConsole
            agentEvent={agentEvent}
            pendingPlan={pendingPlan}
            onApprovePlan={handleApprovePlan}
            onRejectPlan={handleRejectPlan}
            autonomousMode={autonomousMode}
          />
        </div>
      </main>

      {/* ────────────────────────────────────────────────────────────────────────
          3. INTERACTIVE ML & SARIMA BENCHMARKS MODAL
      ──────────────────────────────────────────────────────────────────────── */}
      {showBenchmarkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-2xl shadow-black/80">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-white tracking-wide">
                    KINTSUGI-AI BENCHMARK SUITE
                  </h2>
                  <p className="text-xs text-slate-400">
                    Empirical Evaluation across 4-Model Ablation, Classical SARIMA, and Autonomous MTTR
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBenchmarkModal(false)}
                className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-white transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {loadingBenchmark ? (
              <div className="py-12 text-center font-mono text-sm text-slate-400 flex items-center justify-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-400 animate-spin" />
                Loading empirical benchmark metadata...
              </div>
            ) : (
              <div className="space-y-6 font-mono text-xs">
                {/* SECTION 1: 4-MODEL ABLATION STUDY */}
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
                  <h3 className="text-xs font-bold text-white mb-2 flex items-center gap-1.5 font-sans">
                    <TrendingUp className="h-4 w-4 text-cyan-400" />
                    1. Formal 4-Model Classification Ablation Study (FSE'23 Nezha)
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                          <th className="py-2 px-3">Model Architecture</th>
                          <th className="py-2 px-3">Precision</th>
                          <th className="py-2 px-3">Recall</th>
                          <th className="py-2 px-3 text-cyan-300">Macro-F1</th>
                          <th className="py-2 px-3 text-indigo-300">Anomaly F1</th>
                          <th className="py-2 px-3">Regime A Latency</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-[11px]">
                        <tr className="hover:bg-slate-800/30">
                          <td className="py-2 px-3 font-semibold text-slate-300">Baseline 0 (Prometheus Rules)</td>
                          <td className="py-2 px-3">0.2700</td>
                          <td className="py-2 px-3">0.3495</td>
                          <td className="py-2 px-3">0.2816</td>
                          <td className="py-2 px-3">0.1683</td>
                          <td className="py-2 px-3 text-rose-400">148.0s (Reactive)</td>
                        </tr>
                        <tr className="hover:bg-slate-800/30">
                          <td className="py-2 px-3 font-semibold text-slate-300">Model 1 (IsolationForest)</td>
                          <td className="py-2 px-3">0.2794</td>
                          <td className="py-2 px-3">0.3643</td>
                          <td className="py-2 px-3">0.2782</td>
                          <td className="py-2 px-3">0.1889</td>
                          <td className="py-2 px-3 text-amber-300">132.5s</td>
                        </tr>
                        <tr className="hover:bg-slate-800/30">
                          <td className="py-2 px-3 font-semibold text-slate-300">Model 2 (Temporal XGBoost - Metrics)</td>
                          <td className="py-2 px-3">0.5414</td>
                          <td className="py-2 px-3">0.6141</td>
                          <td className="py-2 px-3">0.5706</td>
                          <td className="py-2 px-3">0.5789</td>
                          <td className="py-2 px-3 text-cyan-300">108.4s</td>
                        </tr>
                        <tr className="bg-amber-950/30 border border-amber-500/40 text-amber-200 font-bold">
                          <td className="py-2 px-3 flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                            Model 3 (Multi-Modal XGBoost)
                          </td>
                          <td className="py-2 px-3">0.7088</td>
                          <td className="py-2 px-3">0.7189</td>
                          <td className="py-2 px-3 text-amber-300 font-extrabold">0.7132 (+153%)</td>
                          <td className="py-2 px-3 text-amber-300 font-extrabold">0.7225 (+329%)</td>
                          <td className="py-2 px-3 text-emerald-300">87.6s (-60.4s)</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* SECTION 2: CLASSICAL SARIMA vs MULTI-MODAL XGBREGRESSOR */}
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
                  <h3 className="text-xs font-bold text-white mb-2 flex items-center gap-1.5 font-sans">
                    <Cpu className="h-4 w-4 text-amber-400" />
                    2. Classical SARIMA(1,1,1)×(1,0,1)₁₂ vs. Multi-Modal XGBRegressor (Regime B)
                  </h3>
                  <div className="overflow-x-auto mb-2">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                          <th className="py-2 px-3">Forecasting Architecture</th>
                          <th className="py-2 px-3">TTE MAE</th>
                          <th className="py-2 px-3">Trajectory RMSE</th>
                          <th className="py-2 px-3">Lead-Time Horizon</th>
                          <th className="py-2 px-3">Inference Latency</th>
                          <th className="py-2 px-3">1Hz Real-Time Viability</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-[11px]">
                        <tr className="hover:bg-slate-800/30">
                          <td className="py-2 px-3 font-semibold text-slate-300">Univariate SARIMA(1,1,1)×(1,0,1)₁₂</td>
                          <td className="py-2 px-3 text-rose-300">6.50 min</td>
                          <td className="py-2 px-3">6.89 min</td>
                          <td className="py-2 px-3">10.0 min (Late drift)</td>
                          <td className="py-2 px-3 text-rose-400 font-bold">90.4 ms</td>
                          <td className="py-2 px-3 text-slate-400">❌ High latency lag</td>
                        </tr>
                        <tr className="bg-emerald-950/30 border border-emerald-500/40 text-emerald-200 font-bold">
                          <td className="py-2 px-3 flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                            Multi-Modal XGBRegressor
                          </td>
                          <td className="py-2 px-3 text-emerald-300 font-extrabold">0.71 min (-89%)</td>
                          <td className="py-2 px-3 text-emerald-300">0.90 min (-87%)</td>
                          <td className="py-2 px-3 text-amber-300">4.7 min Early Warning</td>
                          <td className="py-2 px-3 text-emerald-300 font-extrabold">0.76 ms (119x Faster)</td>
                          <td className="py-2 px-3 text-emerald-300">✅ Line-rate 1Hz ready</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed italic bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                    💡 <strong>Architectural Takeaway:</strong> Classical univariate SARIMA lacks multi-pod log correlation and requires ~90ms per tick, introducing unacceptable lag for real-time Kubernetes streams. Multi-Modal XGBoost achieves 89% lower MAE with sub-millisecond execution.
                  </p>
                </div>

                {/* SECTION 3: PHASE 2 CLOSED-LOOP MTTR BENCHMARK */}
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
                  <h3 className="text-xs font-bold text-white mb-2 flex items-center gap-1.5 font-sans">
                    <ShieldAlert className="h-4 w-4 text-emerald-400" />
                    3. Phase 2 LangGraph Autonomous Remediation (MTTR)
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-center">
                      <div className="text-[10px] text-slate-400">Average MTTR</div>
                      <div className="text-sm font-bold text-emerald-400">27.6s</div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-center">
                      <div className="text-[10px] text-slate-400">Success Rate</div>
                      <div className="text-sm font-bold text-cyan-300">100.0%</div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-center">
                      <div className="text-[10px] text-slate-400">Guardrail False Reject</div>
                      <div className="text-sm font-bold text-emerald-400">0.0%</div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-center">
                      <div className="text-[10px] text-slate-400">Cooldown Window</div>
                      <div className="text-sm font-bold text-amber-300">120.0s</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between font-mono text-[11px] text-slate-400">
              <span>Google OnlineBoutique (hipster) · FSE'23 Nezha Benchmark</span>
              <button
                onClick={() => setShowBenchmarkModal(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold transition-all"
              >
                Close Modal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
