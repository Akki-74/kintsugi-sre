# ==============================================================================
# Kintsugi-AI — Multi-Stage Production Dockerfile ($0 Hugging Face Spaces & Cloud)
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build React 19 Frontend
# ------------------------------------------------------------------------------
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Python 3.11 FastAPI Backend & SRE Command Center
# ------------------------------------------------------------------------------
FROM python:3.11-slim
WORKDIR /app

# Install system build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    fastapi uvicorn websockets pydantic kubernetes langgraph langchain-core

# Copy application backend, prediction models, and remediation agent
COPY backend/ ./backend/
COPY phase1_prediction/ ./phase1_prediction/
COPY phase2_remediation/ ./phase2_remediation/
COPY docs/ ./docs/

# Copy built frontend assets from Stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Default port for Hugging Face Spaces is 7860; can be overridden via $PORT
ENV PORT=7860
ENV PYTHONUNBUFFERED=1

EXPOSE 7860

CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT}"]
