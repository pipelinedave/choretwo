# Choretwo - Current Session State

## Last Updated
**Date:** September 22, 2026
**Session:** CatchUp-E2E-Reparatur — GET-by-id null-Bug im chore-service behoben

---

## CatchUp-Fix: GET /api/chores/{id} lieferte null (22.09.2026)

**Symptom:** CatchUp-Suite 22/22 failed (Chromium+Firefox). Zwei Fehlermuster:
1. `SyntaxError: Unexpected end of JSON input` im Test-Setup — Ursache: kein Backend auf `:8000` (Vite-Proxy zeigt seit Modular-Monolith-Migration auf `localhost:8000`, nicht 8002). Dev-Stack ist `docker-compose -f docker-compose.yml -f docker-compose.monolith.yml --profile microservices up -d monolith` (Profile-Flag nötig, sonst Compose-Validierungsfehler `frontend depends on undefined service chore-service`).
2. `TypeError: Cannot read properties of null (reading 'done'/'due_date')` in 8 Tests — Ursache: echter Produkt-Bug.

**Root-Cause (`services/chore-service/app/routes/chores.py` `get_single_chore`, ~Zeile 130):**
Das `return ChoreResponse(...)` war **eingerückt unter dem `if not chore:`-Block NACH dem `raise`** → toter Code. Bei existierendem Chore fiel die Funktion durch → implizites `None` → FastAPI antwortete **HTTP 200 mit Body `null`**. Jeder GET-by-id-Client bekam null (404 kam nur für wirklich gelöschte Chores). Fix: Einrückung eine Ebene raus (Return auf Funktionsebene). Gleicher Fix in `monolith/vendor/chore/app/routes/chores.py` (gitignored, wird via `sync_vendor.py` aus services/ generiert — Commit nur auf services/).

**Verifikation:**
- curl: `GET /api/chores/{id}` → vorher `null`, nachher volles Chore-Objekt (HTTP 200)
- Realer Browser-E2E (CDP): Stack/Sortierung/Deck-Effekt, Swipe-done + Recurrence (+7d), Toast mit UNDO (position:fixed, display:flex, opacity:1), Snooze-Sheet (+3 Tage), Undo restored due_date — **alle UI-Flows funktional**, Page-Errors: 0
- `npx playwright test catchup` → **22 passed (1.2m)** (vorher 8 failed / 14 passed mit korrektem Stack, 22 failed ohne Backend)

**Nicht verschlechtert:** Gesamt-Suite 60 failed / 68 passed — Failures sind vorexistierender Test-Drift: Tests warten auf `.stats-grid` (existiert nicht im src-Code) und `Sign in with Google` (UI sagt "Sign in with Dex / OAuth"), fehlende Nav-Links. Logisch unabhängig vom Backend-Fix (Backend-only Änderung des Response-Bodys null→Objekt).

**Commit:** `1c9a76b` fix(chore): return chore object from GET /chores/{id} instead of null (lokal, NICHT gepusht — paralleler Staging-Rollout läuft)

---

## AI Provider Migration (22.09.2026)

Das AI-Backend (NLP-Intent-Parsing des Copilots) wurde vom adesso AI Hub
Sovereign auf den Provider **Synthetic** (synthetic.new) mit **GLM-5.3-Flash**
umgestellt — provider-agnostisch und env-getrieben:

- **Neuer Client:** `services/ai-copilot-service/app/llm_client.py` (ersetzt
  `aihub_client.py`). Env-Vars: `LLM_BASE_URL` (Default
  `https://api.synthetic.new/openai/v1`, Basis-URL bis /v1 — der Client hängt
  `/chat/completions` selbst an), `LLM_API_KEY` (Secret, leer = deterministischer
  Regex-Fallback), `LLM_MODEL` (Default `hf:zai-org/GLM-5.3-Flash`).
- **Backward-Compat:** Sind ALLE `LLM_*` unset, greift der Legacy-Fallback auf
  `ADESSO_*` (adesso AI Hub Sovereign, Deprecated-Warnung im Log). Sobald eine
  `LLM_*`-Var gesetzt ist, gelten ausschließlich die LLM_*-Vars.
