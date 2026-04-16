# choretwo - Agent Instructions

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
make build-all          # Build all images
make build-auth         # Single service
make push-all           # Push to DockerHub
```

### Deploy Flow
1. Push to main → GitHub Actions builds
2. Flux reconciles (5min) → staging
3. E2E tests on staging
4. Manual approval
5. Deploy production (tag-based)

### Flux Commands
```bash
# Check status
flux get kustomizations -n flux-system

# Force reconcile
flux reconcile kustomization choretwo-staging -n flux-system

# Trace issues
flux trace kustomization choretwo-staging -n flux-system
```

## Kustomize Structure
```
k3s-config/kustomize/choretwo/
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

## Skills Available
- `caveman` - Ultra-terse communication (active)
- `caveman-commit` - Compressed commit messages
- `caveman-review` - Concise PR reviews
- `playwright-testing` - E2E testing patterns
- `mcp-protocol-builder` - MCP server development

## References
- PRD: `docs/PRD_base.md`
- Choremane PRD: `/home/dhallmann/projects/choremane/prd.md`
- K3s docs: `/home/dhallmann/projects/k3s-config/docs/`
- Workflow: `/home/dhallmann/projects/k3s-config/docs/concepts/workflow.md`
