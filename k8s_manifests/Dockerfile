# ==============================================================================
# Kintsugi-AI — Multi-Stage Production Dockerfile (Kubernetes Container)
# ==============================================================================

FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY phase1_prediction/ ./phase1_prediction/
COPY phase2_remediation/ ./phase2_remediation/
COPY docs/ ./docs/
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

ENV PORT=8000
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT}"]
