"""Choretwo Modular Monolith — kombinierter FastAPI-Entrypoint.

Führt die vier Python-Einzelservices (chore, log, notify, ai) in EINEM
Uvicorn-Prozess zusammen. Die Einzelservice-Pakete liegen unverändert
(eigener Code) unter `monolith/vendor/<service>/` und werden hier nur
eingebunden. Der Go-auth-service (OAuth/Dex-Callback) bleibt eigenständig;
seine JWT-Validierung übernimmt der Monolith nativ per `monolith/auth.py`.

Endpunkte:
    /api/chores/*    <- chore-service
    /api/logs/*      <- log-service
    /api/notify/*    <- notification-service
    /api/ai/*        <- ai-copilot-service
    /health          <- unified healthcheck
"""

from __future__ import annotations

import importlib
import sys
from pathlib import Path

from fastapi import FastAPI
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.middleware.cors import CORSMiddleware

from .auth import auth_middleware
from . import database as shared_db

SERVICES_ROOT = Path(__file__).resolve().parent / "vendor"
# Vendor-Pakete (chore/log/notify/ai) müssen importierbar sein.
if str(SERVICES_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVICES_ROOT))

# (Vendor-Paketname, Router-Modul, Health-Service-Name)
ROUTERS = [
    ("chore", "chore.app.routes.chores", "chore"),
    ("chore", "chore.app.routes.export", "chore"),
    ("chore", "chore.app.routes.settings", "chore"),
    ("log", "log.app.routes.logs", "log"),
    ("notify", "notify.app.routes.preferences", "notify"),
    ("ai", "ai.app.routes.ai", "ai"),
]

app = FastAPI(
    title="Choretwo Monolith",
    description="Combined API for Choretwo (chore, log, notification, AI)",
    version="1.0.0",
)

# Echte JWT-Auth-Middleware (innere Middleware)
app.add_middleware(BaseHTTPMiddleware, dispatch=auth_middleware)
# CORS (äußere Middleware) -> OPTIONS-Preflight funktioniert, Auth bleibt innen
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://choretwo.stillon.top",
        "https://choretwo-staging.stillon.top",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _bind_shared_database(package: str) -> None:
    """Lässt das geladene Service-Paket die gemeinsame Engine verwenden.

    Die Router der Einzelservices importieren `from <pkg>.app.database import
    get_db` und rufen zur Laufzeit `SessionLocal()` auf. Indem wir die
    Modul-Globals `engine`, `SessionLocal` und `get_db` auf die Singleton-
    Instanzen aus `monolith.database` setzen, teilen sich alle vier Pakete
    tatsächlich eine Engine bzw. Session-Factory.
    """
    db_mod = importlib.import_module(f"{package}.app.database")
    db_mod.engine = shared_db.engine
    db_mod.SessionLocal = shared_db.SessionLocal
    db_mod.get_db = shared_db.get_db


# Router laden und mit shared DB verbinden
_loaded = set()
for _package, module_name, _svc in ROUTERS:
    mod = importlib.import_module(module_name)
    pkg = module_name.split(".")[0]
    if pkg not in _loaded:
        _bind_shared_database(pkg)
        _loaded.add(pkg)
    router = getattr(mod, "router", None)
    if router is None:
        raise RuntimeError(f"Router-Modul {module_name} hat kein `router`-Attribut")
    app.include_router(router)


@app.on_event("startup")
async def startup_event() -> None:
    """Führt die Migrationen aller vier Services aus (idempotent)."""
    for package in ("chore", "log", "notify", "ai"):
        db_mod = importlib.import_module(f"{package}.app.database")
        try:
            db_mod.run_migrations()
        except Exception as exc:  # pragma: no cover - nicht deterministisch
            print(f"[WARN] Migration {package} fehlgeschlagen: {exc}")

    # obligationen: Ollama-Client (AI) initialisieren, falls verfügbar
    try:
        ai_routes = importlib.import_module("ai.app.routes.ai")
        if hasattr(ai_routes, "get_ollama_client"):
            ai_routes.ollama_client = ai_routes.get_ollama_client()
            print("[monolith] Ollama-Client initialisiert")
    except Exception as exc:  # pragma: no cover
        print(f"[WARN] AI/Ollama-Init fehlgeschlagen (degraded): {exc}")


@app.get("/health")
async def health_check() -> dict:
    return {"status": "ok", "service": "choretwo-monolith"}


@app.get("/")
async def root() -> dict:
    return {"message": "Choretwo Monolith", "version": "1.0.0"}
