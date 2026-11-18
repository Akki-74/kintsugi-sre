import React from 'react';
import { ShieldCheck, Cpu, Play, Pause, Activity, Zap, Server, RefreshCw } from 'lucide-react';

export default function TopBar({
  isConnected,
  autonomousMode,
  setAutonomousMode,
  llmBackend,
  setLlmBackend,
  clusterSource,
  setClusterSource,
  activeTick
}) {
  const toggleMode = async () => {
    const nextMode = !autonomousMode;
    try {
      await fetch('/api/agent/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autonomous: nextMode })
      });
      setAutonomousMode(nextMode);
    } catch (e) {
      console.error('Failed to toggle agent mode:', e);
      setAutonomousMode(nextMode);
    }
  };

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-950/80 backdrop-blur px-6 flex items-center justify-between z-20">
      {/* Brand & Logo */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
          <Activity className="h-5 w-5 text-white animate-pulse" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-white tracking-wide">KINTSUGI<span className="text-cyan-400">.AI</span></h1>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/80 text-cyan-300">v1.0-FSE23</span>
          </div>
          <p className="text-xs text-slate-400">Catch the cracks. Verify the fix. (Autonomous SRE Agent)</p>
        </div>
      </div>

      {/* Control Switchers */}
      <div className="flex items-center gap-3">
        {/* Cluster Source Switcher */}
        <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-lg text-xs font-mono">
          <Server className="h-3.5 w-3.5 text-slate-400 ml-1.5" />
          <button
            onClick={() => setClusterSource('replay')}
            className={`px-2.5 py-1 rounded transition-colors ${
              clusterSource === 'replay'
                ? 'bg-cyan-600 text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Digital Twin Replay
          </button>
          <button
            onClick={() => setClusterSource('live')}
            className={`px-2.5 py-1 rounded transition-colors ${
              clusterSource === 'live'
                ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Live K8s Cluster
          </button>
        </div>

        {/* LLM Model Switcher */}
        <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-lg text-xs font-mono">
          <Cpu className="h-3.5 w-3.5 text-slate-400 ml-1.5" />
          <button
            onClick={() => setLlmBackend('lmstudio')}
            className={`px-2.5 py-1 rounded transition-colors ${
              llmBackend === 'lmstudio'
                ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            LM Studio (Qwen-3B)
          </button>
          <button
            onClick={() => setLlmBackend('groq')}
            className={`px-2.5 py-1 rounded transition-colors ${
              llmBackend === 'groq'
                ? 'bg-amber-600 text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Groq (Llama-70B)
          </button>
        </div>

        {/* Autonomous Mode Toggle */}
        <button
          onClick={toggleMode}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg border text-xs font-semibold font-mono transition-all shadow-sm ${
            autonomousMode
              ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-400 shadow-emerald-950/40'
              : 'bg-amber-950/70 border-amber-500/50 text-amber-400 shadow-amber-950/40'
          }`}
        >
          {autonomousMode ? (
            <>
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>AUTONOMOUS HEALING</span>
            </>
          ) : (
            <>
              <Pause className="h-4 w-4 text-amber-400" />
              <span>HITL APPROVAL MODE</span>
            </>
          )}
        </button>

        {/* WebSocket Pulse */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
          <div className="flex items-center gap-1.5 text-xs font-mono">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isConnected ? 'bg-emerald-400 animate-ping' : 'bg-rose-500'
              }`}
            />
            <span className={isConnected ? 'text-emerald-400' : 'text-rose-400'}>
              {isConnected ? 'LIVE 1Hz' : 'OFFLINE'}
            </span>
          </div>
          {activeTick !== null && (
            <span className="text-[11px] font-mono text-slate-500">
              #{activeTick}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
