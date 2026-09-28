# Architecture

System architecture, service responsibilities, and data flow.
Stand: 28.09.2026 — Produktion = Vercel + Python-Monolith (verifiziert an
`vercel.json`, `api/index.py`, `monolith/main.py`, `monolith/auth.py`,
`monolith/database.py`, `frontend/src/stores/auth.js`).

## System Overview

```
Browser / PWA
    │  HTTPS
    ▼
Vercel (Projekt `choretwo`)
├── frontend/dist (statisch, aus `frontend/`)
└── api/index.py ──▶ monolith/main.py (FastAPI, maxDuration 60s)
        ├── /api/chores/*  ← chore-service (Vendor)
        ├── /api/logs/*    ← log-service (Vendor)
        ├── /api/notify/*  ← notification-service (Vendor)
        ├── /api/ai/*      ← ai-copilot-service (Vendor)
        └── /health        → {"status":"ok","service":"choretwo-monolith"}
                │
                ▼
        Postgres (Supabase, 3 Schemas: chores/logs/notifications)
        + Cron GET /api/notify/run-due (täglich 07:00, CRON_SECRET-Bearer)
```

Lokal (Dev): Docker-Compose (Postgres/Redis/Monolith :8000, Go-auth :8001)
+ Vite-Dev :3000 (Proxy `/api/auth` → :8001, restliche `/api/*` → :8000).

## Services

| Teil | Tech | Prod | Lokal | Verantwortung |
|------|------|------|-------|---------------|
| Frontend | Vue 3/Pinia/Vite/PWA | `frontend/dist` auf Vercel | `:3000` (Vite) | UI, State, Magic-Link-Login |
| Monolith | Python/FastAPI | `api/index.py` (Serverless) | `:8000` | chores, logs, notify, ai in EINEM Prozess |
| Go-auth | Go/Gin | **nicht deployed (legacy)** | `:8001` | nur lokale Dev/E2E (Mock-Auth) |
| Postgres | Supabase | `DATABASE_URL` | Compose `postgres:16` | Schemas `chores`, `logs`, `notifications` |

Vendor-Prinzip: `monolith/sync_vendor.py` kopiert `services/*/app` nach
`monolith/vendor/<service>/app` und schreibt `app.*`-Imports um. Der Vendor ist
gitignored — Fixes IMMER in `services/*/app/`.

## Authentication (was wirklich benutzt wird)

- **Prod:** Supabase Magic-Link im Frontend (`VITE_SUPABASE_URL`/
  `VITE_SUPABASE_ANON_KEY`, siehe `frontend/src/stores/auth.js`). Das JWT
  (ES256) verifiziert der Monolith nativ via JWKS (`JWT_JWKS_URL`,
  `monolith/auth.py`). Fällt JWKS zurück, gilt HS256 mit `JWT_SECRET`.
- **Lokal/E2E:** `USE_MOCK_AUTH=true` → `X-User-Email`-Header gilt als
  Identität (Playwright ohne OIDC-Flow). **In Prod `false`** — sonst Bypass.
- **Legacy/tot in Prod:** Go-auth-service + Dex-OAuth. Der Go-Code existiert
  noch (`services/auth-service`, Dex-Init in `cmd/main.go`) und dient lokal als
  Mock-Login (`/api/auth/login`), wird aber in Prod weder gebaut noch geroutet.
  Öffentlich lesbar ohne Login: nur `GET /api/chores*` und `/api/export*`
  (Shared-Chores; Service-Schicht filtert Private via `owner_email`).

## Routing & Serverless-Grenzen (`vercel.json`)

- Rewrites: `/health` + `/api/:path*` → `/api/index.py`, Rest → `/index.html`.
- `maxDuration: 60` — lange Requests (Import/Export) müssen darunter bleiben.
- `RUN_STARTUP_MIGRATIONS=false` in Prod: keine DDL im Cold-Start; Migrationen
  laufen extern/lokal. Lokal default `true`.
- DB-Pool env-driven (`DB_POOL_SIZE`/`DB_MAX_OVERFLOW`, am Pooler z. B. `1`/`1`);
  TLS (`sslmode=require`) außerhalb localhost automatisch (`monolith/database.py`).
- CORS: `CORS_ORIGINS` (kommagetrennt) **ersetzt Defaults komplett**
  (`monolith/main.py`) — auf Vercel alle Domains setzen.

## Database (Schema Isolation)

Single Postgres, ein Schema pro Service. Init: `scripts/init-db.sql`.

- `chores.chores` (+ assignments/recurrence), `logs.chore_logs`,
  `notifications.notification_preferences` + `scheduled_notifications`.
  (Vollständige DDL: `monolith/database.py` `_migrate_*` — Single Source of Truth.)
- Alle vier Vendor-Pakete teilen sich EINE Engine (`monolith/database.py`
  bindet `engine`/`SessionLocal`/`get_db` in die Service-Module ein).
- Backend spricht snake_case, Frontend camelCase (`normalizeChore()` im
  Pinia-Store).

## Frontend (Pinia + Komponenten)

Stores: `auth` (Supabase-Session + Legacy-Mock), `chore`, `log`,
`notification`, `settings`. Kern-Komponenten: `ChoreCard`, `FilterPills`,
`CatchUpCard`, `SnoozeSheet`, Settings-Modals; Views: Chores/CatchUp/Logs/AI/Home/Login/Callback.

## Security (Prod)

1. TLS via Vercel (kein eigenes Zert-Management mehr).
2. Echte JWT-Signaturprüfung (JWKS/HS256), Mock-Header nur mit `USE_MOCK_AUTH=true`.
3. Cron-Endpoint nur mit `CRON_SECRET`-Bearer (pfad-restringiert).
4. Secrets ausschließlich als Vercel-Env-Vars (via `vera`) — nie im Repo.

## Historisch (stillgelegt 09/2026)

6 Einzel-Deployments (Go-auth :8001, chore :8002, log :8003, notify :8004,
ai :8005) auf eigenem Cluster mit eigenem Ingress und Registry-Images.
Ersetzt durch Vercel-Monolith oben. Reste nur noch in der Git-Historie.

---

**Next**: [DEVELOPMENT.md](./DEVELOPMENT.md) - Local development setup
