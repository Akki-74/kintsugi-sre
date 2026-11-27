# ==============================================================================
# Kintsugi-AI — Multi-Stage Production Dockerfile
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build React 19 + Vite Frontend
# ------------------------------------------------------------------------------
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Build Python Dependencies into Isolated Virtualenv
# ------------------------------------------------------------------------------
FROM python:3.11-slim AS python-builder
WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# ------------------------------------------------------------------------------
# Stage 3: Minimal Non-Root Python 3.11 Production Runtime
# ------------------------------------------------------------------------------
FROM python:3.11-slim AS runtime
WORKDIR /app

# Runtime libs: curl (Docker HEALTHCHECK) + libgomp1 (OpenMP runtime for XGBoost)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 appuser \
    && useradd --uid 10001 --gid 10001 --create-home --shell /usr/sbin/nologin appuser

# Copy prebuilt virtualenv from Stage 2 (without gcc/g++ build toolchain)
COPY --from=python-builder /opt/venv /opt/venv

# Copy runtime backend, Phase 2 LangGraph agent, and required Phase 1 / benchmark assets
COPY --chown=appuser:appuser backend/ ./backend/
COPY --chown=appuser:appuser phase2_remediation/ ./phase2_remediation/
COPY --chown=appuser:appuser phase1_prediction/__init__.py ./phase1_prediction/__init__.py
COPY --chown=appuser:appuser phase1_prediction/saved_models/ ./phase1_prediction/saved_models/
COPY --chown=appuser:appuser phase1_prediction/plots/ ./phase1_prediction/plots/
COPY --chown=appuser:appuser docs/remediation_benchmark.json ./docs/remediation_benchmark.json

# Copy built frontend SPA from Stage 1 (diagnostic plots are served from phase1_prediction/plots/)
COPY --chown=appuser:appuser --from=frontend-builder /app/frontend/dist ./frontend/dist

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

EXPOSE 8000

USER appuser

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD ["sh", "-c", "curl -fsS http://127.0.0.1:${PORT}/health || exit 1"]

CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT}"]