- **Status-Endpoint:** `/api/ai/status` liefert jetzt `llm_connected` +
  `llm_provider` (statt `aihub_connected`). Frontend nutzt das Feld nicht
  (verifiziert).
- **Monolith:** Vendor-Kopie wird via `monolith/sync_vendor.py` generiert
  (gitignored, läuft im Dockerfile-Build) — nur die Service-Quelle wurde
  geändert und re-gesynced.
- **Tests:** 50 passed (neu: `tests/test_llm_client.py` mit Env-Resolution,
  URL-Normalisierung, HTTP-/Timeout-Fehlern, Codefence-JSON, Health-Semantik,
  Fallback-Pfad). Ruff clean (inkl. 6 pre-existing Findings gefixt).
- **Live-Verifikation:** Service lokal gegen Synthetic getestet — `/health` ok,
  `/api/ai/status` → `llm_connected: true, llm_provider: api.synthetic.new`
  (echtes Modell-Listing), 2 echte Intent-Parses über GLM (EN + DE, confidence
  0.95, `response_format: json_object` funktioniert).
- **K8s (k3s-config, Commit b2055e2):** `monolith/deployment.yaml` +
  `ai-copilot-service/deployment.yaml` auf `LLM_*` migriert. Secret-Key
  `llm-api-key` wurde in `choretwo-secrets` (beide Namespaces, manuell
  verwaltetes Plain-Secret — kein SealedSecret im Repo) gepatcht.
- **Commits:** `dc5d67b` (refactor ai client), `2c3f1c6` (compose/env),
  `3153018` (tests), `9303777` (ruff fixes), `cc0e107` (docs).

---

## Previous Session

**Date:** September 16, 2026
**Session:** CatchUp (Aufholen) 2.0 — Bug-Fixes, E2E-Stabilität & drei aufeinanderfolgende grüne Läufe

---

## Current Status

### ✅ All Services & Test Suites Verified (100% Pass)
```
✅ auth-service         - Go test ./... (100% pass)
✅ chore-service        - pytest: 21 passed (Recurrence formula + Settings tests)
✅ log-service          - pytest: 8 passed (Undo flow, async httpx mock tests)
✅ notification-service - pytest: 3 passed (Gotify notification tests)
✅ ai-copilot-service   - pytest: 5 passed (NLP intent parser tests)
✅ frontend unit tests  - vitest: 22 passed across 4 test suites (Happy-DOM / Node 20)
✅ frontend build       - vite build: Production bundle generated cleanly
```

---

## Recent Accomplishments & Alignment

### 1. Choremane Spirit & UX Realignment
- **True Material You Pastel Aesthetic Restored:**
  - Color palette: `--color-overdue: #f7b4ae`, `--color-due-today: #f6c7ae`, `--color-due-soon: #f2ddba`, `--color-due-7-days: #d3ead8`, `--color-due-far-future: #a4dcd3`, `--color-primary: #2f6f6f`.
  - Signature body radial gradient background with Space Grotesk / Manrope typography.
  - Frosted glass headers and cards (`backdrop-filter: blur(14px)`).
- **Single-Page Cohesive Home Dashboard:**
  - Pinned global header with Title (`CHORETWO`), `+` Add Chore button, PWA install prompt, AI Copilot toggle, and `☰` Menu dropdown.
  - Smooth animated Household Health performance bar (0-100%).
  - Horizontal Filter Pills bar with live badge counts and sticky clear `[ ✕ ]` button.
  - Natural Language AI Copilot quick action bar.
  - Urgency-sorted chore cards list.
  - Gmail-style tactile swiping gestures:
    - Swipe Right -> Marks Done with instant strikethrough transition (`✓ Done today`).
    - Swipe Left -> Expands card into inline edit form.
    - Double click -> Expands card into inline edit form.
  - Bottom activity log sheet drawer (`LogOverlay`) with collapsed handle showing latest action + instant Undo button, expandable into 70vh full activity log with individual undo buttons.
  - Modals: `AddChoreForm`, `ArchivedChoresModal`, `NotificationSettingsModal`, `ImportExportModal`, `SettingsModal`, `AboutModal`.

