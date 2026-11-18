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
import { Flame, Zap, ShieldAlert, AlertTriangle, Clock } from 'lucide-react';

export default function TelemetryCharts({
  selectedService = 'frontend',
  telemetryHistory = [],
  currentTickData = {},
  onInjectChaos,
}) {
  const [injecting, setInjecting] = useState(false);

  const metrics = currentTickData.metrics || {};
  const prediction = currentTickData.prediction || {};
  const isAnomaly = prediction.is_anomaly || false;
  const confidence = prediction.confidence || 0.0;
  const tteMin = prediction.time_to_exhaustion_min;

  const handleChaos = async (faultType) => {
    setInjecting(true);
    try {
      if (onInjectChaos) {
        await onInjectChaos(selectedService, faultType);
      }
    } finally {
      setTimeout(() => setInjecting(false), 800);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* 1. Real-Time Telemetry & Baseline Envelope Area Chart */}
      <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-xl flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-200 font-mono tracking-wider">
                LIVE METRIC ENVELOPE: <span className="text-cyan-400">{selectedService.toUpperCase()}</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800/80 text-slate-400 border border-slate-700/60">
                Baseline Z-Normalized
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Past 30 rolling seconds (CPU, Memory, Latency P95)</p>
          </div>

          <div className="flex items-center gap-3 text-[11px] font-mono">
            <span className="flex items-center gap-1 text-cyan-400">
              <span className="h-2 w-2 rounded-full bg-cyan-400" /> CPU: {Math.round(metrics['CpuUsageRate(%)'] || 0)}%
            </span>
            <span className="flex items-center gap-1 text-indigo-400">
              <span className="h-2 w-2 rounded-full bg-indigo-400" /> Mem: {Math.round(metrics['MemoryUsageRate(%)'] || 0)}%
            </span>
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400" /> P95: {(metrics['PodServerLatencyP95(s)'] || 0).toFixed(2)}s
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
                contentStyle={{ backgroundColor: '#090d16', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                itemStyle={{ color: '#e2e8f0' }}
              />
              <ReferenceLine y={2.0} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: '+2σ Threshold', fill: '#f59e0b', fontSize: 10, position: 'top' }} />
              <Area type="monotone" dataKey="cpu_z" stroke="#38bdf8" strokeWidth={2} fillOpacity={1} fill="url(#cpuGrad)" name="CPU Z-Score" />
              <Area type="monotone" dataKey="mem_z" stroke="#818cf8" strokeWidth={2} fillOpacity={1} fill="url(#memGrad)" name="Mem Z-Score" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Chaos Injection Deck */}
        <div className="pt-3 mt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono font-semibold text-slate-300 flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5 text-rose-400" />
              CHAOS INJECTION DECK (Target: <span className="text-cyan-400">{selectedService}</span>)
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Real-time prompt into active twin</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <button
              disabled={injecting}
              onClick={() => handleChaos('cpu_contention')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/60 border border-slate-800 hover:border-rose-500/50 text-slate-300 hover:text-rose-200 text-xs font-mono transition-all disabled:opacity-50"
            >
              🔥 CPU Stress
            </button>
            <button
              disabled={injecting}
              onClick={() => handleChaos('memory_leak')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-amber-950/60 border border-slate-800 hover:border-amber-500/50 text-slate-300 hover:text-amber-200 text-xs font-mono transition-all disabled:opacity-50"
            >
              💧 Mem Leak
            </button>
            <button
              disabled={injecting}
              onClick={() => handleChaos('exception')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-purple-950/60 border border-slate-800 hover:border-purple-500/50 text-slate-300 hover:text-purple-200 text-xs font-mono transition-all disabled:opacity-50"
            >
              💥 500 Errors
            </button>
            <button
              disabled={injecting}
              onClick={() => handleChaos('disk_pressure')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-orange-950/60 border border-slate-800 hover:border-orange-500/50 text-slate-300 hover:text-orange-200 text-xs font-mono transition-all disabled:opacity-50"
            >
              💾 Disk Fill
            </button>
            <button
              disabled={injecting}
              onClick={() => handleChaos('network_delay')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-cyan-950/60 border border-slate-800 hover:border-cyan-500/50 text-slate-300 hover:text-cyan-200 text-xs font-mono transition-all disabled:opacity-50"
            >
              🌐 Latency lag
            </button>
          </div>
        </div>
      </div>

      {/* 2. Failure Probability & Horizon Forecasting Gauge */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-xl flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-200 font-mono tracking-wider">
              FAILURE PROBABILITY GAUGE
            </span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${
              isAnomaly ? 'bg-rose-950 border-rose-600 text-rose-300' : 'bg-emerald-950 border-emerald-700 text-emerald-400'
            }`}>
              {isAnomaly ? 'ANOMALY DETECTED' : 'HEALTHY'}
            </span>
          </div>

          {/* Probability Bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1">
              <span>Classifier Confidence</span>
              <span className="text-white font-bold">{Math.round(confidence * 100)}%</span>
            </div>
            <div className="h-3 w-full rounded-full bg-slate-900 overflow-hidden border border-slate-800">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  confidence > 0.75
                    ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                    : confidence > 0.4
                    ? 'bg-gradient-to-r from-cyan-500 to-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.round(confidence * 100)}%` }}
              />
            </div>
          </div>

          {/* Active Diagnostic Status */}
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 mb-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Target Microservice:</span>
              <span className="text-cyan-300 font-bold">{selectedService}</span>
            </div>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Predicted Root Cause:</span>
              <span className={`font-semibold ${isAnomaly ? 'text-rose-400' : 'text-emerald-400'}`}>
                {prediction.fault_class || 'NORMAL'}
              </span>
            </div>
          </div>

          {/* Regime B Time-to-Exhaustion Card */}
          {tteMin !== null && tteMin !== undefined && (
            <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-600/40 text-amber-200">
              <div className="flex items-center gap-1.5 text-xs font-mono font-bold mb-1">
                <Clock className="h-4 w-4 text-amber-400" />
                <span>FORECASTING LEAD-TIME (Regime B)</span>
              </div>
              <div className="text-lg font-bold font-mono text-amber-300">
                {tteMin.toFixed(1)} <span className="text-xs font-normal text-amber-400">minutes to container crash</span>
              </div>
              <p className="text-[11px] text-amber-300/80 mt-1">
                Proactive patch window active. Ambient agent will remediate before OOM threshold breach.
              </p>
            </div>
          )}
        </div>

        <div className="pt-2 text-[10px] text-slate-500 font-mono text-center border-t border-slate-800/80">
          Fast Brain Multi-Modal XGBoost Engine (90.1s Lead Latency)
        </div>
      </div>
    </div>
  );
}
