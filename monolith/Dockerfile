# Choretwo Monolith — Single-Image für nucy (k3s)
# Führt chore-, log-, notification- und ai-copilot-logik in einem Prozess.

FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# System-Voraussetzungen für psycopg2-binary & Co.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

COPY monolith/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Paketstruktur: monolith/ + vendor/ (vendor nicht im Image, sondern beim Build aus services/ generiert)
COPY monolith/ /app/monolith/
COPY services/chore-service/app /svc-src/chore
COPY services/log-service/app /svc-src/log
COPY services/notification-service/app /svc-src/notify
COPY services/ai-copilot-service/app /svc-src/ai

# Vendor-Sync im Build (Import-Prefix-Rewrite) per Sync-Skript
RUN python3 - <<'PY'
import re, shutil
from pathlib import Path

IMPORT_RE = re.compile(r"(?P<prefix>\b(from|import)\s+)app(?P<suffix>\.[\w.]+|\s)")
MAP = {"chore": "chore", "log": "log", "notify": "notify", "ai": "ai"}

def rewrite(content, pkg):
    return IMPORT_RE.sub(lambda m: f"{m.group('prefix')}{pkg}.app{m.group('suffix')}", content)

vendor = Path("/app/monolith/vendor")
for svc, pkg in MAP.items():
    src = Path("/svc-src") / svc
    dst = vendor / pkg / "app"
    shutil.copytree(src, dst, ignore=shutil.ignore_patterns("__pycache__"))
    (vendor / pkg / "__init__.py").write_text("", encoding="utf-8")
    (dst / "__init__.py").write_text("", encoding="utf-8") if not (dst / "__init__.py").exists() else None
    for py in dst.rglob("*.py"):
        c = py.read_text(encoding="utf-8")
        nc = rewrite(c, pkg)
        if nc != c:
            py.write_text(nc, encoding="utf-8")
PY

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "monolith.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
