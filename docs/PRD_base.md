choretwo - Complete Architecture Plan
Infrastructure Reality
You use Flux (not ArgoCD):
- flux-system/ directory with gotk-components.yaml
- apps/ directory with Flux Kustomizations
- kustomize manifests in kustomize/
- SealedSecrets for secrets
- 5-minute reconciliation interval
- dependsOn: dex for choremane
Existing infrastructure to integrate with:
- nginx-ingress (already deployed via Flux)
- cert-manager with letsencrypt-prod issuer
- dex (oidc provider) with choremane client
- open-webui + ollama (AI infrastructure)
- sealed-secrets operator
- flux (gitops controller)
choretwo Architecture (Final Decisions)
┌────────────────────────────────────────────────────────────┐
│                    nginx-ingress                            │
│          (path-based routing, TLS termination)             │
└────────────────┬───────────────────────────────────────────┘
                 │
    ┌────────────┼───────────┬───────────┬──────────┐
    ▼            ▼           ▼           ▼          ▼
┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌──────────┐
│  /auth │  │/chores │  │ /logs  │  │/notify │  │   /ai    │
└───┬────┘  └───┬────┘  └───┬────┘  └───┬────┘  └────┬─────┘
    ▼           ▼           ▼           ▼            ▼
┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌──────────┐
│  Auth  │  │ Chore  │  │  Log   │  │Notify  │  │ AI Copilot│
│ Service│  │ Service│  │ Service│  │Service │  │ Service   │
│  (Go)  │  │(Python)│  │(Python)│  │ (Node) │  │  (Python) │
└────────┘  └────────┘  └────────┘  └────────┘  └──────────┘
    │           │           │           │            │
    └───────────┴─────┬─────┴───────────┴────────────┘
                      ▼
            ┌─────────────────┐
            │     Redis       │  (cache + message queue)
            └────────┬────────┘
                     │
                     ▼
            ┌─────────────────┐
            │    Postgres     │  (single instance, 4 schemas)
            │  - auth         │
            │  - chores       │
            │  - logs         │
            │  - notifications│
            └─────────────────┘
