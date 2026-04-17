# choretwo - Agent Instructions

## Current Status

✅ **All services running successfully** (as of latest session)
- Frontend authentication flow working with mock auth
- All 6 services operational: auth, chore, log, notification, ai-copilot, frontend
- E2E tests created (9 Playwright tests)
- PWA assets generated

## Architecture Overview

**Microservices:** 5 services + frontend
- `auth-service` (Go/Gin) - JWT, Dex OIDC, sessions
- `chore-service` (Python/FastAPI) - CRUD, recurrence
- `log-service` (Python/FastAPI) - audit trail, undo
- `notification-service` (Node/Express) - push scheduling
- `ai-copilot-service` (Python/FastAPI) - NLP, suggestions
- `frontend` (Vue 3) - PWA

**Infrastructure:**
- FluxCD (GitOps) - NOT ArgoCD
- nginx-ingress (path-based routing)
- cert-manager + letsencrypt-prod
- Dex (OIDC provider)
- SealedSecrets
- Single Postgres (4 schemas: auth, chores, logs, notifications)
- Redis (cache + queue)

## Key Patterns

### Flux Integration
```yaml
# apps/choretwo-staging.yaml - Flux Kustomization
dependsOn:
  - name: dex
  - name: nginx-ingress
  - name: cert-manager
interval: 5m  # reconciliation
```

### Ingress Pattern (nginx-ingress)
```yaml
annotations:
  cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  rules:
    - host: choretwo.stillon.top
      paths:
        - /api/auth → auth-service
        - /api/chores → chore-service
        - /api/logs → log-service
        - /api/notify → notification-service
        - /api/ai → ai-copilot-service
        - / → frontend
```

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

### Local Development (docker-compose)
```bash
# Start all services
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

## Build & Deploy

### Build Images
```bash
make build-all          # Build all service images
make build-auth         # Build single service image
make push-all           # Push all images to DockerHub
```

### Deploy Flow
1. Push to main → GitHub Actions builds and pushes images to DockerHub
2. GitHub Actions calls update-kubernetes-deployment workflow
3. Workflow updates k3s-config repo (pipelinedave/k3s-config) with new image tags
4. Flux reconciles from k3s-config repo (5min interval) → staging
5. E2E tests run automatically on staging
6. Manual approval required for production
7. Deploy production via tag push (v*)

### GitHub Secrets Required
```
DOCKERHUB_USERNAME=pipelinedave
DOCKERHUB_TOKEN=<DockerHub token>
K3S_CONFIG_TOKEN=<Personal Access Token with write access to k3s-config repo>
```

### Flux Commands
```bash
# Check Flux status (in k3s-config repo context)
flux get kustomizations -n flux-system

# Force reconcile (in k3s-config repo context)
flux reconcile kustomization choretwo-staging -n flux-system

# Trace issues
flux trace kustomization choretwo-staging -n flux-system
```

## Kustomize Structure (in k3s-config repo)
```
k3s-config/ (https://github.com/pipelinedave/k3s-config)
├── apps/
│   ├── choretwo-staging.yaml      # Flux Kustomization for staging
│   └── choretwo-production.yaml   # Flux Kustomization for production
└── kustomize/choretwo/
    ├── base/
    │   ├── auth-service/
    │   ├── chore-service/
    │   ├── log-service/
    │   ├── notification-service/
    │   ├── ai-copilot-service/
    │   ├── frontend/
    │   ├── postgres/
    │   ├── redis/
    │   └── kustomization.yaml
    ├── overlays/
    │   ├── staging/
    │   └── production/
    └── namespaces/
        ├── choretwo-staging.yaml
        └── choretwo-production.yaml
```

## SealedSecrets
```bash
# Create secret (temporary file)
kubectl create secret generic my-secret \
  --from-literal=password=changeme \
  -n choretwo --dry-run=client -o yaml > secret.yaml

# Seal it
kubeseal --format yaml < secret.yaml > secret-sealed.yaml

# Add to kustomization.yaml, delete unsealed version
```

## Choremane Patterns (Reuse)
- Read `choremane/backend/app/main.py` for FastAPI patterns
- Read `choremane/backend/app/api/routes.py` for API structure
- Read `choremane/frontend/src/main.js` for Vue patterns
- Use same Dex integration approach
- Similar log/undo system

## OpenViking Integration
- Indexed repos: `choremane`, `k3s-config`, `fastapi`, `vue-core`, `gin`, `openhands`, `go-redis`
- Use `ov search`, `ov grep`, `ov read` for patterns
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
All ingresses follow: `<app>.stillon.top`
- `choretwo.stillon.top` - production
- `choretwo-staging.stillon.top` - staging

## Common Pitfalls

1. **Session cookies**: Set `https_only=true` in production, `same_site="lax"`
2. **CORS**: Allow `allow_origins=["*"]` but `allow_credentials=True`
3. **Flux pruning**: Never add `namespace.yaml` to kustomize (create manually)
4. **PVC protection**: Add `finalizers: [kubernetes.io/pvc-protection]`
5. **Secrets**: NEVER commit unsealed secrets
6. **Schema isolation**: Each service uses `DATABASE_URL?schema=<name>`
7. **Flux dependencies**: Always add `dependsOn: dex` for auth-dependent services

## Recent Fixes (Important Context)

### Authentication Flow (Fixed)
- **Issue**: Callback page hung showing spinner
- **Root cause**: Login.vue had callback logic checking for `/callback`, but router used `/auth-callback` and CallbackView.vue had no auth logic
- **Solution**: Moved `handleCallback()` from Login.vue to CallbackView.vue
- **Files changed**: `frontend/src/views/CallbackView.vue`, `frontend/src/components/auth/Login.vue`, `frontend/src/router/index.js`

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
- PRD: `docs/PRD.md`
- Choremane PRD: `/home/dhallmann/projects/choremane/prd.md`
- K3s docs: `/home/dhallmann/projects/k3s-config/docs/`
- Workflow: `/home/dhallmann/projects/k3s-config/docs/concepts/workflow.md`
- Documentation: `docs/` directory (GETTING_STARTED.md, ARCHITECTURE.md, etc.)
