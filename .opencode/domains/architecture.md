# choretwo - Architecture

Full-stack chore management platform with 5 microservices + Vue 3 PWA frontend.

## Services

| Service | Language | Port | Schema | Description |
|---------|----------|------|--------|-------------|
| auth-service | Go/Gin | 8001 | auth | JWT, Dex OIDC, sessions |
| chore-service | Python/FastAPI | 8002 | chores | CRUD, recurrence, health scoring |
| log-service | Python/FastAPI | 8003 | logs | Audit trail, undo |
| notification-service | Python/FastAPI | 8004 | notifications | Celery, Redis, Gotify |
| ai-copilot-service | Python/FastAPI | 8005 | ai | NLP, Ollama, suggestions |
| frontend | Vue 3 | 3000 | — | PWA, Material Design 3 |

## Infrastructure

- **PostgreSQL 16**: Single instance, schema isolation (`?schema=<name>`)
- **Redis 7**: Cache + Celery queue
- **Dex**: OIDC provider (Google/GitHub)
- **FluxCD**: GitOps deployment (NOT ArgoCD)
- **nginx-ingress**: Path-based routing, TLS via cert-manager + LetsEncrypt
- **Docker Compose**: Local development stack

## Deployment

- **Staging**: `choretwo-staging.stillon.top` — auto-deploy on push to `main`
- **Production**: `choretwo.stillon.top` — deploy on tag `v*`
- **k3s-config repo**: https://github.com/pipelinedave/k3s-config (Flux Kustomization)

## CI/CD

1. Push to `main` → GitHub Actions builds & pushes Docker images
2. Updates k3s-config repo with new image tags
3. Flux reconciles → staging after 5min
4. E2E tests run on staging
5. Manual approval for production (tag `v*`)

## Database

```sql
CREATE SCHEMA auth;
CREATE SCHEMA chores;
CREATE SCHEMA logs;
CREATE SCHEMA notifications;
CREATE SCHEMA ai;
```

Each service connects via `DATABASE_URL?schema=<name>`. Init script: `scripts/init-db.sql`.

## Auth Flow

1. Frontend redirects to Dex (`https://dex.stillon.top`)
2. User authenticates with Google/GitHub
3. Dex redirects back to `/auth-callback` with auth code
4. Backend exchanges code for ID token
5. Generates JWT (24h access + 7d refresh)
6. Frontend stores token, makes authenticated requests

Dev mode: `USE_MOCK_AUTH=true` bypasses Dex.

## Local Development

```bash
# Start full stack
docker-compose up

# Start Vite dev server (free port 3000)
docker-compose stop frontend && cd frontend && npm run dev
```

Vite proxies `/api/*` to Docker services (8001-8005).

## API Conventions

- Backend: **snake_case**
- Frontend: **camelCase**
- Frontend normalizes via Pinia stores (`normalizeChore()`)
- Auth: Bearer token in `Authorization` header
- JSON response format, Swagger at `/docs` (Python services)
