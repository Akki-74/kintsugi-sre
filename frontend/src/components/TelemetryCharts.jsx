import React, { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Flame, Cpu, Database, AlertTriangle, HardDrive, Wifi, Activity } from 'lucide-react';

const SERVICES = [
  'checkoutservice',
  'frontend',
  'cartservice',
  'paymentservice',
  'productcatalogservice',
  'currencyservice',
  'shippingservice',
  'recommendationservice',
  'adservice',
  'emailservice',
];

const CHAOS_BUTTONS = [
  { id: 'cpu_contention', label: 'CPU Saturation', icon: Cpu, color: 'border-rose-500/60 hover:bg-rose-950/70 text-rose-300' },
  { id: 'memory_leak', label: 'Memory Leak (OOM)', icon: Database, color: 'border-amber-500/60 hover:bg-amber-950/70 text-amber-300' },
  { id: 'exception', label: 'HTTP 500 Burst', icon: AlertTriangle, color: 'border-purple-500/60 hover:bg-purple-950/70 text-purple-300' },
  { id: 'disk_pressure', label: 'Node Disk Pressure', icon: HardDrive, color: 'border-cyan-500/60 hover:bg-cyan-950/70 text-cyan-300' },
  { id: 'network_delay', label: 'Envoy Latency Spike', icon: Wifi, color: 'border-blue-500/60 hover:bg-blue-950/70 text-blue-300' },
];

export default function TelemetryCharts({
  telemetryHistory = [],
  selectedService = 'checkoutservice',
  onSelectService,
  onInjectChaos,
  latestTick,
}) {
  const [firingFault, setFiringFault] = useState(null);

  const handleChaosClick = async (faultType) => {
    setFiringFault(faultType);
    if (onInjectChaos) {
      await onInjectChaos(selectedService || 'checkoutservice', faultType);
    }
    setTimeout(() => setFiringFault(null), 900);
  };

  const metrics = latestTick?.metrics || {};
  const pred = latestTick?.prediction || {};

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Left 8 Cols: Real-Time Multi-Modal Telemetry & Exhaustion Horizon Chart */}
      <div className="lg:col-span-8 rounded-2xl kintsugi-glass p-4 flex flex-col justify-between">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-cyan-400" />
            <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
              REAL-TIME MULTI-MODAL TELEMETRY & HORIZON FORECAST
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-cyan-500/30">
              Target: {selectedService}
            </span>
          </div>

          {pred.time_to_exhaustion_min ? (
            <div className="px-2.5 py-1 rounded-lg bg-amber-950/90 border border-amber-400 text-amber-300 text-[11px] font-mono font-bold animate-pulse">
              ⏳ Predicted Exhaustion Horizon (TTE): {pred.time_to_exhaustion_min} min
            </div>
          ) : (
            <div className="text-[11px] font-mono text-slate-400">
              Dashed Red Line = <span className="text-rose-400 font-semibold">90% Critical Exhaustion Threshold</span>
            </div>
          )}
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <div className="bg-slate-950/75 border border-slate-800/90 rounded-xl px-3 py-2">
            <div className="text-[10px] font-mono text-slate-400">CPU Utilization</div>
            <div className="text-sm font-bold font-mono text-cyan-300">
              {metrics['CpuUsageRate(%)'] !== undefined ? `${metrics['CpuUsageRate(%)'].toFixed(1)}%` : '24.5%'}
            </div>
          </div>
          <div className="bg-slate-950/75 border border-slate-800/90 rounded-xl px-3 py-2">
            <div className="text-[10px] font-mono text-slate-400">Memory Utilization</div>
            <div className="text-sm font-bold font-mono text-amber-300">
              {metrics['MemoryUsageRate(%)'] !== undefined ? `${metrics['MemoryUsageRate(%)'].toFixed(1)}%` : '31.0%'}
            </div>
          </div>
          <div className="bg-slate-950/75 border border-slate-800/90 rounded-xl px-3 py-2">
            <div className="text-[10px] font-mono text-slate-400">Pod P95 Latency</div>
            <div className="text-sm font-bold font-mono text-emerald-300">
              {metrics['PodServerLatencyP95(s)'] !== undefined ? `${(metrics['PodServerLatencyP95(s)'] * 1000).toFixed(0)} ms` : '120 ms'}
            </div>
          </div>
          <div className="bg-slate-950/75 border border-slate-800/90 rounded-xl px-3 py-2">
            <div className="text-[10px] font-mono text-slate-400">Drain3 Log Errors</div>
            <div className="text-sm font-bold font-mono text-rose-300">
              {metrics.log_error_count !== undefined ? metrics.log_error_count : 0} events/tick
            </div>
          </div>
        </div>

        <div className="h-[195px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={telemetryHistory} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#fbbf24" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="timeLabel" stroke="#64748b" fontSize={10} />
              <YAxis domain={[0, 100]} stroke="#64748b" fontSize={10} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              />
              <ReferenceLine
                y={90}
                stroke="#f43f5e"
                strokeDasharray="5 5"
                strokeWidth={1.5}
              />
              <Area
                type="monotone"
                dataKey="cpu"
                name="CPU Usage (%)"
                stroke="#38bdf8"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#cpuGrad)"
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="memory"
                name="Memory Usage (%)"
                stroke="#fbbf24"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#memGrad)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Right 4 Cols: Tactile Chaos Injection Deck */}
      <div className="lg:col-span-4 rounded-2xl kintsugi-glass p-4 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-rose-400" />
              <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
                CHAOS FAULT INJECTION DECK
              </h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950/80 border border-rose-500/40 text-rose-300">
              LIVE MUTATION
            </span>
          </div>

          <p className="text-[11px] text-slate-400 mb-2.5">
            Select a microservice in the mesh and inject a real anomaly to trigger Phase 1 detection & Phase 2 LangGraph healing:
          </p>

          <div className="mb-3">
            <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
              Target Microservice (namespace: hipster)
            </label>
            <select
              value={selectedService}
              onChange={(e) => onSelectService && onSelectService(e.target.value)}
              className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-400"
            >
              {SERVICES.map((svc) => (
                <option key={svc} value={svc}>
                  {svc}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            {CHAOS_BUTTONS.map((btn) => {
              const Icon = btn.icon;
              const isFiring = firingFault === btn.id;
              return (
                <button
                  key={btn.id}
                  onClick={() => handleChaosClick(btn.id)}
                  className={`w-full px-3 py-2 rounded-xl border bg-slate-950/85 text-xs font-mono font-semibold flex items-center justify-between transition-all cursor-pointer ${
                    btn.color
                  } ${isFiring ? 'scale-95 ring-2 ring-amber-400' : ''}`}
                >
                  <span className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5" />
                    {btn.label}
                  </span>
                  <span className="text-[10px] opacity-80">
                    {isFiring ? 'INJECTING...' : 'FIRE ➔'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
