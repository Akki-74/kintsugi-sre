import React, { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
} from '@xyflow/react';
import { Server, Cpu, Database, CreditCard, ShoppingBag, Truck, Mail, Layers, Sparkles } from 'lucide-react';

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

function ServiceNode({ data }) {
  const Icon = serviceIcons[data.id] || Server;
  const status = data.status || 'healthy';
  const replicas = Math.min(Math.max(Number(data.replicas || 1), 1), 5);

  const statusStyles = {
    healthy: 'border-emerald-500/60 bg-slate-900/90 shadow-emerald-950/30 text-emerald-400',
    predicted: 'border-amber-400 bg-amber-950/50 shadow-amber-950/50 text-amber-300 animate-pulse',
    incident: 'border-rose-500 bg-rose-950/60 shadow-[0_0_20px_rgba(244,63,94,0.45)] text-rose-300 animate-bounce',
    remediating: 'border-cyan-400 bg-cyan-950/50 shadow-[0_0_18px_rgba(34,211,238,0.4)] text-cyan-300 animate-pulse',
    verified_repaired: 'border-amber-400 shadow-[0_0_22px_rgba(251,191,36,0.55)] ring-1 ring-amber-300/60 bg-gradient-to-br from-slate-900/95 via-amber-950/45 to-slate-900/95 text-amber-300',
  };

  const badgeStyles = {
    healthy: 'bg-emerald-950/90 border-emerald-700/80 text-emerald-400',
    predicted: 'bg-amber-950/90 border-amber-500 text-amber-300',
    incident: 'bg-rose-950/90 border-rose-500 text-rose-300',
    remediating: 'bg-cyan-950/90 border-cyan-500 text-cyan-300',
    verified_repaired: 'bg-amber-950/95 border-amber-400 text-amber-200 shadow-[0_0_10px_rgba(251,191,36,0.6)] font-bold',
  };

  const dotColor =
    status === 'verified_repaired'
      ? 'bg-amber-400 shadow-[0_0_6px_#fbbf24]'
      : status === 'incident'
      ? 'bg-rose-500 shadow-[0_0_6px_#f43f5e]'
      : status === 'remediating'
      ? 'bg-cyan-400 shadow-[0_0_6px_#22d3ee]'
      : 'bg-emerald-400 shadow-[0_0_5px_#34d399]';

  return (
    <div
      onClick={() => data.onSelect && data.onSelect(data.id)}
      className={`px-3.5 py-2.5 rounded-xl border-2 backdrop-blur-md cursor-pointer transition-all duration-300 hover:scale-105 min-w-[182px] ${
        statusStyles[status] || statusStyles.healthy
      } ${data.isSelected ? 'ring-2 ring-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.35)]' : ''}`}
    >
      <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-slate-500" />
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5">
          <Icon className="h-4 w-4 shrink-0" />
          <span className="text-xs font-bold text-white tracking-wide truncate max-w-[96px]">
            {data.name}
          </span>
        </div>
        {status === 'verified_repaired' ? (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md border font-bold bg-amber-950/95 border-amber-400 text-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.55)] flex items-center gap-1">
            ✦ Kintsugi
          </span>
        ) : (
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border font-semibold ${badgeStyles[status]}`}>
            {status.toUpperCase()}
          </span>
        )}
      </div>

      {/* Pod Replica Visual Dots + Memory Limit */}
      <div className="flex items-center justify-between text-[10px] font-mono text-slate-300 py-1 border-t border-slate-800/80">
        <div className="flex items-center gap-1" title={`${replicas} Running Pod Replicas`}>
          <span className="text-slate-400">Pods:</span>
          <div className="flex items-center gap-1 ml-0.5">
            {Array.from({ length: replicas }).map((_, idx) => (
              <span key={idx} className={`h-2 w-2 rounded-full ${dotColor}`} />
            ))}
          </div>
          <strong className="text-white ml-0.5">({replicas})</strong>
        </div>
        <span className="text-slate-400">
          CPU: <strong className="text-white">{data.cpu || '24%'}</strong>
        </span>
      </div>

      <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 pt-0.5">
        <span>Mem Limit: <strong className="text-slate-200">{data.memLimit || '128Mi'}</strong></span>
        {status === 'verified_repaired' && (
          <span className="text-amber-300 font-semibold">SEAM VERIFIED</span>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-slate-500" />
    </div>
  );
}

const nodeTypes = {
  serviceNode: ServiceNode,
};

export default function ClusterTopology({
  serviceStates = {},
  nodeStates = {},
  selectedService,
  onSelectService,
}) {
  const initialNodes = useMemo(() => [
    { id: 'frontend', type: 'serviceNode', position: { x: 380, y: 18 }, data: { id: 'frontend', name: 'frontend', replicas: 1, cpu: '28%', status: 'healthy' } },
    { id: 'checkoutservice', type: 'serviceNode', position: { x: 190, y: 130 }, data: { id: 'checkoutservice', name: 'checkoutservice', replicas: 1, cpu: '34%', status: 'healthy' } },
    { id: 'recommendationservice', type: 'serviceNode', position: { x: 570, y: 130 }, data: { id: 'recommendationservice', name: 'recommendation', replicas: 1, cpu: '22%', status: 'healthy' } },
    { id: 'cartservice', type: 'serviceNode', position: { x: 25, y: 245 }, data: { id: 'cartservice', name: 'cartservice', replicas: 1, cpu: '31%', status: 'healthy' } },
    { id: 'paymentservice', type: 'serviceNode', position: { x: 225, y: 245 }, data: { id: 'paymentservice', name: 'paymentservice', replicas: 1, cpu: '18%', status: 'healthy' } },
    { id: 'productcatalogservice', type: 'serviceNode', position: { x: 425, y: 245 }, data: { id: 'productcatalogservice', name: 'productcatalog', replicas: 1, cpu: '20%', status: 'healthy' } },
    { id: 'currencyservice', type: 'serviceNode', position: { x: 625, y: 245 }, data: { id: 'currencyservice', name: 'currencyservice', replicas: 1, cpu: '19%', status: 'healthy' } },
    { id: 'shippingservice', type: 'serviceNode', position: { x: 115, y: 360 }, data: { id: 'shippingservice', name: 'shippingservice', replicas: 1, cpu: '15%', status: 'healthy' } },
    { id: 'emailservice', type: 'serviceNode', position: { x: 320, y: 360 }, data: { id: 'emailservice', name: 'emailservice', replicas: 1, cpu: '12%', status: 'healthy' } },
    { id: 'adservice', type: 'serviceNode', position: { x: 525, y: 360 }, data: { id: 'adservice', name: 'adservice', replicas: 1, cpu: '16%', status: 'healthy' } },
  ], []);

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
          replicas: live.replicas || 1,
          memLimit: live.mem_limit || '128Mi',
          cpu: live.cpu_usage ? `${Math.round(live.cpu_usage)}%` : n.data.cpu,
          status: nodeStatus,
          isSelected: selectedService === n.id,
          onSelect: onSelectService,
        },
      };
    });
  }, [initialNodes, serviceStates, selectedService, onSelectService]);

  const statusById = useMemo(() => {
    const map = {};
    nodes.forEach((n) => { map[n.id] = n.data.status; });
    return map;
  }, [nodes]);

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
    return rawEdges.map((edge) => {
      const sStatus = statusById[edge.source];
      const tStatus = statusById[edge.target];
      const isGold = sStatus === 'verified_repaired' || tStatus === 'verified_repaired';
      const isIncident = sStatus === 'incident' || tStatus === 'incident';
      return {
        ...edge,
        animated: isGold || isIncident || edge.id === 'e-f-c',
        style: isGold
          ? { stroke: '#fbbf24', strokeWidth: 2.4 }
          : isIncident
          ? { stroke: '#f43f5e', strokeWidth: 2.2 }
          : { stroke: '#38bdf8', strokeWidth: 1.3, opacity: 0.65 },
      };
    });
  }, [statusById]);

  const k8sNodes = useMemo(() => {
    const defaults = {
      'desktop-control-plane': { ready: true, cordoned: false },
      'desktop-worker': { ready: true, cordoned: false },
      'desktop-worker2': { ready: true, cordoned: false },
    };
    return Object.keys(nodeStates).length > 0 ? nodeStates : defaults;
  }, [nodeStates]);

  return (
    <div className="relative h-[510px] w-full rounded-2xl kintsugi-glass overflow-hidden">
      {/* Top Header & Legend */}
      <div className="absolute top-3 left-4 z-10 flex flex-wrap items-center justify-between w-[calc(100%-32px)] gap-2 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto bg-slate-950/85 border border-slate-800 px-3 py-1.5 rounded-xl">
          <span className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24]" />
          <span className="text-xs font-bold text-slate-100 tracking-wider font-mono">
            ONLINEBOUTIQUE MESH TOPOLOGY (namespace: hipster)
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-300 border border-amber-500/30">
            10 Microservices
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono pointer-events-auto bg-slate-950/85 border border-slate-800 px-3 py-1.5 rounded-xl">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> Healthy
          </span>
          <span className="flex items-center gap-1.5 text-amber-300">
            <span className="h-2 w-2 rounded-full bg-amber-400" /> Predicted
          </span>
          <span className="flex items-center gap-1.5 text-rose-400">
            <span className="h-2 w-2 rounded-full bg-rose-500" /> Incident
          </span>
          <span className="flex items-center gap-1.5 text-cyan-400">
            <span className="h-2 w-2 rounded-full bg-cyan-400" /> Healing
          </span>
          <span className="flex items-center gap-1.5 text-amber-300 font-bold">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24]" /> ✦ Kintsugi Gold Seam
          </span>
        </div>
      </div>

      {/* Bottom 3-Node Kubernetes Cluster Hardware HUD */}
      <div className="absolute bottom-3 left-14 z-10 flex flex-wrap items-center gap-2 pointer-events-auto bg-slate-950/90 border border-slate-800/90 px-3 py-1.5 rounded-xl shadow-lg">
        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mr-1">
          K8s Cluster Nodes:
        </span>
        {Object.entries(k8sNodes).map(([nodeName, info]) => (
          <div
            key={nodeName}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-mono ${
              info.cordoned
                ? 'bg-amber-950/70 border-amber-500/60 text-amber-300'
                : 'bg-slate-900/90 border-slate-700/80 text-slate-200'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                info.cordoned ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
              }`}
            />
            <span>{nodeName}</span>
            <span className="text-[9px] text-slate-400">
              [{info.cordoned ? 'CORDONED' : 'READY'}]
            </span>
          </div>
        ))}
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-right"
        className="bg-transparent"
      >
        <Background color="#1e293b" gap={22} size={1} />
        <Controls className="!bg-slate-900/90 !border-slate-700 !text-slate-200" />
      </ReactFlow>
    </div>
  );
}
