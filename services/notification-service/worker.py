from celery.schedules import crontab
from app.celery_app import celery_app
from app.tasks import send_scheduled_notifications, check_overdue_chores

# Configure periodic tasks
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