Service Specifications
1. Auth Service (Go)
Responsibilities:
- JWT token issuance/verification
- Dex OIDC integration
- User session management
- Rate limiting per user
Tech Stack:
- Language: Go 1.21+
- Framework: Gin or Echo
- JWT: github.com/golang-jwt/jwt
- Dex client: github.com/dexidp/dex/connector/oidc
K8s Resources:
# kustomize/choretwo/base/auth-service/
├── deployment.yaml    (2 replicas for HA)
├── service.yaml       (ClusterIP)
├── hpa.yaml          (autoscale 2-10 replicas)
└── configmap.yaml    (dex issuer URL, client ID)
2. Chore Service (Python/FastAPI)
Responsibilities:
- Chore CRUD operations
- Recurrence logic
- Chore assignment
- Due date calculation
Tech Stack:
- Language: Python 3.12
- Framework: FastAPI
- ORM: SQLAlchemy 2.0+
- Schema: chores
K8s Resources:
# kustomize/choretwo/base/chore-service/
├── deployment.yaml    (1 replica)
├── service.yaml       (ClusterIP)
├── hpa.yaml          (autoscale 1-5 replicas)
└── configmap.yaml    (DB schema name, redis URL)
3. Log Service (Python/FastAPI)
Responsibilities:
- Action audit trail
- State reconstruction
- Undo/rollback support
- Log retention policy
Tech Stack:
- Language: Python 3.12
- Framework: FastAPI
- ORM: SQLAlchemy 2.0+
- Schema: logs
K8s Resources:
# kustomize/choretwo/base/log-service/
├── deployment.yaml    (1 replica)
├── service.yaml       (ClusterIP)
└── configmap.yaml    (DB schema name, retention days)
4. Notification Service (Node.js)
Responsibilities:
- Push notification scheduling
- Browser notification delivery
- User preference management
- Gotify integration (optional)
Tech Stack:
- Language: TypeScript 5.x
- Runtime: Node.js 20 LTS
- Framework: Express or Fastify
- Queue: Bull (Redis-based)
- Schema: notifications
K8s Resources:
# kustomize/choretwo/base/notification-service/
├── deployment.yaml    (1 replica)
├── service.yaml       (ClusterIP)
├── cronjob.yaml      (notification scheduler)
└── configmap.yaml    (gotify URL, redis URL)
5. AI Copilot Service (Python)
Responsibilities:
- Natural language parsing
- Chore suggestions
- Behavior learning
- OpenHands agent orchestration
Tech Stack:
- Language: Python 3.12
- Framework: FastAPI
- LLM: Ollama (your existing deployment)
- Agent: OpenHands SDK
- Schema: ai (optional, for preferences)
K8s Resources:
# kustomize/choretwo/base/ai-copilot-service/
├── deployment.yaml    (1 replica)
├── service.yaml       (ClusterIP)
└── configmap.yaml    (ollama URL, open-webui URL)
6. Redis
Responsibilities:
- Caching (sessions, chore data)
- Message queue (notifications)
- Rate limiting
K8s Resources:
# kustomize/choretwo/base/redis/
├── deployment.yaml    (1 replica, persistent)
├── service.yaml       (ClusterIP)
└── pvc.yaml          (5GB storage)
7. PostgreSQL
Responsibilities:
- Single database with 4 schemas
- Migrations per schema
- Backup/restore
K8s Resources:
# kustomize/choretwo/base/postgres/
├── deployment.yaml    (1 replica, persistent)
├── service.yaml       (ClusterIP)
├── pvc.yaml          (10GB storage)
├── configmap.yaml    (init scripts)
└── job.yaml          (schema migrations)
Repository Structure
choretwo/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml              # Main CI pipeline
│   │   ├── e2e.yml             # E2E tests on staging
│   │   └── security.yml        # Trivy scans
│   ├── pull_request_template.md
│   └── todo/
├── .devcontainer/              # VS Code dev container
├── .pre-commit-config.yaml     # Pre-commit hooks
├── docker-compose.yml          # Local development
├── Makefile                    # Development commands
├── README.md
├── docs/
│   ├── architecture.md
│   ├── api.md
│   ├── testing.md
│   └── deployment.md
├── services/
│   ├── auth-service/
│   │   ├── cmd/
│   │   ├── internal/
│   │   ├── pkg/
│   │   ├── tests/
│   │   ├── go.mod
│   │   ├── go.sum
│   │   ├── Dockerfile
│   │   └── README.md
│   ├── chore-service/
│   │   ├── app/
│   │   ├── tests/
│   │   ├── requirements.txt
│   │   ├── Dockerfile
│   │   └── README.md
│   ├── log-service/
│   │   ├── app/
│   │   ├── tests/
│   │   ├── requirements.txt
│   │   ├── Dockerfile
│   │   └── README.md
│   ├── notification-service/
│   │   ├── src/
│   │   ├── tests/
│   │   ├── package.json
│   │   ├── Dockerfile
│   │   └── README.md
│   └── ai-copilot-service/
│       ├── app/
│       ├── tests/
│       ├── requirements.txt
│       ├── Dockerfile
│       └── README.md
├── frontend/
│   ├── src/
│   ├── tests/
│   ├── cypress/
│   ├── e2e/
│   ├── package.json
│   ├── Dockerfile
│   └── README.md
└── k3s-config/
    └── kustomize/choretwo/
        ├── base/
        │   ├── api-gateway/
        │   │   ├── ingress.yaml
        │   │   └── kustomization.yaml
        │   ├── auth-service/
        │   │   ├── deployment.yaml
        │   │   ├── service.yaml
        │   │   ├── hpa.yaml
        │   │   └── kustomization.yaml
        │   ├── chore-service/
        │   ├── log-service/
        │   ├── notification-service/
        │   ├── ai-copilot-service/
        │   ├── redis/
        │   ├── postgres/
        │   └── kustomization.yaml
        ├── overlays/
        │   ├── staging/
        │   │   ├── kustomization.yaml
        │   │   ├── patches/
        │   │   └── version-configmap.yaml
        │   └── production/
        │       ├── kustomization.yaml
        │       ├── patches/
        │       └── version-configmap.yaml
        └── namespaces/
            ├── choretwo-staging.yaml
            └── choretwo-prod.yaml
