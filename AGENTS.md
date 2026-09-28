# choretwo - Agent Instructions

## Choretwo Agent System

Dieses Projekt verwendet **spezialisierte Subagents** für jede Domain. Der Primary Model delegiert automatisch basierend auf Keywords.

### Routing-Tabelle

| TASK KEYWORDS | → DELEGATE TO |
|---------------|---------------|
| Vue, component, Pinia, Vite, PWA, Playwright, ChoreCard, FilterPills, swipe, Material Design, store, view | **finn** |
| Go, Gin, Dex, OIDC, JWT, session, auth middleware, token, User model, login, callback | **aron** |
| chore, log, ai-copilot, FastAPI, recurrence, undo, NLP, intent, Pydantic, SQLAlchemy | **ben** |
| notification, Celery, push, Gotify, scheduler, preferences | **nelly** |
| test, pytest, Vitest, Playwright, coverage, TDD, unit test, mock fixture | **tessa** |
| Vercel-Deploy, Env-Vars (VITE_*), Domains, Build-Logs, Production-Check | **vera** (globaler Agent, einziger mit Vercel-Zugriff) |
| Docker-Compose nur lokal (Dev) | kein Deploy-Agent nötig, Doku unten |
| unclear scope, cross-service, API integration, full-stack both directions | **dean** |

### Spezialisten-Regeln

- **IMMER spezialisierte Agenten verwenden** — NEVER `general` wenn ein Spezialist passt
- Cross-cutting Tasks → `dean` (Supervisor, koordiniert mehrere Agents)
- Vercel-Deployment → `vera` (global). `kira`/k3s/Flux ist für choretwo STILLGELEGT — NIE für Deployments nutzen.
- Spezialisten haben strikte File-Scopes (sogar `.opencode/agents/*.md`)

## Current Status

✅ **All services running successfully** (as of latest session)
- Frontend authentication flow working with mock auth
- All 6 services operational: auth, chore, log, notification, ai-copilot, frontend
- E2E tests created (28 Playwright tests - 14 Chromium + 14 Firefox)
- PWA assets generated
- Local dev: Vite on port 3000, Docker services on 8001-8005

**See `SESSION_STATE.md` for detailed current session state**

## Architecture Overview

**Microservices:** 5 services + frontend
- `auth-service` (Go/Gin) - JWT, Dex OIDC, sessions
- `chore-service` (Python/FastAPI) - CRUD, recurrence
- `log-service` (Python/FastAPI) - audit trail, undo
- `notification-service` (Node/Express) - push scheduling
- `ai-copilot-service` (Python/FastAPI) - NLP, suggestions
- `frontend` (Vue 3) - PWA

**Production (STAND 28.09.2026 — k3s/Flux STILLGELEGT):**
- Hosting: Vercel (Projekt `choretwo`, productionBranch `main`)
- Frontend: statischer Build aus `frontend/dist` (`npm ci && npm run build`)
- Backend: EIN Python-Serverless-Monolith via `api/index.py` (FastAPI aus `monolith/main.py`,
  Vendor via `monolith/sync_vendor.py` im Build generiert)
- Routing: `vercel.json` rewrites (`/api/*` → Monolith, Rest → SPA)
- Domains: `choretwo.stillon.top` (prod), `choretwo.vercel.app`
- Deploy: Push auf `main` → Vercel Git-Integration baut+deployt automatisch nach Production.
  KEIN k3s, KEIN Flux, KEIN DockerHub, KEIN k3s-config mehr.
- Alte k3s-Artefakte (`docker-compose*.yml`, `.github/workflows/build-and-push.yaml`,
  `update-kubernetes-deployment.yaml`, `docs/DEPLOYMENT.md`-k3s-Teile) sind STALE/DEPRECATED.

**Lokal (Dev):** Docker-Compose (Postgres, Redis, Monolith :8000, Vite :3000) — nur Entwicklung, kein Deployment.

## Key Patterns

### Vercel Routing (vercel.json)
```json
// /api/* → Python-Monolith (api/index.py), alles andere → SPA (index.html)
{ "source": "/api/:path*", "destination": "/api/index.py" },
{ "source": "/((?!api/|assets/).*)", "destination": "/index.html" }
```
Build: `cd frontend && npm ci && npm run build && cd .. && python3 monolith/sync_vendor.py`
Cron: `/api/notify/run-due` täglich 07:00 (vercel.json `crons`).

