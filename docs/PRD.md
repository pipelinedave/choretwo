choretwo - Product Requirements Document (PRD)
Executive Summary
choretwo is a chore management platform building on choremane's foundation: Material You PWA, Supabase magic-link auth (Go/Dex-legacy nur noch lokal), undo-capable log system, and AI copilot integration. Production runs as ONE Python-FastAPI monolith (vendored services) + static frontend on Vercel (Stand 28.09.2026).
Infrastructure Reality (verifiziert an Code, Stand 28.09.2026)
What Exists:
- Vercel-Projekt `choretwo`, productionBranch `main` — Push auf main deployt automatisch
- EIN Python-Monolith via `api/index.py` (`monolith/main.py`), Vendor generiert (`sync_vendor.py`)
- Supabase Auth (Magic-Link) + Postgres; Cron `/api/notify/run-due` 07:00 täglich
- Lokal: Docker-Compose + Vite (Dev only)
Domain Schema:
- choretwo.stillon.top - production (Vercel)
- choretwo.vercel.app - production (Vercel-Default)
(Staging-Umgebung `choretwo-staging.stillon.top` stillgelegt 09/2026.)
Architecture (Prod: Vercel — statisches Frontend + EIN Python-Monolith)
┌────────────────────────────────────────────────────────────┐
│              Vercel (rewrites + TLS)                        │
│   /health + /api/* → Monolith, Rest → SPA (index.html)     │
└────────────────┬───────────────────────────────────────────┘
                 │
    ┌────────────┼───────────┬───────────┬──────────┬─────────┐
    ▼            ▼           ▼           ▼          ▼         ▼
┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌──────┐
│ /auth  │  │/chores │  │ /logs  │  │/notify │  │  /ai   │  │  /   │
└───┬────┘  └───┬────┘  └───┬────┘  └───┬────┘  └────┬───┘  └──┬───┘
    ▼           ▼           ▼           ▼            ▼         ▼
┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌──────────┐  ┌────────┐
│  Auth  │  │ Chore  │  │  Log   │  │Notify  │  │ AI Copilot│  │Frontend│
│Service │  │Service │  │Service │  │Service │  │ Service  │  │ (Vue3) │
│  (Go, legacy) │  │(Python)│  │(Python)│  │(Python) │  │ (Python) │  └────────┘
(Prod: alle vier Python-Services laufen vendored in EINEM Monolith auf Vercel;
Go-auth/Dex nur noch lokaler Mock-Login. Ursprungs-Diagramm unten historisch.)
└────────┘  └────────┘  └────────┘  └────────┘  └──────────┘
    │           │           │           │            │
    └───────────┴───────────┴───────────┴────────────┘
                        │
            ┌───────────┴───────────┐
            │                       │
            ▼                       ▼
    ┌─────────────────┐     ┌─────────────────┐
    │    Postgres     │     │     Redis       │
    │ (3 schemas)     │     │ Vercel-Cron+DB   │
    └─────────────────┘     └─────────────────┘
Service Specifications
1. Auth Service (Go/Gin)
Responsibilities:
- JWT token issuance/verification
- Supabase magic-link auth in prod; Go/Dex-legacy nur noch lokaler Mock-Login (reuse choremane pattern)
- User session management with secure cookies
- Rate limiting per user
Tech Stack:
- Go 1.21+
- Gin framework
- JWT: github.com/golang-jwt/jwt/v5
- Supabase/JWKS-Verifikation im Monolith (`monolith/auth.py`)
API Endpoints:
- GET /api/auth/login - Initiate OAuth flow
- GET /api/auth/callback - OAuth callback
- GET /api/auth/user - Current user info
- POST /api/auth/refresh - Token refresh
Key Patterns (from choremane):
- SessionMiddleware with https_only=true in prod
- same_site="lax" for cookie security
- X-User-Email header for user identification
- Fallback USE_MOCK_AUTH=true for dev
2. Chore Service (Python/FastAPI)
Responsibilities:
- Chore CRUD operations
- Recurrence interval logic
- Chore assignment to users
- Due date calculation
- Import/export functionality
Tech Stack:
- Python 3.12
- FastAPI
- SQLAlchemy 2.0+
- Schema: chores
API Endpoints:
- GET /api/chores - List chores (paginated)
- POST /api/chores - Create chore
- PUT /api/chores/{id} - Update chore
- PUT /api/chores/{id}/done - Mark complete
- PUT /api/chores/{id}/archive - Archive
- GET /api/chores/archived - Archived list
- GET /api/chores/count - Stats by category
- GET /api/export - Export data
- POST /api/import - Import data
Database Schema:
CREATE TABLE chores (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    interval_days INT NOT NULL,
    due_date DATE NOT NULL,
    done BOOLEAN DEFAULT FALSE,
    done_by VARCHAR(255),
    last_done DATE,
    owner_email VARCHAR(255),  -- NULL for shared
    is_private BOOLEAN DEFAULT FALSE,
    archived BOOLEAN DEFAULT FALSE
);
3. Log Service (Python/FastAPI)
Responsibilities:
- Action audit trail
- State reconstruction for undo
- Log retention policy
- User-visible log history
Tech Stack:
- Python 3.12
- FastAPI
- SQLAlchemy 2.0+
- Schema: logs
API Endpoints:
- GET /api/logs - Get all logs (user-filtered)
- POST /api/logs - Create log entry
- GET /api/logs/{id} - Get specific log
- POST /api/undo - Undo action by log_id
Database Schema:
CREATE TABLE chore_logs (
    id SERIAL PRIMARY KEY,
    chore_id INT,  -- NULL for system actions
    done_by VARCHAR(255),
    done_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    action_type VARCHAR(50) NOT NULL,  -- created/updated/marked_done/archived/undo
    action_details JSONB  -- Full state for reconstruction
);
Undo Logic (from choremane):
- created → Set archived = TRUE
- updated → Restore previous_state
- marked_done → Reset done=false, restore due_date
- archived → Set archived = FALSE
4. Notification Service (Python/FastAPI — früher Node-Plan, umgesetzt in Python)
Responsibilities:
- Push notification scheduling (Vercel-Cron `/api/notify/run-due`, `CRON_SECRET`)
- Browser notification delivery
- User preference management
- Gotify integration (optional)
Tech Stack:
- Python 3.12
- FastAPI
- Schema: notifications
API Endpoints:
- GET /api/notify/preferences - User notification settings
- PUT /api/notify/preferences - Update settings
- POST /api/notify/test - Send test notification
- GET /api/notify/scheduled - List scheduled notifications
Database Schema:
CREATE TABLE notification_preferences (
    user_email VARCHAR(255) PRIMARY KEY,
    enabled BOOLEAN DEFAULT TRUE,
    notify_times JSONB,  -- ["09:00", "18:00"]
    notify_overdue BOOLEAN DEFAULT TRUE,
    notify_soon BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE scheduled_notifications (
    id SERIAL PRIMARY KEY,
    user_email VARCHAR(255),
    chore_id INT,
    scheduled_for TIMESTAMP,
    sent_at TIMESTAMP,
    notification_type VARCHAR(50),  -- overdue/soon/due
    processed BOOLEAN DEFAULT FALSE
);
5. AI Copilot Service (Python/FastAPI)
Responsibilities:
- Natural language parsing
- Chore suggestions based on patterns
- Behavior learning
- OpenHands agent orchestration
Tech Stack:
- Python 3.12
- FastAPI
- Ollama (existing deployment)
- OpenHands SDK (from indexed repo)
- Schema: ai (optional, for preferences)
API Endpoints:
- POST /api/ai/chat - Natural language commands
- GET /api/ai/suggestions - Smart chore suggestions
- POST /api/ai/analyze - Analyze chore patterns
- GET /api/ai/status - Service health
NLP Commands (examples):
- "Mark dishes done" → PUT /api/chores/{id}/done
- "Add laundry every 3 days" → POST /api/chores
- "Push trash to next week" → PUT /api/chores/{id} with new due_date
6. Frontend (Vue 3)
Responsibilities:
- Material You PWA
- Service worker caching
- Offline-first UX
- Real-time sync
Tech Stack:
- Vue 3 Composition API
- Pinia (state management)
- Vite
- Hammer.js (gestures)
- Service Workers
- CSS variables for theming
Key Features (from choremane):
- Swipe gestures (done/edit/delete)
- Log overlay with undo capability
- Material Design pills for filtering
- Dark/light mode sync
- PWA installable
Database Design
Single Postgres, 3 schemas (chores/logs/notifications):
-- Schema creation (init script)
CREATE SCHEMA chores;
CREATE SCHEMA logs;
CREATE SCHEMA notifications;
Connection Pattern:
DATABASE_URL=postgres://user:pass@host:5432/choretwo?schema=chores
Each service connects only to its schema for isolation.
Migration Strategy:
- Per-schema DDL in `monolith/database.py` (Single Source of Truth)
- Lokal automatisch; Prod `RUN_STARTUP_MIGRATIONS=false` (keine DDL im Serverless-Cold-Start)
Vercel Deployment
- Push auf `main` → Vercel baut (`frontend`-Build + `sync_vendor.py`) und deployt Production
- Rewrites: `/health` + `/api/*` → Monolith, Rest → SPA; Cron `/api/notify/run-due` 07:00
- Env-Vars ausschließlich auf Vercel, verwaltet via `vera` (Agent)
CI/CD Pipeline
GitHub Actions Workflow
# .github/workflows/ci.yml
name: CI Pipeline
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
jobs:
  lint:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: [auth, chore, log, notification, ai-copilot, frontend]
    steps:
      - uses: actions/checkout@v4
      - run: make lint-${{ matrix.service }}
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: [auth, chore, log, notification, ai-copilot, frontend]
    steps:
      - uses: actions/checkout@v4
      - run: make test-${{ matrix.service }}
      - uses: codecov/codecov-action@v4
  build:
    needs: [lint, test]
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: [auth, chore, log, notification, ai-copilot, frontend]
    steps:
      - uses: actions/checkout@v4
      - run: make build-${{ matrix.service }}
      - run: make push-${{ matrix.service }}
  security:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          format: 'sarif'
          output: 'trivy-results.sarif'
  deploy-production: # ENTFALLEN — Vercel auto-deployt Push auf main
    needs: [build, security]
    if: false # stillgelegt 09/2026
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy production
        run: |
          # Vercel Git-Integration deployt automatisch — kein Workflow nötig
Pre-commit Hooks
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: lint-all
        name: Lint all services
        entry: make lint-all
        language: system
        pass_filenames: false
      
      - id: test-all
        name: Run all tests
        entry: make test-all
        language: system
        pass_filenames: false
      
      - id: coverage-check
        name: Check test coverage
        entry: make coverage-check
        language: system
        pass_filenames: false
Testing Requirements
Coverage Thresholds
Service
Auth service
Chore service
Log service
Notification service
AI Copilot service
Frontend
Test Strategy
- Unit tests - Per-service, fast feedback
- Integration tests - Service-to-service communication
- E2E tests - Full user flows (Playwright/Cypress)
- Load tests - Under simulated load
E2E Test Scenarios
1. User authentication flow
2. Create chore via UI
3. Mark chore done (swipe gesture)
4. Undo action via log overlay
5. Import/export data
6. Notification delivery
7. AI copilot natural language commands
8. Offline mode recovery
Development Environment
Docker Compose
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: choretwo
      POSTGRES_USER: choretwo
      POSTGRES_PASSWORD: choretwo_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
  auth-service:
    build: ./services/auth-service
    ports:
      - "8001:8000"
    environment:
      - DATABASE_URL=postgres://choretwo:choretwo_dev@postgres:5432/choretwo?schema=auth
      - REDIS_URL=redis://redis:6379
      - USE_MOCK_AUTH=true
    depends_on:
      - postgres
      - redis
  chore-service:
    build: ./services/chore-service
    ports:
      - "8002:8000"
    environment:
      - DATABASE_URL=postgres://choretwo:choretwo_dev@postgres:5432/choretwo?schema=chores
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
  # ... other services
  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on:
      - auth-service
      - chore-service
      - log-service
      - notification-service
      - ai-copilot-service
volumes:
  postgres_data:
Makefile Commands
# Development
dev:            # docker-compose up (all services)
dev-auth:       # docker-compose up auth-service
dev-chore:      # docker-compose up chore-service
dev-stop:       # docker-compose down
# Testing
test:           # make test-all
test-auth:      # pytest services/auth-service/tests
test-chore:     # pytest services/chore-service/tests
test-e2e:       # playwright test
test-coverage:  # pytest --cov
# Linting
lint:           # make lint-all
lint-auth:      # golangci-lint run
lint-chore:     # ruff check
lint-frontend:  # npm run lint
# Building
build:          # make build-all
build-auth:     # docker build -t auth-service ./services/auth-service
build-all:      # Build all images
# Deployment — ENTFALLEN (heute Vercel-Auto-Deploy, kein Make-Target nötig)
deploy-staging: # GELÖSCHT (war: Cluster-Staging-Overlay)
deploy-prod:    # GELÖSCHT (war: Cluster-Production-Overlay)
# Utilities
clean:          # docker-compose down -v
reset-db:       # docker-compose down -v && docker-compose up -d
Common Pitfalls
1. Session cookies: https_only=true in production, same_site="lax"
2. CORS: `CORS_ORIGINS`-Env auf Vercel ersetzt Defaults KOMPLETT (nie `*` mit Credentials)
3. Altes Cluster-Setup: STILLGELEGT (09/2026) — keine Manifeste/Overlays mehr anfassen
4. (Volume-Schutzregeln des alten Clusters entfallen mit Vercel)
5. Secrets: NIE ins Repo — nur Vercel-Env via `vera`
6. Schema isolation: Single Postgres, `chores`/`logs`/`notifications` (siehe `monolith/database.py`)
7. (Dex-Abhängigkeiten entfallen — Auth = Supabase, Go-legacy nur lokal)
8. (altes Ingress-Routing entfällt — Routing = `vercel.json` rewrites)
Success Criteria
- All 4 Python services vendored in ONE monolith, deployed on Vercel
- Auth flow working with Supabase magic-link (Go/Dex-legacy nur lokal)
- Chore CRUD with undo capability
- Notifications via Vercel-Cron per user preferences
- AI copilot handles natural language commands (Synthetic/GLM, Regex-Fallback ohne Key)
- PWA installable and offline-capable
- Test coverage meets thresholds
- CI pipeline automated (Vercel auto-deploys main)
- Production health: `/health` → `{"status":"ok","service":"choretwo-monolith"}`
Non-Goals
- Multi-housing support (beyond multi-user chores)
- In-app user registration (OAuth providers only)
- Admin panels or manual DB editing
- Cross-cluster federation
- Real-time collaboration (future)
Implementation Status

✅ Completed
- All 6 services implemented and running
- Authentication flow with mock auth working
- E2E tests created (9 Playwright tests)
- PWA assets generated (192, 512, apple-touch, favicon)
- Docker Compose configured for local development
- Frontend authentication UI complete
- Basic CRUD for chores implemented

⬜ In Progress
- Go/Dex-Prod-Pfad entfernen oder offiziell als tot markieren (legacy nur lokal)
- Notification/Cron-Härtung (Prod-Beobachtung)
- AI copilot Tuning
- Full E2E test suite

⬜ Planned
- Real-time sync with WebSockets
- Advanced AI suggestions
- Gotify integration
- Multi-user chore assignment UI

References
- Choremane PRD: /home/dhallmann/projects/choremane/prd.md
- OpenViking Indexed Repos: choremane, fastapi, vue-core, gin, openhands, go-redis
  (Cluster-Config-Repo entkoppelt — altes Setup stillgelegt 09/2026)
- Documentation: docs/ (GETTING_STARTED.md, ARCHITECTURE.md, DEVELOPMENT.md, API.md, TESTING.md, DEPLOYMENT.md, TROUBLESHOOTING.md)
---
END OF PRD
