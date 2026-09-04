from celery import Celery
import os

CELERY_BROKER_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
CELERY_RESULT_BACKEND = os.getenv("REDIS_URL", "redis://redis:6379/0")

celery_app = Celery(
    "notifications",
    broker=CELERY_BROKER_URL,
    backend=CELERY_RESULT_BACKEND,
    include=["app.celery_app"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,
)

# Periodic task configuration
celery_app.conf.beat_schedule = {
    "check-overdue-chores-every-15-minutes": {
        "task": "check_overdue_chores",
        "schedule": 900.0,  # 15 minutes
    },
    "send-scheduled-notifications-every-5-minutes": {
        "task": "send_scheduled_notifications",
        "schedule": 300.0,  # 5 minutes
    },
}

celery_app.conf.timezone = "UTC"
