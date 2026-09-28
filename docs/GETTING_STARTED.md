# Getting Started with Choretwo

Quick start for local development. Stand: 28.09.2026.
Prod-Deploy läuft über Vercel (siehe [DEPLOYMENT.md](./DEPLOYMENT.md)).

## Voraussetzungen

- **Docker & Docker Compose** (v2.0+): `docker --version`
- **Python** (3.12+) — Monolith/Services: `python3 --version`
- **Go** (1.21+, nur auth-legacy lokal): `go version`
- **Node.js** (20+) — Frontend: `node --version`
- **Git**, **Make** (empfohlen)

Vercel-Zugang (nur für Deploy/Env, via `vera`): Vercel-Projekt `choretwo`.
Kein Cluster-Tooling nötig.

## Start

```bash
git clone https://github.com/pipelinedave/choretwo.git
cd choretwo
docker compose -f docker-compose.yml -f docker-compose.monolith.yml --profile microservices up -d monolith
cd frontend && npm run dev
```

Nach ~30 s:

- **Frontend**: http://localhost:3000
- **Monolith** (chores/logs/notify/ai): http://localhost:8000 (`/health`, `/docs`)
- **Go-auth** (Mock-Login, legacy): http://localhost:8001
- **PostgreSQL**: localhost:5432 · **Redis**: localhost:6379

## Login lokal

`USE_MOCK_AUTH=true` (Compose-Default): Mock-Login ohne OIDC — beliebige
E-Mail genügt. Prod nutzt Supabase Magic-Link (`VITE_SUPABASE_*`, siehe
[ARCHITECTURE.md](./ARCHITECTURE.md)).

## Health-Check

```bash
curl http://localhost:8000/health   # {"status":"ok","service":"choretwo-monolith"}
docker compose ps
docker compose logs --tail=20 monolith
```

## Häufige Befehle

```bash
make test-all / make lint-all       # Tests / Lint
cd frontend && npm run test:e2e     # Playwright
docker compose down -v              # Reset (Volumes inkl. DB weg)
```

## Wenn etwas klemmt

- Port belegt: `lsof -i :3000` / `:8000` / `:5432`, Prozess beenden.
- DB-Fehler: Compose-Status prüfen, ggf. `down -v` + neu starten.
- Frontend erreicht Backend nicht: Monolith auf :8000 oben? (Vite-Proxys:
  `/api/auth` → :8001, restliche `/api/*` → :8000.)
- Mehr: [TROUBLESHOOTING.md](./TROUBLESHOOTING.md).

## Next Steps

1. [ARCHITECTURE.md](./ARCHITECTURE.md) — Systemdesign (Vercel + Monolith)
2. [DEVELOPMENT.md](./DEVELOPMENT.md) — Dev-Workflow im Detail
3. [TESTING.md](./TESTING.md) — Tests und Coverage
