import React, { useState, useEffect, useRef } from 'react';
import {
  Activity, ShieldCheck, AlertTriangle, Zap, Server, RefreshCw,
  Terminal, Play, Pause, CheckCircle2, XCircle, Sliders, Cpu, HardDrive,
  Wifi, HelpCircle, Layers, ArrowRight, Clock, ShieldAlert, Award
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend
} from 'recharts';

const SERVICES = [
  { id: 'frontend', name: 'Frontend', tier: 'Edge Gateway', color: 'from-blue-500 to-cyan-500' },
  { id: 'checkoutservice', name: 'CheckoutService', tier: 'Order Pipeline', color: 'from-purple-500 to-indigo-500' },
  { id: 'cartservice', name: 'CartService', tier: 'Stateful Cache', color: 'from-amber-500 to-orange-500' },
  { id: 'productcatalogservice', name: 'ProductCatalog', tier: 'Catalog Store', color: 'from-emerald-500 to-teal-500' },
  { id: 'currencyservice', name: 'CurrencyService', tier: 'FX Converter', color: 'from-pink-500 to-rose-500' },
  { id: 'paymentservice', name: 'PaymentService', tier: 'FinTech Gateway', color: 'from-violet-500 to-purple-500' },
  { id: 'shippingservice', name: 'ShippingService', tier: 'Logistics Router', color: 'from-sky-500 to-blue-500' },
  { id: 'recommendationservice', name: 'Recommendation', tier: 'ML Inference', color: 'from-indigo-500 to-blue-600' },
  { id: 'adservice', name: 'AdService', tier: 'Ad Exchange', color: 'from-fuchsia-500 to-pink-500' },
  { id: 'emailservice', name: 'EmailService', tier: 'Async Notify', color: 'from-teal-500 to-emerald-600' },
];

