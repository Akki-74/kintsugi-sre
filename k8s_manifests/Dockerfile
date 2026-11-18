FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    fastapi uvicorn websockets pydantic kubernetes langgraph langchain-core

# Copy application code
COPY backend/ ./backend/
COPY phase1_prediction/ ./phase1_prediction/
COPY phase2_remediation/ ./phase2_remediation/
COPY docs/ ./docs/

EXPOSE 8000

ENV PYTHONUNBUFFERED=1

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
