# 🛠️ Cluster Lifecycle & Memory Runbook (16GB RAM Optimization)
**Operational Runbook for Local 3-Node Kubernetes, Observability, and Kintsugi-AI**

This operational runbook provides quick PowerShell commands to pause, resume, and manage your local 3-node Kubernetes cluster (`desktop-control-plane`, `desktop-worker`, `desktop-worker2`) on resource-constrained development machines (such as 16GB RAM laptops/ThinkPads).

---

## 💡 Overview & Memory Profile

Running a full production-like microservices topology locally consumes significant system memory:
- **3-Node Cluster (Docker Desktop / WSL2):** ~3.5 – 5.0 GB RAM
- **10 OnlineBoutique Microservices (`hipster`):** ~800 MB – 1.2 GB RAM
- **Prometheus + Grafana (`monitoring`):** ~1.0 – 1.5 GB RAM
- **Kubernetes Web Dashboard (`kubernetes-dashboard`):** ~250 MB RAM
- **Kintsugi-AI FastAPI + ML Fast Brain:** ~150 – 250 MB RAM

By pausing the cluster containers when not actively conducting live cluster mutations, you can instantly recover **~5–7 GB of RAM** for other workloads, while the dashboard displays the Live Connection Gate.

---

## ⏸️ 1. Pause Local Cluster (Free Up RAM)

Run this block in PowerShell to cleanly shut down port-forwards and pause all 3 node containers without deleting pods, deployments, or cluster configuration:

```powershell
# 1. Terminate all background kubectl port-forwards
Get-Process kubectl -ErrorAction SilentlyContinue | Stop-Process -Force

# 2. Pause the 3 Kubernetes node containers (preserves all deployments, etcd state, and pod configs)
docker stop desktop-control-plane desktop-worker desktop-worker2

Write-Host "✅ Kubernetes cluster paused. ~5-7 GB RAM freed!" -ForegroundColor Green
```

> **Note:** When the cluster is paused, the web dashboard displays the Live Cluster Connection Gate with quick 1-line resume instructions.

---

## ▶️ 2. Resume Local Cluster Anytime

When you are ready to resume live cluster chaos injection and real Kubernetes API remediation:

```powershell
# 1. Start the 3 physical node containers back up
docker start desktop-control-plane desktop-worker desktop-worker2

# 2. Re-apply Linux Kernel inotify optimization (prevents WSL2 TLS handshake timeouts)
docker exec desktop-control-plane sysctl -w fs.inotify.max_user_instances=8192 fs.inotify.max_user_watches=524288

# 3. Wait 10 seconds for kube-apiserver & kubelet to settle, then verify nodes
Start-Sleep -Seconds 10
kubectl get nodes -o wide

# 4. Re-open minimized background port-forwards for Prometheus, Grafana, and K8s Dashboard
Start-Process kubectl -ArgumentList "port-forward -n monitoring svc/monitoring-kube-prometheus-prometheus 9090:9090" -WindowStyle Minimized
Start-Process kubectl -ArgumentList "port-forward -n monitoring svc/monitoring-grafana 3000:80" -WindowStyle Minimized
Start-Process kubectl -ArgumentList "port-forward -n kubernetes-dashboard svc/kubernetes-dashboard 8443:443" -WindowStyle Minimized

# 5. Launch the Kintsugi Command Center UI
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

---

## 🔍 3. Verification & Diagnostic Commands

Once the cluster is resumed, verify all services:

```powershell
# Check node readiness
kubectl get nodes

# Check 10 microservices in hipster namespace
kubectl get pods -n hipster -o wide

# Check monitoring stack
kubectl get pods -n monitoring

# Verify local backend API health
curl http://localhost:8000/health
```

---

## 🌐 4. Endpoint Reference Table

| Service | Local URL | Credentials / Notes |
| :--- | :--- | :--- |
| **Kintsugi SRE Command Center** | [http://localhost:8000/app/](http://localhost:8000/app/) | Live 10-Service Topology + Chaos Injection |
| **Technical Architecture Slides** | [http://localhost:8000/app/slides.html](http://localhost:8000/app/slides.html) | Keyboard-navigable technical presentation deck |
| **Prometheus Metrics & PromQL** | [http://localhost:9090](http://localhost:9090) | PromQL queries: `container_cpu_usage_seconds_total` |
| **Grafana Observability** | [http://localhost:3000](http://localhost:3000) | User: `admin` / Password: `admin` |
| **Kubernetes Dashboard** | [https://localhost:8443](https://localhost:8443) | Bearer Token via `admin-user` ServiceAccount |
| **Render Cloud Production URL** | [https://kintsugi-ai.onrender.com/app/](https://kintsugi-ai.onrender.com/app/) | 24/7 Zero-Infrastructure Public Endpoint |
