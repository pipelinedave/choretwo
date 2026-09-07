# syntax=docker/dockerfile:1
# Choretwo monolith image — all 3 Python services in one process
# Reduces idle RAM from ~300 MB (3 containers) to ~90 MB (1 container)

FROM python:3.11-slim AS base

WORKDIR /app

# Install system deps for psycopg2
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY monolith/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy service source code (keep original package structure intact)
COPY services/chore-service /app/services/chore-service
COPY services/log-service /app/services/log-service
COPY services/notification-service /app/services/notification-service

# Copy monolith glue code
COPY monolith /app/monolith

# PYTHONPATH: repo root so "from monolith.xxx" and "from app.xxx" both resolve
# The main.py adds service paths dynamically at runtime
ENV PYTHONPATH=/app

EXPOSE 8000

# Health check: poll /health every 30s
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

CMD ["uvicorn", "monolith.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--log-level", "info"]
