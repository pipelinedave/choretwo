import hmac
import os
from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime

from app.database import get_db
from app.schemas import (
    NotificationPreferencesCreate,
    ScheduledNotificationCreate,
    TestNotificationRequest,
)
from app.services import notifier as notifier_module
from app.services.scheduler import (
    create_scheduled_notification,
    get_user_scheduled_notifications,
    mark_notification_sent,
)
from app.services.notifier import (
    send_chore_due_soon_notification,
    send_chore_overdue_notification,
    send_test_notification,
)

router = APIRouter(prefix="/api/notify")

# Vercel-Cron-Secret (Vercel sendet `Authorization: Bearer $CRON_SECRET`).
CRON_SECRET = os.getenv("CRON_SECRET", "")


def _cron_authorized(request: Request) -> bool:
    """Cron-Endpoint-Auth: AUSSCHLIESSLICH Bearer == CRON_SECRET.

    Bewusst KEIN User-JWT-Pfad: Ein gültiger User-JWT würde jeden
    angemeldeten User erlauben, den Batch für ALLE User zu triggern
    (vorzeitiger Versand ohne Scope/Rate-Limit). Vercel Cron sendet
    immer CRON_SECRET — mehr Auth-Fläche ist nicht nötig. Im Monolith
    lässt die Auth-Middleware den Cron-Bearer nur auf genau diesem
    Pfad durch (pfad-restrictierter Bypass); der Endpoint prüft hier
    zusätzlich selbst (Defense in Depth).
    """
    auth_header = request.headers.get("Authorization", "")
    return bool(CRON_SECRET) and hmac.compare_digest(
        auth_header, f"Bearer {CRON_SECRET}"
    )


@router.get("/preferences")
async def get_preferences(request: Request, db: Session = Depends(get_db)):
    """Get user's notification preferences"""
    user_email = request.state.user_email

    result = db.execute(
        text("""
        SELECT user_email, enabled, notify_times, notify_overdue, notify_soon, created_at, updated_at
        FROM notifications.notification_preferences
        WHERE user_email = :email
    """),
        {"email": user_email},
    )

    row = result.fetchone()

    if row:
        return {
            "user_email": row[0],
            "enabled": row[1],
            "notify_times": row[2],
            "notify_overdue": row[3],
            "notify_soon": row[4],
            "created_at": row[5].isoformat() if row[5] else None,
            "updated_at": row[6].isoformat() if row[6] else None,
        }

    # Create default preferences if they don't exist
    db.execute(
        text("""
        INSERT INTO notifications.notification_preferences (user_email, enabled, notify_times, notify_overdue, notify_soon)
        VALUES (:email, TRUE, '["09:00", "18:00"]'::jsonb, TRUE, TRUE)
    """),
        {"email": user_email},
    )
    db.commit()

    return {
        "user_email": user_email,
        "enabled": True,
        "notify_times": ["09:00", "18:00"],
        "notify_overdue": True,
        "notify_soon": True,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }


@router.put("/preferences")
async def update_preferences(
    request: Request,
    preferences: NotificationPreferencesCreate,
    db: Session = Depends(get_db),
):
    """Update user's notification preferences"""
    user_email = request.state.user_email

    db.execute(
        text("""
        INSERT INTO notifications.notification_preferences (user_email, enabled, notify_times, notify_overdue, notify_soon, updated_at)
        VALUES (:email, :enabled, :notify_times, :notify_overdue, :notify_soon, :updated_at)
        ON CONFLICT (user_email) DO UPDATE SET
            enabled = EXCLUDED.enabled,
            notify_times = EXCLUDED.notify_times,
            notify_overdue = EXCLUDED.notify_overdue,
            notify_soon = EXCLUDED.notify_soon,
            updated_at = EXCLUDED.updated_at
    """),
        {
            "email": user_email,
            "enabled": preferences.enabled,
            "notify_times": preferences.notify_times,
            "notify_overdue": preferences.notify_overdue,
            "notify_soon": preferences.notify_soon,
            "updated_at": datetime.utcnow(),
        },
    )
    db.commit()

    return await get_preferences(request, db)


