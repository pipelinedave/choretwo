#!/usr/bin/env python3
"""Expliziter Migrations-Runner fuer Produktion (Vercel).

WARUM DIESES SKRIPT EXISTIERT
-----------------------------
Auf Vercel laeuft der Monolith mit `RUN_STARTUP_MIGRATIONS=false`. Das ist
absichtlich: DDL gehoert nicht in den Cold-Start-Hot-Path einer
Serverless-Funktion. Die Kehrseite war bisher, dass es damit KEINEN Weg
gab, ein neues Schema in Produktion zu bringen — `make migrate` spielt
nur `init-db.sql` ab (Rolle, Datenbank, Schemas), nicht das App-Schema.
`monolith/main.py` behauptete zwar, die Migration werde "einmalig extern
ausgefuehrt", aber ein solcher Mechanismus existierte nicht.

Dieses Skript IST dieser Mechanismus: aufrufen, wenn eine neue
Schema-Aenderung deployt werden soll, einmal, bewusst, von aussen.

Es ruft exakt dieselbe Funktion auf wie der lokale Compose-Start
(`<service>/app/database.py::run_migrations()`) — es gibt damit keine
zweite, abweichende Kopie des DDL. Das ist auch der Grund, warum hier
`run_migrations()` und nicht `migrate_rooms()` geladen wird: die
Room-Migration braucht `chores.chores`, und die legt `run_migrations()`
zuerst an. Auf einer frischen Datenbank wuerde `migrate_rooms()` allein
mit einem Foreign-Key-Fehler abbrechen.

BEISPIEL
--------
    # lokal (Compose oder direkt)
    DATABASE_URL='postgresql://...' python3 scripts/run_migrations.py

    # via make (liest DATABASE_URL aus der Umgebung)
    make migrate-app

Idempotent: mehrfaches Ausfuehren ist unschaedlich. Am Ende wird das
Ergebnis NACHGEPRUEFT — ein "grüner" Lauf, der aber nichts bewirkt hat,
bricht mit Exit-Code != 0 ab.
"""

import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]


def _load_run_migrations():
    """Holt `run_migrations` aus dem chore-Paket — mit Vendor-Fallback.

    Reihenfolge der Quellen:
    1. `monolith/vendor/chore/` (Build-Artefakt des Vercel-Builds, erzeugt
       von `monolith/sync_vendor.py`) — so wird der Runner nach einem
       Build benutzt.
    2. `services/chore-service/` (Repo-Quelle) — so funktioniert er
       direkt aus dem Repo, ohne Build.

    ACHTUNG, der Import-Pfad ist in beiden Faellen ein anderer:
    `sync_vendor.py` schreibt in den vendor-Dateien jedes `from app.x` zu
    `from chore.app.x` um (damit die vier Vendor-Pakete im Monolith
    disjunkte, deterministisch importierbare Namen haben). Im Repo ist
    das Paket dagegen schlicht `app`. Wer hier `monolith/vendor/chore` auf
    den Pfad legt und `app.database` importiert, laeuft in die falsche
    Datei bzw. in "No module named 'chore'".

    `run_migrations()` nutzt die Engine aus dem Modul selbst, und die
    liest `DATABASE_URL` aus der Umgebung. Deshalb wird hier keine eigene
    Engine fuer die Migration gebaut.
    """
    vendor_root = REPO_ROOT / "monolith" / "vendor"
    if (vendor_root / "chore" / "app" / "database.py").exists():
        sys.path.insert(0, str(vendor_root))
        from chore.app.database import run_migrations  # type: ignore

        return run_migrations, "monolith/vendor/chore"

    sys.path.insert(0, str(REPO_ROOT / "services" / "chore-service"))
    from app.database import run_migrations  # type: ignore

    return run_migrations, "services/chore-service"


def main() -> int:
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print(
            "FEHLER: DATABASE_URL ist nicht gesetzt.\n"
            "Beispiel:\n"
            "  DATABASE_URL='postgresql://user:pw@host:5432/db?sslmode=require' "
            "python3 scripts/run_migrations.py",
            file=sys.stderr,
        )
        return 2

    from sqlalchemy import create_engine, text

    url = database_url
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)

    # sslmode ausserhalb von localhost erzwingen (Supabase verlangt es),
    # ausser die URL setzt ihn selbst.
    connect_args = {}
    is_local = "localhost" in url or "127.0.0.1" in url
    if not is_local and "sslmode=" not in url:
        connect_args["sslmode"] = "require"

    try:
        run_migrations, source = _load_run_migrations()
    except Exception as exc:
        print(f"FEHLER: Migrations-Modul nicht ladbar: {exc}", file=sys.stderr)
        return 1

    print(f"Migrations-Quelle : {source}")
    # Host/DB ausgeben, aber niemals das Passwort.
    print(f"Ziel              : {url.split('@')[-1]}")

    engine = create_engine(url, pool_pre_ping=True, connect_args=connect_args)

    # 1) Schemas. `init-db.sql` legt sie an, `run_migrations()` setzt sie
    #    aber VORAUS (sein erstes Statement ist `CREATE TABLE
    #    chores.chores`). Auf einer DB, auf der `make migrate` nie
    #    gelaufen ist, bricht es sonst mit "schema chores does not exist"
    #    ab. Der Aufrufer dieses Skripts soll nicht wissen muessen, in
    #    welcher Reihenfolge das Repo die DB aufsetzt.
    #    (monolith/database.py::run_all_migrations() macht es genauso.)
    try:
        with engine.connect() as conn:
            for schema in ("chores", "logs", "notifications", "ai", "auth"):
                conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {schema}"))
            conn.commit()
    except Exception as exc:
        print(f"FEHLER: Schemas nicht anlegbar: {exc}", file=sys.stderr)
        engine.dispose()
        return 1

    # 2) App-Schema. `run_migrations()` committet selbst.
    try:
        run_migrations()
    except Exception as exc:
        print(f"FEHLER: Migration abgebrochen: {exc}", file=sys.stderr)
        engine.dispose()
        return 1

    # 3) VERIFIKATION. Eigene Engine, nur zum Nachsehen.
    try:
        with engine.connect() as conn:
            rooms = conn.execute(text("SELECT count(*) FROM chores.rooms")).scalar_one()
            has_column = conn.execute(
                text(
                    "SELECT count(*) FROM information_schema.columns "
                    "WHERE table_schema='chores' AND table_name='chores' "
                    "AND column_name='room_id'"
                )
            ).scalar_one()
            dave = conn.execute(
                text("SELECT is_personal FROM chores.rooms WHERE name = 'Dave'")
            ).scalar_one_or_none()
    except Exception as exc:
        print(f"FEHLER: Verifikation fehlgeschlagen: {exc}", file=sys.stderr)
        return 1
    finally:
        engine.dispose()

    if has_column != 1:
        print(
            "FEHLER: chores.chores.room_id fehlt nach der Migration.", file=sys.stderr
        )
        return 1

    print(f"OK: chores.rooms existiert ({rooms} Raeume), chores.room_id vorhanden.")

    # Der Dave-Raum traegt die Spezialbehandlung. Fehlt er, ist die
    # Migration formal durchgelaufen, das Feature aber unvollstaendig.
    if dave is None:
        print(
            "WARNUNG: Seed-Raum 'Dave' fehlt — rooms-Tabelle existed evtl. schon.",
            file=sys.stderr,
        )
    elif not dave:
        print("WARNUNG: 'Dave' ist nicht als is_personal markiert.", file=sys.stderr)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
