# choretwo - Shared Patterns

Cross-cutting patterns used by all services. Shared knowledge to reduce per-agent context.

## Auth Middleware Pattern

### Go (auth-service)
- `app/middleware/auth.go` — Extracts JWT from `Authorization: Bearer <token>`
- Parses claims (email, user ID), attaches to Gin Context
- Session middleware for cookie-based Sessions

### Python (chore/log/ai/notification)
- `app/middleware/auth/__init__.py` — Decorator or middleware function
- Extracts JWT from `Authorization: Bearer <token>`
- Validates signature, attaches `user_email` to request state
- AI & Notification services: signature bypass (`verify_signature: False`) — decodes email only

## CORS Configuration

```python
# All Python services
CORSMiddleware(
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Go: specific domains per environment.

## Route Ordering (FastAPI — CRITICAL!)

Specific routes MUST be defined BEFORE parameterized routes.

```python
# CORRECT:
router.get("/count")        # specific — matched first
router.get("/{chore_id}")   # parameterized — matched second

# WRONG:
router.get("/{chore_id}")   # FastAPI treats "count" as chore_id
router.get("/count")        # never reached — 404
```

## Health Check Pattern

All services expose:
```
GET /health → {"status": "ok"}
```

## Database Connection

```
postgresql://user:pass@postgres:5432/choretwo?sslmode=disable
```

Each service uses `?schema=<name>` to isolate its tables.

Python services: `asyncpg` for async, `psycopg2` as fallback.
Go service: `lib/pq` + gorpg pool.

## Testing Requirements

| Service | Coverage Target |
|---------|----------------|
| auth-service | 90% |
| chore-service | 90% |
| log-service | 90% |
| notification-service | 85% |
| ai-copilot-service | 80% |
| frontend | 80% |

Linter: `ruff` (Python), `golangci-lint` (Go), `eslint` (Vue).

## Security

- NEVER commit secrets or keys
- NEVER commit unsealed SealedSecrets
- Session cookies: `httpOnly=true`, `secure=true`, `sameSite=lax`
- JWT HS256 with strong secret
- Flux pruning: never add `namespace.yaml` to kustomize
- PVC protection: add `finalizers: [kubernetes.io/pvc-protection]`

## Git Workflow

- Branch: `main`
- Commits only when explicitly asked
- Message format: concise, 1-2 sentences, focus on reason
- NEVER force push, NEVER skip hooks
- AMEND only when explicitly asked OR hooks auto-modify

## Docker Compose

Ports:
- 8001: auth-service
- 8002: chore-service
- 8003: log-service
- 8004: notification-service
- 8005: ai-copilot-service
- 3000: frontend (nginx)

Network: `choretwo-network` (bridge).

## Frontend API Clients

`frontend/src/api/index.js` — 5 Axios instances:
- `authApi` → `http://localhost:8001/api/auth`
- `choreApi` → `http://localhost:8002/api/chores`
- `logApi` → `http://localhost:8003/api/logs`
- `notifyApi` → `http://localhost:8004/api/notify`
- `aiApi` → `http://localhost:8005/api/ai`

Each has Bearer token interceptor. On 401: clear storage + redirect to `/login`.

## Cross-Service Logging

chore-service's `utils.py` → `log_action()` writes directly to `logs` schema (same Postgres, different schema). Audit trail entries stored as JSONB.

## Flux Dependencies

Always add `dependsOn: dex` for auth-dependent services in Kustomization.