### 2. Backend & Database Normalization
- Fixed PostgreSQL connection URLs for SQLAlchemy 2.0 (`postgresql://...`).
- Initialized schemas `auth`, `chores`, `logs`, `notifications`, `ai` with owner `choretwo`.
- Configured configurable `CHORE_SERVICE_URL` in `log-service`.
- Upgraded `log-service` tests with `pytest-asyncio` and mock patches.
- Fixed Gotify env lookup and mock client patch in `notification-service`.

### 3. CatchUp (Aufholen) 2.0 — Bug-Fixes & E2E-Stabilität (☑ bestätigt)

**Umgebung:** Monolith (Uvicorn `:8000`) + Go auth (`:8001`) + Vite (`:3000`, `USE_MOCK_AUTH=true`), in tmux: `ts-monolith` / `ts-auth` / `ts-frontend`. Backend-Quelle: `services/chore-service`, Vendor via `monolith/sync_vendor.py --force` synchronisiert (Vendor ist git-ignoriert → Fixes IMMER in `services/` pflegen!).

**Behobene Bugs:**
- **Backend-Undo griff nie:** `/chores/{id}/done` las `done_by` nur als Query-Param; Frontend sendet `{done_by}` im Body → Route löst jetzt auch aus dem JSON-Body auf (`services/chore-service/app/routes/chores.py:160`).
- **UNDO stellte `due_date` nicht wieder her:** `pendingUndoDates`-Map im Store (`frontend/src/stores/chore.js`) + `updateChore` persistiert das Originaldatum.
- **UNDO-Race bei letzter Chore:** Success-Overlay blockierte den Toast → `pointer-events:none` + Toast-`z-index: 2100`; `successTimer` wird vor dem `await` gecleart.
- **Leerer Kartentitel nach Undo/Snooze:** `normalizeChore` mit `{message}`-Response überschrieb `name` → nur mergen, wenn gültiges Chore-Objekt vorliegt.
- **Doppelte Gesten:** `touch-action: pan-y` am Card + Up-Swipe-Kandidat bleibt bis zur Schwelle offen (Scroll-Lock erst danach).
- **Zeitzonen-Bug** in `formatNextDue` (`new Date("YYYY-MM-DD")` = UTC) → lokale `parseLocalDate()`.

**E2E-Stabilität (Flakiness-Fixes):**
- `playwright.config.js`: `workers: 1`, `fullyParallel: false` (geteilte Test-DB).
- Test-Isolation: `beforeEach` in allen 3 CatchUp-Specs macht **Login + Stack-Cleanup** (`clearActiveChores`), damit der Stack deterministisch nur die eigenen Chores enthält.
- Render-Robustheit: `waitForFunction` statt `waitForSelector(".catchup-card")`, damit alle eigenen Chores rendern, bevor Assertions auf Anzahl/oberste Karte zugreifen.

**E2E-Tests (Chromium + Firefox):**
- `catchup.spec.js` — Sortierung/Deck-Effekt, Swipe-Done arbeitet Stack ab, Empty-State
- `catchup-snooze-undo.spec.js` — Snooze-Button, Undo-Flow
- `catchup-edge-cases.spec.js` — UNDO-Due-Date, Swipe-up Snooze, Custom-Datum, Recurrence-Toast, Filter, Fortschrittszähler

### ☑ Stabilitäts-Bestätigung (Nachtwache, 16.09.2026)
```
cd ~/projects/choretwo/frontend && npx playwright test catch
→ 22 passed (1.3m)   // Chromium + Firefox
→ dreimal in Folge grün (22/22, keine flaky/skipped)
→ Ergebnis auch im vollen E2E-Lauf bestätigt: 0 CatchUp-Failures
```
Der zuvor intermittierende `CatchUp 2.0 Edge-Cases › UNDO stellt die due_date …` (Firefox) läuft nach den Isolations-/Render-Fixes stabil grün.

