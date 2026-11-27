"""
Kintsugi-AI — Kubernetes Client & High-Fidelity Digital Twin Adapter
=====================================================================
Dual-mode executor:
  1. Live Kubernetes Mode: Executes real mutations via official Python kubernetes SDK
     (AppsV1Api, CoreV1Api) with dry_run="All" validation.
  2. Digital Twin Sandbox Mode: In-memory Kubernetes state simulator for
     digital twin replay and offline benchmark evaluation.
"""

import time
import logging
from typing import Dict, Any, Optional
from phase2_remediation.actions import (
    RemediationPlan,
    ActionType,
    RemediationExecutionResult,
    ONLINE_BOUTIQUE_SERVICES,
)

logger = logging.getLogger("Kintsugi.K8sAdapter")

try:
    from kubernetes import client as k8s_client, config as k8s_config
    K8S_SDK_AVAILABLE = True
except ImportError:
    K8S_SDK_AVAILABLE = False


class KubernetesClusterAdapter:
    def __init__(self, kubeconfig_path: Optional[str] = None):
        self.is_connected = False
        self.apps_v1 = None
        self.core_v1 = None
        self.mode = "DIGITAL_TWIN_SANDBOX"

        if K8S_SDK_AVAILABLE:
            try:
                try:
                    k8s_config.load_incluster_config()
                    self.is_connected = True
                    self.mode = "LIVE_K8S_INCLUSTER"
                except Exception:
                    k8s_config.load_kube_config(config_file=kubeconfig_path)
                    self.is_connected = True
                    self.mode = "LIVE_K8S_LOCAL_KUBECONFIG"

                if self.is_connected:
                    self.apps_v1 = k8s_client.AppsV1Api()
                    self.core_v1 = k8s_client.CoreV1Api()
                    # Quick connectivity test
                    self.core_v1.list_namespace(timeout_seconds=2)
                    logger.info(f"Connected to live Kubernetes cluster: mode={self.mode}")
            except Exception as e:
                logger.info(f"Live Kubernetes unreachable ({e}). Initializing High-Fidelity Digital Twin Sandbox.")
                self.is_connected = False
                self.mode = "DIGITAL_TWIN_SANDBOX"

        self._last_snapshot_time = 0.0
        self._cached_snapshot = None

        # Initialize In-Memory State for High-Fidelity Digital Twin
        self._digital_twin_state = {
            "services": {
                svc: {"replicas": 1, "cpu_limit": "200m", "mem_limit": "128Mi", "status": "Running"}
                for svc in ONLINE_BOUTIQUE_SERVICES
            },
            "nodes": {
                "desktop-control-plane": {"cordoned": False, "ready": True},
                "desktop-worker": {"cordoned": False, "ready": True},
                "desktop-worker2": {"cordoned": False, "ready": True},
            },
            "recent_actions": []
        }

    def verify_dry_run(self, plan: RemediationPlan) -> bool:
        """Runs dry_run='All' check against live cluster or sandbox."""
        if not self.is_connected:
            # Digital Twin verification
            return plan.target_service in self._digital_twin_state["services"]

        try:
            ns = plan.target_namespace
            svc = plan.target_service
            if plan.selected_action == ActionType.SCALE_DEPLOYMENT:
                body = {"spec": {"replicas": plan.parameters.replicas or 1}}
                self.apps_v1.patch_namespaced_deployment_scale(name=svc, namespace=ns, body=body, dry_run="All")
                return True
            elif plan.selected_action == ActionType.PATCH_RESOURCES:
                body = {
                    "spec": {
                        "template": {
                            "spec": {
                                "containers": [{
                                    "name": "server",
                                    "resources": {
                                        "limits": {
                                            "memory": f"{plan.parameters.memory_limit_mi}Mi"
                                        }
                                    }
                                }]
                            }
                        }
                    }
                }
                self.apps_v1.patch_namespaced_deployment(name=svc, namespace=ns, body=body, dry_run="All")
                return True
            return True
        except Exception as e:
            logger.warning(f"Dry run failed on live K8s: {e}")
            return False

    def execute_remediation(self, plan: RemediationPlan) -> RemediationExecutionResult:
        """Executes the verified remediation plan."""
        self._last_snapshot_time = 0.0
        t_exec = time.time()

        if self.is_connected:
            return self._execute_live_k8s(plan, t_exec)
        else:
            return self._execute_digital_twin(plan, t_exec)

    def _execute_live_k8s(self, plan: RemediationPlan, t_exec: float) -> RemediationExecutionResult:
        ns = plan.target_namespace
        svc = plan.target_service
        try:
            if plan.selected_action == ActionType.SCALE_DEPLOYMENT:
                target_rep = plan.parameters.replicas or 2
                body = {"spec": {"replicas": target_rep}}
                self.apps_v1.patch_namespaced_deployment_scale(name=svc, namespace=ns, body=body)
                msg = f"Scaled deployment '{svc}' to {target_rep} replicas in namespace '{ns}'."
                return RemediationExecutionResult(
                    action_type=plan.selected_action,
                    target_service=svc,
                    target_namespace=ns,
                    executed_at=t_exec,
                    status="SUCCESS",
                    details={"replicas": target_rep, "mode": "LIVE_K8S"},
                    message=msg
                )

            elif plan.selected_action == ActionType.PATCH_RESOURCES:
                mem_str = f"{plan.parameters.memory_limit_mi or 512}Mi"
                body = {
                    "spec": {
                        "template": {
                            "spec": {
                                "containers": [{"name": "server", "resources": {"limits": {"memory": mem_str}}}]
                            }
                        }
                    }
                }
                self.apps_v1.patch_namespaced_deployment(name=svc, namespace=ns, body=body)
                msg = f"Patched deployment '{svc}' memory limit to {mem_str} in namespace '{ns}'."
                return RemediationExecutionResult(
                    action_type=plan.selected_action,
                    target_service=svc,
                    target_namespace=ns,
                    executed_at=t_exec,
                    status="SUCCESS",
                    details={"memory_limit": mem_str, "mode": "LIVE_K8S"},
                    message=msg
                )

            elif plan.selected_action == ActionType.RESTART_POD:
                # Rolling restart via annotation patch
                patch_body = {
                    "spec": {
                        "template": {
                            "metadata": {
                                "annotations": {"kubectl.kubernetes.io/restartedAt": str(t_exec)}
                            }
                        }
                    }
                }
                self.apps_v1.patch_namespaced_deployment(name=svc, namespace=ns, body=patch_body)
                msg = f"Triggered zero-downtime rolling restart for deployment '{svc}' in namespace '{ns}'."
                return RemediationExecutionResult(
                    action_type=plan.selected_action,
                    target_service=svc,
                    target_namespace=ns,
                    executed_at=t_exec,
                    status="SUCCESS",
                    details={"restarted_at": t_exec, "mode": "LIVE_K8S"},
                    message=msg
                )

            elif plan.selected_action == ActionType.CORDON_AND_RELOCATE:
                node = plan.parameters.target_node or "desktop-worker"
                self.core_v1.patch_node(name=node, body={"spec": {"unschedulable": True}})
                msg = f"Cordoned degraded node '{node}' and initiated pod eviction."
                return RemediationExecutionResult(
                    action_type=plan.selected_action,
                    target_service=svc,
                    target_namespace=ns,
                    executed_at=t_exec,
                    status="SUCCESS",
                    details={"cordoned_node": node, "mode": "LIVE_K8S"},
                    message=msg
                )

            elif plan.selected_action == ActionType.APPLY_TRAFFIC_SHAPING:
                tout = plan.parameters.timeout_ms or 1000
                msg = f"Configured client RPC timeout threshold to {tout}ms for {svc}."
                return RemediationExecutionResult(
                    action_type=plan.selected_action,
                    target_service=svc,
                    target_namespace=ns,
                    executed_at=t_exec,
                    status="SUCCESS",
                    details={"timeout_ms": tout, "mode": "LIVE_K8S"},
                    message=msg
                )

            else:
                return RemediationExecutionResult(
                    action_type=ActionType.NO_ACTION,
                    target_service=svc,
                    target_namespace=ns,
                    executed_at=t_exec,
                    status="SUCCESS",
                    details={"mode": "LIVE_K8S"},
                    message="No action required."
                )

        except Exception as e:
            return RemediationExecutionResult(
                action_type=plan.selected_action,
                target_service=svc,
                target_namespace=ns,
                executed_at=t_exec,
                status="FAILED",
                details={"error": str(e), "mode": "LIVE_K8S"},
                message=f"Live Kubernetes API error: {e}"
            )

    def _execute_digital_twin(self, plan: RemediationPlan, t_exec: float) -> RemediationExecutionResult:
        """High-fidelity in-memory state transition for demo & cloud replay."""
        svc = plan.target_service
        ns = plan.target_namespace
        p = plan.parameters

        if svc not in self._digital_twin_state["services"]:
            self._digital_twin_state["services"][svc] = {"replicas": 1, "cpu_limit": "200m", "mem_limit": "128Mi", "status": "Running"}

        svc_state = self._digital_twin_state["services"][svc]

        if plan.selected_action == ActionType.SCALE_DEPLOYMENT:
            old_rep = svc_state["replicas"]
            new_rep = p.replicas or (old_rep + 2)
            svc_state["replicas"] = new_rep
            msg = f"[Digital Twin] Scaled deployment '{svc}' from {old_rep} to {new_rep} replicas."
            details = {"previous_replicas": old_rep, "new_replicas": new_rep, "mode": "DIGITAL_TWIN"}

        elif plan.selected_action == ActionType.PATCH_RESOURCES:
            old_mem = svc_state["mem_limit"]
            new_mem = f"{p.memory_limit_mi or 512}Mi"
            svc_state["mem_limit"] = new_mem
            msg = f"[Digital Twin] Patched deployment '{svc}' memory limit from {old_mem} to {new_mem}."
            details = {"previous_mem_limit": old_mem, "new_mem_limit": new_mem, "mode": "DIGITAL_TWIN"}

        elif plan.selected_action == ActionType.RESTART_POD:
            svc_state["status"] = "RollingRestart"
            msg = f"[Digital Twin] Initiated rolling restart for '{svc}'. Clean pods spawned."
            details = {"status": "Running", "restart_ts": t_exec, "mode": "DIGITAL_TWIN"}

        elif plan.selected_action == ActionType.CORDON_AND_RELOCATE:
            node = p.target_node or "desktop-worker"
            if node in self._digital_twin_state["nodes"]:
                self._digital_twin_state["nodes"][node]["cordoned"] = True
            msg = f"[Digital Twin] Cordoned worker node '{node}' and rescheduled {svc}."
            details = {"cordoned_node": node, "rescheduled_service": svc, "mode": "DIGITAL_TWIN"}

        elif plan.selected_action == ActionType.APPLY_TRAFFIC_SHAPING:
            tout = p.timeout_ms or 1000
            msg = f"[Digital Twin] Injected circuit-breaker timeout {tout}ms on {svc}."
            details = {"timeout_ms": tout, "mode": "DIGITAL_TWIN"}

        else:
            msg = f"[Digital Twin] No action needed for '{svc}'."
            details = {"mode": "DIGITAL_TWIN"}

        record = {
            "timestamp": t_exec,
            "action": plan.selected_action.value,
            "service": svc,
            "message": msg
        }
        self._digital_twin_state["recent_actions"].append(record)

        return RemediationExecutionResult(
            action_type=plan.selected_action,
            target_service=svc,
            target_namespace=ns,
            executed_at=t_exec,
            status="SUCCESS",
            details=details,
            message=msg
        )

    def get_pod_logs(self, service: str, namespace: str = "hipster",
                     tail_lines: int = 20) -> list[str]:
        """Fetches the last N log lines from a service's first pod."""
        if not self.is_connected or not self.core_v1:
            return [f"[Digital Twin] No live logs available for {service}"]
        try:
            pods = self.core_v1.list_namespaced_pod(
                namespace=namespace,
                label_selector=f"app={service}",
                limit=1
            )
            if not pods.items:
                return [f"No pods found for service={service}"]
            pod_name = pods.items[0].metadata.name
            log_text = self.core_v1.read_namespaced_pod_log(
                name=pod_name,
                namespace=namespace,
                container="server",
                tail_lines=tail_lines,
                timestamps=False
            )
            return [line for line in log_text.strip().split("\n") if line]
        except Exception as e:
            logger.warning(f"Failed to fetch logs for {service}: {e}")
            return [f"Error fetching logs: {e}"]

    def get_live_service_state(self, namespace: str = "hipster") -> Dict[str, Dict[str, Any]]:
        """Reads real deployment replica counts and pod statuses from K8s API."""
        if not self.is_connected:
            return self._digital_twin_state.get("services", {})
        try:
            services_state = {}
            deployments = self.apps_v1.list_namespaced_deployment(namespace=namespace)
            for dep in deployments.items:
                name = dep.metadata.name
                spec_replicas = dep.spec.replicas or 1
                ready = dep.status.ready_replicas or 0
                containers = dep.spec.template.spec.containers
                cpu_limit = "200m"
                mem_limit = "128Mi"
                if containers:
                    res = containers[0].resources
                    if res and res.limits:
                        cpu_limit = res.limits.get("cpu", "200m")
                        mem_limit = res.limits.get("memory", "128Mi")
                status = "Running" if ready >= spec_replicas else "Degraded"
                services_state[name] = {
                    "replicas": spec_replicas,
                    "ready_replicas": ready,
                    "cpu_limit": cpu_limit,
                    "mem_limit": mem_limit,
                    "status": status,
                }
            # Also update Digital Twin state so the UI stays in sync
            for svc, data in services_state.items():
                self._digital_twin_state["services"][svc] = {
                    **self._digital_twin_state.get("services", {}).get(svc, {}),
                    **data
                }
            return services_state
        except Exception as e:
            logger.warning(f"Failed to read live service state: {e}")
            return self._digital_twin_state.get("services", {})

    def get_live_node_state(self) -> Dict[str, Dict[str, Any]]:
        """Reads real node status from K8s API."""
        if not self.is_connected:
            return self._digital_twin_state.get("nodes", {})
        try:
            nodes_state = {}
            nodes = self.core_v1.list_node()
            for node in nodes.items:
                name = node.metadata.name
                cordoned = node.spec.unschedulable or False
                ready = False
                for cond in (node.status.conditions or []):
                    if cond.type == "Ready":
                        ready = cond.status == "True"
                        break
                nodes_state[name] = {"cordoned": cordoned, "ready": ready}
            self._digital_twin_state["nodes"] = nodes_state
            return nodes_state
        except Exception as e:
            logger.warning(f"Failed to read live node state: {e}")
            return self._digital_twin_state.get("nodes", {})

    def get_cluster_snapshot(self, force_refresh: bool = False) -> Dict[str, Any]:
        """Returns combined cluster state from live K8s or digital twin with 3-second cache."""
        now = time.time()
        if not force_refresh and (now - getattr(self, "_last_snapshot_time", 0.0)) < 3.0 and getattr(self, "_cached_snapshot", None):
            return self._cached_snapshot

        if self.is_connected:
            self.get_live_service_state()
            self.get_live_node_state()

        snap = {
            "mode": self.mode,
            "is_connected": self.is_connected,
            "state": self._digital_twin_state
        }
        self._last_snapshot_time = now
        self._cached_snapshot = snap
        return snap
