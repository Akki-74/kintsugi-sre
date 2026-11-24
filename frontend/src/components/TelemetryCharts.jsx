import React, { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid
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
  Sliders,
  AlertTriangle,
  Zap,
  Repeat,
  Radio,
  CheckCircle2
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

export const EXPANDED_CHAOS_OPTIONS = [
  {
    id: 'cpu_contention',
    label: 'CPU Contention',
    shortName: 'CPU Saturation',
    description: 'Spikes CPU to 94.6% via tight compute loop',
    defaultService: 'checkoutservice',
    action: 'SCALE_DEPLOYMENT (1→3)',
    category: 'Compute',
    icon: Cpu,
    color: 'border-rose-500/60 bg-rose-500/15 hover:bg-rose-500/25 text-rose-200'
  },
  {
    id: 'memory_leak',
    label: 'Memory Leak (OOM)',
    shortName: 'Heap Leak',
    description: 'Monotonic heap climb toward container OOM limit',
    defaultService: 'cartservice',
    action: 'PATCH_RESOURCES (512Mi)',
    category: 'Memory',
    icon: HardDrive,
    color: 'border-amber-500/60 bg-amber-500/15 hover:bg-amber-500/25 text-amber-200'
  },
  {
    id: 'exception',
    label: 'HTTP 500 / Exception Burst',
    shortName: '5xx Burst',
    description: 'Cascading application exceptions in stdout logs',
    defaultService: 'paymentservice',
    action: 'RESTART_POD (Rolling)',
    category: 'Application',
    icon: FileWarning,
    color: 'border-purple-500/60 bg-purple-500/15 hover:bg-purple-500/25 text-purple-200'
  },
  {
    id: 'disk_pressure',
    label: 'Node Disk Pressure',
    shortName: 'Disk Pressure',
    description: 'SyscallWrite surge & ephemeral volume saturation',
    defaultService: 'productcatalogservice',
    action: 'CORDON_AND_RELOCATE',
    category: 'Node / Storage',
    icon: Layers,
    color: 'border-cyan-500/60 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-200'
  },
  {
    id: 'network_delay',
    label: 'Envoy Latency Spike',
    shortName: 'RPC Delay',
    description: 'Service mesh inter-service call delay > 1800ms',
    defaultService: 'frontend',
    action: 'APPLY_TRAFFIC_SHAPING',
    category: 'Network',
    icon: WifiOff,
    color: 'border-blue-500/60 bg-blue-500/15 hover:bg-blue-500/25 text-blue-200'
  },
  {
    id: 'thread_deadlock',
    label: 'Thread Pool Deadlock',
    shortName: 'Deadlock / Socket',
    description: 'Worker thread starvation & leaked TCP sockets',
    defaultService: 'shippingservice',
    action: 'RESTART_POD (Rolling)',
    category: 'Application',
    icon: AlertTriangle,
    color: 'border-pink-500/60 bg-pink-500/15 hover:bg-pink-500/25 text-pink-200'
  },
  {
    id: 'packet_loss',
    label: 'Packet Loss & Jitter',
    shortName: 'Packet Drop',
    description: 'Dropped TCP frames and upstream retry storm',
    defaultService: 'recommendationservice',
    action: 'APPLY_TRAFFIC_SHAPING',
    category: 'Network',
    icon: Radio,
    color: 'border-indigo-500/60 bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-200'
  },
  {
    id: 'cascading_failure',
    label: 'Cascading Ingest Flood',
    shortName: 'Cascade Load',
    description: 'Ingress backlog overwhelming downstream dependencies',
    defaultService: 'currencyservice',
    action: 'SCALE_DEPLOYMENT (Scale 3)',
    category: 'Compute',
    icon: Zap,
    color: 'border-yellow-500/60 bg-yellow-500/15 hover:bg-yellow-500/25 text-yellow-200'
  }
];

export const ALL_SERVICES = [
  'checkoutservice',
  'frontend',
  'cartservice',
  'paymentservice',
  'productcatalogservice',
  'currencyservice',
  'shippingservice',
  'recommendationservice',
  'adservice',
  'emailservice'
];

export default function TelemetryCharts({
  telemetryHistory = [],
  selectedService = 'checkoutservice',
  onSelectService,
  latestPrediction,
  onInjectChaos,
  chaosLoading
}) {
  const [activeTab, setActiveTab] = useState('telemetry'); // 'telemetry' | 'chaos' | 'attribution'
  const [customTarget, setCustomTarget] = useState('AUTO');
  const [intensity, setIntensity] = useState('HIGH');
  const [firingId, setFiringId] = useState(null);

  const tteMinutes = latestPrediction?.tte_minutes ?? latestPrediction?.time_to_exhaustion_min;
  const predClass = latestPrediction?.fault_type || latestPrediction?.fault_class || latestPrediction?.predicted_class || 'NORMAL';
  const predConf = Number(latestPrediction?.confidence || 0) * 100;

  const latestPoint =
    telemetryHistory.length > 0
      ? telemetryHistory[telemetryHistory.length - 1]
      : { cpu: 14.2, memory: 31.5, latency: 22.0 };

  const handleFireChaos = async (scenarioId, defaultTarget) => {
    setFiringId(scenarioId);
    const target = customTarget === 'AUTO' ? (selectedService || defaultTarget) : customTarget;
    if (onInjectChaos) {
      await onInjectChaos(scenarioId, target);
    }
    setTimeout(() => setFiringId(null), 1200);
  };

  // Top 4 Z-score features for Tab 3
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
      name: 'Drain3 Log Error Burst',
      val: predClass !== 'NORMAL' ? '+4.15' : '+0.12',
      pct: predClass !== 'NORMAL' ? 88 : 12
    }
  ];

  return (
    <div className="kintsugi-panel flex flex-col h-full rounded-2xl overflow-hidden min-w-0 max-w-full">
      {/* Header Bar with Service Selector & Workstation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 bg-slate-950/20 backdrop-blur-xs px-3.5 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <Activity className="h-4 w-4 text-cyan-400 flex-shrink-0" />
          <span className="font-display text-xs font-bold uppercase tracking-wider text-slate-200 truncate">
            Target Pod:
          </span>
          <select
            value={selectedService}
            onChange={(e) => onSelectService && onSelectService(e.target.value)}
            className="rounded-lg bg-slate-900/30 backdrop-blur-xs border border-slate-700/60 px-2.5 py-1 font-mono-code text-xs text-amber-300 focus:outline-none focus:border-amber-400"
          >
            {ALL_SERVICES.map((svc) => (
              <option key={svc} value={svc} className="bg-slate-900 text-slate-200">
                {svc} (hipster)
              </option>
            ))}
          </select>
        </div>

        {/* Workstation Tab Switcher */}
        <div className="flex items-center gap-1 rounded-lg bg-slate-900/30 backdrop-blur-xs border border-slate-800/60 p-0.5 text-xs">
          <button
            onClick={() => setActiveTab('telemetry')}
            className={`px-3 py-1 rounded-md font-medium transition-all ${
              activeTab === 'telemetry'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Live Charts
          </button>
          <button
            onClick={() => setActiveTab('chaos')}
            className={`px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'chaos'
                ? 'bg-rose-500/25 text-rose-200 border border-rose-500/50 shadow-sm'
                : 'text-slate-400 hover:text-rose-300'
            }`}
          >
            <Flame className="h-3.5 w-3.5 text-rose-400" />
            <span>Chaos Deck (8 Scenarios)</span>
          </button>
          <button
            onClick={() => setActiveTab('attribution')}
            className={`px-3 py-1 rounded-md font-medium transition-all ${
              activeTab === 'attribution'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Z-Scores &amp; Logs
          </button>
        </div>
      </div>

      {/* Model Anomaly Readout & TTE Horizon Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/20 backdrop-blur-xs border-b border-slate-800/60 px-3.5 py-1.5 font-mono-code text-[11px] min-w-0">
        <div className="flex items-center gap-2 min-w-0 truncate">
          <span className="text-slate-400">Status:</span>
          <Badge
            variant={predClass === 'NORMAL' ? 'emerald' : 'destructive'}
            className={predClass !== 'NORMAL' ? 'animate-pulse' : ''}
          >
            {predClass} ({predConf.toFixed(0)}%)
          </Badge>
        </div>

        <div className="flex items-center gap-2 min-w-0 truncate">
          <Clock className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
          <span className="text-slate-400">Exhaustion Horizon:</span>
          <span className="text-amber-300 font-bold truncate">
            {tteMinutes && predClass !== 'NORMAL'
              ? `${Number(tteMinutes).toFixed(1)} min to container crash`
              : 'Stable (>30 min)'}
          </span>
        </div>
      </div>

      {/* TAB 1: LIVE TELEMETRY CHARTS + QUICK CHAOS INJECTORS */}
      {activeTab === 'telemetry' && (
        <div className="flex-1 flex flex-col p-3 gap-2 min-h-0 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 flex-1 min-h-0 overflow-hidden">
            {/* CPU Chart */}
            <div className="rounded-xl bg-slate-950/20 backdrop-blur-xs border border-slate-800/40 p-2.5 flex flex-col min-w-0 min-h-0 overflow-hidden relative shadow-sm">
              <div className="flex justify-between items-center text-[11px] font-mono-code mb-1 flex-shrink-0">
                <span className="text-slate-400">CPU USAGE (%)</span>
                <span className="text-cyan-300 font-bold">{Number(latestPoint.cpu || 0).toFixed(1)}%</span>
              </div>
              <div className="flex-1 min-h-0 w-full relative overflow-hidden">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={telemetryHistory} margin={{ top: 4, right: 4, left: 4, bottom: 2 }}>
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
                        backgroundColor: 'rgba(15, 23, 42, 0.85)',
                        borderColor: '#334155',
                        fontSize: '11px',
                        fontFamily: 'JetBrains Mono, monospace',
                        backdropFilter: 'blur(8px)'
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
            <div className="rounded-xl bg-slate-950/20 backdrop-blur-xs border border-slate-800/40 p-2.5 flex flex-col min-w-0 min-h-0 overflow-hidden relative shadow-sm">
              <div className="flex justify-between items-center text-[11px] font-mono-code mb-1 flex-shrink-0">
                <span className="text-slate-400">MEMORY &amp; OOM (%)</span>
                <span className="text-amber-300 font-bold">{Number(latestPoint.memory || 0).toFixed(1)}%</span>
              </div>
              <div className="flex-1 min-h-0 w-full relative overflow-hidden">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={telemetryHistory} margin={{ top: 4, right: 4, left: 4, bottom: 2 }}>
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
                        backgroundColor: 'rgba(15, 23, 42, 0.85)',
                        borderColor: '#334155',
                        fontSize: '11px',
                        fontFamily: 'JetBrains Mono, monospace',
                        backdropFilter: 'blur(8px)'
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
            <div className="rounded-xl bg-slate-950/20 backdrop-blur-xs border border-slate-800/40 p-2.5 flex flex-col min-w-0 min-h-0 overflow-hidden relative shadow-sm">
              <div className="flex justify-between items-center text-[11px] font-mono-code mb-1 flex-shrink-0">
                <span className="text-slate-400">P90 RPC LATENCY (ms)</span>
                <span className="text-emerald-300 font-bold">{Number(latestPoint.latency || 0).toFixed(0)} ms</span>
              </div>
              <div className="flex-1 min-h-0 w-full relative overflow-hidden">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={telemetryHistory} margin={{ top: 4, right: 4, left: 4, bottom: 2 }}>
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
                        fontSize: '11px',
                        fontFamily: 'JetBrains Mono, monospace'
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

          {/* Quick Chaos Bar at Bottom of Charts */}
          <div className="relative z-20 flex-shrink-0 pt-2 pb-1 px-3 border-t border-slate-800/80 bg-slate-950/25 backdrop-blur-sm rounded-xl flex flex-wrap items-center justify-between gap-1.5 shadow-lg">
            <span className="flex items-center gap-1.5 font-mono-code text-[11px] text-slate-300 font-medium">
              <Flame className="h-3.5 w-3.5 text-rose-400 flex-shrink-0" />
              <span>Quick Chaos ({selectedService}):</span>
            </span>
            <div className="flex flex-wrap items-center gap-1.5 relative z-30">
              {EXPANDED_CHAOS_OPTIONS.slice(0, 5).map((opt) => {
                const Icon = opt.icon;
                const isFiring = firingId === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={chaosLoading}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFireChaos(opt.id, opt.defaultService);
                    }}
                    className={`relative z-30 pointer-events-auto cursor-pointer flex items-center gap-1 rounded-lg border px-2.5 py-1 font-mono-code text-[10px] font-semibold transition-all hover:brightness-125 hover:scale-[1.02] active:scale-95 ${
                      isFiring ? 'scale-105 ring-2 ring-rose-400' : ''
                    } ${opt.color} disabled:opacity-50 disabled:cursor-not-allowed`}
                    title={`Inject ${opt.label} on ${selectedService}`}
                  >
                    <Icon className="h-3 w-3 flex-shrink-0" />
                    <span>{opt.shortName}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FULL TACTILE CHAOS INJECTION DECK (8 EXPANDED OPTIONS) */}
      {activeTab === 'chaos' && (
        <div className="flex-1 p-3.5 flex flex-col justify-between overflow-y-auto space-y-3 min-h-0">
          {/* Target Service & Intensity Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
            <div>
              <h3 className="font-display text-xs font-bold text-rose-300 flex items-center gap-1.5">
                <Flame className="h-4 w-4 text-rose-400" />
                <span>Tactile Chaos Engineering Fault Injector</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Choose a microservice in namespace <code className="font-mono-code text-amber-300">hipster</code> and trigger chaos injections across 8 operational fault signatures.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 font-mono-code text-xs">
                <span className="text-slate-400">Target:</span>
                <select
                  value={customTarget}
                  onChange={(e) => setCustomTarget(e.target.value)}
                  className="rounded-lg bg-slate-900 border border-amber-500/50 px-2.5 py-1 text-xs text-amber-300 focus:outline-none"
                >
                  <option value="AUTO">Current Selected ({selectedService})</option>
                  {ALL_SERVICES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 font-mono-code text-xs">
                <span className="text-slate-400">Intensity:</span>
                <div className="flex rounded-lg bg-slate-900/50 backdrop-blur-sm border border-slate-700/60 p-0.5 text-[10px]">
                  {['MODERATE', 'HIGH', 'CRITICAL'].map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => setIntensity(lvl)}
                      className={`px-2 py-0.5 rounded font-bold transition-all ${
                        intensity === lvl
                          ? 'bg-rose-500/30 text-rose-200 border border-rose-500/50'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 8 Expanded Chaos Option Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {EXPANDED_CHAOS_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isFiring = firingId === opt.id;
              const target = customTarget === 'AUTO' ? (selectedService || opt.defaultService) : customTarget;

              return (
                <button
                  key={opt.id}
                  disabled={chaosLoading}
                  onClick={() => handleFireChaos(opt.id, opt.defaultService)}
                  className={`flex flex-col justify-between rounded-xl border p-2.5 text-left transition-all ${
                    isFiring ? 'scale-[1.03] ring-2 ring-rose-400' : 'hover:scale-[1.01]'
                  } ${opt.color} disabled:opacity-50 min-h-[95px]`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <Icon className="h-4 w-4" />
                    <span className="font-mono-code text-[9px] uppercase px-1.5 py-0.5 rounded bg-black/40 text-slate-300 truncate max-w-[85px]">
                      {target.replace('service', '')}
                    </span>
                  </div>
                  <div>
                    <div className="font-display text-xs font-bold leading-tight">{opt.label}</div>
                    <p className="text-[10px] text-slate-300/80 line-clamp-1 mt-0.5">{opt.description}</p>
                    <div className="font-mono-code text-[9px] text-amber-300 font-semibold mt-1 flex items-center gap-1">
                      <span>Action:</span>
                      <span className="truncate">{opt.action}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-800 text-[11px] font-mono-code text-slate-400 flex items-center justify-between">
            <span>Clicking any scenario sends live telemetry anomaly &amp; wakes Phase 2 LangGraph SRE</span>
            <span className="text-emerald-400">● 10/10 Services Supported</span>
          </div>
        </div>
      )}

      {/* TAB 3: 89-FEATURE Z-SCORE ATTRIBUTION & DRAIN3 LOGS */}
      {activeTab === 'attribution' && (
        <div className="flex-1 p-3.5 grid grid-cols-1 md:grid-cols-2 gap-3 overflow-y-auto min-h-0">
          <div className="rounded-xl bg-slate-950/20 backdrop-blur-xs border border-slate-800/40 p-3 space-y-2.5 min-w-0">
            <div className="flex items-center justify-between">
              <span className="font-display text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5" /> Top Z-Score Deviations ({selectedService})
              </span>
              <span className="font-mono-code text-[10px] text-slate-400">89-Feature Vector</span>
            </div>
            <div className="space-y-2 font-mono-code text-[11px]">
              {zScores.map((z) => (
                <div key={z.name} className="min-w-0">
                  <div className="flex justify-between text-slate-300 mb-0.5 text-[10px]">
                    <span className="truncate">{z.name}</span>
                    <span className="text-amber-300 font-bold ml-1">{z.val}σ</span>
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

          <div className="rounded-xl bg-slate-950/20 backdrop-blur-xs border border-slate-800/40 p-3 flex flex-col justify-between font-mono-code text-[10px] min-w-0">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
              <span className="text-cyan-300 font-bold flex items-center gap-1.5 truncate">
                <TerminalSquare className="h-3.5 w-3.5 flex-shrink-0" /> Drain3 Structured Container Log Stream
              </span>
              <span className="text-emerald-400 flex-shrink-0">stdout JSON</span>
            </div>
            <div className="space-y-1.5 text-slate-300 overflow-y-auto max-h-[140px] break-words">
              <div className="rounded bg-slate-900/50 backdrop-blur-sm p-1.5 border-l-2 border-emerald-400">
                <span className="text-slate-500">[INFO]</span> svc={selectedService} http.resp.status=200 took_ms={Number(latestPoint.latency || 18).toFixed(0)}ms
              </div>
              {predClass !== 'NORMAL' ? (
                <div className="rounded bg-rose-950/45 backdrop-blur-sm p-1.5 border-l-2 border-rose-500 text-rose-200">
                  <span className="font-bold">[ERROR]</span> template_hit={predClass} z_score=+4.62σ anomaly_detected=true
                </div>
              ) : (
                <div className="rounded bg-slate-900/50 backdrop-blur-sm p-1.5 border-l-2 border-cyan-400">
                  <span className="text-cyan-400">[TEMPLATE]</span> Drain3 entropy H(t)=0.42 normal baseline window
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
