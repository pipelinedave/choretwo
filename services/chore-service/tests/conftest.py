import os
from unittest.mock import MagicMock, patch

import pytest
from starlette.testclient import TestClient

# Point to an in-memory SQLite DB so SQLAlchemy can create the engine
# without hitting a real database. The settings route tests mock all
# DB calls entirely, so no actual queries are executed.
os.environ.setdefault(
    "DATABASE_URL",
    "sqlite:///:memory:",
)

# Import after env var is set
from app.main import app

FAKE_EMAIL = "test@example.com"

# ── Fixtures ─────────────────────────────────────────────────────────


@pytest.fixture
def client():
    """Synchronous TestClient that carries an auth header so AuthMiddleware passes."""
    return TestClient(
        app,
        base_url="http://test",
        headers={"X-User-Email": FAKE_EMAIL},
    )
