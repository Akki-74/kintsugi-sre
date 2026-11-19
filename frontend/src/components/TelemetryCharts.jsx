import React, { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Flame, Zap, Database, HardDrive, AlertTriangle, Clock, Activity, AlertOctagon } from 'lucide-react';

export default function TelemetryCharts({
  selectedService = 'frontend',
  telemetryHistory = [],
  currentTickData = {},
  onInjectChaos,
}) {
  const [activeFault, setActiveFault] = useState(null);
  const [injecting, setInjecting] = useState(false);

  const metrics = currentTickData.metrics || {};
  const prediction = currentTickData.prediction || {};
  const isAnomaly = prediction.is_anomaly || false;
  const confidence = prediction.confidence || 0.0;
  const tteMin = prediction.time_to_exhaustion_min;

  const handleChaos = async (faultType) => {
    setActiveFault(faultType);
    setInjecting(true);
    try {
      if (onInjectChaos) {
        await onInjectChaos(selectedService, faultType);
      }
    } finally {
      setTimeout(() => {
        setInjecting(false);
        setActiveFault(null);
      }, 1000);
    }
  };

  const chaosButtons = [
    { id: 'cpu_contention', label: 'CPU Contention', icon: Flame, color: 'hover:border-rose-500 hover:bg-rose-950/40 text-rose-300' },
    { id: 'memory_leak', label: 'Memory Leak (Sawtooth)', icon: Database, color: 'hover:border-amber-500 hover:bg-amber-950/40 text-amber-300' },
    { id: 'exception', label: 'HTTP 500 Exception Burst', icon: AlertTriangle, color: 'hover:border-purple-500 hover:bg-purple-950/40 text-purple-300' },
    { id: 'disk_pressure', label: 'Disk Volume Saturation', icon: HardDrive, color: 'hover:border-orange-500 hover:bg-orange-950/40 text-orange-300' },
    { id: 'network_delay', label: 'Envoy Latency Spike', icon: Zap, color: 'hover:border-cyan-500 hover:bg-cyan-950/40 text-cyan-300' },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* 1. Real-Time Telemetry & Baseline Envelope Area Chart */}
      <div className="lg:col-span-2 rounded-2xl border border-slate-800/90 bg-slate-950/70 p-4 shadow-xl flex flex-col justify-between backdrop-blur-xl">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-200 font-mono tracking-wider">
                LIVE METRIC ENVELOPE: <span className="text-cyan-400">{selectedService.toUpperCase()}</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800/80 text-slate-400 border border-slate-700/60">
                Baseline Z-Normalized (±3σ)
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Past 30 rolling seconds (CPU, Memory, Latency P95)</p>
          </div>

          {/* Metric Badges + Live TTE Countdown Pill */}
          <div className="flex items-center gap-2 text-[11px] font-mono">
            {tteMin !== undefined && tteMin !== null && tteMin < 10.0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-950/90 border border-amber-500/80 text-amber-300 font-bold animate-pulse shadow-md shadow-amber-950/50">
                <Clock className="h-3.5 w-3.5 text-amber-400 animate-spin" />
                <span>TTE Horizon: ~{tteMin.toFixed(1)}m to OOM</span>
              </div>
            )}
            <span className="flex items-center gap-1 text-cyan-400 bg-slate-900 px-2 py-1 rounded border border-slate-800">
              <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_4px_#38bdf8]" /> CPU: {Math.round(metrics['CpuUsageRate(%)'] || 0)}%
            </span>
            <span className="flex items-center gap-1 text-indigo-400 bg-slate-900 px-2 py-1 rounded border border-slate-800">
              <span className="h-2 w-2 rounded-full bg-indigo-400 shadow-[0_0_4px_#818cf8]" /> Mem: {Math.round(metrics['MemoryUsageRate(%)'] || 0)}%
            </span>
            <span className="flex items-center gap-1 text-emerald-400 bg-slate-900 px-2 py-1 rounded border border-slate-800">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_4px_#34d399]" /> P95: {(metrics['PodServerLatencyP95(s)'] || 0).toFixed(2)}s
            </span>
          </div>
        </div>

        {/* Recharts Area Chart */}
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={telemetryHistory} margin={{ top: 8, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#818cf8" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" stroke="#475569" fontSize={10} tickLine={false} />
              <YAxis stroke="#475569" fontSize={10} domain={[-2, 6]} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#050811', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                itemStyle={{ color: '#e2e8f0' }}
              />
              {/* +2.0σ Detection Boundary */}
              <ReferenceLine y={2.0} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: '+2σ Onset Trigger', fill: '#f59e0b', fontSize: 10, position: 'top' }} />
              {/* Critical +4.0σ / 90% Exhaustion Ceiling */}
              <ReferenceLine y={4.0} stroke="#f43f5e" strokeDasharray="2 2" label={{ value: 'Critical 90% SLA Threshold', fill: '#f43f5e', fontSize: 10, position: 'top' }} />
              <Area type="monotone" dataKey="cpu_z" stroke="#38bdf8" strokeWidth={2} fillOpacity={1} fill="url(#cpuGrad)" name="CPU Z-Score" />
              <Area type="monotone" dataKey="mem_z" stroke="#818cf8" strokeWidth={2} fillOpacity={1} fill="url(#memGrad)" name="Mem Z-Score" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Industrial Tactile Chaos Injection Deck */}
        <div className="pt-3 mt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono font-semibold text-slate-300 flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5 text-rose-400" />
              TACTILE CHAOS DECK (Target: <span className="text-cyan-400 font-bold">{selectedService}</span>)
            </span>
            <span className="text-[10px] font-mono text-slate-500">
              Injects FSE'23 Nezha Anomaly Signatures
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {chaosButtons.map((btn) => {
              const Icon = btn.icon;
              const isFiring = injecting && activeFault === btn.id;
              return (
                <button
                  key={btn.id}
                  disabled={injecting}
                  onClick={() => handleChaos(btn.id)}
                  className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl border border-slate-800 bg-slate-900/80 text-[11px] font-mono font-semibold transition-all shadow-md active:scale-95 disabled:opacity-50 ${btn.color} ${
                    isFiring ? 'scale-105 ring-2 ring-rose-500 animate-pulse bg-rose-950/80 text-white' : ''
                  }`}
                  title={`Inject ${btn.label} into ${selectedService}`}
                >
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${isFiring ? 'animate-spin' : ''}`} />
                  <span className="truncate">{btn.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Fast Brain Live Anomaly Classification Scorecard */}
      <div className="rounded-2xl border border-slate-800/90 bg-slate-950/70 p-4 shadow-xl flex flex-col justify-between backdrop-blur-xl">
        <div>
          <div className="flex items-center justify-between mb-3 border-b border-slate-800/80 pb-2">
            <div className="flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-cyan-400" />
              <span className="text-xs font-bold text-slate-200 font-mono tracking-wider">
                PHASE 1 FAST BRAIN INFERENCE
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/90 border border-cyan-800 text-cyan-300 font-bold">
              XGBOOST v2.0
            </span>
          </div>

          {/* Prediction Status Badge */}
          <div className="p-3 rounded-xl border mb-3 bg-slate-900/90 border-slate-800">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Predicted State:</span>
              <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${
                isAnomaly
                  ? 'bg-rose-950/90 border border-rose-600 text-rose-300 animate-pulse'
                  : 'bg-emerald-950/90 border border-emerald-600 text-emerald-300'
              }`}>
                {prediction.fault_class || 'NORMAL'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Model Confidence:</span>
              <strong className="text-white">{(confidence * 100).toFixed(1)}%</strong>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${isAnomaly ? 'bg-rose-500' : 'bg-emerald-500'}`}
                style={{ width: `${Math.min(100, Math.max(5, confidence * 100))}%` }}
              />
            </div>
          </div>

          {/* Operational Regimes Readout */}
          <div className="space-y-1.5 text-xs font-mono">
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800/60">
              <span className="text-slate-400">Regime A Latency ($\Delta t$):</span>
              <strong className="text-cyan-300">87.6 seconds</strong>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800/60">
              <span className="text-slate-400">Regime B Lead Time:</span>
              <strong className="text-amber-300">4.7 minutes</strong>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800/60">
              <span className="text-slate-400">Root-Cause Loc. (Top-1):</span>
              <strong className="text-emerald-300">66.7%</strong>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800/60">
              <span className="text-slate-400">False Alarm Rate:</span>
              <strong className="text-indigo-300">1.71 / hr (Zero Fatigue)</strong>
            </div>
          </div>
        </div>

        <div className="text-[10px] font-mono text-slate-500 pt-2 border-t border-slate-800/80 flex items-center justify-between">
          <span>Target Microservice: <strong className="text-slate-300">{selectedService}</strong></span>
          <span className="text-emerald-400">● Live Inference</span>
        </div>
      </div>
    </div>
  );
}
