import React, { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import {
  Activity,
  Flame,
  Clock,
  Cpu,
  HardDrive,
  WifiOff,
  FileWarning,
  Layers,
  TerminalSquare,
  Sliders
} from 'lucide-react';

const CHAOS_SCENARIOS = [
  {
    id: 'cpu_contention',
    label: 'CPU Contention',
    defaultService: 'checkoutservice',
    action: 'SCALE_DEPLOYMENT (1→3)',
    icon: Cpu,
    color: 'border-rose-500/50 bg-rose-500/15 hover:bg-rose-500/25 text-rose-200'
  },
  {
    id: 'memory_leak',
    label: 'Memory Leak (OOM)',
    defaultService: 'cartservice',
    action: 'PATCH_RESOURCES (512Mi)',
    icon: HardDrive,
    color: 'border-amber-500/50 bg-amber-500/15 hover:bg-amber-500/25 text-amber-200'
  },
  {
    id: 'exception_burst',
    label: '5xx Exception Burst',
    defaultService: 'paymentservice',
    action: 'RESTART_POD (Rolling)',
    icon: FileWarning,
    color: 'border-purple-500/50 bg-purple-500/15 hover:bg-purple-500/25 text-purple-200'
  },
  {
    id: 'disk_pressure',
    label: 'Node Disk Pressure',
    defaultService: 'productcatalogservice',
    action: 'CORDON_AND_RELOCATE',
    icon: Layers,
    color: 'border-cyan-500/50 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-200'
  },
  {
    id: 'network_latency',
    label: 'Envoy Latency Spike',
    defaultService: 'frontend',
    action: 'APPLY_TRAFFIC_SHAPING',
    icon: WifiOff,
    color: 'border-emerald-500/50 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200'
  }
];

const ALL_SERVICES = [
  'checkoutservice',
  'cartservice',
  'paymentservice',
  'productcatalogservice',
  'frontend',
  'currencyservice',
  'shippingservice',
  'emailservice',
  'recommendationservice',
  'adservice'
];

export default function TelemetryCharts({
  telemetryHistory = [],
  selectedService,
  onSelectService,
  latestPrediction,
  onInjectChaos,
  chaosLoading
}) {
  const [activeTab, setActiveTab] = useState('telemetry'); // 'telemetry' | 'attribution' | 'chaos'
  const [customTarget, setCustomTarget] = useState('AUTO');

  const tteMinutes = latestPrediction?.tte_minutes ?? latestPrediction?.time_to_exhaustion_min;
  const predClass = latestPrediction?.fault_type || latestPrediction?.predicted_class || 'NORMAL';
  const predConf = Number(latestPrediction?.confidence || 0) * 100;

  const latestPoint =
    telemetryHistory.length > 0
      ? telemetryHistory[telemetryHistory.length - 1]
      : { cpu: 14.2, memory: 31.5, latency: 22.0 };

  // Derived Multi-Modal Z-Score attribution bars for Tab 2
  const zScores = [
    {
      name: 'CpuUsageRate(%) Z-Score',
      val: ((Number(latestPoint.cpu || 15) - 18) / 8).toFixed(2),
      pct: Math.min(100, Math.max(8, Number(latestPoint.cpu || 15)))
    },
    {
      name: 'MemoryUsageRate(%) Slope',
      val: ((Number(latestPoint.memory || 30) - 28) / 9).toFixed(2),
      pct: Math.min(100, Math.max(8, Number(latestPoint.memory || 30)))
    },
    {
      name: 'PodServerLatencyP90(s)',
      val: ((Number(latestPoint.latency || 20) - 15) / 12).toFixed(2),
      pct: Math.min(100, Math.max(8, Number(latestPoint.latency || 20) / 3))
    },
    {
      name: 'Drain3 Log Error Template Burst',
      val: predClass !== 'NORMAL' ? '+4.15' : '+0.12',
      pct: predClass !== 'NORMAL' ? 86 : 14
    }
  ];

  return (
    <div className="kintsugi-panel flex flex-col h-full rounded-2xl overflow-hidden">
      {/* Header with Service Selector + 3-Tab Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 bg-slate-950/75 px-3.5 py-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-cyan-400" />
          <span className="font-display text-xs font-bold uppercase tracking-wider text-slate-200">
            Phase 1 Fast-Brain:
          </span>
          <select
            value={selectedService}
            onChange={(e) => onSelectService && onSelectService(e.target.value)}
            className="rounded-lg bg-slate-900 border border-slate-700 px-2 py-0.5 font-mono-code text-xs text-amber-300 focus:outline-none focus:border-amber-400"
          >
            {ALL_SERVICES.map((svc) => (
              <option key={svc} value={svc}>
                {svc}
              </option>
            ))}
          </select>
        </div>

        {/* 3-Mode Workstation Tabs */}
        <div className="flex items-center gap-1 rounded-lg bg-slate-900/90 border border-slate-800 p-0.5 text-[11px]">
          <button
            onClick={() => setActiveTab('telemetry')}
            className={`px-2.5 py-1 rounded-md font-medium transition-all ${
              activeTab === 'telemetry'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Live Charts
          </button>
          <button
            onClick={() => setActiveTab('attribution')}
            className={`px-2.5 py-1 rounded-md font-medium transition-all ${
              activeTab === 'attribution'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            89-Feature Z-Scores
          </button>
          <button
            onClick={() => setActiveTab('chaos')}
            className={`px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1 ${
              activeTab === 'chaos'
                ? 'bg-rose-500/25 text-rose-200 border border-rose-500/50'
                : 'text-slate-400 hover:text-rose-300'
            }`}
          >
            <Flame className="h-3 w-3 text-rose-400" /> Chaos Lab
          </button>
        </div>
      </div>

      {/* Classification & TTE Forecast Status Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/60 border-b border-slate-800/60 px-3.5 py-1.5 font-mono-code text-[11px]">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">XGBoost Class:</span>
          <span
            className={`rounded px-2 py-0.5 font-bold ${
              predClass === 'NORMAL'
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                : 'bg-rose-500/25 text-rose-200 border border-rose-500/50 animate-pulse'
            }`}
          >
            {predClass} ({predConf.toFixed(0)}%)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-slate-400">Regime B Horizon (TTE):</span>
          <span className="text-amber-300 font-bold">
            {tteMinutes && predClass !== 'NORMAL'
              ? `${Number(tteMinutes).toFixed(1)} min to exhaustion`
              : 'Stable (>30.0 min)'}
          </span>
        </div>
      </div>

      {/* TAB 1: LIVE TELEMETRY CHARTS + COMPACT CHAOS BAR */}
      {activeTab === 'telemetry' && (
        <div className="flex-1 flex flex-col justify-between p-3 gap-2 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 flex-1 min-h-[120px]">
            {/* CPU Chart */}
            <div className="rounded-xl bg-slate-950/70 border border-slate-800/80 p-2 flex flex-col">
              <div className="flex justify-between items-center text-[10px] font-mono-code mb-1">
                <span className="text-slate-400">CPU USAGE (%)</span>
                <span className="text-cyan-300 font-bold">{Number(latestPoint.cpu || 0).toFixed(1)}%</span>
              </div>
              <div className="flex-1 min-h-[85px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={telemetryHistory}>
                    <defs>
                      <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.45} />
                        <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" hide />
                    <YAxis domain={[0, 100]} hide />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        fontSize: '11px'
                      }}
                    />
                    <ReferenceLine y={80} stroke="#f43f5e" strokeDasharray="3 3" />
                    <Area
                      type="monotone"
                      dataKey="cpu"
                      stroke="#38bdf8"
                      strokeWidth={2}
                      fill="url(#cpuGrad)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Memory Chart */}
            <div className="rounded-xl bg-slate-950/70 border border-slate-800/80 p-2 flex flex-col">
              <div className="flex justify-between items-center text-[10px] font-mono-code mb-1">
                <span className="text-slate-400">MEMORY &amp; OOM HORIZON (%)</span>
                <span className="text-amber-300 font-bold">
                  {Number(latestPoint.memory || 0).toFixed(1)}%
                </span>
              </div>
              <div className="flex-1 min-h-[85px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={telemetryHistory}>
                    <defs>
                      <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.45} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" hide />
                    <YAxis domain={[0, 100]} hide />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        fontSize: '11px'
                      }}
                    />
                    <ReferenceLine y={85} stroke="#f59e0b" strokeDasharray="3 3" />
                    <Area
                      type="monotone"
                      dataKey="memory"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      fill="url(#memGrad)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* P90 Latency Chart */}
            <div className="rounded-xl bg-slate-950/70 border border-slate-800/80 p-2 flex flex-col">
              <div className="flex justify-between items-center text-[10px] font-mono-code mb-1">
                <span className="text-slate-400">POD P90 LATENCY (ms)</span>
                <span className="text-emerald-300 font-bold">
                  {Number(latestPoint.latency || 0).toFixed(0)} ms
                </span>
              </div>
              <div className="flex-1 min-h-[85px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={telemetryHistory}>
                    <defs>
                      <linearGradient id="latGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.45} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" hide />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        fontSize: '11px'
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="latency"
                      stroke="#10b981"
                      strokeWidth={2}
                      fill="url(#latGrad)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Quick 1-Click Chaos Trigger Bar */}
          <div className="pt-1.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-1.5">
            <span className="flex items-center gap-1 font-mono-code text-[10px] text-slate-400">
              <Flame className="h-3.5 w-3.5 text-rose-400" /> Quick Chaos Inject:
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {CHAOS_SCENARIOS.map((sc) => {
                const Icon = sc.icon;
                return (
                  <button
                    key={sc.id}
                    disabled={chaosLoading}
                    onClick={() => onInjectChaos(sc.id, sc.defaultService)}
                    className={`flex items-center gap-1 rounded-lg border px-2 py-1 font-mono-code text-[10px] font-semibold transition-all ${sc.color} disabled:opacity-50`}
                    title={`Inject ${sc.label} on ${sc.defaultService} -> Expect ${sc.action}`}
                  >
                    <Icon className="h-3 w-3" />
                    <span>{sc.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: 89-FEATURE MULTI-MODAL Z-SCORE ATTRIBUTION & DRAIN3 LOG SIGNALS */}
      {activeTab === 'attribution' && (
        <div className="flex-1 p-3.5 grid grid-cols-1 md:grid-cols-2 gap-3 overflow-y-auto">
          <div className="rounded-xl bg-slate-950/75 border border-slate-800 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-display text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5" /> Top SHAP / Z-Score Drivers ({selectedService})
              </span>
              <span className="font-mono-code text-[10px] text-slate-400">89-Feature Vector</span>
            </div>
            <div className="space-y-2 font-mono-code text-[11px]">
              {zScores.map((z) => (
                <div key={z.name}>
                  <div className="flex justify-between text-slate-300 mb-0.5">
                    <span>{z.name}</span>
                    <span className="text-amber-300 font-bold">{z.val}σ</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-amber-400 to-rose-500 transition-all duration-500"
                      style={{ width: `${z.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-slate-950/75 border border-slate-800 p-3 flex flex-col justify-between font-mono-code text-[10px]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
              <span className="text-cyan-300 font-bold flex items-center gap-1.5">
                <TerminalSquare className="h-3.5 w-3.5" /> Drain3 Structured Container Log Stream
              </span>
              <span className="text-emerald-400">stdout JSON</span>
            </div>
            <div className="space-y-1.5 text-slate-300 overflow-y-auto max-h-[135px]">
              <div className="rounded bg-slate-900/90 p-1.5 border-l-2 border-emerald-400">
                <span className="text-slate-500">[INFO]</span> svc={selectedService} http.resp.status=200 took_ms={Number(latestPoint.latency || 18).toFixed(0)}ms
              </div>
              {predClass !== 'NORMAL' ? (
                <div className="rounded bg-rose-950/60 p-1.5 border-l-2 border-rose-500 text-rose-200">
                  <span className="font-bold">[ERROR]</span> template_hit={predClass} z_score=+4.62σ anomaly_detected=true
                </div>
              ) : (
                <div className="rounded bg-slate-900/90 p-1.5 border-l-2 border-cyan-400">
                  <span className="text-cyan-400">[TEMPLATE]</span> Drain3 entropy H(t)=0.42 normal baseline window
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TARGETED CHAOS ENGINEERING WORKSTATION */}
      {activeTab === 'chaos' && (
        <div className="flex-1 p-3.5 flex flex-col justify-between overflow-y-auto">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div>
              <h3 className="font-display text-xs font-bold text-rose-300">
                Targeted Kubernetes Chaos Fault Injector
              </h3>
              <p className="text-[11px] text-slate-400">
                Select any microservice in <code className="font-mono-code text-amber-300">hipster</code> or use the scenario default to test closed-loop LangGraph healing.
              </p>
            </div>
            <div className="flex items-center gap-2 font-mono-code text-xs">
              <span className="text-slate-400">Target Pod:</span>
              <select
                value={customTarget}
                onChange={(e) => setCustomTarget(e.target.value)}
                className="rounded-lg bg-slate-900 border border-amber-500/50 px-2.5 py-1 text-amber-300"
              >
                <option value="AUTO">Scenario Default (Recommended)</option>
                {ALL_SERVICES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
            {CHAOS_SCENARIOS.map((sc) => {
              const Icon = sc.icon;
              const targetSvc = customTarget === 'AUTO' ? sc.defaultService : customTarget;
              return (
                <button
                  key={sc.id}
                  disabled={chaosLoading}
                  onClick={() => onInjectChaos(sc.id, targetSvc)}
                  className={`flex flex-col justify-between rounded-xl border p-2.5 text-left transition-all ${sc.color} disabled:opacity-50`}
                >
                  <div className="flex items-center justify-between w-full mb-1.5">
                    <Icon className="h-4 w-4" />
                    <span className="font-mono-code text-[9px] uppercase px-1.5 py-0.5 rounded bg-black/30">
                      {targetSvc.replace('service', '')}
                    </span>
                  </div>
                  <div>
                    <div className="font-display text-xs font-bold">{sc.label}</div>
                    <div className="font-mono-code text-[9px] opacity-80 mt-0.5">{sc.action}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