### Database Pattern
Single Postgres instance, 4 schemas:
```sql
CREATE SCHEMA auth;
CREATE SCHEMA chores;
CREATE SCHEMA logs;
CREATE SCHEMA notifications;
```
Each service connects to its schema via `DATABASE_URL=postgres://.../choretwo?schema=chores`

### Auth Pattern (from choremane)
- Dex OAuth2 with Google/GitHub
- SessionMiddleware + secure cookies
- `X-User-Email` header for user identification
- JWT tokens passed to frontend
- Fallback mock auth for dev (`USE_MOCK_AUTH=true`)

## Development Commands

### Local Development (Vite + Docker)
```bash
# 1. Stop frontend container (to free port 3000)
docker-compose stop frontend

# 2. Start Vite dev server
cd frontend && npm run dev

# 3. Access app at http://localhost:3000
# API calls proxied to Docker services (8001-8005)
```

### Docker Compose (Full Stack)
```bash
# Start all services including frontend container
docker-compose up

# Single service
docker-compose up auth-service

# Reset database
docker-compose down -v && docker-compose up -d

# View logs
docker-compose logs -f auth-service
```

### Service Development
```bash
# Auth service (Go)
cd services/auth-service
go run cmd/main.go

# Chore/Log/AI services (Python)
cd services/chore-service
uvicorn app.main:app --reload

# Notification service (Node)
cd services/notification-service
npm run dev

# Frontend (Vue)
cd frontend
npm run dev
```

### Testing
```bash
# All services
make test-all

# Single service
make test-auth
make test-chore

# E2E
make test-e2e
# or
cd frontend && npm run test:e2e

# Coverage
make coverage-check
```

### Linting
```bash
# All services
make lint-all

# Single service
make lint-auth  # golangci-lint
make lint-chore # ruff
make lint-frontend # eslint
```

## Build & Deploy (Vercel, Stand 28.09.2026)

### Deploy Flow
1. Auf `main` pushen → Vercel Git-Integration baut automatisch (`vercel.json` buildCommand)
2. Vendor-Sync läuft im Build (`monolith/sync_vendor.py` → `monolith/vendor/*`, gitignored)
3. Bei grünem Build → automatisches Production-Deploy (`choretwo.stillon.top`)
4. Verifizieren: `https://choretwo.stillon.top/health` → `{"status":"ok",...}`
5. Build-Logs/Env-Vars/Domains: NUR über `vera` (Vercel-REST-API)

### Vercel Env-Vars (Production)
```
DATABASE_URL / JWT_SECRET / USE_MOCK_AUTH / CORS_ORIGINS (inkl. Vercel-Domains!)
VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
LLM_BASE_URL / LLM_MODEL / LLM_API_KEY (Secret, nie ins Repo)
RUN_STARTUP_MIGRATIONS=false (Serverless: keine DDL im Cold-Start)
```
Setzen/prüfen NUR über `vera`. NIEMALS Secrets ins Repo oder in Logs.

### DEPRECATED (nicht mehr nutzen)
- `make build-all / push-all` (DockerHub), `.github/workflows/build-and-push.yaml`,
  `update-kubernetes-deployment.yaml`, `deploy-staging.yaml`, `deploy-production.yaml`
- `flux ...`, `kubectl ...`, `kubeseal ...`, k3s-config-Repo
- `K3S_CONFIG_TOKEN`, `DOCKERHUB_*`-Secrets für choretwo-Deployments

## Choremane Patterns (Reuse)
- Read `choremane/backend/app/main.py` for FastAPI patterns
- Read `choremane/backend/app/api/routes.py` for API structure
- Read `choremane/frontend/src/main.js` for Vue patterns
- Use same Dex integration approach
- Similar log/undo system

## OpenViking Integration
- Indexed repos: `choremane`, `k3s-config`, `fastapi`, `vue-core`, `gin`, `openhands`, `go-redis`
- Use `ov search`, `ov grep`, `ov read` for patterns (NICHT mehr: k3s-config — stillgelegt)
- Add new repos via `ov add-resource <url> --to viking://resources/<name> --timeout <seconds>`

