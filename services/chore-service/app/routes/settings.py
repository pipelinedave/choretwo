from __future__ import annotations

from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
from typing import Any
from psycopg2.extras import Json

from app.database import get_db
from app.schemas import (
    SettingsResponse,
    SettingsUpdate,
    NotificationPreferencesUpdate,
    AIUserPreferencesUpdate,
    NotificationPreferencesGet,
    AIUserPreferencesGet,
    AppearanceSettings,
)

router = APIRouter(prefix="/api")


def _get_user_notifications(db: Session, email: str) -> NotificationPreferencesGet:
    result = db.execute(
        text("""
        SELECT user_email, enabled, notify_times, notify_overdue, notify_soon,
               created_at, updated_at
        FROM notifications.notification_preferences
        WHERE user_email = :email
    """),
        {"email": email},
    )

    row = result.fetchone()
    if row:
        return NotificationPreferencesGet(
            enabled=row[1],
            notify_times=row[2] or ["09:00", "18:00"],
            notify_overdue=row[3],
            notify_soon=row[4],
            created_at=row[5].isoformat() if row[5] else None,
            updated_at=row[6].isoformat() if row[6] else None,
        )

    db.execute(
        text("""
        INSERT INTO notifications.notification_preferences
            (user_email, enabled, notify_times, notify_overdue, notify_soon)
        VALUES (:email, TRUE, '["09:00", "18:00"]'::jsonb, TRUE, TRUE)
    """),
        {"email": email},
    )
    now = datetime.utcnow().isoformat()
    db.commit()

    return NotificationPreferencesGet(
        enabled=True,
        notify_times=["09:00", "18:00"],
        notify_overdue=True,
        notify_soon=True,
        created_at=now,
        updated_at=now,
    )


def _update_user_notifications(
    db: Session, email: str, data: NotificationPreferencesUpdate
):
    enabled = data.enabled if data.enabled is not None else None
    notify_times = data.notify_times if data.notify_times is not None else None
    notify_overdue = data.notify_overdue if data.notify_overdue is not None else None
    notify_soon = data.notify_soon if data.notify_soon is not None else None

    fields: list[str] = []
    values: dict = {"email": email}

    if enabled is not None:
        fields.append("enabled = :enabled")
        values["enabled"] = enabled
    if notify_times is not None:
        # Wrap jsonb list values with Json() so psycopg2 serialises as JSON
        # instead of PostgreSQL ARRAY (which causes DatatypeMismatch).
        fields.append("notify_times = :notify_times")
        values["notify_times"] = Json(notify_times)
    if notify_overdue is not None:
        fields.append("notify_overdue = :notify_overdue")
        values["notify_overdue"] = notify_overdue
    if notify_soon is not None:
        fields.append("notify_soon = :notify_soon")
        values["notify_soon"] = notify_soon

    if fields:
        values["updated_at"] = datetime.utcnow()
        fields.append("updated_at = :updated_at")
        db.execute(
            text(
                """
            INSERT INTO notifications.notification_preferences (user_email, updated_at)
            VALUES (:email, :updated_at)
            ON CONFLICT (user_email) DO UPDATE SET
                {set_clause}
            RETURNING enabled, notify_times, notify_overdue, notify_soon,
                      created_at, updated_at
        """.format(set_clause=", ".join(fields))
            ),
            values,
        )
        db.commit()


def _get_user_ai_prefs(db: Session, email: str) -> AIUserPreferencesGet:
    result = db.execute(
        text("""
        SELECT user_email, learning_enabled, suggestion_types,
               created_at, updated_at
        FROM ai.ai_user_preferences
        WHERE user_email = :email
    """),
        {"email": email},
    )

    row = result.fetchone()
    if row:
        return AIUserPreferencesGet(
            learning_enabled=row[1],
            suggestion_types=row[2] or ["recurrence", "timing", "assignment"],
            created_at=row[3].isoformat() if row[3] else None,
            updated_at=row[4].isoformat() if row[4] else None,
        )

    db.execute(
        text("""
        INSERT INTO ai.ai_user_preferences
            (user_email, learning_enabled, suggestion_types)
        VALUES (:email, TRUE, '["recurrence", "timing", "assignment"]'::jsonb)
    """),
        {"email": email},
    )
    now = datetime.utcnow().isoformat()
    db.commit()

    return AIUserPreferencesGet(
        learning_enabled=True,
        suggestion_types=["recurrence", "timing", "assignment"],
        created_at=now,
        updated_at=now,
    )


def _update_user_ai_prefs(db: Session, email: str, data: AIUserPreferencesUpdate):
    suggestion_types = (
        data.suggestion_types if data.suggestion_types is not None else None
    )
    learning_enabled = (
        data.learning_enabled if data.learning_enabled is not None else None
    )

    fields: list[str] = []
    values: dict = {"email": email}

    if learning_enabled is not None:
        fields.append("learning_enabled = :learning_enabled")
        values["learning_enabled"] = learning_enabled
    if suggestion_types is not None:
        # Wrap jsonb list values with Json() so psycopg2 serialises as JSON
        # instead of PostgreSQL ARRAY (which causes DatatypeMismatch).
        fields.append("suggestion_types = :suggestion_types")
        values["suggestion_types"] = Json(suggestion_types)

    if fields:
        values["updated_at"] = datetime.utcnow()
        fields.append("updated_at = :updated_at")
        db.execute(
            text(
                """
            INSERT INTO ai.ai_user_preferences (user_email, updated_at)
            VALUES (:email, :updated_at)
            ON CONFLICT (user_email) DO UPDATE SET
                {set_clause}
            RETURNING learning_enabled, suggestion_types,
                      created_at, updated_at
        """.format(set_clause=", ".join(fields))
            ),
            values,
        )
        db.commit()


@router.get("/settings", response_model=SettingsResponse)
async def get_settings(request: Request, db: Session = Depends(get_db)):
    user_email = request.state.user_email

    notifications = _get_user_notifications(db, user_email)
    ai = _get_user_ai_prefs(db, user_email)
    appearance_param = request.query_params.get("theme", "system")

    if appearance_param not in ("light", "dark", "system"):
        appearance_param = "system"

    appearance = AppearanceSettings(theme=appearance_param)

    return SettingsResponse(
        notifications=notifications,
        ai=ai,
        appearance=appearance,
    )


@router.put("/settings", response_model=SettingsResponse)
async def update_settings(
    request: Request,
    body: SettingsUpdate,
    db: Session = Depends(get_db),
):
    user_email = request.state.user_email

    if body.notifications:
        _update_user_notifications(db, user_email, body.notifications)

    if body.ai:
        _update_user_ai_prefs(db, user_email, body.ai)

    if body.appearance:
        appearance_param = body.appearance.theme
        if appearance_param not in ("light", "dark", "system"):
            raise HTTPException(
                status_code=400, detail="Theme must be light, dark, or system"
            )

    notifications = _get_user_notifications(db, user_email)
    ai = _get_user_ai_prefs(db, user_email)

    final_theme = (body.appearance or AppearanceSettings()).theme
    appearance = AppearanceSettings(theme=final_theme)

    return SettingsResponse(
        notifications=notifications,
        ai=ai,
        appearance=appearance,
    )