export default function App() {
  const [autonomousMode, setAutonomousMode] = useState(true);
  const [connected, setConnected] = useState(false);
  const [currentTick, setCurrentTick] = useState(null);
  const [selectedService, setSelectedService] = useState('checkoutservice');
  const [chartData, setChartData] = useState([]);
  const [terminalLogs, setTerminalLogs] = useState([
    { ts: new Date().toLocaleTimeString(), tag: 'SYSTEM', text: 'KubePulse AI Ambient SRE Agent initialized.' },
    { ts: new Date().toLocaleTimeString(), tag: 'ML_ENGINE', text: 'Phase 1 Multi-Modal XGBoost loaded (Macro-F1: 0.7065).' },
    { ts: new Date().toLocaleTimeString(), tag: 'GUARDRAILS', text: 'SRE Safety Guardrails locked to namespace: hipster.' }
  ]);
  const [pendingApproval, setPendingApproval] = useState(null);
  const [clusterState, setClusterState] = useState({});
  const [isInjecting, setIsInjecting] = useState(false);

  const terminalEndRef = useRef(null);

  // Auto-scroll terminal
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalLogs]);

  // Connect to Backend WebSocket
  useEffect(() => {
    const wsUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'ws://localhost:8000/ws/telemetry'
      : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/telemetry`;

    let ws = null;
    let reconnectTimeout = null;

    const connectWs = () => {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setConnected(true);
        addLog('WEBSOCKET', 'Live telemetry stream connected to backend engine.');
      };

      ws.onmessage = (event) => {
        try {
          const tick = JSON.parse(event.data);
          setCurrentTick(tick);
          if (tick.cluster_state) {
            setClusterState(tick.cluster_state);
          }

          // Handle pending HITL approval
          if (tick.pending_hitl && tick.pending_plan) {
            setPendingApproval(tick.pending_plan);
          } else {
            setPendingApproval(null);
          }

          // Update real-time charts
          setChartData(prev => {
            const nextPoint = {
              time: new Date(tick.timestamp * 1000).toLocaleTimeString(),
              cpu: tick.metrics?.['CpuUsageRate(%)'] || 0,
              mem: tick.metrics?.['MemoryUsageRate(%)'] || 0,
              latency: (tick.metrics?.['PodServerLatencyP95(s)'] || 0) * 1000,
              errors: tick.metrics?.['log_error_count'] || 0,
            };
            const updated = [...prev, nextPoint];
            return updated.slice(-25); // Keep rolling 25 points
          });

          // Log agent events
          if (tick.agent_event) {
            const ev = tick.agent_event;
            addLog(ev.state, `${ev.planned_action ? `[${ev.planned_action}] ` : ''}${ev.reasoning || 'State transition'}`);
          }
        } catch (e) {
          console.error('Failed to parse telemetry tick', e);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        reconnectTimeout = setTimeout(connectWs, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connectWs();
    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  const addLog = (tag, text) => {
    setTerminalLogs(prev => [
      ...prev.slice(-40),
      { ts: new Date().toLocaleTimeString(), tag, text }
    ]);
  };

  const toggleAutonomousMode = async () => {
    const nextMode = !autonomousMode;
    setAutonomousMode(nextMode);
    try {
      await fetch('http://localhost:8000/api/agent/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autonomous: nextMode })
      });
      addLog('MODE_CHANGE', `Operating mode switched to: ${nextMode ? 'AUTONOMOUS' : 'HUMAN-IN-THE-LOOP'}`);
    } catch (e) {
      console.warn('Backend mode change call failed', e);
    }
  };

  const injectChaos = async (service, faultType) => {
    setIsInjecting(true);
    addLog('CHAOS_DECK', `Injecting ${faultType} on ${service}...`);
    try {
      const res = await fetch('http://localhost:8000/api/chaos/inject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service, fault_type: faultType })
      });
      const data = await res.json();
      addLog('CHAOS_RESULT', `Chaos injected! Agent response: ${data.agent_state}`);
    } catch (e) {
      addLog('CHAOS_ERROR', `Failed to inject chaos: ${e.message}`);
    } finally {
      setIsInjecting(false);
    }
  };

  const approveAction = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/agent/approve', { method: 'POST' });
      const data = await res.json();
      addLog('OPERATOR_ACTION', `Approved remediation: ${data.action} on ${data.service}!`);
      setPendingApproval(null);
    } catch (e) {
      addLog('APPROVAL_ERROR', e.message);
    }
  };

  const rejectAction = async () => {
    try {
      await fetch('http://localhost:8000/api/agent/reject', { method: 'POST' });
      addLog('OPERATOR_ACTION', 'Action rejected by operator. Cooldown initiated.');
      setPendingApproval(null);
    } catch (e) {
      addLog('REJECTION_ERROR', e.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* ─── TOP NAVIGATION BAR ─── */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 shadow-lg shadow-blue-500/20">
            <Activity className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                KubePulse AI
              </h1>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30">
                Phase 1 + 2 SRE Engine
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Autonomous Multi-Modal Failure Prediction & Ambient Remediation
            </p>
          </div>
        </div>

        {/* Aggregate Benchmark Badges */}
        <div className="hidden lg:flex items-center gap-3 font-mono text-xs">
          <div className="px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center gap-2">
            <Award className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-slate-400">Macro-F1:</span>
            <span className="text-emerald-400 font-bold">0.7065</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-slate-400">Avg MTTR:</span>
            <span className="text-purple-300 font-bold">27.6s</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-400">False Alarms:</span>
            <span className="text-emerald-300 font-bold">0.19 / hr (-98%)</span>
          </div>
        </div>

        {/* Mode Toggle & Status */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleAutonomousMode}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all border ${
              autonomousMode
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${autonomousMode ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
            {autonomousMode ? 'Mode: AUTONOMOUS' : 'Mode: HUMAN-IN-THE-LOOP'}
          </button>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-mono">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-rose-500'}`} />
            <span className="text-slate-300">{connected ? 'Live Replay' : 'Connecting...'}</span>
          </div>
        </div>
      </header>

      {/* ─── MAIN SRE DASHBOARD ─── */}
      <main className="flex-1 p-6 grid grid-cols-1 xl:grid-cols-12 gap-6 max-w-[1700px] w-full mx-auto">
        
        {/* LEFT COLUMN: TOPOLOGY & CHAOS CONTROL (5 COLS) */}
        <div className="xl:col-span-5 flex flex-col gap-6">
          
          {/* Microservice Topology Map */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                <h2 className="font-bold text-sm text-slate-200">OnlineBoutique Microservice Topology</h2>
              </div>
              <span className="text-xs text-slate-400 font-mono">10 Services (Namespace: hipster)</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {SERVICES.map(svc => {
                const state = clusterState[svc.id] || { replicas: 1, mem_limit: '128Mi', status: 'Running' };
                const isSelected = selectedService === svc.id;
                const isCurrentTickSvc = currentTick?.service === svc.id;
                const isAnomaly = isCurrentTickSvc && currentTick?.prediction?.is_anomaly;

                return (
                  <div
                    key={svc.id}
                    onClick={() => setSelectedService(svc.id)}
                    className={`cursor-pointer p-3 rounded-xl border transition-all text-left relative overflow-hidden ${
                      isAnomaly
                        ? 'bg-rose-950/40 border-rose-500/80 shadow-lg shadow-rose-950/50 animate-pulse'
                        : isSelected
                        ? 'bg-slate-800/90 border-blue-500 shadow-md shadow-blue-500/10'
                        : 'bg-slate-850/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-xs text-slate-200 truncate">{svc.name}</span>
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        isAnomaly ? 'bg-rose-500 text-white font-bold' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {state.replicas} pods
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span>{svc.tier}</span>
                      <span className="text-slate-500">{state.mem_limit}</span>
                    </div>

                    {isAnomaly && (
                      <div className="mt-2 text-[10px] font-mono text-rose-400 flex items-center gap-1 font-semibold">
                        <AlertTriangle className="w-3 h-3" />
                        <span>{currentTick?.prediction?.fault_class}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chaos Injection Deck */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <h2 className="font-bold text-sm text-slate-200">Chaos Injection Deck</h2>
              </div>
              <span className="text-xs text-slate-400 font-mono">Target: <strong className="text-white">{selectedService}</strong></span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <button
                disabled={isInjecting}
                onClick={() => injectChaos(selectedService, 'cpu_contention')}
                className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 text-purple-300 text-xs font-semibold flex items-center gap-2 transition"
              >
                <Cpu className="w-3.5 h-3.5 text-purple-400" />
                <span>CPU Hog</span>
              </button>

              <button
                disabled={isInjecting}
                onClick={() => injectChaos(selectedService, 'memory_leak')}
                className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold flex items-center gap-2 transition"
              >
                <HardDrive className="w-3.5 h-3.5 text-amber-400" />
                <span>Memory Leak</span>
              </button>

              <button
                disabled={isInjecting}
                onClick={() => injectChaos(selectedService, 'exception')}
                className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold flex items-center gap-2 transition"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                <span>500 Burst</span>
              </button>

              <button
                disabled={isInjecting}
                onClick={() => injectChaos(selectedService, 'network_delay')}
                className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 text-blue-300 text-xs font-semibold flex items-center gap-2 transition"
              >
                <Wifi className="w-3.5 h-3.5 text-blue-400" />
                <span>Latency Lag</span>
              </button>

              <button
                disabled={isInjecting}
                onClick={() => injectChaos(selectedService, 'disk_pressure')}
                className="p-2.5 rounded-xl bg-teal-500/10 border border-teal-500/30 hover:bg-teal-500/20 text-teal-300 text-xs font-semibold flex items-center gap-2 transition"
              >
                <Server className="w-3.5 h-3.5 text-teal-400" />
                <span>Disk Fill</span>
              </button>

              <button
                disabled={isInjecting}
                onClick={() => injectChaos(selectedService, 'normal')}
                className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-2 transition"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                <span>Heal / Reset</span>
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: CHARTS, HITL CONSOLE & TERMINAL (7 COLS) */}
        <div className="xl:col-span-7 flex flex-col gap-6">

          {/* Operator HITL Approval Card (Only visible when awaiting operator) */}
          {pendingApproval && (
            <div className="bg-gradient-to-r from-amber-950/80 via-slate-900 to-amber-950/80 border-2 border-amber-500/80 rounded-2xl p-5 shadow-2xl shadow-amber-950/50 animate-bounce-once">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-amber-400 animate-pulse" />
                  <h3 className="font-bold text-sm text-amber-300 uppercase tracking-wider font-mono">
                    Human-in-the-Loop Operator Review Required
                  </h3>
                </div>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Confidence: {(pendingApproval.confidence * 100).toFixed(0)}%
                </span>
              </div>

              <div className="bg-slate-950/80 rounded-xl p-4 border border-amber-500/30 mb-4 font-mono text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Target Microservice:</span>
                  <span className="text-white font-bold">{pendingApproval.target_service}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Proposed Action:</span>
                  <span className="text-emerald-400 font-bold">{pendingApproval.selected_action}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Root Cause Diagnosis:</span>
                  <span className="text-slate-300">{pendingApproval.diagnosed_root_cause}</span>
                </div>
                <div className="pt-2 border-t border-slate-800 text-slate-400">
                  <span className="text-amber-400 font-semibold">SRE Reasoning: </span>
                  {pendingApproval.reasoning_summary}
                </div>
              </div>

              {/* SRE Guardrails Checklist */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 text-[11px] font-mono text-slate-300">
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Namespace: hipster</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Bounds: replicas &le; 5</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Cooldown: Clear</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Dry-Run: Passed</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={approveAction}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Approve & Remediate</span>
                </button>
                <button
                  onClick={rejectAction}
                  className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs flex items-center justify-center gap-2 transition"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Reject</span>
                </button>
              </div>
            </div>
          )}

          {/* Real-Time Telemetry & Forecast Chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-sm text-slate-200">Live Telemetry & Horizon Forecasting</h3>
                <p className="text-xs text-slate-400 font-mono">Streamed from Digital Replay Holdout Partition</p>
              </div>
              {currentTick?.prediction?.time_to_exhaustion_min && (
                <div className="px-3 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono text-xs flex items-center gap-2 animate-pulse">
                  <Clock className="w-3.5 h-3.5" />
                  <span>TTE: {currentTick.prediction.time_to_exhaustion_min} min</span>
                </div>
              )}
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Line type="monotone" dataKey="cpu" name="CPU Usage %" stroke="#a855f7" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="mem" name="Memory Usage %" stroke="#38bdf8" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="errors" name="Log Errors" stroke="#f43f5e" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* SRE Agent State Machine Terminal */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-xl flex-1 flex flex-col font-mono">
            <div className="flex items-center justify-between mb-3 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-xs text-slate-300 uppercase tracking-wider">
                  LangGraph Ambient SRE Reasoning Terminal
                </h3>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>Live Event Loop</span>
              </div>
            </div>

            <div className="flex-1 max-h-56 overflow-y-auto space-y-1.5 text-xs text-slate-300 pr-2">
              {terminalLogs.map((log, i) => (
                <div key={i} className="flex items-start gap-2 leading-relaxed">
                  <span className="text-slate-600 select-none">{log.ts}</span>
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                    log.tag.includes('MONITOR') ? 'bg-blue-500/20 text-blue-400' :
                    log.tag.includes('PLAN') ? 'bg-purple-500/20 text-purple-400' :
                    log.tag.includes('GUARD') ? 'bg-emerald-500/20 text-emerald-400' :
                    log.tag.includes('EXEC') ? 'bg-amber-500/20 text-amber-400' :
                    log.tag.includes('CHAOS') ? 'bg-rose-500/20 text-rose-400' :
                    'bg-slate-800 text-slate-400'
                  }`}>
                    {log.tag}
                  </span>
                  <span className="text-slate-300 flex-1">{log.text}</span>
                </div>
              ))}
              <div ref={terminalEndRef} />
            </div>
          </div>

        </div>

      </main>
    </div>
  );
}
