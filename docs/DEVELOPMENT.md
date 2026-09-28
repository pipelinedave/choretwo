# Development Guide

Local development setup and workflow. Stand: 28.09.2026.
Deployments laufen auf Vercel (siehe [DEPLOYMENT.md](./DEPLOYMENT.md)) —
diese Datei beschreibt NUR lokale Entwicklung.

## Voraussetzungen

- Docker + Docker Compose (v2.0+), Go (auth-Legacy), Python 3.12, Node 20, Git, Make.
- Kein Cluster-Tooling nötig (nur Docker/Compose).

## Start

```bash
git clone https://github.com/pipelinedave/choretwo.git
cd choretwo

# Modularer Monolith (empfohlen): Postgres + Redis + Monolith :8000 + Go-auth :8001
docker compose -f docker-compose.yml -f docker-compose.monolith.yml --profile microservices up -d monolith

# Frontend-Dev (eigener Shell-Tab, Port :3000)
cd frontend && npm run dev
```

Vite-Proxys (`frontend/vite.config.js`): `/api/auth` → `localhost:8001` (Go),
restliche `/api/*` → `localhost:8000` (Monolith).

Zugriff: Frontend http://localhost:3000, Monolith http://localhost:8000
(`/health`, `/docs`), Go-auth http://localhost:8001.

## Einzelservices (ohne Docker)

```bash
# Monolith direkt
uvicorn monolith.main:app --reload --host 0.0.0.0 --port 8000

# Einzelservice direkt (wird im Vendor-Kontext getestet)
cd services/chore-service && uvicorn app.main:app --reload --port 8002

# Go-auth (nur Mock-Login lokal)
cd services/auth-service && go run cmd/main.go

# Frontend
cd frontend && npm run dev
```

Wichtig: Vendor-Code (`monolith/vendor/*`) ist generiert — Fixes IMMER in
`services/*/app/`, danach bei Bedarf `python3 monolith/sync_vendor.py`.

## Datenbank

```bash
# Init-Schemas
docker compose exec postgres psql -U choretwo -d choretwo < scripts/init-db.sql
# oder: SELECT aus monolith/database.py (Single Source of Truth)

# Reset
docker compose down -v && <Start wie oben>
```

Migrationen: lokal automatisch (`RUN_STARTUP_MIGRATIONS` default `true`).
In Prod `false` — keine DDL im Serverless-Cold-Start.

## Env (lokal, `.env`, gitignored)

```
DATABASE_URL=postgresql://choretwo:choretwo_dev@localhost:5432/choretwo?sslmode=disable
JWT_SECRET=choretwo-dev-jwt-secret-change-in-production
USE_MOCK_AUTH=true
LLM_BASE_URL=https://api.synthetic.new/openai/v1
LLM_MODEL=hf:zai-org/GLM-5.3-Flash
LLM_API_KEY=   # ohne Key: Regex-Fallback per Design
```

Prod-Env-Vars stehen auf Vercel und werden NUR über `vera` verwaltet.

## Tests / Lint

```bash
make test-all        # alle Services
make test-chore      # einzelner Service
cd frontend && npm run test:e2e   # Playwright (Chromium + Firefox, seriell)
make lint-all
```

Coverage-Ziele: auth/chore/log 90 %, notify 85 %, ai 80 %, Frontend 80 %.

## Git

Branch `main`. Konventionelle Commits (`feat:`, `fix:`, `docs:`, …).
Push auf `main` deployt automatisch nach Vercel-Production — vorher Tests grün.

## Support

- Issues: https://github.com/pipelinedave/choretwo/issues
- Architektur: [ARCHITECTURE.md](./ARCHITECTURE.md) · Deploy: [DEPLOYMENT.md](./DEPLOYMENT.md) · Tests: [TESTING.md](./TESTING.md)
