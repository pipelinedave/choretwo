# Datenbank-Migrationen (choretwo)

## Kurzfassung

**Ein Deploy migriert die Datenbank nicht.** Auf Vercel läuft der Monolith
mit `RUN_STARTUP_MIGRATIONS=false` — DDL gehört nicht in den Cold-Start einer
Serverless-Funktion. Nach einer Schema-Änderung muss die Migration
**bewusst, einmal, von außen** ausgeführt werden:

```bash
DATABASE_URL='postgresql://…' python3 scripts/run_migrations.py
# oder
make migrate-app          # nutzt DATABASE_URL aus der Umgebung
```

## Zwei verschiedene "migrate"-Ziele

| Target | Was | Wann |
|---|---|---|
| `make migrate` | spielt `init-db.sql` ab: Rolle, Datenbank, Schemas (`auth`, `chores`, `logs`, `notifications`, `ai`) | einmal bei **neuer** DB |
| `make migrate-app` | App-Schema: Tabellen, Spalten, FKs, Indizes, Seeds | nach jeder **Schema-Änderung** |

`make migrate` legt **kein** App-Schema an. Wer `rooms` in einer frischen
DB sucht und nur `make migrate` gefahren hat, findet dort nichts.

## Aufbau

Es gibt genau **eine** Quelle für DDL pro Service:

- `services/<service>/app/migrations.py` — die Statements
- `services/<service>/app/database.py::run_migrations()` — führt sie aus
  (lokaler Compose-Start)
- `scripts/run_migrations.py` — führt dieselbe Funktion gegen `DATABASE_URL`
  aus (Produktion)

`monolith/database.py::run_all_migrations()` ist ein **toter** Pfad: der
Monolith ruft in `startup_event` direkt `db_mod.run_migrations()` der
Vendor-Pakete auf, nicht diese Funktion. Sie bleibt als Backup erhalten;
wer sie reaktiviert, muss `_migrate_rooms()` mitdenken (sie ist dort
eingebaut).

### Idempotenz

Jedes Statement ist mit `IF NOT EXISTS` bzw. einem `pg_constraint`-Guard
abgesichert. Die Migration darf beliebig oft laufen und ist danach ein
No-op. Postgres kennt kein `ADD CONSTRAINT IF NOT EXISTS`, deshalb der
FK als `DO $$ … IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE …) … $$`.

## Das Raum-Feature (Stand 30.09.2026)

Angelegt: Tabelle `chores.rooms`, Spalte `chores.chores.room_id`,
FK mit `ON DELETE SET NULL`, Indizes, UNIQUE auf `rooms.name`, plus
11 geseedete Räume (inkl. `Dave` mit `is_personal = true`).

**Kein Breaking**: `room_id` ist NULLBAR. Bestehende Chores bleiben ohne
Raum gültig, es gibt kein Backfill. `ON DELETE SET NULL` ist die zweite
Hälfte der Optionalität — ein gelöschter Raum **löscht keine Chores**, er
entkoppelt sie nur wieder vom Raum.

### Prod-Runbook

Reihenfolge ist bewusst **Migration zuerst**, Deploy danach. Die neue
Frontend-Version fragt `GET /api/chores/rooms` ab; ohne Tabelle liefert
das 500er. Ein Deploy zuerst hieße: App-Version gegen ein Schema, das
die Route noch nicht kennt.

```bash
# 1. Migration gegen die Prod-DB (idempotent, beliebig wiederholbar)
DATABASE_URL='postgresql://…?sslmode=require' python3 scripts/run_migrations.py
#    Erwartet: "OK: chores.rooms existiert (11 Raeume), chores.room_id vorhanden."
#    Exit-Code != 0 -> STOP, nicht deployen.

# 2. Deploy (Push auf main; Vercel baut automatisch)

# 3. Verifizieren
curl -s https://choretwo.stillon.top/api/chores/rooms \
  -H "Authorization: Bearer $TOKEN" | head -c 400
```

Das Skript prüft am Ende selbst nach, ob `chores.chores.room_id` und
`chores.rooms` wirklich existieren, und bricht mit Exit-Code 1 ab, wenn
nicht. Ein "grüner" Lauf, der aber nichts bewirkt hat, fällt damit auf.

### Verifikation in der DB

```sql
\d chores.rooms
SELECT column_name FROM information_schema.columns
  WHERE table_schema='chores' AND table_name='chores' AND column_name='room_id';
SELECT name, is_personal FROM chores.rooms ORDER BY sort_order;
```

### Rollback

Die Tabelle ist additiv und enthält keine autoritativen Daten — die
Zuordnung `chore → Raum` ist Beiwerk, der Chore selbst lebt ohne sie.

```sql
ALTER TABLE chores.chores DROP COLUMN room_id;   -- FK faellt mit weg
DROP TABLE chores.rooms;
```

Die alte Code-Version läuft danach unverändert weiter: Ihre Chore-Responses
kennen `room_id` nicht, und `Base.metadata.create_all()` legt in einer
frischen DB nichts an, was hier fehlt. **Vor** dem Rollback trotzdem den
Frontend-Stand beachten: eine ChoreCard mit Chip rendert ohne Raum still
nichts (der Chip ist an `room` gebunden), zeigt also keinen Rest.

## Falle: Routen-Reihenfolge

`GET /api/chores/rooms` und `GET /api/chores/{chore_id}` kollidieren. Der
rooms-Router muss **vor** dem chores-Router inkludiert werden, sonst
matcht FastAPI die Integer-Route und antwortet **422** statt 200
(`value is not a valid integer`). Betroffen sind zwei Listen:

- `services/chore-service/app/main.py` → `app.include_router(...)`
- `monolith/main.py` → `ROUTERS`

Abgesichert durch
`services/chore-service/tests/test_rooms.py::test_rooms_route_is_not_swallowed_by_chore_id`.

## Daten-Backfill: `scripts/backfill_rooms.py`

DDL legt Tabellen an, befüllt aber keine bestehenden Zeilen. Für die
Raum-Zuordnung der bereits vorhandenen Chores gibt es deshalb ein
eigenes, versioniertes Skript:

```bash
make backfill-rooms                 # Dry-Run: zeigt nur, was passieren würde
make backfill-rooms APPLY=1         # schreibt
```

**Default ist Dry-Run.** Ohne `APPLY=1` passiert nichts — das ist
Absicht, damit niemand versehentlich Produktionsdaten anfasst.

Zwei Eigenschaften, die den Prod-Lauf sicher machen:

- **Doppelter Schlüssel.** Jeder Eintrag nennt Chore-ID *und* den
  aktuell erwarteten Titel. Weicht beides ab, bricht das Skript mit
  Exit != 0 ab, statt einen unbekannten Chore zu treffen.
- **Atomar.** Der Abbruch passiert vor dem Commit — ein Lauf mit einer
  einzigen Abweichung schreibt gar nichts, auch nicht die gültigen
  Zeilen.

Die Zuordnung selbst ist eine **Domänenentscheidung** und steht als
explizite Tabelle im Skript, nicht als Heuristik über die Titel.
„Papiermüll" ist hausweit und bekommt deshalb bewusst *keinen* Raum;
Titel wie „Küchenfronten abwischen" werden zu „Fronten abwischen"
entzerrt, weil der Raum jetzt als Chip danebensteht.