@router.get("/scheduled")
async def list_scheduled_notifications(request: Request, db: Session = Depends(get_db)):
    """List user's scheduled notifications"""
    user_email = request.state.user_email
    rows = get_user_scheduled_notifications(db, user_email)

    notifications = []
    for row in rows:
        notifications.append(
            {
                "id": row[0],
                "user_email": row[1],
                "chore_id": row[2],
                "scheduled_for": row[3].isoformat() if row[3] else None,
                "sent_at": row[4].isoformat() if row[4] else None,
                "notification_type": row[5],
                "processed": row[6],
            }
        )

    return notifications


@router.post("/schedule")
async def schedule_notification(
    request: Request,
    schedule_data: ScheduledNotificationCreate,
    db: Session = Depends(get_db),
):
    """Schedule a notification (internal use)"""
    # Verify user has permission (only allow scheduling for self)
    if schedule_data.user_email != request.state.user_email:
        raise HTTPException(
            status_code=403, detail="Cannot schedule notifications for other users"
        )

    notification = create_scheduled_notification(
        db,
        schedule_data.user_email,
        schedule_data.scheduled_for,
        schedule_data.notification_type,
        schedule_data.chore_id,
    )

    return {
        "id": notification.id,
        "user_email": notification.user_email,
        "chore_id": notification.chore_id,
        "scheduled_for": notification.scheduled_for.isoformat(),
        "notification_type": notification.notification_type,
        "processed": notification.processed,
    }


@router.post("/test")
async def send_test_notification_endpoint(
    request: Request,
    test_request: TestNotificationRequest,
    db: Session = Depends(get_db),
):
    """Send a test notification"""
    user_email = request.state.user_email

    success = await send_test_notification(
        user_email, test_request.message, test_request.priority
    )

    if success:
        return {"message": "Test notification sent successfully"}
    else:
        raise HTTPException(status_code=500, detail="Failed to send test notification")


@router.api_route("/run-due", methods=["GET", "POST"])
async def run_due_notifications(request: Request, db: Session = Depends(get_db)):
    """Versendet alle fälligen Scheduled-Notifications (Vercel-Cron-Endpoint).

    Ersetzt den früheren Celery-Worker: Vercel Cron triggert täglich
    (vercel.json, Hobby-Plan erlaubt nur Daily-Crons) mit
    `Authorization: Bearer $CRON_SECRET`. Ohne GOTIFY-Konfiguration
    wird bewusst 200 + `skipped` geliefert statt zu crashen (Cron darf
    nicht alarmieren).
    """
    if not _cron_authorized(request):
        raise HTTPException(status_code=401, detail="Authentication required")

    if not notifier_module.GOTIFY_TOKEN:
        return {"skipped": "gotify_not_configured"}

    rows = db.execute(
        text("""
        SELECT n.id, n.user_email, n.chore_id, n.scheduled_for, n.notification_type,
               c.name AS chore_name
        FROM notifications.scheduled_notifications n
        LEFT JOIN chores.chores c ON c.id = n.chore_id
        WHERE n.processed = FALSE AND n.scheduled_for <= :now
        ORDER BY n.scheduled_for ASC
        LIMIT 100
    """),
        {"now": datetime.utcnow()},
    ).fetchall()

    sent = 0
    failed = 0
    skipped_unknown_type = 0
    for row in rows:
        (
            notification_id,
            user_email,
            chore_id,
            scheduled_for,
            notification_type,
            chore_name,
        ) = row
        chore_label = chore_name or f"Chore #{chore_id}"
        try:
            if notification_type == "overdue":
                ok = await send_chore_overdue_notification(user_email, chore_label)
            elif notification_type == "soon":
                ok = await send_chore_due_soon_notification(
                    user_email, chore_label, str(scheduled_for)
                )
            else:
                # Unbekannter Typ: als erledigt markieren (Poison-Row-Schutz),
                # aber separat zählen statt als Versand zu verbuchen.
                skipped_unknown_type += 1
                ok = True

            if ok:
                mark_notification_sent(db, notification_id)
                sent += 1
            else:
                failed += 1
        except Exception as exc:  # noqa: BLE001 - Cron darf nicht abbrechen
            print(f"[run-due] Versand fehlgeschlagen (id={notification_id}): {exc}")
            failed += 1

    return {
        "due": len(rows),
        "sent": sent,
        "failed": failed,
        "skipped_unknown_type": skipped_unknown_type,
    }
