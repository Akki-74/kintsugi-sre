"""
Kintsugi-AI — Live Prometheus Telemetry Collector
===================================================
Queries a live Prometheus server via PromQL to collect real-time
container CPU, Memory, Network, and Pod status metrics for the
10 OnlineBoutique microservices in the hipster namespace.
"""

import os
import json
import time
import logging
import urllib.request
import urllib.error
from typing import Dict, Any, Optional, List
from urllib.parse import quote

logger = logging.getLogger("Kintsugi.PrometheusCollector")

# Default PromQL queries for per-pod/container telemetry
# These match the Nezha dataset metric columns for seamless interoperability
PROMQL_QUERIES = {
    # CPU usage rate as percentage of limit (0-100%)
    "CpuUsageRate(%)": (
        '100 * sum by (pod) ('
        '  rate(container_cpu_usage_seconds_total{namespace="hipster", container="server"}[1m])'
        ') / sum by (pod) ('
        '  kube_pod_container_resource_limits{namespace="hipster", container="server", resource="cpu"}'
        ')'
    ),
    # Memory usage rate as percentage of limit (0-100%)
    "MemoryUsageRate(%)": (
        '100 * sum by (pod) ('
        '  container_memory_working_set_bytes{namespace="hipster", container="server"}'
        ') / sum by (pod) ('
        '  kube_pod_container_resource_limits{namespace="hipster", container="server", resource="memory"}'
        ')'
    ),
    # Network receive bytes per second
    "PodNetworkReceiveBytesPerSec": (
        'sum by (pod) ('
        '  rate(container_network_receive_bytes_total{namespace="hipster"}[1m])'
        ')'
    ),
    # Network transmit bytes per second
    "PodNetworkTransmitBytesPerSec": (
        'sum by (pod) ('
        '  rate(container_network_transmit_bytes_total{namespace="hipster"}[1m])'
        ')'
    ),
    # Container restart count (cumulative)
    "ContainerRestartCount": (
        'sum by (pod) ('
        '  kube_pod_container_status_restarts_total{namespace="hipster", container="server"}'
        ')'
    ),
}

# Simplified per-service queries (aggregated across pods of same deployment)
SERVICE_QUERIES = {
    "cpu_usage_pct": (
        '100 * sum by (container) ('
        '  rate(container_cpu_usage_seconds_total{{namespace="hipster", container="server", pod=~"{service}.*"}}[1m])'
        ') / sum by (container) ('
        '  kube_pod_container_resource_limits{{namespace="hipster", container="server", pod=~"{service}.*", resource="cpu"}}'
        ')'
    ),
    "memory_usage_pct": (
        '100 * sum by (container) ('
        '  container_memory_working_set_bytes{{namespace="hipster", container="server", pod=~"{service}.*"}}'
        ') / sum by (container) ('
        '  kube_pod_container_resource_limits{{namespace="hipster", container="server", pod=~"{service}.*", resource="memory"}}'
        ')'
    ),
    "network_recv_rate": (
        'sum(rate(container_network_receive_bytes_total{{namespace="hipster", pod=~"{service}.*"}}[1m]))'
    ),
    "network_xmit_rate": (
        'sum(rate(container_network_transmit_bytes_total{{namespace="hipster", pod=~"{service}.*"}}[1m]))'
    ),
}


