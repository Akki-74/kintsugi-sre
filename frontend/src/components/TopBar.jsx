import React from 'react';
import {
  ShieldCheck,
  Cpu,
  Radio,
  Sparkles,
  BarChart3,
  Presentation,
  Search,
  Volume2,
  VolumeX,
  Pause,
  Play,
  Activity,
  Layers
} from 'lucide-react';

export default function TopBar({
  status,
  wsConnected,
  onToggleMode,
  onToggleClusterSource,
  onOpenClusterGate,
  onToggleBackend,
  onOpenBenchmark,
  onOpenCommandPalette,
  streamPaused,
  onToggleStreamPause,
  soundEnabled,
  onToggleSound,
  kintsugiStats
}) {
  const agentMode = status?.agent_mode || 'AUTONOMOUS';
  const clusterMode = status?.cluster_mode || 'LIVE_K8S';
  const llmBackend = status?.llm_backend || 'GROQ_CLOUD';

  return (
    <header className="kintsugi-panel z-30 border-b border-slate-800/80 px-4 py-2 flex flex-col gap-1.5">
      {/* Primary Navigation Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Brand Identity */}
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/25 via-amber-500/10 to-slate-900 border border-amber-400/50 shadow-[0_0_20px_rgba(245,158,11,0.25)]">
            <Sparkles className="h-5 w-5 text-amber-300" />
            <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${wsConnected ? 'bg-emerald-400' : 'bg-rose-400'}`} />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${wsConnected ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-lg font-bold tracking-wider text-white">
                KINTSUGI<span className="kintsugi-gold-text">-AI</span>
              </h1>
              <span className="rounded-full bg-amber-500/15 border border-amber-400/40 px-2 py-0.5 font-mono-code text-[10px] font-semibold text-amber-300">
                金継ぎ v2.4
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Multi-Modal K8s Prediction (XGBoost + SARIMA) &amp; Closed-Loop LangGraph SRE
            </p>
          </div>
        </div>

        {/* Center Command Palette Trigger */}
        <button
          onClick={onOpenCommandPalette}
          className="hidden lg:flex items-center gap-3 rounded-lg bg-slate-900/90 hover:bg-slate-800/90 border border-slate-700/70 hover:border-amber-500/50 px-3.5 py-1.5 text-xs text-slate-300 transition-all shadow-inner group"
          title="Open SRE Command Palette (Ctrl+K)"
        >
          <Search className="h-3.5 w-3.5 text-slate-400 group-hover:text-amber-400 transition-colors" />
          <span className="text-slate-400 group-hover:text-slate-200">
            Search services, inject chaos, or run SRE commands...
          </span>
          <kbd className="rounded bg-slate-800 border border-slate-700 px-1.5 py-0.5 font-mono-code text-[10px] text-amber-300">
            Ctrl K
          </kbd>
        </button>

        {/* Right Controls & Runtime Hot-Swaps */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Telemetry Source Switcher & Cluster Gate */}
          <button
            onClick={onToggleClusterSource}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium border transition-all ${
              clusterMode === 'LIVE_K8S'
                ? status?.is_k8s_connected
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/60 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                  : 'bg-rose-950/60 border-rose-500/50 text-rose-300 hover:bg-rose-900/60 shadow-[0_0_12px_rgba(244,63,94,0.2)]'
                : 'bg-cyan-950/60 border-cyan-500/50 text-cyan-300 hover:bg-cyan-900/60'
            }`}
            title={
              clusterMode === 'LIVE_K8S'
                ? status?.is_k8s_connected
                  ? 'Live Kubernetes Cluster Connected (3-Node Control Plane). Click to switch to Replay Stream.'
                  : 'Live Cluster Offline. Click to switch to Replay Stream.'
                : 'Streaming Chronological Telemetry. Click to switch to Live K8s Cluster.'
            }
          >
            <Radio
              className={`h-3.5 w-3.5 ${
                clusterMode === 'LIVE_K8S' && !status?.is_k8s_connected
                  ? 'text-rose-400'
                  : 'animate-pulse'
              }`}
            />
            <span className="font-mono-code text-[11px]">
              {clusterMode === 'LIVE_K8S'
                ? status?.is_k8s_connected
                  ? 'LIVE K8S (3-NODE)'
                  : 'K8S OFFLINE'
                : 'REPLAY STREAM'}
            </span>
          </button>

          {/* LLM Reasoner Switcher */}
          <button
            onClick={onToggleBackend}
            className="flex items-center gap-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-purple-500/40 px-2.5 py-1.5 text-xs font-medium text-purple-200 transition-all"
            title="Hot-swap between Groq Cloud Qwen3.8-27B and Local LM Studio"
          >
            <Cpu className="h-3.5 w-3.5 text-purple-400" />
            <span className="font-mono-code text-[11px]">
              {llmBackend.includes('GROQ') ? 'QWEN 3.8-27B (GROQ)' : 'LOCAL QWEN-3B'}
            </span>
          </button>

          {/* Auto Remedy vs Manual Approve Segmented Switch */}
          <div className="flex items-center rounded-lg bg-slate-950/90 border border-slate-700/80 p-0.5 shadow-inner" title="Toggle Auto-Remedy (Autonomous) vs Manual Approval (Human-in-the-Loop)">
            <button
              onClick={() => agentMode !== 'AUTONOMOUS' && onToggleMode()}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                agentMode === 'AUTONOMOUS'
                  ? 'bg-amber-500/25 border border-amber-400 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.35)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="h-3 w-3 text-amber-400" />
              <span className="font-mono-code text-[11px]">Auto Remedy</span>
            </button>
            <button
              onClick={() => agentMode === 'AUTONOMOUS' && onToggleMode()}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                agentMode !== 'AUTONOMOUS'
                  ? 'bg-sky-500/25 border border-sky-400 text-sky-200 shadow-[0_0_12px_rgba(56,189,248,0.35)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="h-3 w-3 text-sky-400" />
              <span className="font-mono-code text-[11px]">Manual Approve</span>
            </button>
          </div>

          {/* ML & SARIMA Benchmark Modal Button */}
          <button
            onClick={onOpenBenchmark}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500/25 to-yellow-500/15 hover:from-amber-500/35 hover:to-yellow-500/25 border border-amber-400/60 px-2.5 py-1.5 text-xs font-semibold text-amber-200 transition-all shadow-[0_0_12px_rgba(245,158,11,0.18)]"
          >
            <BarChart3 className="h-3.5 w-3.5 text-amber-300" />
            <span className="hidden md:inline">ML &amp; SARIMA</span>
          </button>

          {/* Technical Slides Link */}
          <a
            href="/app/slides.html"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-amber-300 transition-all"
            title="Open Systems Architecture Slide Deck"
          >
            <Presentation className="h-3.5 w-3.5 text-amber-400" />
            <span className="hidden xl:inline">Deck</span>
          </a>

          {/* Stream Pause/Play & Audio SFX Controls */}
          <div className="flex items-center rounded-lg bg-slate-900/90 border border-slate-800 p-0.5">
            <button
              onClick={onToggleStreamPause}
              className={`p-1.5 rounded-md text-xs transition-colors ${
                streamPaused ? 'bg-amber-500/25 text-amber-300' : 'text-slate-400 hover:text-white'
              }`}
              title={streamPaused ? 'Resume 1Hz Telemetry Stream' : 'Freeze Telemetry Stream for Inspection'}
            >
              {streamPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={onToggleSound}
              className={`p-1.5 rounded-md text-xs transition-colors ${
                soundEnabled ? 'text-amber-300 bg-amber-500/15' : 'text-slate-500 hover:text-slate-300'
              }`}
              title={soundEnabled ? 'Mute Cyber-SRE Audio Chimes' : 'Enable Cyber-SRE Audio Chimes'}
            >
              {soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Executive SRE Telemetry & SLO Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/60 text-[11px]">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Mesh SLO:</span>
            <span className={`font-mono-code font-bold ${
              kintsugiStats.sloHealth >= 95 ? 'text-emerald-400' : kintsugiStats.sloHealth >= 85 ? 'text-amber-400' : 'text-rose-400'
            }`}>
              {kintsugiStats.sloHealth.toFixed(1)}%
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Active Fractures:</span>
            <span className={`font-mono-code font-bold px-1.5 py-0.2 rounded ${
              kintsugiStats.activeIncidents > 0
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                : 'text-slate-300'
            }`}>
              {kintsugiStats.activeIncidents}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-amber-300/90 font-medium">✦ Kintsugi Gold Seams:</span>
            <span className="font-mono-code font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-400/40">
              {kintsugiStats.repairedCount} Verified
            </span>
          </div>

          <div className="hidden md:flex items-center gap-1.5">
            <Activity className="h-3 w-3 text-cyan-400" />
            <span className="text-slate-400">Fast-Brain Latency:</span>
            <span className="font-mono-code text-cyan-300 font-semibold">0.67 ms/tick</span>
          </div>

          <div className="hidden xl:flex items-center gap-1.5">
            <Layers className="h-3 w-3 text-emerald-400" />
            <span className="text-slate-400">Closed-Loop Mean MTTR:</span>
            <span className="font-mono-code text-emerald-300 font-semibold">27.6s</span>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono-code text-[10px] text-slate-400">
          <span>NAMESPACE: <strong className="text-slate-200">hipster</strong> (10 deployments)</span>
          <span>•</span>
          <span className={wsConnected ? 'text-emerald-400' : 'text-rose-400'}>
            {streamPaused ? '⏸ STREAM FROZEN' : wsConnected ? '● 1Hz WS LIVE' : '○ RECONNECTING'}
          </span>
        </div>
      </div>
    </header>
  );
}
