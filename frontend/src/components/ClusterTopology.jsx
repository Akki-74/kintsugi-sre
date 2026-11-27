import React, { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  MarkerType
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Server,
  Sparkles,
  AlertTriangle,
  Activity,
  CheckCircle2,
  HardDrive,
  Flame,
  Terminal,
  X
} from 'lucide-react';

// Deterministic 3-Tier Topological 10-Microservice OnlineBoutique Layout
const NODE_POSITIONS = {
  frontend: { x: 515, y: 0 },
  adservice: { x: 0, y: 190 },
  checkoutservice: { x: 220, y: 190 },
  recommendationservice: { x: 960, y: 190 },
  paymentservice: { x: 0, y: 385 },
  emailservice: { x: 205, y: 385 },
  shippingservice: { x: 410, y: 385 },
  cartservice: { x: 615, y: 385 },
  currencyservice: { x: 820, y: 385 },
  productcatalogservice: { x: 1025, y: 385 }
};

function ServiceCustomNode({ data }) {
  const {
    label,
    status,
    cpu,
    memory,
    replicas = 1,
    nodeName = 'desktop-worker',
    faultType,
    isVerifiedRepaired,
    selected
  } = data;

  const isGold = isVerifiedRepaired || status === 'verified_repaired';
  const isIncident = status === 'incident' || status === 'critical';
  const isPredicted = status === 'predicted' || status === 'warning';
  const isHealing = status === 'remediating';

  let cardStyle =
    'bg-slate-900/35 backdrop-blur-sm border-slate-700/50 hover:border-slate-300 text-slate-100 shadow-md';
  let statusBadge = (
    <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300">
      <CheckCircle2 className="h-2.5 w-2.5" /> HEALTHY
    </span>
  );

  if (isGold) {
    cardStyle = 'node-gold-seam text-amber-50';
    statusBadge = (
      <span className="flex items-center gap-1 rounded-full bg-amber-400/25 border border-amber-300 px-1.5 py-0.5 text-[9px] font-bold text-amber-200 shadow-[0_0_10px_rgba(251,191,36,0.5)]">
        <Sparkles className="h-2.5 w-2.5 text-amber-300" /> ✦ KINTSUGI
      </span>
    );
  } else if (isIncident) {
    cardStyle = 'node-incident-glow text-rose-50';
    statusBadge = (
      <span className="flex items-center gap-1 rounded-full bg-rose-500/30 border border-rose-400 px-1.5 py-0.5 text-[9px] font-bold text-rose-200">
        <AlertTriangle className="h-2.5 w-2.5 text-rose-300" /> FRACTURE
      </span>
    );
  } else if (isHealing) {
    cardStyle =
      'bg-cyan-950/35 backdrop-blur-sm border-2 border-cyan-400/80 shadow-[0_0_20px_rgba(56,189,248,0.3)] text-cyan-50';
    statusBadge = (
      <span className="flex items-center gap-1 rounded-full bg-cyan-500/25 border border-cyan-300 px-1.5 py-0.5 text-[9px] font-bold text-cyan-200 animate-pulse">
        <Activity className="h-2.5 w-2.5" /> HEALING
      </span>
    );
  } else if (isPredicted) {
    cardStyle =
      'bg-amber-950/35 backdrop-blur-sm border-2 border-amber-500/80 shadow-[0_0_18px_rgba(245,158,11,0.25)] text-amber-50';
    statusBadge = (
      <span className="flex items-center gap-1 rounded-full bg-amber-500/25 border border-amber-400 px-1.5 py-0.5 text-[9px] font-bold text-amber-200">
        <AlertTriangle className="h-2.5 w-2.5" /> HORIZON
      </span>
    );
  }

  const replicaCount = Math.max(1, Math.min(5, Number(replicas) || 1));

  return (
    <div
      className={`relative w-[152px] rounded-xl border p-2 transition-all duration-300 cursor-pointer ${cardStyle} ${
        selected ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-950 scale-[1.03]' : ''
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-amber-400 !w-2 !h-2 !border-0" />

      {/* Decorative Kintsugi Gold Fracture SVG Overlay when Repaired */}
      {isGold && (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full opacity-55"
          viewBox="0 0 160 90"
          fill="none"
        >
          <path
            d="M12 85 L48 52 L42 34 L88 18 L118 28 L152 6"
            stroke="url(#goldSeamGrad)"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <defs>
            <linearGradient id="goldSeamGrad" x1="0" y1="0" x2="160" y2="90">
              <stop offset="0%" stopColor="#fde047" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#fef08a" />
            </linearGradient>
          </defs>
        </svg>
      )}

      {/* Header: Service Name & Status Pill */}
      <div className="relative z-10 flex items-center justify-between gap-1 mb-1.5">
        <span className="font-display text-[11px] font-bold tracking-tight truncate">
          {label.replace('service', '')}
        </span>
        {statusBadge}
      </div>

      {/* CPU & Memory Mini Bars */}
      <div className="relative z-10 space-y-1 font-mono-code text-[10px]">
        <div>
          <div className="flex justify-between text-slate-300">
            <span>CPU</span>
            <span className={cpu > 75 ? 'text-rose-300 font-bold' : 'text-slate-200'}>
              {Number(cpu || 0).toFixed(1)}%
            </span>
          </div>
          <div className="h-1 w-full rounded-full bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isGold
                  ? 'bg-gradient-to-r from-amber-400 to-yellow-300'
                  : cpu > 75
                  ? 'bg-rose-500'
                  : 'bg-cyan-400'
              }`}
              style={{ width: `${Math.min(100, Math.max(4, Number(cpu || 0)))}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-slate-300">
            <span>MEM</span>
            <span className={memory > 80 ? 'text-amber-300 font-bold' : 'text-slate-200'}>
              {Number(memory || 0).toFixed(1)}%
            </span>
          </div>
          <div className="h-1 w-full rounded-full bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isGold
                  ? 'bg-gradient-to-r from-amber-400 to-yellow-300'
                  : memory > 80
                  ? 'bg-amber-500'
                  : 'bg-emerald-400'
              }`}
              style={{ width: `${Math.min(100, Math.max(4, Number(memory || 0)))}%` }}
            />
          </div>
        </div>
      </div>

      {/* Footer: Pod Replica Dots & Physical K8s Worker Node */}
      <div className="relative z-10 mt-2 pt-1.5 border-t border-slate-700/50 flex items-center justify-between text-[9px] font-mono-code text-slate-300">
        <div className="flex items-center gap-1" title={`${replicaCount} Ready Pod Replicas`}>
          <span className="text-slate-400">PODS</span>
          <div className="flex items-center gap-0.5">
            {Array.from({ length: replicaCount }).map((_, i) => (
              <span
                key={i}
                className={`h-2 w-2 rounded-full ${
                  isGold
                    ? 'bg-amber-300 shadow-[0_0_6px_#fbbf24]'
                    : isIncident
                    ? 'bg-rose-400'
                    : 'bg-emerald-400'
                }`}
              />
            ))}
          </div>
          <span className="text-amber-300 font-bold">{replicaCount}/1</span>
        </div>
        <span className="truncate max-w-[74px] text-slate-400" title={nodeName}>
          {nodeName.replace('desktop-', '')}
        </span>
      </div>

      {/* Active Fault Tag */}
      {faultType && faultType !== 'NORMAL' && !isGold && (
        <div className="relative z-10 mt-1 rounded bg-rose-950/90 border border-rose-500/50 px-1.5 py-0.5 text-center font-mono-code text-[8px] font-bold text-rose-200 truncate">
          {faultType}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-amber-400 !w-2 !h-2 !border-0" />
    </div>
  );
}

const nodeTypes = { serviceNode: ServiceCustomNode };

export default function ClusterTopology({
  topology,
  selectedService,
  onSelectService,
  clusterNodes = [],
  onQuickChaos
}) {
  const [showInspector, setShowInspector] = React.useState(true);

  const rfNodes = useMemo(() => {
    const rawNodes = topology?.nodes || [];
    return rawNodes.map((n) => {
      const id = n.id || n.service;
      const pos = NODE_POSITIONS[id] || { x: 200, y: 200 };
      return {
        id,
        type: 'serviceNode',
        position: pos,
        data: {
          label: id,
          status: n.status || 'healthy',
          cpu: n.cpu ?? n.metrics?.cpu ?? 12.4,
          memory: n.memory ?? n.metrics?.memory ?? 28.1,
          latency: n.latency ?? n.metrics?.latency ?? 18.5,
          replicas: n.replicas || 1,
          nodeName: n.node || 'desktop-worker',
          faultType: n.fault_type || n.predicted_fault || 'NORMAL',
          isVerifiedRepaired: Boolean(n.is_verified_repaired || n.status === 'verified_repaired'),
          selected: id === selectedService
        }
      };
    });
  }, [topology, selectedService]);

  const rfEdges = useMemo(() => {
    const rawEdges = topology?.edges || [];
    return rawEdges.map((e, idx) => {
      const isSelectedLink = e.source === selectedService || e.target === selectedService;
      const strokeColor = isSelectedLink ? '#fbbf24' : '#f59e0b';
      return {
        id: e.id || `e-${e.source}-${e.target}-${idx}`,
        source: e.source,
        target: e.target,
        animated: true,
        style: {
          stroke: strokeColor,
          strokeWidth: isSelectedLink ? 2.2 : 1.7,
          opacity: isSelectedLink ? 0.92 : 0.68
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: strokeColor,
          width: 15,
          height: 15
        }
      };
    });
  }, [topology, selectedService]);

  const inspectedNode = useMemo(() => {
    return rfNodes.find((n) => n.id === selectedService)?.data || rfNodes[0]?.data;
  }, [rfNodes, selectedService]);

  const hardwareNodes =
    clusterNodes.length > 0
      ? clusterNodes
      : [
          { name: 'desktop-control-plane', role: 'control-plane', status: 'Ready', pods: 8 },
          { name: 'desktop-worker', role: 'worker-1', status: 'Ready', pods: 6 },
          { name: 'desktop-worker2', role: 'worker-2', status: 'Ready', pods: 6 }
        ];

  return (
    <div className="kintsugi-panel relative flex flex-col h-full rounded-2xl overflow-hidden">
      {/* Top Overlay Header + 3-Node Physical Cluster HUD */}
      <div className="z-10 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 bg-slate-950/20 backdrop-blur-xs px-3.5 py-2">
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4 text-amber-400" />
          <h2 className="font-display text-xs font-bold uppercase tracking-wider text-slate-200">
            OnlineBoutique 10-Service Mesh
          </h2>
          <span className="rounded bg-slate-800/50 border border-slate-700/60 px-1.5 py-0.5 font-mono-code text-[10px] text-amber-300">
            Click node to inspect
          </span>
        </div>

        {/* 3-Node Kubernetes Hardware Capacity Pills */}
        <div className="flex items-center gap-1.5">
          {hardwareNodes.map((hn) => {
            const unschedulable = hn.unschedulable || hn.status === 'Cordoned';
            return (
              <div
                key={hn.name}
                className={`flex items-center gap-1.5 rounded-lg border px-2 py-0.5 font-mono-code text-[10px] backdrop-blur-xs ${
                  unschedulable
                    ? 'bg-rose-950/40 border-rose-500/50 text-rose-200'
                    : 'bg-slate-900/30 border-slate-700/50 text-slate-300'
                }`}
                title={`K8s Node: ${hn.name} (${hn.status})`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    unschedulable ? 'bg-rose-400 animate-ping' : 'bg-emerald-400'
                  }`}
                />
                <span>{hn.name.replace('desktop-', '')}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main XYFlow Canvas */}
      <div className="relative flex-1 w-full">
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => {
            onSelectService(node.id);
            setShowInspector(true);
          }}
          fitView
          fitViewOptions={{ padding: 0.14 }}
          minZoom={0.38}
          maxZoom={1.6}
        >
          <Background color="#334155" gap={24} size={1} />
          <Controls position="bottom-left" showInteractive={false} />
        </ReactFlow>

        {/* Floating Deep-Inspector HUD Drawer for Selected Microservice */}
        {inspectedNode && showInspector && (
          <div className="absolute top-3 right-3 z-20 w-64 rounded-xl bg-slate-950/40 border border-amber-500/40 p-3 shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <Terminal className="h-3.5 w-3.5 text-amber-400" />
                  <span className="font-display text-xs font-bold text-white">
                    {inspectedNode.label}
                  </span>
                </div>
                <span className="font-mono-code text-[10px] text-slate-400">
                  ns/hipster • node/{inspectedNode.nodeName.replace('desktop-', '')}
                </span>
              </div>
              <button
                onClick={() => setShowInspector(false)}
                className="rounded p-0.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Live Spec & Z-Score Mini Gauges */}
            <div className="space-y-1.5 font-mono-code text-[10px]">
              <div className="flex justify-between">
                <span className="text-slate-400">Container Image:</span>
                <span className="text-cyan-300">python:3.11-alpine</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Cgroup Limits:</span>
                <span className="text-slate-200">200m CPU / 128Mi</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Active Replicas:</span>
                <span className="text-amber-300 font-bold">{inspectedNode.replicas} / 5 max</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">CPU / Memory:</span>
                <span className="text-emerald-300">
                  {Number(inspectedNode.cpu || 0).toFixed(1)}% / {Number(inspectedNode.memory || 0).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Kintsugi Status:</span>
                <span className={inspectedNode.isVerifiedRepaired ? 'text-amber-300 font-bold' : 'text-slate-200'}>
                  {inspectedNode.isVerifiedRepaired ? '✦ GOLD SEAM SEALED' : inspectedNode.status.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Quick Targeted Chaos Trigger Button */}
            {onQuickChaos && (
              <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex gap-1.5">
                <button
                  onClick={() => onQuickChaos('cpu_contention', inspectedNode.label)}
                  className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/50 py-1 text-[10px] font-semibold text-rose-200 transition-all"
                >
                  <Flame className="h-3 w-3 text-rose-400" /> Stress CPU
                </button>
                <button
                  onClick={() => onQuickChaos('memory_leak', inspectedNode.label)}
                  className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 py-1 text-[10px] font-semibold text-amber-200 transition-all"
                >
                  <HardDrive className="h-3 w-3 text-amber-400" /> Leak Mem
                </button>
              </div>
            )}
          </div>
        )}

        {/* Legend Footer Overlay */}
        <div className="pointer-events-none absolute bottom-2.5 right-3 z-10 hidden sm:flex items-center gap-3 rounded-lg bg-slate-950/30 backdrop-blur-xs border border-slate-800/60 px-3 py-1 text-[10px] font-mono-code text-slate-300">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> Healthy
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-400" /> Horizon
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-rose-500" /> Fracture
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-cyan-400" /> Healing
          </span>
          <span className="flex items-center gap-1 text-amber-300 font-bold">
            ✦ Kintsugi Gold Seam
          </span>
        </div>
      </div>
    </div>
  );
}
