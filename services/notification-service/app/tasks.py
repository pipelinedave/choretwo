from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import text
import logging

from app.celery_app import celery_app
from app.services.notifier import (
    send_chore_overdue_notification,
    send_chore_due_soon_notification,
)
from app.services.scheduler import (
    get_unprocessed_scheduled_notifications,
    mark_notification_sent,
)

logger = logging.getLogger(__name__)


@celery_app.task
def send_scheduled_notifications():
    """Celery task to send all due scheduled notifications"""
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        notifications = get_unprocessed_scheduled_notifications(db, datetime.utcnow())

        for row in notifications:
            notification_id = row[0]
            user_email = row[1]
            chore_id = row[2]
            notification_type = row[5]

            try:
                if notification_type == "overdue":
                    # Send overdue notification
                    # In a real implementation, we'd fetch chore name from chore-service
                    await send_chore_overdue_notification(
                        user_email, f"Chore #{chore_id}"
                    )
                elif notification_type == "soon":
                    await send_chore_due_soon_notification(
                        user_email, f"Chore #{chore_id}", str(row[3])
                    )

                mark_notification_sent(db, notification_id)
                logger.info(f"Sent notification {notification_id} to {user_email}")

            except Exception as e:
                logger.error(f"Failed to send notification {notification_id}: {e}")

    finally:
        db.close()


@celery_app.task
def check_overdue_chores():
    """Celery task to check for overdue chores and create notifications"""
    from app.database import SessionLocal
    from app.services.scheduler import create_scheduled_notification

    db = SessionLocal()
    try:
        # Query overdue chores from chore-service via API
        # For now, this is a placeholder
        logger.info("Checking for overdue chores...")

        # In production:
        # 1. Call chore-service to get overdue chores
        # 2. For each overdue chore, check if notification already sent
        # 3. Create scheduled notification if needed

    finally:
        db.close()


@celery_app.task
def send_notification_task(user_email: str, message: str, title: str, priority: int):
    """Celery task to send a notification"""
    from app.services.notifier import send_gotify_notification

    return send_gotify_notification(user_email, message, title, priority)
