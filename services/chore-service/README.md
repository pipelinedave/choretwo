# Chore Service

Python/FastAPI microservice for chore management.

## Features

- CRUD operations for chores
- Recurrence interval logic
- Mark chores complete with auto-scheduling
- Archive/restore chores
- Import/export data
- Statistics (overdue, due soon, on track)
- Integration with log service for audit trail

## Quick Start

### Local Development

```bash
cd services/chore-service
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Visit: http://localhost:8002/api/chores

### With Docker

```bash
docker build -t pipelinedave/chore-service .
docker run -p 8002:8000 pipelinedave/chore-service
```

## API Endpoints

### Chores

- `GET /api/chores` - List chores (paginated)
- `POST /api/chores` - Create chore
- `GET /api/chores/{id}` - Get chore
- `PUT /api/chores/{id}` - Update chore
- `PUT /api/chores/{id}/done` - Mark complete
- `PUT /api/chores/{id}/archive` - Archive chore
- `GET /api/chores/archived` - List archived chores
- `GET /api/chores/count` - Get statistics

### Data

- `GET /api/export` - Export all data
- `POST /api/import` - Import data

## Environment Variables

```bash
DATABASE_URL=postgres://user:pass@host:5432/choretwo?schema=chores
REDIS_URL=redis://localhost:6379
AUTH_SERVICE_URL=http://auth-service:8000
SERVER_URL=http://localhost:8002
```

## Testing

```bash
pytest tests/ -v
pytest tests/ --cov=app --cov-report=html
```

## Architecture

```
app/
├── main.py           # FastAPI app
├── database.py       # SQLAlchemy setup
├── models.py         # SQLAlchemy models
├── schemas.py        # Pydantic models
├── utils.py          # Logging utility
├── middleware/
│   └── auth.py       # User validation
├── routes/
│   ├── chores.py     # CRUD endpoints
│   └── export.py     # Import/export
└── services/
    ├── chore_service.py  # Business logic
    └── recurrence.py     # Recurrence calc
```
