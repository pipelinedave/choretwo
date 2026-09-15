"""Tests der öffentlich-lesbaren GET-Pfade der Monolith-Auth-Middleware.

Ohne DB-Anbindung: prüft nur die Routing-/Auth-Zweige der Middleware
(`auth.is_public_read_get` + `auth_middleware`), also ob unauthentifizierte
GETs auf Shared-Chore-/Export-Pfaden erlaubt sind, während Schreiboperationen
und andere Pfade weiterhin Auth erzwingen.

Kern der Definition of Done: `GET /api/chores/` ohne Login liefert echte
Shared-Chores (user_email=None), private Chores dürfen dabei nie auftauchen.
"""

import sys
from pathlib import Path

import pytest
from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.testclient import TestClient
from starlette.middleware.base import BaseHTTPMiddleware

MONOLITH_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(MONOLITH_DIR))

from auth import auth_middleware, is_public_read_get  # noqa: E402


@pytest.fixture()
def client():
    app = Starlette()

    @app.route("/api/chores/")
    async def chores(request):
        return JSONResponse(
            {"user_email": getattr(request.state, "user_email", "MISSING")}
        )

    @app.route("/api/export")
    async def export(request):
        return JSONResponse(
            {"user_email": getattr(request.state, "user_email", "MISSING")}
        )

    @app.route("/api/chores/{chore_id}/done", methods=["PUT"])
    async def done(request, chore_id: int):
        return JSONResponse(
            {"user_email": getattr(request.state, "user_email", "MISSING")}
        )

    @app.route("/api/settings", methods=["GET"])
    async def settings(request):
        return JSONResponse(
            {"user_email": getattr(request.state, "user_email", "MISSING")}
        )

    app.add_middleware(BaseHTTPMiddleware, dispatch=auth_middleware)
    with TestClient(app) as c:
        yield c


class _FakeMethod:
    """Minimaler Request-Stub für `is_public_read_get`."""

    def __init__(self, method: str, path: str):
        self.method = method
        self.url = type("U", (), {"path": path})()


def test_is_public_read_get():
    assert is_public_read_get(_FakeMethod("GET", "/api/chores/")) is True
    assert is_public_read_get(_FakeMethod("GET", "/api/chores/count")) is True
    assert is_public_read_get(_FakeMethod("GET", "/api/chores/5")) is True
    assert is_public_read_get(_FakeMethod("GET", "/api/chores/5/done")) is True
    assert is_public_read_get(_FakeMethod("GET", "/api/export")) is True
    # Nicht-öffentliche Pfade
    assert is_public_read_get(_FakeMethod("GET", "/api/settings")) is False
    assert is_public_read_get(_FakeMethod("GET", "/api/logs")) is False
    # Schreiboperationen bleiben auth-pflichtig, auch auf öffentlichen Pfaden
    assert is_public_read_get(_FakeMethod("POST", "/api/chores/")) is False
    assert is_public_read_get(_FakeMethod("PUT", "/api/chores/5/done")) is False
    assert is_public_read_get(_FakeMethod("DELETE", "/api/chores/5")) is False


def test_get_chores_without_auth_allowed(client):
    res = client.get("/api/chores/")
    assert res.status_code == 200
    assert res.json() == {"user_email": None}


def test_get_export_without_auth_allowed(client):
    res = client.get("/api/export")
    assert res.status_code == 200
    assert res.json() == {"user_email": None}


def test_get_chores_with_identity(client):
    res = client.get("/api/chores/", headers={"X-User-Email": "test@example.com"})
    assert res.status_code == 200
    assert res.json() == {"user_email": "test@example.com"}


def test_put_done_without_auth_blocked(client):
    res = client.put("/api/chores/5/done")
    assert res.status_code == 401
    assert res.json() == {"error": "Authentication required"}


def test_get_settings_without_auth_blocked(client):
    res = client.get("/api/settings")
    assert res.status_code == 401
    assert res.json() == {"error": "Authentication required"}