CI/CD Pipeline (GitHub Actions + Flux)
Pipeline Flow
git push
    ↓
pre-commit hooks
    ├── lint (ruff, eslint, golangci-lint)
    ├── typecheck (mypy, tsc)
    └── test (pytest, jest, go test)
    ↓
GitHub Actions
    ├── 1. Build all images
    ├── 2. Run unit tests (parallel)
    ├── 3. Run integration tests
    ├── 4. Run e2e tests
    ├── 5. Security scan (trivy)
    ├── 6. Build and push to DockerHub
    └── 7. Update k3s-config image tags
    ↓
Flux reconciliation (5 min interval)
    ↓
Deploy to staging namespace
    ↓
E2E validation on staging
    ↓
Manual approval (GitHub)
    ↓
Deploy to production (tag-based)
CI Workflow (ci.yml)
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
      - name: Lint ${{ matrix.service }}
        run: make lint-${{ matrix.service }}
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: [auth, chore, log, notification, ai-copilot, frontend]
    steps:
      - uses: actions/checkout@v4
      - name: Test ${{ matrix.service }}
        run: make test-${{ matrix.service }}
      - name: Coverage upload
        uses: codecov/codecov-action@v4
  build:
    needs: [lint, test]
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: [auth, chore, log, notification, ai-copilot, frontend]
    steps:
      - uses: actions/checkout@v4
      - name: Build ${{ matrix.service }}
        run: make build-${{ matrix.service }}
      - name: Push to DockerHub
        run: make push-${{ matrix.service }}
  security:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Trivy scan
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          format: 'sarif'
          output: 'trivy-results.sarif'
      - name: Upload Trivy results
        uses: github/codeql-action/upload-sarif@v2
  deploy-staging:
    needs: [build, security]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Update k3s-config
        run: |
          git clone https://github.com/pipelinedave/k3s-config.git
          cd k3s-config
          # Update image tags in overlays/staging
          # Commit and push
      - name: Wait for Flux reconciliation
        run: |
          # Poll flux get kustomizations until success
TDD Enforcement
Pre-commit hooks (.pre-commit-config.yaml):
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
Coverage thresholds:
- Auth service: 90%
- Chore service: 90%
- Log service: 90%
- Notification service: 85%
- AI Copilot service: 80%
- Frontend: 80%
Kubernetes Manifest Structure
Base Kustomization
# kustomize/choretwo/base/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: choretwo
resources:
  - api-gateway/
  - auth-service/
  - chore-service/
  - log-service/
  - notification-service/
  - ai-copilot-service/
  - redis/
  - postgres/
commonLabels:
  app.kubernetes.io/part-of: choretwo
  app.kubernetes.io/managed-by: flux
Staging Overlay
# kustomize/choretwo/overlays/staging/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: choretwo-staging
resources:
  - ../../base/
  - version-configmap.yaml
patches:
  - target:
      kind: Deployment
      name: auth-service
    patch: |-
      - op: replace
        path: /spec/replicas
        value: 1  # Scale down for staging
  
  - target:
      kind: Deployment
      name: postgres
    patch: |-
      - op: replace
        path: /spec/template/spec/containers/0/env
        value:
          - name: POSTGRES_DB
            value: choretwo_staging
