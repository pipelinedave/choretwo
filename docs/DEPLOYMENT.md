# Choretwo Deployment (Vercel)

Stand: 28.09.2026. Produktion läuft auf **Vercel** (Projekt `choretwo`,
productionBranch `main`). Push auf `main` baut und deployt automatisch.
Das alte Cluster-Setup gibt es für choretwo nicht mehr.

## Wie ein Deploy läuft

1. Auf `main` pushen (direkt oder per PR-Merge).
2. Vercel Git-Integration baut automatisch mit dem Build-Command aus `vercel.json`:
   `cd frontend && npm ci && npm run build && cd .. && python3 monolith/sync_vendor.py`
   Output: `frontend/dist`.
3. Bei grünem Build → automatisches Production-Deploy.
4. Verifizieren: `https://choretwo.stillon.top/health` →
   `{"status":"ok","service":"choretwo-monolith"}`.

## Was Vercel baut (verifiziert an `vercel.json`, `api/index.py`)

- **Frontend:** statischer Build aus `frontend/dist` (`npm ci && npm run build`).
- **Backend:** EIN Python-FastAPI-Monolith via `api/index.py` (importiert
  `monolith/main.py`). Vendor-Code unter `monolith/vendor/*` wird **im Build**
  generiert (`monolith/sync_vendor.py`) und ist gitignored — Fixes gehören
  IMMER in `services/*/app/`, nie in `monolith/vendor/`.
- **Routing (Rewrites):** `/health` und `/api/*` → Monolith, alles andere → SPA
  (`index.html`). `maxDuration: 60` für `api/index.py`.
- **Cron:** `GET /api/notify/run-due` täglich 07:00 (`vercel.json` `crons`).
  Auth via `Authorization: Bearer $CRON_SECRET` (siehe `monolith/auth.py` —
  pfad-restringiert auf genau diesen Endpoint).
- **Domains:** `choretwo.stillon.top` (prod) + `choretwo.vercel.app` (default).

## Env-Vars (nur über `vera` verwalten)

Deploys und Env-Vars laufen NUR über `vera` (globaler Vercel-Agent).
Niemals Secrets ins Repo oder in Logs.

| Var | Zweck |
|-----|-------|
| `DATABASE_URL` | Postgres (Supabase, mit `sslmode=require` außer localhost) |
| `JWT_SECRET` | HS256-Fallback (Go-auth-legacy / lokale Dev) |
| `JWT_ISSUER` / `JWT_AUDIENCE` / `JWT_JWKS_URL` | Supabase-JWT-Verifikation (ES256 via JWKS) |
| `USE_MOCK_AUTH` | `true` nur lokal (Playwright ohne OIDC). **Prod: `false`** — sonst ist `X-User-Email` ein Auth-Bypass |
| `CORS_ORIGINS` | Kommagetrennt. **Ersetzt die Defaults KOMPLETT** (`monolith/main.py`) — alle Domains inkl. Vercel-Domains setzen |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Frontend-Login (Magic-Link) |
| `LLM_BASE_URL` / `LLM_MODEL` / `LLM_API_KEY` | AI-Copilot (Synthetic/GLM). Ohne Key: deterministischer Regex-Fallback |
| `CRON_SECRET` | Bearer für den Vercel-Cron-Endpoint |
| `RUN_STARTUP_MIGRATIONS` | Prod: `false` (keine DDL im Serverless-Cold-Start) |
| `DB_POOL_SIZE` / `DB_MAX_OVERFLOW` | Serverless-tauglich klein halten (z. B. `1`/`1` am Pooler) |

## Rollback

Im Vercel-Dashboard: Deployments → vorheriges grünes Deployment → Promote.
Kein Git-Revert nötig, kein Tag-Flow.

## Troubleshooting (nur Belegtes)

- **Build rot:** Build-Logs im Vercel-Dashboard lesen (`vera`). Häufig: Frontend-Build
  bricht (`npm ci`/`vite build`) oder `sync_vendor.py` findet `services/*/app` nicht.
  Lokal reproduzieren: Build-Command 1:1 ausführen.
- **CORS-Fehler in Prod:** `CORS_ORIGINS` auf Vercel prüfen — gesetzter Wert ersetzt
  die Defaults komplett, fehlende Domain = blockiert. Fix nur via `vera`.
- **`401 Authentication required` überall:** `USE_MOCK_AUTH` muss in Prod `false` sein;
  Frontend schickt Supabase-JWT als `Authorization: Bearer …`. `JWT_JWKS_URL`/
  `JWT_ISSUER`/`JWT_AUDIENCE` prüfen (via `vera`).
- **`/api/notify/run-due` 401t im Cron:** `CRON_SECRET`-Env auf Vercel ≠ im Cron
  gesendeter Bearer. Via `vera` abgleichen.
- **DB-Timeouts/Slow-Cold-Starts:** `DB_POOL_SIZE`/`DB_MAX_OVERFLOW` zu groß für den
  Pooler, oder `RUN_STARTUP_MIGRATIONS` steht auf `true`. Via `vera` prüfen.
- **AI antwortet nur generisch:** `LLM_API_KEY` fehlt/ungültig → Regex-Fallback per
  Design (`/api/ai/status` zeigt `llm_connected: false`). Key via `vera` rotieren.

## Historisch

Bis 09/2026 lief Prod auf k3s + FluxCD + DockerHub (`build-and-push.yaml`,
`update-kubernetes-deployment.yaml`, Staging-Umgebung). Das ist ersatzlos
stillgelegt — die Workflows wurden gelöscht, Vercel braucht sie nicht.
Details nur noch in der Git-Historie.
