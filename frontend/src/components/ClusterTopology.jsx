import React, { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
} from '@xyflow/react';
import { Server, Cpu, Database, CreditCard, ShoppingBag, Truck, Mail, Layers, Sparkles, CheckCircle2, AlertOctagon } from 'lucide-react';

const serviceIcons = {
  frontend: Layers,
  checkoutservice: ShoppingBag,
  cartservice: Database,
  productcatalogservice: Layers,
  currencyservice: CreditCard,
  paymentservice: CreditCard,
  shippingservice: Truck,
  recommendationservice: Sparkles,
  adservice: Server,
  emailservice: Mail,
};

// Custom Node for Google OnlineBoutique Microservices with Pod Replica Dots & Gold Seam
function ServiceNode({ data }) {
  const Icon = serviceIcons[data.id] || Server;
  const status = data.status || 'healthy'; // healthy, predicted, incident, remediating, verified_repaired
  const replicas = Math.max(1, Math.min(5, data.replicas || 1));

  const statusStyles = {
    healthy: 'border-emerald-500/60 bg-slate-900/90 shadow-emerald-950/20 text-emerald-400',
    predicted: 'border-amber-400 bg-amber-950/50 shadow-amber-950/40 text-amber-300 animate-pulse',
    incident: 'border-rose-500 bg-rose-950/60 shadow-rose-950/50 text-rose-300 animate-bounce',
    remediating: 'border-cyan-400 bg-cyan-950/50 shadow-cyan-950/40 text-cyan-300 animate-pulse',
    verified_repaired: 'border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.55)] ring-2 ring-amber-400/60 bg-gradient-to-br from-slate-900/95 via-amber-950/50 to-slate-900/95 text-amber-300 animate-kintsugi-gold',
  };

  const badgeStyles = {
    healthy: 'bg-emerald-950 border-emerald-700 text-emerald-400',
    predicted: 'bg-amber-950 border-amber-600 text-amber-300',
    incident: 'bg-rose-950 border-rose-600 text-rose-300',
    remediating: 'bg-cyan-950 border-cyan-600 text-cyan-300',
    verified_repaired: 'bg-amber-950/95 border-amber-400 text-amber-200 shadow-[0_0_10px_rgba(251,191,36,0.6)] font-bold',
  };

  return (
    <div
      onClick={() => data.onSelect && data.onSelect(data.id)}
      className={`px-3 py-2.5 rounded-xl border-2 shadow-xl backdrop-blur-md cursor-pointer transition-all hover:scale-105 min-w-[175px] ${
        statusStyles[status] || statusStyles.healthy
      } ${data.isSelected ? 'ring-2 ring-cyan-400 shadow-cyan-500/40 scale-105' : ''}`}
    >
      <Handle type="target" position={Position.Top} className="w-2.5 h-2.5 !bg-slate-500" />

      {/* Header with Icon, Name, and Status Badge */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5">
          <Icon className="h-4 w-4 shrink-0" />
          <span className="text-xs font-bold text-white tracking-wide truncate max-w-[95px]">
            {data.name}
          </span>
        </div>
        {status === 'verified_repaired' ? (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded border font-bold bg-amber-950/95 border-amber-400 text-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.6)] flex items-center gap-1 animate-pulse">
            <Sparkles className="h-3 w-3 text-amber-300 animate-spin" />
            ✦ KINTSUGI HEALED
          </span>
        ) : (
          <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border font-semibold ${badgeStyles[status]}`}>
            {status.toUpperCase()}
          </span>
        )}
      </div>

      {/* Pod Dynamic Replica Dots HUD */}
      <div className="flex items-center justify-between py-1 px-1.5 rounded bg-slate-950/60 border border-slate-800/80 my-1">
        <span className="text-[10px] font-mono text-slate-400">Pods:</span>
        <div className="flex items-center gap-1">
          {Array.from({ length: replicas }).map((_, i) => (
            <span
              key={i}
              className={`h-2 w-2 rounded-full transition-all duration-300 ${
                status === 'verified_repaired'
                  ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]'
                  : status === 'incident'
                  ? 'bg-rose-500 shadow-[0_0_6px_#f43f5e]'
                  : 'bg-emerald-400 shadow-[0_0_4px_#34d399]'
              }`}
              title={`Pod Replica #${i + 1} (${status})`}
            />
          ))}
        </div>
      </div>

      {/* Metric Readout */}
      <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-800/80">
        <span>Rep: <strong className="text-white">{data.replicas || 1}</strong></span>
        <span>CPU: <strong className="text-white">{data.cpu || '25%'}</strong></span>
      </div>

      <Handle type="source" position={Position.Bottom} className="w-2.5 h-2.5 !bg-slate-500" />
    </div>
  );
}

const nodeTypes = {
  serviceNode: ServiceNode,
};

