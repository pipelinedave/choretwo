# choretwo - Routing Table

How the Primary Model routes tasks to specialists.

## Primary Model Routing

When you receive a task, classify it by keywords and delegate to the appropriate specialist.

| TASK KEYWORDS | → DELEGATE TO |
|---------------|---------------|
| Vue, component, Pinia, Vite, PWA, Playwright, ChoreCard, FilterPills, swipe, Material Design, store, view, frontend, CSS | **choretwo-frontend** |
| Go, Gin, Dex, OIDC, JWT, session, auth middleware, token, User model, login, callback, refresh, logout | **choretwo-auth** |
| chore, log, ai-copilot, FastAPI, recurrence, chore_service, undo, NLP, intent, Pydantic, SQLAlchemy, cron | **choretwo-backend** |
| notification, Celery, push, Gotify, scheduler, preferences | **choretwo-notification** |
| test, tests, pytest, Vitest, Playwright, coverage, TDD, unit test, e2e, regression, mock fixture | **choretwo-test-manager** |
| Docker, Kubernetes, Flux, CI/CD, Helm, ingress, cert-manager, SealedSecrets, deploy, staging, production, GitHub Actions | **k8s-expert** |
| unclear scope, cross-service, API integration, full-stack both directions | **choretwo-dev-lead** |

## Specialist Delegation Rules

**ALWAYS use specialized agents** — NEVER fall back to `general` when a specialist matches.

- If task touches multiple domains → `choretwo-dev-lead` orchestrates
- If task touches infrastructure/deployment → `k8s-expert`
- If task touches external APIs (d.velop) → domain-specific specialist

## Forbidden Delegations

Specialists must NOT delegate to:
- `general` (always use a specialist instead)
- Other choretwo specialists (each stays focused)
- arr-expert, hook-migration-expert, migration-orchestrator, forms-developer-gudrun, schnittstellen-profi
- Except: `docs-librarian-albert` and `quality-control-dieter` (allowed for info/QA)
