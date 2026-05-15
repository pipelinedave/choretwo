"""Unit tests for the Settings API endpoints.

Endpoints under test (from ``app.routes.settings``):

* ``GET /api/settings`` — returns unified settings from notifications + ai schemas
* ``PUT /api/settings`` — partial update of notifications / ai / appearance sections

The tests mock the internal helpers (_get_user_notifications,
_get_user_ai_prefs, _update_user_notifications, _update_user_ai_prefs)
so that no database connection is required.
"""

import os
from unittest.mock import MagicMock, patch

import pytest
from starlette.testclient import TestClient

# Ensure the DATABASE_URL used at import time points to a
# non-existent DB so SQLAlchemy can create the engine without
# hitting a real server.  The tests patch the route's DB calls
# entirely so no actual queries are executed.
os.environ.setdefault(
    "DATABASE_URL",
    "sqlite:///:memory:",
)

from app.main import app  # noqa: E402

FAKE_EMAIL = "test@example.com"

# ── Shared fixtures ──────────────────────────────────────────────────

NOTIF_PREFS = {
    "enabled": True,
    "notify_times": ["09:00", "18:00"],
    "notify_overdue": True,
    "notify_soon": True,
    "created_at": "2024-01-01T00:00:00",
    "updated_at": "2024-01-01T00:00:00",
}

AI_PREFS = {
    "learning_enabled": True,
    "suggestion_types": ["recurrence", "timing", "assignment"],
    "created_at": "2024-01-01T00:00:00",
    "updated_at": "2024-01-01T00:00:00",
}

DEFAULT_SETTINGS_RESPONSE = {
    "notifications": NOTIF_PREFS,
    "ai": AI_PREFS,
    "appearance": {"theme": "system"},
}

MODULE = "app.routes.settings"


@pytest.fixture
def mock_helpers(notif_data=NOTIF_PREFS, ai_data=AI_PREFS):
    """Mock the four internal helpers so the route never touches the DB."""
    notif_copy = dict(notif_data)
    ai_copy = dict(ai_data)

    with (
        patch(f"{MODULE}._get_user_notifications") as mock_get_notif,
        patch(f"{MODULE}._get_user_ai_prefs") as mock_get_ai,
        patch(f"{MODULE}._update_user_notifications") as mock_upd_notif,
        patch(f"{MODULE}._update_user_ai_prefs") as mock_upd_ai,
    ):
        mock_get_notif.return_value = notif_copy
        mock_get_ai.return_value = ai_copy
        mock_get_notif.side_effect = None  # allow multiple calls
        mock_get_ai.side_effect = None

        yield {
            "get_notif": mock_get_notif,
            "get_ai": mock_get_ai,
            "upd_notif": mock_upd_notif,
            "upd_ai": mock_upd_ai,
        }


# ── Helper: assert response shape ────────────────────────────────────


def _assert_settings_ok(response):
    """Quick assertion helper for a 200 settings response."""
    assert response.status_code == 200
    data = response.json()
    assert "notifications" in data
    assert "ai" in data
    assert "appearance" in data
    return data


# ── GET /api/settings tests ──────────────────────────────────────────


class TestGetSettings:
    def test_returns_200_with_settings_response(self, client, mock_helpers):
        """GET /api/settings returns unified settings from both schemas."""
        response = client.get("/api/settings")
        data = _assert_settings_ok(response)

        # Notifications
        assert data["notifications"]["enabled"] is True
        assert data["notifications"]["notify_times"] == ["09:00", "18:00"]
        assert data["notifications"]["notify_overdue"] is True
        assert data["notifications"]["notify_soon"] is True

        # AI
        assert data["ai"]["learning_enabled"] is True
        assert data["ai"]["suggestion_types"] == [
            "recurrence",
            "timing",
            "assignment",
        ]

        # Appearance (default)
        assert data["appearance"]["theme"] == "system"

        # Internal helpers should have been called
        mock_helpers["get_notif"].assert_called()
        mock_helpers["get_ai"].assert_called()

    def test_returns_correct_response_model_fields(self, client, mock_helpers):
        """Response contains all three top-level fields."""
        response = client.get("/api/settings")
        data = response.json()
        assert set(data.keys()) == {"notifications", "ai", "appearance"}

    def test_get_settings_with_light_theme_param(self, client):
        """GET /api/settings?theme=light returns appearance with light theme."""
        with (
            patch(f"{MODULE}._get_user_notifications", return_value=dict(NOTIF_PREFS)),
            patch(f"{MODULE}._get_user_ai_prefs", return_value=dict(AI_PREFS)),
        ):
            response = client.get("/api/settings?theme=light")

        assert response.status_code == 200
        data = response.json()
        assert data["appearance"]["theme"] == "light"

    def test_get_settings_with_dark_theme_param(self, client):
        """GET /api/settings?theme=dark returns appearance with dark theme."""
        with (
            patch(f"{MODULE}._get_user_notifications", return_value=dict(NOTIF_PREFS)),
            patch(f"{MODULE}._get_user_ai_prefs", return_value=dict(AI_PREFS)),
        ):
            response = client.get("/api/settings?theme=dark")

        assert response.status_code == 200
        data = response.json()
        assert data["appearance"]["theme"] == "dark"

    def test_get_settings_with_system_theme_param(self, client):
        """GET /api/settings?theme=system explicitly returns system theme."""
        with (
            patch(f"{MODULE}._get_user_notifications", return_value=dict(NOTIF_PREFS)),
            patch(f"{MODULE}._get_user_ai_prefs", return_value=dict(AI_PREFS)),
        ):
            response = client.get("/api/settings?theme=system")

        assert response.status_code == 200
        data = response.json()
        assert data["appearance"]["theme"] == "system"

    def test_get_settings_invalid_theme_falls_back_to_system(self, client):
        """GET /api/settings?theme=invalid falls back to 'system' theme."""
        with (
            patch(f"{MODULE}._get_user_notifications", return_value=dict(NOTIF_PREFS)),
            patch(f"{MODULE}._get_user_ai_prefs", return_value=dict(AI_PREFS)),
        ):
            response = client.get("/api/settings?theme=invalid")

        assert response.status_code == 200
        data = response.json()
        assert data["appearance"]["theme"] == "system"

    def test_get_settings_requires_authentication(self, client):
        """GET /api/settings without auth header returns 401."""
        client_no_auth = TestClient(
            app,
            base_url="http://test",
            headers={},  # no X-User-Email, no Authorization
        )
        response = client_no_auth.get("/api/settings")
        assert response.status_code == 401
        assert response.json()["error"] == "Authentication required"


