# Notification Service

Python/FastAPI microservice for push notifications and scheduling.

## Features

- User notification preferences management
- Scheduled notifications (overdue, due soon)
- Celery workers for background processing
- Gotify integration for push delivery
- Periodic tasks for checking overdue chores

## Quick Start

### Local Development

```bash
cd services/notification-service
pip install -r requirements.txt

# Start API server
uvicorn app.main:app --reload

# Start Celery worker
celery -A app.celery_app worker --loglevel=info

# Start Celery beat (scheduler)
celery -A app.celery_app beat --loglevel=info
```

### With Docker

```bash
# Build and run all components
docker-compose up notification-service notification-worker notification-beat
```

## API Endpoints

### Preferences

- `GET /api/notify/preferences` - Get user's notification settings
- `PUT /api/notify/preferences` - Update settings

### Scheduled Notifications

- `GET /api/notify/scheduled` - List scheduled notifications
- `POST /api/notify/schedule` - Schedule a notification (internal)
- `POST /api/notify/test` - Send test notification

## Environment Variables

```bash
DATABASE_URL=postgres://user:pass@host:5432/choretwo?schema=notifications
REDIS_URL=redis://localhost:6379
GATWAY_URL=https://gotify.stillon.top
GATWAY_TOKEN=your-gotify-token
SERVER_URL=http://localhost:8004
```

## Celery Tasks

### Periodic Tasks (via Celery Beat)

- `check_overdue_chores` - Every 15 minutes
  - Checks for overdue chores
  - Creates notifications for affected users

- `send_scheduled_notifications` - Every 5 minutes
  - Sends all due scheduled notifications
  - Marks notifications as processed

### Worker Tasks

- `send_notification_task(user_email, message, title, priority)`
  - Sends notification via Gotify

## Testing

```bash
pytest tests/ -v
pytest tests/ --cov=app --cov-report=html
```

## Architecture

```
app/
├── main.py              # FastAPI app
├── celery_app.py        # Celery configuration
├── database.py          # SQLAlchemy setup
├── models.py            # Notification models
├── schemas.py           # Pydantic models
├── middleware/
│   └── auth.py          # User validation
├── routes/
│   └── preferences.py   # All notification endpoints
└── services/
    ├── notifier.py      # Gotify delivery
    └── scheduler.py     # Scheduling logic
```

## Integration

### With Chore Service

Chore-service can schedule notifications by calling:

```bash
POST /api/notify/schedule
{
  "user_email": "user@example.com",
  "chore_id": 123,
  "scheduled_for": "2024-01-15T09:00:00Z",
  "notification_type": "soon"
}
```

### With Gotify

The service sends notifications to Gotify which delivers them to:
- Browser notifications (if subscribed)
- Mobile app (if installed)
- Desktop notifications