images:
  - name: pipelinedave/choretwo-auth-service
    newTag: staging-${{ github.sha }}
  - name: pipelinedave/choretwo-chore-service
    newTag: staging-${{ github.sha }}
  # ... etc for all services
Production Overlay
# kustomize/choretwo/overlays/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: choretwo-production
resources:
  - ../../base/
  - version-configmap.yaml
patches:
  - target:
      kind: Deployment
      name: auth-service
    patch: |-
      - op: replace
        path: /spec/replicas
        value: 3  # Full HA for production
  
  - target:
      kind: Deployment
      name: chore-service
    patch: |-
      - op: replace
        path: /spec/replicas
        value: 2
images:
  - name: pipelinedave/choretwo-auth-service
    newTag: prod-${{ github.ref_name }}
  # ... etc for all services
Flux Integration
Flux Kustomization for choretwo
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
---
# apps/choretwo-production.yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: choretwo-production
  namespace: flux-system
spec:
  targetNamespace: choretwo-production
  interval: 5m
  path: ./kustomize/choretwo/overlays/production
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
Network Policies
Self-contained namespace:
# All services only communicate within choretwo namespace
# External access only via ingress
# No cross-namespace communication needed
API Gateway Configuration (nginx-ingress)
# kustomize/choretwo/base/api-gateway/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: choretwo-ingress
  namespace: choretwo
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/rate-limit: "100"
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - choretwo.stillon.top
        - choretwo-staging.stillon.top
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
          - path: /api/logs
            pathType: Prefix
            backend:
              service:
                name: log-service
                port:
                  number: 80
          - path: /api/notify
            pathType: Prefix
            backend:
              service:
                name: notification-service
                port:
                  number: 80
          - path: /api/ai
            pathType: Prefix
            backend:
              service:
                name: ai-copilot-service
                port:
                  number: 80
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend
                port:
                  number: 80
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
      - DATABASE_URL=postgres://choretwo:choretwo_dev@postgres:5432/choretwo
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
  chore-service:
    build: ./services/chore-service
    ports:
      - "8002:8000"
    environment:
      - DATABASE_URL=postgres://choretwo:choretwo_dev@postgres:5432/choretwo
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
  log-service:
    build: ./services/log-service
    ports:
      - "8003:8000"
    environment:
      - DATABASE_URL=postgres://choretwo:choretwo_dev@postgres:5432/choretwo
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
  notification-service:
    build: ./services/notification-service
    ports:
      - "8004:3000"
    environment:
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
  ai-copilot-service:
    build: ./services/ai-copilot-service
    ports:
      - "8005:8000"
    environment:
      - OLLAMA_URL=http://host.docker.internal:11434
    depends_on:
      - redis
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
dev:            # Start all services
dev-auth:       # Start auth service only
dev-chore:      # Start chore service only
dev-stop:       # Stop all services
# Testing
test:           # Run all tests
test-auth:      # Run auth service tests
test-chore:     # Run chore service tests
test-e2e:       # Run e2e tests
test-coverage:  # Run tests with coverage report
# Linting
lint:           # Lint all services
lint-auth:      # Lint auth service
lint-chore:     # Lint chore service
# Building
build:          # Build all images
build-auth:     # Build auth service image
build-all:      # Build all images without push
# Deployment
deploy-staging: # Deploy to staging
deploy-prod:    # Deploy to production
# Utilities
clean:          # Remove all containers and volumes
reset-db:       # Reset database
shell-auth:     # Shell into auth service container
Summary of Decisions
1. 5 microservices + frontend + infrastructure
2. Flux for GitOps (not ArgoCD)
3. Single Postgres with 4 schemas (pragmatic)
4. Redis for cache + queue
5. nginx-ingress for API routing
6. OpenHands + Ollama for AI (use existing infra)
7. Strict TDD with pre-commit enforcement
8. GitHub Actions for CI
9. Separate namespaces (choretwo-staging, choretwo-production)
10. Self-contained - no cross-namespace dependencies
Ready to write the complete PRD document.