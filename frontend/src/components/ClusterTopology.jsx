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

// Custom Node for Google OnlineBoutique Microservices
function ServiceNode({ data }) {
  const Icon = serviceIcons[data.id] || Server;
  const status = data.status || 'healthy'; // healthy, predicted, incident, remediating

  const statusStyles = {
    healthy: 'border-emerald-500/60 bg-slate-900/90 shadow-emerald-950/20 text-emerald-400',
    predicted: 'border-amber-400 bg-amber-950/40 shadow-amber-950/40 text-amber-300 animate-pulse',
    incident: 'border-rose-500 bg-rose-950/50 shadow-rose-950/50 text-rose-300 animate-bounce',
    remediating: 'border-cyan-400 bg-cyan-950/40 shadow-cyan-950/40 text-cyan-300 animate-pulse',
  };

  const badgeStyles = {
    healthy: 'bg-emerald-950 border-emerald-700 text-emerald-400',
    predicted: 'bg-amber-950 border-amber-600 text-amber-300',
    incident: 'bg-rose-950 border-rose-600 text-rose-300',
    remediating: 'bg-cyan-950 border-cyan-600 text-cyan-300',
  };

  return (
    <div
      onClick={() => data.onSelect && data.onSelect(data.id)}
      className={`px-3 py-2.5 rounded-xl border-2 shadow-lg backdrop-blur-md cursor-pointer transition-all hover:scale-105 min-w-[170px] ${
        statusStyles[status] || statusStyles.healthy
      } ${data.isSelected ? 'ring-2 ring-cyan-400 shadow-cyan-500/30' : ''}`}
    >
      <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-slate-600" />

      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5">
          <Icon className="h-4 w-4 shrink-0" />
          <span className="text-xs font-bold text-white tracking-wide truncate max-w-[100px]">
            {data.name}
          </span>
        </div>
        <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border font-semibold ${badgeStyles[status]}`}>
          {status.toUpperCase()}
        </span>
      </div>

      <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-800/80">
        <span>Replicas: <strong className="text-white">{data.replicas || 1}</strong></span>
        <span>CPU: <strong className="text-white">{data.cpu || '25%'}</strong></span>
      </div>

      <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-slate-600" />
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
}) {
  // Construct nodes with positions arranged in clear microservice hierarchy
  const initialNodes = useMemo(() => [
    // Layer 0: Gateway
    {
      id: 'frontend',
      type: 'serviceNode',
      position: { x: 380, y: 20 },
      data: { id: 'frontend', name: 'frontend', replicas: 1, cpu: '28%', status: 'healthy', onSelect: onSelectService, isSelected: selectedService === 'frontend' },
    },
    // Layer 1: Core Orchestration
    {
      id: 'checkoutservice',
      type: 'serviceNode',
      position: { x: 200, y: 130 },
      data: { id: 'checkoutservice', name: 'checkoutservice', replicas: 1, cpu: '34%', status: 'healthy', onSelect: onSelectService, isSelected: selectedService === 'checkoutservice' },
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
      if (live.is_remediating) nodeStatus = 'remediating';
      else if (live.is_incident) nodeStatus = 'incident';
      else if (live.is_predicted_failure) nodeStatus = 'predicted';

      return {
        ...n,
        data: {
          ...n.data,
          replicas: live.replicas || 1,
          cpu: live.cpu_usage ? `${Math.round(live.cpu_usage)}%` : n.data.cpu,
          status: nodeStatus,
          isSelected: selectedService === n.id,
          onSelect: onSelectService,
        },
      };
    });
  }, [initialNodes, serviceStates, selectedService, onSelectService]);

  const edges = useMemo(() => [
    { id: 'e-f-c', source: 'frontend', target: 'checkoutservice', animated: true, style: { stroke: '#38bdf8', strokeWidth: 1.5 } },
    { id: 'e-f-r', source: 'frontend', target: 'recommendationservice', style: { stroke: '#475569' } },
    { id: 'e-f-p', source: 'frontend', target: 'productcatalogservice', style: { stroke: '#475569' } },
    { id: 'e-f-cart', source: 'frontend', target: 'cartservice', style: { stroke: '#475569' } },
    { id: 'e-c-pay', source: 'checkoutservice', target: 'paymentservice', style: { stroke: '#475569' } },
    { id: 'e-c-ship', source: 'checkoutservice', target: 'shippingservice', style: { stroke: '#475569' } },
    { id: 'e-c-email', source: 'checkoutservice', target: 'emailservice', style: { stroke: '#475569' } },
    { id: 'e-c-curr', source: 'checkoutservice', target: 'currencyservice', style: { stroke: '#475569' } },
    { id: 'e-r-prod', source: 'recommendationservice', target: 'productcatalogservice', style: { stroke: '#475569' } },
    { id: 'e-f-ad', source: 'frontend', target: 'adservice', style: { stroke: '#475569' } },
  ], []);

  return (
    <div className="relative h-[480px] w-full rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden shadow-xl">
      {/* Topology Header & Status Legend */}
      <div className="absolute top-3 left-4 z-10 flex items-center justify-between w-[calc(100%-32px)] pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <span className="text-xs font-bold text-slate-200 tracking-wider font-mono">
            SERVICE TOPOLOGY MAP (OnlineBoutique)
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
            10 Microservices
          </span>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[11px] font-mono pointer-events-auto bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-lg shadow-sm">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Healthy
          </span>
          <span className="flex items-center gap-1.5 text-amber-300">
            <span className="h-2 w-2 rounded-full bg-amber-400" /> Predicted (Lead-Time)
          </span>
          <span className="flex items-center gap-1.5 text-rose-400">
            <span className="h-2 w-2 rounded-full bg-rose-500" /> Active Incident
          </span>
          <span className="flex items-center gap-1.5 text-cyan-400">
            <span className="h-2 w-2 rounded-full bg-cyan-400" /> Healing
          </span>
        </div>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
        className="bg-slate-950"
      >
        <Background color="#1e293b" gap={18} size={1} />
        <Controls className="!bg-slate-900 !border-slate-800 !text-slate-300" />
      </ReactFlow>
    </div>
  );
}
