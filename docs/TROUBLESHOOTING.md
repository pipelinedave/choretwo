# Troubleshooting Guide

Common issues and solutions. Stand: 28.09.2026 (Prod = Vercel + Monolith).

## Quick Reference

| Issue | Likely Cause | Solution |
|-------|-------------|----------|
| Port already in use | Another service using port | `lsof -i :PORT` and kill process |
| Database connection failed | Wrong credentials or service down | Check postgres container status |
| JWT validation failed | Expired/invalid token or wrong JWKS | Check `JWT_*` env (via `vera` in prod) |
| CORS errors in prod | `CORS_ORIGINS` incomplete | All domains via `vera` setzen (ersetzt Defaults!) |
| Vercel build failed | Frontend build or `sync_vendor.py` | Build-Logs via `vera`, lokal reproduzieren |
| Cron 401 | `CRON_SECRET` mismatch | Via `vera` abgleichen |

## Production (Vercel)

Alles unter dieser Sektion läuft über `vera` (einziger Vercel-Zugang).
Nie Secrets in Logs/Shell-History schreiben.

### Build schlägt fehl

1. Build-Logs im Vercel-Dashboard öffnen (via `vera`).
2. Lokal 1:1 reproduzieren:
   `cd frontend && npm ci && npm run build && cd .. && python3 monolith/sync_vendor.py`
3. Typisch: kaputter Frontend-Build oder `services/*/app`-Verzeichnis fehlt
   (Vendor wird generiert — nie `monolith/vendor` committen/fixen).

### CORS-Fehler in Prod

`CORS_ORIGINS` auf Vercel **ersetzt die Defaults komplett**
(`monolith/main.py`). Fehlende Domain = blockiert. Alle Domains inkl.
`choretwo.stillon.top` + `choretwo.vercel.app` kommagetrennt setzen (via `vera`).

### Überall 401

- `USE_MOCK_AUTH` muss in Prod `false` sein (sonst `X-User-Email`-Bypass).
- Frontend muss `Authorization: Bearer <Supabase-JWT>` schicken.
- `JWT_JWKS_URL`/`JWT_ISSUER`/`JWT_AUDIENCE` prüfen (via `vera`).

### Cron `/api/notify/run-due` 401t

Der Endpoint akzeptiert NUR `Authorization: Bearer $CRON_SECRET`
(`monolith/auth.py`, pfad-restringiert). Secret auf Vercel vs. Cron-Config
abgleichen (via `vera`).

### AI nur generisch / `llm_connected: false`

`LLM_API_KEY` fehlt/ungültig → Regex-Fallback per Design. Status:
`GET /api/ai/status`. Key via `vera` rotieren. `LLM_BASE_URL` muss bis `/v1`
zeigen (Client hängt `/chat/completions` an).

### DB-Timeouts / langsame Cold-Starts

- `DB_POOL_SIZE`/`DB_MAX_OVERFLOW` zu groß für den Pooler (z. B. `1`/`1`).
- `RUN_STARTUP_MIGRATIONS` muss in Prod `false` sein (keine DDL im Cold-Start).

### Rollback

Vercel-Dashboard → Deployments → letztes grünes Deployment promoten.

## Lokal (Docker Compose)

### Monolith startet nicht / DB-Fehler

```bash
docker compose ps
docker compose logs --tail=50 monolith
docker compose exec postgres psql -U choretwo -d choretwo -c "SELECT 1"
# Schemas prüfen (Single Source of Truth: monolith/database.py)
docker compose exec postgres psql -U choretwo -d choretwo -c "\dt chores.*"
# Reset (dev only!)
docker compose down -v
```

### Mock-Login geht nicht

```bash
docker compose exec monolith env | grep MOCK   # muss true sein (Dev)
# USE_MOCK_AUTH=true in .env, dann neu starten
```

### Chore wird nicht angelegt (500)

```bash
docker compose logs monolith --tail=50
# Vendor kaputt? Neu generieren (Fixes gehören in services/*/app/):
python3 monolith/sync_vendor.py
```

### Undo geht nicht

```bash
docker compose exec postgres psql -U choretwo -d choretwo \
  -c "SELECT * FROM logs.chore_logs ORDER BY id DESC LIMIT 5"
# action_type muss gültig sein (created/updated/marked_done/archived),
# previous_state muss alle Restore-Felder enthalten
```

### Notifications kommen nicht

- Cron lokal manuell triggern (mit `CRON_SECRET` aus `.env`):
  `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:8000/api/notify/run-due`
- Prefs prüfen: `notifications.notification_preferences`-Tabelle.
- Browser-Permission prüfen (Settings → Privacy → Notifications).

### Copilot-Antworten generisch (lokal)

```bash
docker compose exec monolith env | grep LLM_
# LLM_API_KEY leer → Regex-Fallback per Design. Key in .env setzen, neu starten.
curl -s -H "X-User-Email: you@example.com" http://localhost:8000/api/ai/status
```

### Frontend weiß / Auth-Loop

- Console (F12) lesen; `docker compose ps` (Monolith :8000 oben?).
- Auth-State resetten: `localStorage.clear()` + Reload.
- PWA: `http://localhost:3000/manifest.json` erreichbar? Service-Worker ggf. deregistrieren.

## Build/CI (GitHub Actions)

CI (`ci.yaml`) + Security (`security.yaml`) laufen pro Push/PR. Bei Rot:
Actions-Log lesen, lokal `make test-all` / `make lint-all` reproduzieren.
Die gelöschten Alt-Workflows (`build-and-push`, `deploy-*`,
`update-kubernetes-deployment`) scheiterten bei jedem Push — sie sind weg,
Vercel baut selbst.

## Historisch

Altes Cluster-Troubleshooting (Reconcile, Image-Pull, Secret-Sealing) ist ersatzlos entfallen — bei Bedarf Git-Historie.
