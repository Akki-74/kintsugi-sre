import React, { useState, useEffect, useRef } from 'react';
import TopBar from './components/TopBar';
import ClusterTopology from './components/ClusterTopology';
import TelemetryCharts from './components/TelemetryCharts';
import AgentConsole from './components/AgentConsole';

export default function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [autonomousMode, setAutonomousMode] = useState(true);
  const [llmBackend, setLlmBackend] = useState('lmstudio');
  const [clusterSource, setClusterSource] = useState('replay');
  const [selectedService, setSelectedService] = useState('frontend');

  const [activeTick, setActiveTick] = useState(null);
  const [currentTickData, setCurrentTickData] = useState({});
  const [serviceStates, setServiceStates] = useState({});
  const [telemetryHistory, setTelemetryHistory] = useState([]);
  const [agentEvent, setAgentEvent] = useState(null);
  const [pendingPlan, setPendingPlan] = useState(null);

  const wsRef = useRef(null);

  // Initialize and maintain resilient WebSocket connection
  useEffect(() => {
    let ws = null;
    let reconnectTimeout = null;

    const connectWebSocket = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname || 'localhost';
      const port = window.location.port === '5173' ? '8000' : (window.location.port || '8000');
      const wsUrl = `${protocol}//${host}:${port}/ws/telemetry`;

      console.log(`Connecting to WebSocket at ${wsUrl}...`);
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected.');
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const tick = JSON.parse(event.data);
          if (tick.status === 'NO_DATA') return;

          setActiveTick(tick.tick_index);
          setCurrentTickData(tick);

          // Update cluster state
          if (tick.cluster_state) {
            setServiceStates(tick.cluster_state);
          }

          // If current tick targets a specific service, record in history
          const svc = tick.service || 'frontend';
          const cpu = tick.metrics?.['CpuUsageRate(%)'] || 25.0;
          const mem = tick.metrics?.['MemoryUsageRate(%)'] || 30.0;
          const cpu_z = ((cpu - 25.0) / 12.0);
          const mem_z = ((mem - 40.0) / 15.0);

          setTelemetryHistory((prev) => {
            const next = [
              ...prev,
              {
                time: new Date().toLocaleTimeString(),
                cpu,
                mem,
                cpu_z: parseFloat(cpu_z.toFixed(2)),
                mem_z: parseFloat(mem_z.toFixed(2)),
              },
            ];
            return next.slice(-25); // Keep rolling 25 points
          });

          // Update agent event
          if (tick.agent_event) {
            setAgentEvent(tick.agent_event);
          }

          // Update pending HITL plan
          if (tick.pending_hitl && tick.pending_plan) {
            setPendingPlan(tick.pending_plan);
          } else if (!tick.pending_hitl) {
            setPendingPlan(null);
          }

          if (tick.autonomous_mode !== undefined) {
            setAutonomousMode(tick.autonomous_mode);
          }
        } catch (err) {
          console.error('Error processing telemetry tick:', err);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected. Retrying in 2.5s...');
        setIsConnected(false);
        reconnectTimeout = setTimeout(connectWebSocket, 2500);
      };

      ws.onerror = (err) => {
        console.error('WebSocket encountered error:', err);
        ws.close();
      };
    };

    connectWebSocket();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // Handler for Chaos Injection
  const handleInjectChaos = async (service, faultType) => {
    try {
      const res = await fetch('/api/chaos/inject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service, fault_type: faultType }),
      });
      const data = await res.json();
      console.log('Chaos injected:', data);
    } catch (e) {
      console.error('Failed to inject chaos:', e);
    }
  };

  // Handler for Operator Approval
  const handleApprovePlan = async () => {
    try {
      const res = await fetch('/api/agent/approve', { method: 'POST' });
      const data = await res.json();
      console.log('Plan approved:', data);
      setPendingPlan(null);
    } catch (e) {
      console.error('Failed to approve plan:', e);
    }
  };

  // Handler for Operator Rejection
  const handleRejectPlan = async () => {
    try {
      const res = await fetch('/api/agent/reject', { method: 'POST' });
      const data = await res.json();
      console.log('Plan rejected:', data);
      setPendingPlan(null);
    } catch (e) {
      console.error('Failed to reject plan:', e);
    }
  };

  return (
    <div className="min-h-screen bg-[#070d19] text-slate-100 flex flex-col font-sans">
      {/* 1. Global Navigation TopBar */}
      <TopBar
        isConnected={isConnected}
        autonomousMode={autonomousMode}
        setAutonomousMode={setAutonomousMode}
        llmBackend={llmBackend}
        setLlmBackend={setLlmBackend}
        clusterSource={clusterSource}
        setClusterSource={setClusterSource}
        activeTick={activeTick}
      />

      {/* 2. Main Dashboard Content Grid */}
      <main className="flex-1 p-6 grid grid-cols-1 xl:grid-cols-3 gap-6 overflow-hidden">
        {/* Left Column (2 Cols on XL): Topology & Telemetry Charts */}
        <div className="xl:col-span-2 flex flex-col gap-6">
          {/* Interactive Topology Graph */}
          <ClusterTopology
            serviceStates={serviceStates}
            selectedService={selectedService}
            onSelectService={setSelectedService}
            latestPrediction={currentTickData.prediction}
          />

          {/* Real-time Telemetry Charts & Chaos Injector */}
          <TelemetryCharts
            selectedService={selectedService}
            telemetryHistory={telemetryHistory}
            currentTickData={currentTickData}
            onInjectChaos={handleInjectChaos}
          />
        </div>

        {/* Right Column (1 Col on XL): LangGraph Ambient SRE Agent Console */}
        <div className="xl:col-span-1 h-full min-h-[500px]">
          <AgentConsole
            agentEvent={agentEvent}
            pendingPlan={pendingPlan}
            onApprovePlan={handleApprovePlan}
            onRejectPlan={handleRejectPlan}
            autonomousMode={autonomousMode}
          />
        </div>
      </main>
    </div>
  );
}
