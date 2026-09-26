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


def test_put_done_without_auth_blocked(client):
    res = client.put("/api/chores/5/done")
    assert res.status_code == 401
    assert res.json() == {"error": "Authentication required"}


def test_get_settings_without_auth_blocked(client):
    res = client.get("/api/settings")
    assert res.status_code == 401
    assert res.json() == {"error": "Authentication required"}


# ── X-User-Email: Dev-Feature, kein Produktionsfeature ─────────────────
#
# Bis 2026-09-26 war der Header unbedingt gueltig, d.h. jeder Aufrufer
# konnte sich als beliebige Person ausgeben — auch mit Schreiboperationen.
# Der Docstring nannte es "Dev/Mock-Modus", aber der Code pruefte
# USE_MOCK_AUTH nie. Diese Tests halten die Bindung fest.


class _MockAuthClient:
    """Dieselbe App, aber mit USE_MOCK_AUTH=true (lokaler Dev-Betrieb)."""

    def __enter__(self):
        import auth as auth_mod

        self._orig = auth_mod.USE_MOCK_AUTH
        auth_mod.USE_MOCK_AUTH = True

        app = Starlette()

        @app.route("/api/chores/")
        async def chores(request):
            return JSONResponse(
                {"user_email": getattr(request.state, "user_email", "MISSING")}
            )

        # Achtung: Starlette (anders als FastAPI) reicht Pfad-Parameter NICHT
        # als Funktionsargumente durch — sie stehen in request.path_params.
        @app.route("/api/chores/{chore_id}", methods=["DELETE"])
        async def delete(request):
            return JSONResponse(
                {
                    "user_email": getattr(request.state, "user_email", "MISSING"),
                    "chore_id": request.path_params.get("chore_id"),
                }
            )

        app.add_middleware(BaseHTTPMiddleware, dispatch=auth_middleware)
        self._client = TestClient(app)
        self._client.__enter__()
        return self._client

    def __exit__(self, *exc):
        import auth as auth_mod

        self._client.__exit__(*exc)
        auth_mod.USE_MOCK_AUTH = self._orig


def test_header_identity_is_ignored_in_production(client):
    """Ohne USE_MOCK_AUTH gibt der Header keine Identitaet her."""
    res = client.get("/api/chores/", headers={"X-User-Email": "test@example.com"})
    assert res.status_code == 200
    # Anonym, nicht die behauptete Identitaet. Sonst waere jede private Chore
    # des "test@example.com" sichtbar — genau der Bypass.
    assert res.json() == {"user_email": None}


def test_header_identity_does_not_unlock_writes_in_production(client):
    """Der Header darf ausserhalb des Dev-Modus keine Schreibpfade oeffnen."""
    res = client.delete("/api/chores/5", headers={"X-User-Email": "test@example.com"})
    assert res.status_code == 401
    assert res.json() == {"error": "Authentication required"}


def test_header_identity_still_works_in_mock_auth_mode():
    """Im Dev-Betrieb bleibt der Header-Moeglichkeitsweg erhalten."""
    with _MockAuthClient() as c:
        res = c.get("/api/chores/", headers={"X-User-Email": "test@example.com"})
        assert res.status_code == 200
        assert res.json() == {"user_email": "test@example.com"}

        res = c.delete("/api/chores/5", headers={"X-User-Email": "test@example.com"})
        assert res.status_code == 200
        assert res.json() == {"user_email": "test@example.com", "chore_id": "5"}
