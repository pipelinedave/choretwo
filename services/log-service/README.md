# Log Service

Python/FastAPI microservice for audit trail and undo functionality.

## Features

- Complete audit trail for all chore actions
- Undo capability for created/updated/marked_done/archived actions
- User-visible log history with permission filtering
- JSONB storage for flexible action details
- Integration with chore-service for undo operations

## Quick Start

### Local Development

```bash
cd services/log-service
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Visit: http://localhost:8003/api/logs

### With Docker

```bash
docker build -t pipelinedave/log-service .
docker run -p 8003:8000 pipelinedave/log-service
```

## API Endpoints

### Logs

- `GET /api/logs` - List logs (paginated, user-filtered)
- `GET /api/logs/{id}` - Get specific log entry
- `POST /api/logs` - Create log entry (internal use)
- `POST /api/logs/bulk` - Create multiple logs at once
- `POST /api/logs/undo` - Undo action by log_id

## Environment Variables

```bash
DATABASE_URL=postgres://user:pass@host:5432/choretwo?schema=logs
REDIS_URL=redis://localhost:6379
SERVER_URL=http://localhost:8003
```

## Testing

```bash
pytest tests/ -v
pytest tests/ --cov=app --cov-report=html
```

## Architecture

```
app/
├── main.py              # FastAPI app
├── database.py          # SQLAlchemy setup
├── models.py            # ChoreLog model
├── schemas.py           # Pydantic models
├── middleware/
│   └── auth.py          # User validation
├── routes/
│   └── logs.py          # All log endpoints
└── services/
    ├── log_service.py   # Log CRUD operations
    └── undo_service.py  # Undo logic with chore-service calls
```

## Undo Logic

When undoing an action, the log service:
1. Retrieves the original log entry
2. Calls chore-service API to reverse the operation
3. Creates a new "undo" log entry

Supported undo operations:
- **created** → Archive the chore
- **updated** → Restore previous state
- **marked_done** → Reset done status
- **archived** → Unarchive the chore
