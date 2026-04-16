from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.models import ScheduledNotification


def create_scheduled_notification(
    db: Session,
    user_email: str,
    scheduled_for: datetime,
    notification_type: str,
    chore_id: Optional[int] = None,
) -> ScheduledNotification:
    """Create a scheduled notification"""
    notification = ScheduledNotification(
        user_email=user_email,
        chore_id=chore_id,
        scheduled_for=scheduled_for,
        notification_type=notification_type,
        processed=False,
    )

    db.add(notification)
    db.commit()
    db.refresh(notification)

    return notification


def get_unprocessed_scheduled_notifications(db: Session, now: datetime = None):
    """Get all unprocessed notifications that are due"""
    if now is None:
        now = datetime.utcnow()

    query = text("""
        SELECT id, user_email, chore_id, scheduled_for, sent_at, notification_type, processed
        FROM notifications.scheduled_notifications
        WHERE processed = FALSE AND scheduled_for <= :now
        ORDER BY scheduled_for ASC
    """)

    result = db.execute(query, {"now": now})
    return result.fetchall()


def mark_notification_sent(db: Session, notification_id: int):
    """Mark a notification as sent"""
    db.execute(
        text("""
        UPDATE notifications.scheduled_notifications
        SET processed = TRUE, sent_at = :now
        WHERE id = :id
    """),
        {"now": datetime.utcnow(), "id": notification_id},
    )
    db.commit()


def get_user_scheduled_notifications(db: Session, user_email: str):
    """Get all scheduled notifications for a user"""
    query = text("""
        SELECT id, user_email, chore_id, scheduled_for, sent_at, notification_type, processed
        FROM notifications.scheduled_notifications
        WHERE user_email = :email
        ORDER BY scheduled_for DESC
    """)

    result = db.execute(query, {"email": user_email})
    return result.fetchall()