# ── PUT /api/settings tests ──────────────────────────────────────────


class TestUpdateSettings:
    def test_put_settings_updates_notifications(self, client, mock_helpers):
        """PUT /api/settings with notifications section sends partial update."""
        response = client.put(
            "/api/settings",
            json={
                "notifications": {
                    "enabled": False,
                    "notify_overdue": False,
                }
            },
        )

        data = _assert_settings_ok(response)
        assert data["notifications"]["enabled"] is True  # mock returns original

        # Verify update helper was called with correct data and email
        call_args = mock_helpers["upd_notif"].call_args
        assert call_args[0][1] == FAKE_EMAIL
        # Second positional arg is the NotificationPreferencesUpdate model
        update_obj = call_args[0][2]
        assert update_obj.enabled is False
        assert update_obj.notify_overdue is False
        # Fields not in payload should be None
        assert update_obj.notify_times is None
        assert update_obj.notify_soon is None

    def test_put_settings_updates_ai_prefs(self, client, mock_helpers):
        """PUT /api/settings with ai section sends partial update."""
        response = client.put(
            "/api/settings",
            json={
                "ai": {
                    "learning_enabled": False,
                    "suggestion_types": ["timing"],
                }
            },
        )

        _assert_settings_ok(response)

        # Verify update helper was called
        call_args = mock_helpers["upd_ai"].call_args
        assert call_args[0][1] == FAKE_EMAIL
        update_obj = call_args[0][2]
        assert update_obj.learning_enabled is False
        assert update_obj.suggestion_types == ["timing"]

    def test_put_settings_updates_appearance(self, client, mock_helpers):
        """PUT /api/settings with appearance section updates theme."""
        response = client.put(
            "/api/settings",
            json={
                "appearance": {
                    "theme": "dark",
                }
            },
        )

        data = _assert_settings_ok(response)
        assert data["appearance"]["theme"] == "dark"

    def test_put_settings_full_update_all_sections(self, client, mock_helpers):
        """PUT /api/settings with all three sections triggers all updaters."""
        response = client.put(
            "/api/settings",
            json={
                "notifications": {"enabled": False, "notify_soon": False},
                "ai": {"learning_enabled": False, "suggestion_types": ["recurrence"]},
                "appearance": {"theme": "light"},
            },
        )

        data = _assert_settings_ok(response)
        assert data["appearance"]["theme"] == "light"
        assert mock_helpers["upd_notif"].called
        assert mock_helpers["upd_ai"].called

    def test_put_settings_invalid_theme_raises_422(self, client, mock_helpers):
        """PUT /api/settings with an invalid theme triggers Pydantic 422 validation error."""
        response = client.put(
            "/api/settings",
            json={
                "appearance": {
                    "theme": "midnight-purple",
                }
            },
        )

        assert response.status_code == 422
        assert "theme" in response.json()["detail"][0]["loc"]
        assert "pattern" in response.json()["detail"][0]["msg"]

    def test_put_settings_empty_body_noop(self, client, mock_helpers):
        """PUT /api/settings with empty object returns current settings."""
        response = client.put("/api/settings", json={})

        data = _assert_settings_ok(response)
        # No update helpers should have been called
        assert not mock_helpers["upd_notif"].called
        assert not mock_helpers["upd_ai"].called
        # But reads should have fired
        assert mock_helpers["get_notif"].called
        assert mock_helpers["get_ai"].called

    def test_put_settings_partial_update_left_fields_none(self, client, mock_helpers):
        """PUT /api/settings with some fields null leaves them untouched."""
        response = client.put(
            "/api/settings",
            json={
                # Only enable notifications, leave notify_times untouched
                "notifications": {"enabled": True},
            },
        )

        _assert_settings_ok(response)

        # Verify the update helper received only the changed field
        call_args = mock_helpers["upd_notif"].call_args
        update_obj = call_args[0][2]
        assert update_obj.enabled is True
        # Fields not in payload should be None (not present in update)
        assert update_obj.notify_times is None
        assert update_obj.notify_overdue is None
        assert update_obj.notify_soon is None

    def test_put_settings_no_appearance_validates_light(self, client, mock_helpers):
        """PUT /api/settings with light theme in appearance returns light."""
        response = client.put(
            "/api/settings",
            json={
                "appearance": {"theme": "light"},
            },
        )

        data = _assert_settings_ok(response)
        assert data["appearance"]["theme"] == "light"

    def test_put_settings_multiple_calls_are_independent(self, client, mock_helpers):
        """Multiple PUT calls each trigger their own helpers."""
        client.put(
            "/api/settings",
            json={"appearance": {"theme": "dark"}},
        )
        assert mock_helpers["upd_notif"].call_count == 0
        assert mock_helpers["upd_ai"].call_count == 0

        client.put(
            "/api/settings",
            json={"appearance": {"theme": "light"}},
        )
        # Still 0 — appearance-only updates don't call notification/AI helpers
