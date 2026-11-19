import React from 'react';
import { Activity, Shield, Cpu, Server, Sparkles, BarChart3, Radio, Layers } from 'lucide-react';

export default function TopBar({
  status = {},
  wsConnected = false,
  autonomousMode = true,
  onToggleMode,
  llmBackend = 'groq',
  onSwitchBackend,
  clusterSource = 'live',
  onSwitchSource,
  onOpenBenchmarks,
}) {
  return (
    <header className="w-full kintsugi-glass border-b border-amber-500/20 px-5 py-3 sticky top-0 z-30">
      <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Brand Identity */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-400/20 via-amber-500/10 to-cyan-500/20 border border-amber-400/60 flex items-center justify-center shadow-[0_0_15px_rgba(251,191,36,0.3)]">
            <Sparkles className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-amber-200 via-amber-400 to-cyan-300 bg-clip-text text-transparent">
                KINTSUGI-AI
              </h1>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 font-semibold">
                v1.0 SRE Mesh
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Catch the cracks. Verify the fix. // Multi-Modal K8s Prediction & Ambient Healing
            </p>
          </div>
        </div>

        {/* Live Telemetry & Control Deck */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* WebSocket Stream Status */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono">
            <span className={`h-2 w-2 rounded-full ${wsConnected ? 'bg-emerald-400 animate-ping' : 'bg-rose-500'}`} />
            <span className="text-slate-300">{wsConnected ? '1Hz STREAM LIVE' : 'RECONNECTING'}</span>
          </div>

          {/* Telemetry Source Switcher */}
          <div className="flex items-center bg-slate-950/90 p-1 rounded-xl border border-slate-800 text-xs font-mono">
            <button
              onClick={() => onSwitchSource && onSwitchSource('live')}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                clusterSource === 'live'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Server className="h-3.5 w-3.5" />
              Live K8s
            </button>
            <button
              onClick={() => onSwitchSource && onSwitchSource('replay')}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                clusterSource !== 'live'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Radio className="h-3.5 w-3.5" />
              Digital Twin
            </button>
          </div>

          {/* LLM Brain Switcher */}
          <div className="flex items-center bg-slate-950/90 p-1 rounded-xl border border-slate-800 text-xs font-mono">
            <button
              onClick={() => onSwitchBackend && onSwitchBackend('groq')}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                llmBackend !== 'lm_studio' && llmBackend !== 'lmstudio'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-400/50 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cpu className="h-3.5 w-3.5" />
              Groq Qwen 3.8-27B
            </button>
            <button
              onClick={() => onSwitchBackend && onSwitchBackend('lm_studio')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                llmBackend === 'lm_studio' || llmBackend === 'lmstudio'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-400/50 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              LM Studio
            </button>
          </div>

          {/* Operating Mode Toggle (Autonomous vs HITL) */}
          <button
            onClick={() => onToggleMode && onToggleMode(!autonomousMode)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold transition-all flex items-center gap-1.5 ${
              autonomousMode
                ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300 hover:bg-emerald-900/60'
                : 'bg-amber-950/80 border-amber-400 text-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.3)]'
            }`}
          >
            <Shield className="h-3.5 w-3.5" />
            {autonomousMode ? 'MODE: AUTONOMOUS' : 'MODE: HUMAN-IN-THE-LOOP'}
          </button>

          {/* Benchmark Modal Button */}
          <button
            onClick={onOpenBenchmarks}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-cyan-500/20 hover:from-amber-500/30 hover:to-cyan-500/30 border border-amber-400/50 text-amber-200 text-xs font-mono font-bold flex items-center gap-1.5 shadow-[0_0_12px_rgba(251,191,36,0.2)] transition-all"
          >
            <BarChart3 className="h-3.5 w-3.5 text-amber-400" />
            ML & SARIMA Benchmarks
          </button>
        </div>
      </div>
    </header>
  );
}
