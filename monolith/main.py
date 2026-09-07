"""Choretwo Monolith — single FastAPI app combining all Python services.

Architecture:
- chore-service (Python/FastAPI)  → /api/chores/, /api/export/, /api/settings/
- log-service   (Python/FastAPI)  → /api/logs/
- notification-service (Python)   → /api/notifications/
- auth-service  (Go)              → runs separately, handles /auth/* OAuth flow
- ai-copilot    (Python)          → runs separately (optional, resource-heavy)

Each service's own main.py still works for standalone Microservice mode.
This file is the monolith entry point only.

DB strategy: All services read DATABASE_URL from env.
Since we set it before importing service code, they all share the same connection.
DB pool is managed by SQLAlchemy (single process = single pool).

Auth strategy (Option A): JWT validated in-process via monolith/auth_proxy.py.
Middleware injects user_email into request.state before routers are called.
"""
import os
import sys
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# ---------------------------------------------------------------------------
# Bootstrap: ensure service packages are importable.
# In production Docker image, PYTHONPATH includes the repo root.
# In local dev, run from repo root: uvicorn monolith.main:app
# ---------------------------------------------------------------------------
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

# Add each service to the path so "from app.xxx import" works
for svc in ("chore-service", "log-service", "notification-service"):
    svc_path = os.path.join(REPO_ROOT, "services", svc)
    if svc_path not in sys.path:
        sys.path.insert(0, svc_path)

# ---------------------------------------------------------------------------
# Shared DB migrations
# ---------------------------------------------------------------------------
from monolith.database import run_all_migrations  # noqa: E402

# ---------------------------------------------------------------------------
# Auth middleware (JWT validation, sets request.state.user_email)
# ---------------------------------------------------------------------------
from monolith.auth_proxy import get_user_email, EXEMPT_PATHS  # noqa: E402

# ---------------------------------------------------------------------------
# Service routers — import after sys.path manipulation
# ---------------------------------------------------------------------------
from app.routes.chores import router as chores_router       # chore-service  # noqa: E402
from app.routes.export import router as export_router       # chore-service  # noqa: E402
from app.routes.settings import router as settings_router   # chore-service  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("monolith")

# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "https://choretwo.vercel.app,http://localhost:3000,http://localhost:5173",
).split(",")

app = FastAPI(
    title="Choretwo Monolith",
    description="Unified API for all Choretwo services",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    """Validate JWT and inject user_email into request.state."""
    if request.url.path in EXEMPT_PATHS or request.url.path.startswith("/auth/"):
        return await call_next(request)

    try:
        user_email = get_user_email(request)
        request.state.user_email = user_email
    except Exception:
        return JSONResponse(status_code=401, content={"error": "Authentication required"})

    return await call_next(request)


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------
@app.on_event("startup")
async def startup_event():
    logger.info("[monolith] Starting up...")
    run_all_migrations()
    logger.info("[monolith] Ready")


# ---------------------------------------------------------------------------
# Health & root
# ---------------------------------------------------------------------------
@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "choretwo-monolith",
        "version": "2.0.0",
        "includes": ["chore-service", "log-service", "notification-service"],
    }


@app.get("/")
async def root():
    return {"message": "Choretwo Monolith", "version": "2.0.0", "docs": "/docs"}


# ---------------------------------------------------------------------------
# Mount service routers
# chore-service: keep original prefixes (/chores, /export, /settings)
# ---------------------------------------------------------------------------
app.include_router(chores_router)
app.include_router(export_router)
app.include_router(settings_router)

# log-service: imported separately to avoid module naming collision
# (both chore-service and log-service have app.routes)
try:
    # Temporarily adjust import path to pick up log-service
    log_svc_path = os.path.join(REPO_ROOT, "services", "log-service")
    sys.path.insert(0, log_svc_path)
    import importlib
    log_routes_mod = importlib.import_module("app.routes.logs")
    app.include_router(log_routes_mod.router)
    logger.info("[monolith] log-service routes mounted")
except Exception as e:
    logger.warning(f"[monolith] Could not mount log-service routes: {e}")

# notification-service
try:
    notif_svc_path = os.path.join(REPO_ROOT, "services", "notification-service")
    sys.path.insert(0, notif_svc_path)
    notif_routes_mod = importlib.import_module("app.routes.preferences")
    app.include_router(notif_routes_mod.router)
    logger.info("[monolith] notification-service routes mounted")
except Exception as e:
    logger.warning(f"[monolith] Could not mount notification-service routes: {e}")