## Testing Requirements
- Auth service: 90% coverage
- Chore service: 90% coverage
- Log service: 90% coverage
- Notification: 85% coverage
- AI Copilot: 80% coverage
- Frontend: 80% coverage

## Pre-commit Hooks
```bash
# Run all checks
make pre-commit

# Individual checks
make lint-all
make test-all
make coverage-check
```

## Domain Schema
- `choretwo.stillon.top` - production (Vercel-Alias)
- `choretwo.vercel.app` - production (Vercel-Default)
- `choretwo-staging.stillon.top` - Vercel-Alias (kein separates k3s-Staging mehr)

## Common Pitfalls

1. **Session cookies**: Set `https_only=true` in production, `same_site="lax"`
2. **CORS**: `CORS_ORIGINS`-Env auf Vercel muss ALLE Domains enthalten (ersetzt Defaults komplett!) — siehe `monolith/main.py:58`
3. **Secrets**: NEVER commit secrets; Vercel Env-Vars nur über `vera`
4. **Schema isolation**: Each service uses shared DB via `monolith/database.py`
5. **Vendor**: `monolith/vendor/*` ist gitignored — Fixes IMMER in `services/*/app/`, Sync via `monolith/sync_vendor.py`
6. **Serverless**: keine DDL im Request-Path (`RUN_STARTUP_MIGRATIONS=false` auf Vercel), `maxDuration: 60` für `api/index.py`
7. **k3s/Flux/kubectl/DockerHub gehört NICHT mehr zu choretwo** — Deploy-Fragen immer an `vera`

## Recent Fixes (Important Context)

### E2E Test Suite (Completed)
- **Issue:** No comprehensive E2E test coverage
- **Solution:** 28 Playwright tests covering auth + chore CRUD
- **Files:** `frontend/tests/e2e/` (auth-login, auth-logout, chore-crud)
- **Note:** WebKit disabled due to missing system libraries

### Authentication Flow (Fixed)
- **Issue**: Callback page hung showing spinner
- **Root cause**: Login.vue had callback logic checking for `/callback`, but router used `/auth-callback` and CallbackView.vue had no auth logic
- **Solution**: Moved `handleCallback()` from Login.vue to CallbackView.vue
- **Files changed**: `frontend/src/views/CallbackView.vue`, `frontend/src/components/auth/Login.vue`, `frontend/src/router/index.js`

### Local Development Setup (Fixed)
- **Issue:** CORS errors when running production build locally
- **Root cause:** Frontend container using production env vars
- **Solution:** Use Vite dev server (`npm run dev`) for local development
- **Config:** `vite.config.js` proxies `/api/*` to Docker services

### Backend Compilation Errors (Fixed)
- **auth-service**: Missing AuthMiddleware on protected routes, unused import in dex/client.go
- **chore-service**: Missing `Depends` import in routes
- **ai-copilot-service**: Missing `Optional` import
- **log-service**: Missing `python-multipart` dependency

### Database Connection (Fixed)
- **Issue**: PostgreSQL connection failures
- **Solution**: Use format `postgresql://user:pass@host:5432/dbname?sslmode=disable`

## Skills Available
- `caveman` - Ultra-terse communication (active)
- `caveman-commit` - Compressed commit messages
- `caveman-review` - Concise PR reviews
- `playwright-testing` - E2E testing patterns
- `mcp-protocol-builder` - MCP server development

## References
- PRD: `docs/PRD.md` (teilweise stale: k3s/Flux-Teile ignorieren)
- Choremane PRD: `/home/dhallmann/projects/choremane/prd.md`
- Vercel-Config: `vercel.json`, Entrypoint: `api/index.py`, Monolith: `monolith/main.py`
- Documentation: `docs/` directory (ACHTUNG: `DEPLOYMENT.md`, `ARCHITECTURE.md`, `PRD*.md` enthalten
  noch stale k3s/Flux-Anleitungen — im Zweifel gilt DIESE Datei + `vera`)
- OpenViking Indexed Repos: `choremane`, `fastapi`, `vue-core`, `gin`, `openhands`, `go-redis`