**Letzter Bestätigungs-Lauf (Nachtwache, 16.09.2026):**
```
cd ~/projects/choretwo/frontend && npx playwright test catch
Ergebnis: 22 passed | 0 failed | 0 flaky | 0 skipped   (rc=0, ~1.3 min)
```
Die CatchUp-E2E-Suite bleibt nach den Fixes stabil grün — keine Regression, kein Flakiness-Rückfall.

**Manueller Browser-Test wie ein echter Nutzer (Nachtwache, 16.09.2026):**
Real gefahrene Touch-Gesten (CDP `Input.dispatchTouchEvent`, mobile Emulation) + echte Klicks, gegen die laufende App (`localhost:3000` — die Instanz läuft auf Port **3000**, nicht 3001; kein Prozess auf 3001).
```
• Login über Mock-Auth ok (token gesetzt)
• 3 offene Chores + 1 abgeschlossene Chore geseedet
• Navigation per "Aufholen"-Button (Header) → /catchup, Subtitle "0 von 3 Chores geschafft"
• Stack top→unten korrekt priorisiert: Überfällig | Heute | Morgen
• Abgeschlossene Chore IST korrekt aus dem Stack ausgeblendet
• Done-Swipe → Toast "Erledigt ✓ Nächste Fälligkeit: Mi., 23.09." + UNDO-Button sichtbar
• UNDO geklickt → Chore kehrt zurück in den Stack
• Snooze-Sheet öffnet für die korrekte Chore, 4 Optionen + custom Datum
• Snooze "+1 Woche" → Chore verschwindet aus dem Stack
• Alles abgearbeitet → leere Stack/Erfolg
• Page-Errors: 0
```
Screenshots: `/tmp/human-manual-{1-done,2-undo,3-snooze,4-final}.png`. Alle User-Flows des Aufholen-Features funktionieren manuell einwandfrei.

**✅ Abgeschlossene Verifikation (final, Nachtwache 16.09.2026):**
```
cd /home/dhallmann/projects/choretwo/frontend && npx playwright test catch
→ 22 passed | 0 failed | 0 flaky | 0 skipped   (rc=0, ~1.3 min)
→ 11× Chromium + 11× Firefox, alle grün
```
Das Aufholen-Feature (CatchUp 2.0) ist als **abgeschlossen verifiziert**: E2E-Suite stabil grün, manuelle User-Flows bestätigt, keine offenen TODO/FIXME-Marker im CatchUp-Code.

**🔍 Abschließender TODO/FIXME-Nachweis (Nachtwache 16.09.2026):**
```
npx playwright test catch                          → 22 passed | 0 failed | 0 flaky | 0 skipped
grep -rn "TODO\|FIXME" … --include="*.py|*.ts|*.tsx"
  • Frontend src:                           keine Treffer
  • CatchUp-Frontend (.vue/.js):            keine Treffer (CatchUpCard, SnoozeSheet, CatchUpView, stores/chore, utils/catchUpStack)
  • Backend app/routes/chores.py (real):    keine Treffer
  • services/chore-service/app/api/routes.py: 5× "TODO: Implement" — DEAD CODE (unimportierter Stub,
    nicht in main.py gemountet; echte Routen laufen über app/routes/*) → NICHT Teil des CatchUp-Features
```
Hinweis: Das in der Anfrage angegebene Ziel `…/choretwo/chore-service` existiert nicht (Backend liegt unter `…/choretwo/services/chore-service`); der Grep wurde gegen den korrekten Pfad geführt. Im tatsächlichen CatchUp-Code (Frontend + `app/routes/chores.py`) sind keine offenen Marker vorhanden.

---

## Manueller Browser-Test (Aufholen-Feature, Nachtwache 16.09.2026)

App unter **`http://localhost:3000`** geöffnet (mobile Emulation 420×800, echte Touch-Gesten via CDP `Input.dispatchTouchEvent` + echte Klicks). Jeder Schritt mit beobachtetem Verhalten:

| # | Aktion (wie ein Mensch) | Beobachtetes Verhalten |
|---|---|---|
| 1 | App öffnen | → `http://localhost:3000/login?redirect=/` (Login-Redirect) |
| 2 | Login (Mock-Auth via `.btn-login` + submit) | → Token gesetzt, URL `http://localhost:3000/` |
| 3 | 3 überfällige Aufgaben anlegen (A -5d, B -2d, C -1d) | → IDs 1241/1242/1243 |
| 4 | `/chores` öffnen | → Karten „Überfällig-A/B/C" sichtbar |
| 5 | **Aufgabe A als erledigt markieren** (`/done`) | → `new_due_date=2026-09-23`, `done_by=user@example.com` |
| 6 | **Undo-Funktion** (erneut `/done` → Undo-Pfad) | → `done=false`, `done_by=null`, „wiederhergestellt" (due 2026-09-23) |
| 7 | `/catchup` (Aufholen) öffnen | → Subtitle „0 von 3 Chores geschafft" |
| 8 | Stack inspizieren | → top→unten: **B(-2d) | C(-1d) | A** — Priorisierung „am stärksten überfällig zuerst" korrekt |
| 9 | **Done-Swipe** (oberste Karte, Touch) | → Toast „Erledigt ✓ Nächste Fälligkeit: Mi., 23.09." + UNDO-Button sichtbar; Subtitle „1 von 3" |
| 10 | **UNDO über Toast klicken** | → Karte kehrt zurück, Subtitle „0 von 3" |
| 11 | Erneuter Done-Swipe | → Toast wieder „Erledigt ✓ Nächste Fälligkeit: Mi., 23.09." |
| 12 | **Snooze-Sheet öffnen** (`.snooze-btn`) | → öffnet für korrekte Chore „Überfällig-B", 4 Optionen + custom Datum |
| 13 | **Snooze „+3 Tage" wählen** | → Toast „Aufgeschoben auf Sa., 19.09." |
| 14 | Verbleibende Karten abarbeiten (Swipe-Schleife) | → Empty-State-Rendering im Nachlauf geprüft; Aufgaben sauber durchgearbeitet |
| 15 | **Snooze mit benutzerdefiniertem Datum** (Custom-Picker, nicht nur „+3 Tage") | → Sheet offen für korrekte Chore; custom-Date-Input `min` = heute (2026-09-16, Vergangenheit blockiert); Datum **2026-09-21 (+5 Tage)** gesetzt → Toast **„Aufgeschoben auf Mo., 21.09."**; Server **KORREKT**: `due_date=2026-09-21`, `done=false`; Aufgabe nach Snooze weiter als künftige Karte im Stack. **Page-Errors: 0**. **Bild-Doku:** `custom-{1-open,2-picked,3-after}.png` validiert als gültige, nicht-leere PNGs (420×800, reichhaltiger Inhalt); Picker-Darstellung zusätzlich per DOM-Struktur bestätigt (`.snooze-custom-input` sichtbar, `min`=heute, aria-label „Eigenes Datum wählen"); Toast + Persistenz live gelesen. |
| 16 | **Snooze mit vordefinierten Optionen** (Presets; per DOM verifiziert) | → Sheet öffnet korrekt: `dialog-aria="Aufschieben"`, Titel „Aufschieben", korrekte Chore im Subtitle; **4 Optionen sichtbar: „Morgen" | „+3 Tage" | „+1 Woche" | (custom-Picker)**; Auswahl **„Morgen"** (+1 Tag) → Toast **„Aufgeschoben auf Do., 17.09."**; Server **KORREKT**: `due_date=2026-09-17` (= morgen), `done=false`. Hinweis: die App nutzt Tages-Offsets (Morgen/+3T/+1Woche) — **keine** +1h/+3h-Stundenoptionen vorhanden. **Page-Errors: 0**. Screenshot: `preset-1-uhr.png`. |
| 17 | **Server-Persistenz des Snooze-Presets „Morgen" nach Neustart des chore-service** | → Chore 1247 („Persist …") auf `due_date=2026-09-17` gesnoozt. **Vor Neustart** (DB + API): `due_date=2026-09-17`, `done=false`. **chore-service (Monolith, :8000) neu gestartet** (PostgreSQL-Datenbank — dauerhaft, kein In-Memory). **Nach Neustart** per `GET /chores/1247` (API): **HTTP 200**, `"due_date":"2026-09-17"`, `"done":false` — **identisch erhalten**; zusätzlich direkt in der DB `chores.chores` bestätigt (`2026-09-17`, `False`, `done_by=None`). → **Snooze-Persistenz überlebt den Dienst-Neustart KORREKT.** |

**Ergebnis:** Login, Erledigt-Markierung, **Undo** und der **komplette Aufholen-Flow mit mehreren überfälligen Aufgaben** funktionieren manuell einwandfrei. Stack-Priorisierung korrekt (meist überfällig zuerst), Done-/Undo-Toasts mit korrekter nächster Fälligkeit, Snooze-Sheet mit allen **vordefinierten Optionen** (Morgen/+3T/+1Woche) + **benutzerdefiniertem Datum** (Vergangenheits-Schutz via `min`, exakte Persistenz der gewählten Fälligkeit). **Page-Errors: 0.**

Screenshots: `/tmp/manual-manual/step9-done.png`, `step10-undo.png`, `step11-done2.png`, `step12-snooze.png`, `step14-empty.png`, `custom-1-open.png`, `custom-2-picked.png`, `custom-3-after.png`, `preset-1-uhr.png`.

---

## E2E-Fix: Undo-Bug im Monolith (chore-crud:140) — behoben

**Umfeld:** Der volle E2E-Lauf (`npx playwright test --project=chromium --project=firefox`) ergab **62 passed / 66 failed**. Die CatchUp-Tests sind in beiden Browsern alle grün; die Fehlschläge sind überwiegend veraltete Test-Specs (Settings/Filter/Swipe/Undo-Duplikate) sowie Abhängigkeiten von Services auf `:8002`. **Ein Fehlschlag war ein echter Produkt-Bug** und wurde gefixt:

**Bug (`chore-crud.spec.js:140` › undo chore creation via API):**
- Symptom: `POST /api/logs/undo` → **500** `{"detail":"Undo failed: [Errno -2] Name or service not known"}`
- Root Cause: `services/log-service/app/services/undo_service.py` führte das Undo per **HTTP-Round-Trip** zu `CHORE_SERVICE_URL` aus (Default `http://chore-service:8000/api` — ein Kubernetes/Docker-DNS-Name). Im **Monolith** (ein Prozess auf `:8000`) ist dieser Hostname nicht auflösbar → DNS-Fehler → 500.
- Fix: `undo_service.py` führt die Chore-Zustandsänderungen jetzt **direkt in der geteilten DB** aus (`chores.chores` UPDATE: created→archive, updated→previous_state, marked_done→reset, archived→unarchive; jeweils mit `owner_email`-Guard) statt über einen unreliablen HTTP-Call. Entfernt die inzwischen ungenutzten Imports `os`/`httpx`/`logging`.
- Vendor re-synct (`sync_vendor.py --force`) + Monolith neu gestartet (`:8000`, HTTP 200).

**Verifikation:**
```
npx playwright test tests/e2e/chore-crud.spec.js:140 --project=chromium → 1 passed
npx playwright test tests/e2e/chore-crud.spec.js --project=chromium   → 5 passed (keine Regression)
```

---

## Development Commands

```bash
# Backend test suites (via WSL)
cd services/auth-service && go test ./...
cd services/chore-service && PYTHONPATH=. python3 -m pytest
cd services/log-service && PYTHONPATH=. python3 -m pytest
cd services/notification-service && PYTHONPATH=. python3 -m pytest
cd services/ai-copilot-service && PYTHONPATH=. python3 -m pytest

# Frontend unit tests and build
cd frontend && source ~/.nvm/nvm.sh && nvm use 20
npm test -- --run
npm run build
```
