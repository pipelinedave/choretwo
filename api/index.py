"""Vercel Python Serverless Entrypoint für den Choretwo-Monolith.

Das Vercel Python Runtime erwartet ein ASGI-`app`-Objekt auf Modulebene
von `api/index.py`. Der Monolith lebt in `monolith/main.py`; hier wird nur
der Repo-Root auf `sys.path` gelegt, damit `monolith.*` importierbar ist
(lokal/Docker übernimmt das der Dockerfile via PYTHONPATH=/app).
"""

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from monolith.main import app  # noqa: E402  (Pfad-Setup muss zuerst laufen)

# Vercel Python Runtime erwartet `app` auf Modulebene (ASGI).
handler = app  # Alias für Runtime-Varianten, die `handler` erwarten
