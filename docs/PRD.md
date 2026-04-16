choretwo - Product Requirements Document (PRD)
Executive Summary
choretwo is a microservices-based chore management platform building on choremane's foundation. It decomposes the monolith into 5 specialized services with proper separation of concerns, while maintaining choremane's core features: Material You PWA, Dex-based auth, undo-capable log system, and AI copilot integration.
Infrastructure Reality
What Exists:
- FluxCD (not ArgoCD) - 5-min reconciliation
- nginx-ingress with path-based routing
- cert-manager + letsencrypt-prod
- Dex OIDC provider (Google/GitHub auth)
- SealedSecrets operator
- OpenWebUI + Ollama (AI infrastructure)
- Single K3s cluster
Domain Schema:
- choretwo.stillon.top - production
- choretwo-staging.stillon.top - staging
Architecture
┌────────────────────────────────────────────────────────────┐
│                    nginx-ingress                            │
│          (path-based routing, TLS termination)             │
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
│  (Go)  │  │(Python)│  │(Python)│  │ (Node) │  │ (Python) │  └────────┘
└────────┘  └────────┘  └────────┘  └────────┘  └──────────┘
    │           │           │           │            │
    └───────────┴───────────┴───────────┴────────────┘
                        │
            ┌───────────┴───────────┐
            │                       │
            ▼                       ▼
    ┌─────────────────┐     ┌─────────────────┐
    │    Postgres     │     │     Redis       │
    │  (4 schemas)    │     │  (cache+queue)  │
    └─────────────────┘     └─────────────────┘
Service Specifications
1. Auth Service (Go/Gin)
Responsibilities:
- JWT token issuance/verification
- Dex OIDC integration (reuse choremane pattern)
- User session management with secure cookies
- Rate limiting per user
Tech Stack:
- Go 1.21+
- Gin framework
- JWT: github.com/golang-jwt/jwt/v5
- Dex client integration
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
4. Notification Service (Node.js/Express)
Responsibilities:
- Push notification scheduling
- Browser notification delivery
- User preference management
- Gotify integration (optional)
Tech Stack:
- TypeScript 5.x
- Node.js 20 LTS
- Express or Fastify
- Bull (Redis-based queue)
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
Single Postgres, 4 schemas:
-- Schema creation (init script)
CREATE SCHEMA auth;
CREATE SCHEMA chores;
CREATE SCHEMA logs;
CREATE SCHEMA notifications;
Connection Pattern:
DATABASE_URL=postgres://user:pass@host:5432/choretwo?schema=chores
Each service connects only to its schema for isolation.
Migration Strategy:
- Per-schema migrations
- Migration jobs in K8s (initContainers or Jobs)
- Version tracking per schema
Kubernetes Deployment
Flux Integration Pattern
# apps/choretwo-staging.yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: choretwo-staging
  namespace: flux-system
spec:
  targetNamespace: choretwo-staging
  interval: 5m
  path: ./kustomize/choretwo/overlays/staging
  prune: true
  sourceRef:
    kind: GitRepository
    name: flux-system
  wait: true
  timeout: 5m
  dependsOn:
    - name: dex
    - name: nginx-ingress
    - name: cert-manager
Ingress Configuration
# kustomize/choretwo/base/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: choretwo-ingress
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - choretwo.stillon.top
      secretName: choretwo-tls
  rules:
    - host: choretwo.stillon.top
      http:
        paths:
          - path: /api/auth
            pathType: Prefix
            backend:
              service:
                name: auth-service
                port:
                  number: 80
          - path: /api/chores
            pathType: Prefix
            backend:
              service:
                name: chore-service
                port:
                  number: 80
          # ... other services
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend
                port:
                  number: 80
Kustomize Structure
k3s-config/kustomize/choretwo/
├── base/
│   ├── auth-service/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   ├── hpa.yaml
│   │   └── kustomization.yaml
│   ├── chore-service/
│   ├── log-service/
│   ├── notification-service/
│   ├── ai-copilot-service/
│   ├── frontend/
│   ├── postgres/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   ├── pvc.yaml  # with finalizers
│   │   └── kustomization.yaml
│   ├── redis/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   ├── pvc.yaml  # with finalizers
│   │   └── kustomization.yaml
│   ├── ingress.yaml
│   └── kustomization.yaml
├── overlays/
│   ├── staging/
│   │   ├── kustomization.yaml
│   │   └── patches/
│   └── production/
│       ├── kustomization.yaml
│       └── patches/
└── namespaces/
    ├── choretwo-staging.yaml  # Created manually, NOT in kustomize
    └── choretwo-production.yaml
PVC Protection (Critical)
# ALWAYS include this finalizer
metadata:
  finalizers:
    - kubernetes.io/pvc-protection
SealedSecrets Pattern
# Create (temporary file, NEVER commit)
kubectl create secret generic choretwo-secrets \
  --from-literal=postgres-password='changeme' \
  --from-literal=jwt-secret='another-secret' \
  -n choretwo --dry-run=client -o yaml > secret.yaml
# Seal it
kubeseal --format yaml < secret.yaml > secret-sealed.yaml
# Add to kustomization.yaml, delete unsealed version
rm secret.yaml
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
  deploy-staging:
    needs: [build, security]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Update k3s-config
        run: |
          # Update image tags in overlays/staging
          # Commit and push to k3s-config repo
  deploy-production:
    needs: [deploy-staging]
    if: startsWith(github.ref, 'refs/tags/choretwo/prod/v')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy production
        run: |
          # Update k3s-config with production tags
          # Commit and push
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
# Deployment
deploy-staging: # Update k3s-config staging overlay
deploy-prod:    # Update k3s-config production overlay
# Utilities
clean:          # docker-compose down -v
reset-db:       # docker-compose down -v && docker-compose up -d
Common Pitfalls
1. Session cookies: https_only=true in production, same_site="lax"
2. CORS: allow_origins=["*"] with allow_credentials=True
3. Flux pruning: Never add namespace.yaml to kustomize (create manually)
4. PVC protection: Always add finalizers: [kubernetes.io/pvc-protection]
5. Secrets: NEVER commit unsealed secrets
6. Schema isolation: Always use DATABASE_URL?schema=<name>
7. Flux dependencies: Always add dependsOn: dex for auth-dependent services
8. Ingress rewrite: nginx-ingress requires rewrite-target annotation
Success Criteria
- All 5 microservices deployed and communicating
- Auth flow working with Dex (Google/GitHub)
- Chore CRUD with undo capability
- Notifications delivered per user preferences
- AI copilot handles natural language commands
- PWA installable and offline-capable
- Test coverage meets thresholds
- CI/CD pipeline fully automated
- Staging and production environments isolated
Non-Goals
- Multi-housing support (beyond multi-user chores)
- In-app user registration (OAuth providers only)
- Admin panels or manual DB editing
- Cross-cluster federation
- Real-time collaboration (future)
References
- Choremane PRD: /home/dhallmann/projects/choremane/prd.md
- K3s Workflow: /home/dhallmann/projects/k3s-config/docs/concepts/workflow.md
- Adding Apps Guide: /home/dhallmann/projects/k3s-config/docs/guides/adding-applications.md
- OpenViking Indexed Repos: choremane, k3s-config, fastapi, vue-core, gin, openhands, go-redis
---
END OF PRD
