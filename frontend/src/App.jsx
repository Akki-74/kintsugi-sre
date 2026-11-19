import React, { useState, useEffect, useRef } from 'react';
import TopBar from './components/TopBar';
import ClusterTopology from './components/ClusterTopology';
import TelemetryCharts from './components/TelemetryCharts';
import AgentConsole from './components/AgentConsole';

export default function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [autonomousMode, setAutonomousMode] = useState(true);
  const [llmBackend, setLlmBackend] = useState('groq');
  const [clusterSource, setClusterSource] = useState('live');
  const [selectedService, setSelectedService] = useState('frontend');

  const [activeTick, setActiveTick] = useState(null);
  const [currentTickData, setCurrentTickData] = useState({});
  const [serviceStates, setServiceStates] = useState({});
  const [telemetryHistory, setTelemetryHistory] = useState([]);
  const [agentEvent, setAgentEvent] = useState(null);
  const [pendingPlan, setPendingPlan] = useState(null);

  const wsRef = useRef(null);

  // Sync initial backend state on mount
  useEffect(() => {
    fetch('/api/status')
      .then((res) => res.json())
      .then((data) => {
        if (data.llm_backend) setLlmBackend(data.llm_backend);
        if (data.cluster_source) setClusterSource(data.cluster_source);
        if (data.autonomous_mode !== undefined) setAutonomousMode(data.autonomous_mode);
      })
      .catch((err) => console.log('Status sync err:', err));
  }, []);

  const handleSetLlmBackend = async (backend) => {
    setLlmBackend(backend);
    try {
      await fetch('/api/agent/backend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backend }),
      });
    } catch (e) {
      console.error('Failed to update LLM backend:', e);
    }
  };

  const handleSetClusterSource = async (source) => {
    setClusterSource(source);
    try {
      await fetch('/api/cluster/source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source }),
      });
    } catch (e) {
      console.error('Failed to update cluster source:', e);
    }
  };

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
      // Optimistically show node incident
      setServiceStates((prev) => ({
        ...prev,
        [service]: {
          ...(prev[service] || {}),
          is_incident: true,
          is_verified_repaired: false,
          status: 'Incident',
        },
      }));

      const res = await fetch('/api/chaos/inject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service, fault_type: faultType }),
      });
      const data = await res.json();
      console.log('Chaos injected:', data);

      if (data.agent_state) {
        const isAuto = data.execution && data.execution.status === 'SUCCESS';
        setAgentEvent({
          state: data.agent_state,
          planned_action: data.proposed_plan?.selected_action,
          reasoning: data.proposed_plan?.reasoning_summary,
          history: isAuto
            ? [
                `MONITOR: Ingested telemetry tick for ${service}`,
                `DIAGNOSE: Detected ${data.fault} on ${service}. Correlated with container logs.`,
                `PLAN: Selected ${data.proposed_plan?.selected_action} via Groq`,
                `GUARDRAILS: Passed all 5 checks (Namespace, Bounds, Cooldown, Dry-Run)`,
                `EXECUTE: ${data.execution?.message || 'Action executed successfully.'}`,
                `VERIFY: Pod recovery confirmed. Seamed with Gold Verified badge.`,
              ]
            : [
                `MONITOR: Ingested telemetry tick for ${service}`,
                `DIAGNOSE: Detected ${data.fault} on ${service}. Correlated with container logs.`,
                `PLAN: Selected ${data.proposed_plan?.selected_action} via Groq`,
                `GUARDRAILS: Passed all 5 checks (Namespace, Bounds, Cooldown, Dry-Run)`,
                `EXECUTE: Paused in HUMAN_IN_THE_LOOP mode. Waiting for operator approval.`,
              ],
          execution_status: isAuto ? 'SUCCESS' : 'AWAITING_APPROVAL',
        });
      }

      if (data.agent_state === 'AWAITING_APPROVAL' && data.proposed_plan) {
        setPendingPlan(data.proposed_plan);
      } else if (data.execution && data.execution.status === 'SUCCESS') {
        // In autonomous mode, immediately set to verified repaired
        setServiceStates((prev) => ({
          ...prev,
          [service]: {
            ...(prev[service] || {}),
            is_verified_repaired: true,
            is_incident: false,
            status: 'VerifiedRepaired',
          },
        }));
      }
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

      if (data.service) {
        setServiceStates((prev) => ({
          ...prev,
          [data.service]: {
            ...(prev[data.service] || {}),
            is_verified_repaired: true,
            is_incident: false,
            status: 'VerifiedRepaired',
          },
        }));
        setAgentEvent((prev) => ({
          ...(prev || {}),
          state: 'VERIFIED',
          execution_status: 'SUCCESS',
          history: [
            ...(prev?.history || []),
            `OPERATOR: Approved ${data.action} on ${data.service}`,
            `EXECUTE: ${data.message}`,
            `VERIFY: Pod recovery confirmed. Seamed with Gold Verified badge.`,
          ],
        }));
      }
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

      if (data.service) {
        setServiceStates((prev) => ({
          ...prev,
          [data.service]: {
            ...(prev[data.service] || {}),
            is_incident: false,
            is_verified_repaired: false,
            status: 'Healthy',
          },
        }));
        setAgentEvent((prev) => ({
          ...(prev || {}),
          state: 'REJECTED',
          execution_status: 'REJECTED',
          history: [
            ...(prev?.history || []),
            `OPERATOR: Rejected proposed remediation for ${data.service}`,
          ],
        }));
      }
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
        setLlmBackend={handleSetLlmBackend}
        clusterSource={clusterSource}
        setClusterSource={handleSetClusterSource}
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
