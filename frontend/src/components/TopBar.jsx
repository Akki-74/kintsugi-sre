import React from 'react';
import { ShieldCheck, Cpu, Play, Pause, Activity, Zap, Server, BarChart3, Sparkles } from 'lucide-react';

export default function TopBar({
  isConnected,
  autonomousMode,
  setAutonomousMode,
  llmBackend,
  setLlmBackend,
  clusterSource,
  setClusterSource,
  activeTick,
  onOpenBenchmarks,
}) {
  const toggleMode = async () => {
    const nextMode = !autonomousMode;
    try {
      await fetch('/api/agent/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autonomous: nextMode }),
      });
      setAutonomousMode(nextMode);
    } catch (e) {
      console.error('Failed to toggle agent mode:', e);
      setAutonomousMode(nextMode);
    }
  };

  return (
    <header className="h-16 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl px-5 flex items-center justify-between z-20 sticky top-0 shadow-lg shadow-black/40">
      {/* Brand & Kintsugi Identity */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 via-amber-600 to-yellow-700 flex items-center justify-center shadow-lg shadow-amber-500/20 border border-amber-400/40 relative group cursor-pointer">
          <Sparkles className="h-5 w-5 text-amber-100 animate-pulse" />
          <div className="absolute -inset-0.5 rounded-xl bg-amber-400/20 blur-sm group-hover:bg-amber-400/40 transition-all pointer-events-none" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-extrabold text-white tracking-wider flex items-center gap-1">
              KINTSUGI<span className="text-amber-400">.AI</span>
            </h1>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-950/90 border border-amber-600/70 text-amber-300 font-bold shadow-sm">
              FSE'23 BENCHMARK
            </span>
          </div>
          <p className="text-[11px] text-slate-400 tracking-tight">
            <span className="text-amber-300/90 font-medium">Catch the cracks.</span> Verify the fix.
          </p>
        </div>
      </div>

      {/* Control Switchers & Benchmark Modal Trigger */}
      <div className="flex items-center gap-2.5">
        {/* ML & SARIMA Benchmarks Modal Button */}
        <button
          onClick={onOpenBenchmarks}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-950/80 to-slate-900 border border-amber-500/50 hover:border-amber-400 text-amber-300 hover:text-amber-200 text-xs font-mono font-bold transition-all shadow-md shadow-amber-950/40 hover:scale-105 active:scale-95"
          title="Open ML & SARIMA Benchmarks Comparison Modal"
        >
          <BarChart3 className="h-3.5 w-3.5 text-amber-400" />
          <span>📊 ML & SARIMA Benchmarks</span>
        </button>

        {/* Telemetry Source Switcher */}
        <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 p-1 rounded-lg text-xs font-mono shadow-inner">
          <Server className="h-3.5 w-3.5 text-slate-400 ml-1.5" />
          <button
            onClick={() => setClusterSource('replay')}
            className={`px-2.5 py-1 rounded transition-all ${
              clusterSource === 'replay'
                ? 'bg-cyan-600 text-white font-bold shadow-sm shadow-cyan-900/50'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Digital Twin Replay
          </button>
          <button
            onClick={() => setClusterSource('live')}
            className={`px-2.5 py-1 rounded transition-all ${
              clusterSource === 'live'
                ? 'bg-indigo-600 text-white font-bold shadow-sm shadow-indigo-900/50'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Live K8s Cluster
          </button>
        </div>

        {/* LLM Model Switcher */}
        <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 p-1 rounded-lg text-xs font-mono shadow-inner">
          <Cpu className="h-3.5 w-3.5 text-slate-400 ml-1.5" />
          <button
            onClick={() => setLlmBackend('groq')}
            className={`px-2.5 py-1 rounded transition-all ${
              llmBackend === 'groq'
                ? 'bg-amber-600 text-white font-bold shadow-sm shadow-amber-900/50'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Groq (Qwen 3.8-27B)
          </button>
          <button
            onClick={() => setLlmBackend('lmstudio')}
            className={`px-2.5 py-1 rounded transition-all ${
              llmBackend === 'lmstudio'
                ? 'bg-emerald-600 text-white font-bold shadow-sm shadow-emerald-900/50'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Local (LM Studio)
          </button>
        </div>

        {/* Autonomous vs HITL Mode Switcher */}
        <button
          onClick={toggleMode}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold font-mono transition-all shadow-sm ${
            autonomousMode
              ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300 hover:bg-emerald-900/90 shadow-emerald-950/40'
              : 'bg-amber-950/80 border-amber-500/70 text-amber-200 hover:bg-amber-900/90 shadow-amber-950/40 animate-pulse'
          }`}
          title="Toggle between Autonomous self-healing and Human-in-the-Loop operator approval"
        >
          {autonomousMode ? (
            <>
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span>AUTONOMOUS HEALING</span>
            </>
          ) : (
            <>
              <Pause className="h-3.5 w-3.5 text-amber-400" />
              <span>HUMAN-IN-THE-LOOP</span>
            </>
          )}
        </button>

        {/* Live WebSocket Health Pulse */}
        <div className="flex items-center gap-1.5 pl-2 border-l border-slate-800 text-xs font-mono">
          <span className={`h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-rose-500 animate-ping'}`} />
          <span className="text-[11px] text-slate-400">{isConnected ? 'ONLINE' : 'CONNECTING'}</span>
        </div>
      </div>
    </header>
  );
}