export default function ClusterTopology({
  serviceStates = {},
  selectedService,
  onSelectService,
  latestPrediction,
  hardwareNodes = null,
}) {
  // 10 Google OnlineBoutique nodes arranged in layered hierarchical dependency topology
  const initialNodes = useMemo(() => [
    // Layer 0: Gateway
    {
      id: 'frontend',
      type: 'serviceNode',
      position: { x: 380, y: 20 },
      data: { id: 'frontend', name: 'frontend', replicas: 1, cpu: '28%', status: 'healthy', onSelect: onSelectService, isSelected: selectedService === 'frontend' },
    },
    // Layer 1: Core Flow
    {
      id: 'checkoutservice',
      type: 'serviceNode',
      position: { x: 200, y: 130 },
      data: { id: 'checkoutservice', name: 'checkout', replicas: 1, cpu: '35%', status: 'healthy', onSelect: onSelectService, isSelected: selectedService === 'checkoutservice' },
    },
    {
      id: 'recommendationservice',
      type: 'serviceNode',
      position: { x: 560, y: 130 },
      data: { id: 'recommendationservice', name: 'recommendation', replicas: 1, cpu: '22%', status: 'healthy', onSelect: onSelectService, isSelected: selectedService === 'recommendationservice' },
    },
    // Layer 2: Business Logic & Dependencies
    {
      id: 'cartservice',
      type: 'serviceNode',
      position: { x: 40, y: 240 },
      data: { id: 'cartservice', name: 'cartservice', replicas: 1, cpu: '31%', status: 'healthy', onSelect: onSelectService, isSelected: selectedService === 'cartservice' },
    },
    {
      id: 'paymentservice',
      type: 'serviceNode',
      position: { x: 230, y: 240 },
      data: { id: 'paymentservice', name: 'paymentservice', replicas: 1, cpu: '18%', status: 'healthy', onSelect: onSelectService, isSelected: selectedService === 'paymentservice' },
    },
    {
      id: 'productcatalogservice',
      type: 'serviceNode',
      position: { x: 420, y: 240 },
      data: { id: 'productcatalogservice', name: 'productcatalog', replicas: 1, cpu: '20%', status: 'healthy', onSelect: onSelectService, isSelected: selectedService === 'productcatalogservice' },
    },
    {
      id: 'currencyservice',
      type: 'serviceNode',
      position: { x: 610, y: 240 },
      data: { id: 'currencyservice', name: 'currencyservice', replicas: 1, cpu: '19%', status: 'healthy', onSelect: onSelectService, isSelected: selectedService === 'currencyservice' },
    },
    // Layer 3: Supporting Services
    {
      id: 'shippingservice',
      type: 'serviceNode',
      position: { x: 120, y: 350 },
      data: { id: 'shippingservice', name: 'shippingservice', replicas: 1, cpu: '15%', status: 'healthy', onSelect: onSelectService, isSelected: selectedService === 'shippingservice' },
    },
    {
      id: 'emailservice',
      type: 'serviceNode',
      position: { x: 310, y: 350 },
      data: { id: 'emailservice', name: 'emailservice', replicas: 1, cpu: '12%', status: 'healthy', onSelect: onSelectService, isSelected: selectedService === 'emailservice' },
    },
    {
      id: 'adservice',
      type: 'serviceNode',
      position: { x: 500, y: 350 },
      data: { id: 'adservice', name: 'adservice', replicas: 1, cpu: '16%', status: 'healthy', onSelect: onSelectService, isSelected: selectedService === 'adservice' },
    },
  ], [selectedService, onSelectService]);

  // Update node data with live state
  const nodes = useMemo(() => {
    return initialNodes.map((n) => {
      const live = serviceStates[n.id] || {};
      let nodeStatus = 'healthy';
      if (
        live.is_verified_repaired ||
        live.is_repaired ||
        live.repaired === true ||
        live.status === 'VERIFIED' ||
        live.status === 'VerifiedRepaired'
      ) {
        nodeStatus = 'verified_repaired';
      } else if (live.is_remediating || live.status === 'Remediating') {
        nodeStatus = 'remediating';
      } else if (live.is_incident || live.status === 'Incident') {
        nodeStatus = 'incident';
      } else if (live.is_predicted_failure) {
        nodeStatus = 'predicted';
      }

      return {
        ...n,
        data: {
          ...n.data,
          replicas: live.replicas || live.ready_replicas || 1,
          cpu: live.cpu_usage ? `${Math.round(live.cpu_usage)}%` : n.data.cpu,
          status: nodeStatus,
          isSelected: selectedService === n.id,
          onSelect: onSelectService,
        },
      };
    });
  }, [initialNodes, serviceStates, selectedService, onSelectService]);

  // Dynamically turn connected edges to Gold when connected node is repaired
  const edges = useMemo(() => {
    const rawEdges = [
      { id: 'e-f-c', source: 'frontend', target: 'checkoutservice' },
      { id: 'e-f-r', source: 'frontend', target: 'recommendationservice' },
      { id: 'e-f-p', source: 'frontend', target: 'productcatalogservice' },
      { id: 'e-f-cart', source: 'frontend', target: 'cartservice' },
      { id: 'e-c-pay', source: 'checkoutservice', target: 'paymentservice' },
      { id: 'e-c-ship', source: 'checkoutservice', target: 'shippingservice' },
      { id: 'e-c-email', source: 'checkoutservice', target: 'emailservice' },
      { id: 'e-c-curr', source: 'checkoutservice', target: 'currencyservice' },
      { id: 'e-r-prod', source: 'recommendationservice', target: 'productcatalogservice' },
      { id: 'e-f-ad', source: 'frontend', target: 'adservice' },
    ];

    return rawEdges.map((e) => {
      const srcLive = serviceStates[e.source] || {};
      const tgtLive = serviceStates[e.target] || {};
      const isGoldSeamed =
        srcLive.is_verified_repaired ||
        tgtLive.is_verified_repaired ||
        srcLive.status === 'VerifiedRepaired' ||
        tgtLive.status === 'VerifiedRepaired';

      if (isGoldSeamed) {
        return {
          ...e,
          animated: true,
          style: { stroke: '#fbbf24', strokeWidth: 2.5, filter: 'drop-shadow(0 0 5px rgba(251,191,36,0.8))' },
        };
      }

      const isIncident = srcLive.is_incident || tgtLive.is_incident;
      if (isIncident) {
        return {
          ...e,
          animated: true,
          style: { stroke: '#f43f5e', strokeWidth: 2.0 },
        };
      }

      return {
        ...e,
        animated: e.id === 'e-f-c',
        style: { stroke: e.id === 'e-f-c' ? '#38bdf8' : '#334155', strokeWidth: 1.5 },
      };
    });
  }, [serviceStates]);

  // Live 3-Node Kubernetes Hardware Node Status
  const k8sNodes = hardwareNodes || [
    { name: 'desktop-control-plane', role: 'Control Plane', ready: true, cordoned: false },
    { name: 'desktop-worker', role: 'Worker 1', ready: true, cordoned: false },
    { name: 'desktop-worker2', role: 'Worker 2', ready: true, cordoned: false },
  ];

  return (
    <div className="relative h-[480px] w-full rounded-2xl border border-slate-800/90 bg-slate-950/70 overflow-hidden shadow-2xl backdrop-blur-xl">
      {/* Topology Header & Status Legend */}
      <div className="absolute top-3 left-4 z-10 flex items-center justify-between w-[calc(100%-32px)] pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <span className="text-xs font-bold text-slate-200 tracking-wider font-mono">
            SERVICE TOPOLOGY MAP (OnlineBoutique)
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800/80 text-cyan-300 border border-cyan-800/50">
            10 Microservices
          </span>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2.5 text-[11px] font-mono pointer-events-auto bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-lg shadow-md backdrop-blur">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_5px_#10b981]" /> Healthy
          </span>
          <span className="flex items-center gap-1.5 text-amber-300">
            <span className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_5px_#f59e0b]" /> Predicted (TTE)
          </span>
          <span className="flex items-center gap-1.5 text-rose-400">
            <span className="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_5px_#f43f5e]" /> Active Incident
          </span>
          <span className="flex items-center gap-1.5 text-cyan-400">
            <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_5px_#38bdf8]" /> Healing
          </span>
          <span className="flex items-center gap-1.5 text-amber-300 font-bold">
            <span className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)] animate-pulse" /> ✦ Kintsugi Repaired
          </span>
        </div>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
        className="bg-transparent"
      >
        <Background color="#1e293b" gap={20} size={1} />
        <Controls className="!bg-slate-900/90 !border-slate-800 !text-slate-300 shadow-lg" />
      </ReactFlow>

      {/* 3-Node Kubernetes Hardware HUD Pill (Bottom) */}
      <div className="absolute bottom-3 left-4 right-4 z-10 pointer-events-none flex items-center justify-between">
        <div className="pointer-events-auto flex items-center gap-2 bg-slate-900/90 border border-slate-800/90 backdrop-blur-md px-3.5 py-1.5 rounded-xl shadow-lg text-xs font-mono">
          <div className="flex items-center gap-1.5 text-slate-400 pr-2 border-r border-slate-800">
            <Server className="h-3.5 w-3.5 text-indigo-400" />
            <span className="font-semibold text-slate-200">K8s Nodes (3):</span>
          </div>
          {k8sNodes.map((node) => (
            <div key={node.name} className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-950/80 border border-slate-800">
              <span className={`h-2 w-2 rounded-full ${node.cordoned ? 'bg-amber-400 animate-pulse' : node.ready ? 'bg-emerald-400 shadow-[0_0_4px_#34d399]' : 'bg-rose-500'}`} />
              <span className="text-slate-300 text-[11px] font-bold">{node.name.replace('desktop-', '')}</span>
              <span className={`text-[10px] ${node.cordoned ? 'text-amber-400 font-bold' : 'text-slate-500'}`}>
                {node.cordoned ? '[CORDONED]' : node.role}
              </span>
            </div>
          ))}
        </div>
        <div className="pointer-events-auto bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-xl text-[11px] font-mono text-slate-400 shadow-lg">
          Namespace: <strong className="text-cyan-300">hipster</strong> (OnlineBoutique)
        </div>
      </div>
    </div>
  );
}