class PrometheusCollector:
    """Queries a live Prometheus server for real-time container telemetry."""

    def __init__(self, prometheus_url: Optional[str] = None, timeout_sec: float = 3.0):
        self.prometheus_url = (
            prometheus_url
            or os.environ.get("PROMETHEUS_URL", "http://localhost:9090")
        ).rstrip("/")
        self.timeout_sec = timeout_sec
        self._is_reachable = None
        self._last_reach_check = 0.0

    @property
    def is_reachable(self) -> bool:
        """Checks if Prometheus is accessible with a 5-second dynamic check."""
        now = time.time()
        if self._is_reachable is not None and (now - getattr(self, "_last_reach_check", 0.0)) < 5.0:
            return self._is_reachable

        self._last_reach_check = now
        try:
            url = f"{self.prometheus_url}/api/v1/status/runtimeinfo"
            req = urllib.request.Request(url, method="GET")
            with urllib.request.urlopen(req, timeout=2.0) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                self._is_reachable = data.get("status") == "success"
        except Exception:
            self._is_reachable = False
        return self._is_reachable

    def query_instant(self, promql: str) -> List[Dict[str, Any]]:
        """Runs an instant PromQL query and returns the result vector."""
        try:
            encoded = quote(promql, safe="")
            url = f"{self.prometheus_url}/api/v1/query?query={encoded}"
            req = urllib.request.Request(url, method="GET")
            with urllib.request.urlopen(req, timeout=self.timeout_sec) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                if data.get("status") == "success":
                    return data.get("data", {}).get("result", [])
                logger.warning(f"Prometheus query returned non-success: {data}")
                return []
        except Exception as e:
            logger.warning(f"Prometheus query failed: {e}")
            return []

    def get_service_metrics(self, service: str) -> Dict[str, float]:
        """Returns live metrics for a specific OnlineBoutique service with 2.0s cache."""
        now = time.time()
        if not hasattr(self, "_metrics_cache"):
            self._metrics_cache = {}
        if service in self._metrics_cache:
            ts, cached_metrics = self._metrics_cache[service]
            if now - ts < 2.0:
                return cached_metrics

        metrics = {}
        for metric_name, query_template in SERVICE_QUERIES.items():
            query = query_template.format(service=service)
            results = self.query_instant(query)
            if results:
                # Take the first result's value
                try:
                    val = float(results[0]["value"][1])
                    metrics[metric_name] = round(val, 2)
                except (IndexError, KeyError, ValueError, TypeError):
                    metrics[metric_name] = 0.0
            else:
                metrics[metric_name] = 0.0
        self._metrics_cache[service] = (now, metrics)
        return metrics

    def get_all_services_metrics(self) -> Dict[str, Dict[str, float]]:
        """Returns live metrics for all 10 OnlineBoutique microservices."""
        services = [
            "frontend", "checkoutservice", "cartservice", "paymentservice",
            "productcatalogservice", "currencyservice", "shippingservice",
            "recommendationservice", "adservice", "emailservice"
        ]
        all_metrics = {}
        for svc in services:
            all_metrics[svc] = self.get_service_metrics(svc)
        return all_metrics

    def get_cluster_wide_snapshot(self) -> Dict[str, Any]:
        """Returns a broad cluster-level telemetry snapshot."""
        snapshot = {
            "timestamp": time.time(),
            "prometheus_url": self.prometheus_url,
            "is_reachable": self.is_reachable,
            "services": {},
        }

        if not self.is_reachable:
            return snapshot

        # Batch CPU query for all pods
        cpu_results = self.query_instant(PROMQL_QUERIES["CpuUsageRate(%)"])
        mem_results = self.query_instant(PROMQL_QUERIES["MemoryUsageRate(%)"])
        restart_results = self.query_instant(PROMQL_QUERIES["ContainerRestartCount"])

        def _pod_to_service(pod_name: str) -> str:
            """Extract deployment/service name from pod name."""
            # e.g., 'checkoutservice-79d5bf9974-bd5b5' -> 'checkoutservice'
            parts = pod_name.rsplit("-", 2)
            if len(parts) >= 3:
                return parts[0]
            return pod_name

        # Aggregate by service
        svc_data: Dict[str, Dict[str, Any]] = {}
        for r in cpu_results:
            pod = r["metric"].get("pod", "")
            svc = _pod_to_service(pod)
            svc_data.setdefault(svc, {})
            try:
                svc_data[svc]["cpu_usage_pct"] = round(float(r["value"][1]), 2)
            except (ValueError, TypeError):
                pass

        for r in mem_results:
            pod = r["metric"].get("pod", "")
            svc = _pod_to_service(pod)
            svc_data.setdefault(svc, {})
            try:
                svc_data[svc]["memory_usage_pct"] = round(float(r["value"][1]), 2)
            except (ValueError, TypeError):
                pass

        for r in restart_results:
            pod = r["metric"].get("pod", "")
            svc = _pod_to_service(pod)
            svc_data.setdefault(svc, {})
            try:
                svc_data[svc]["restart_count"] = int(float(r["value"][1]))
            except (ValueError, TypeError):
                pass

        snapshot["services"] = svc_data
        return snapshot
