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
(`services/chore-service/app/database.py::run_migrations()`) — es gibt
damit keine zweite, abweichende Kopie des DDL.

BEISPIEL
--------
    # lokal (Compose oder direkt)
    DATABASE_URL='postgresql://...' python3 scripts/run_migrations.py

    # via make (liest DATABASE_URL aus der Umgebung)
    make migrate-app

Idempotent: mehrfaches Ausfuehren ist unschaedlich.
"""

import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]


def _load_migrate_rooms():
    """Holt `migrate_rooms` aus dem chore-Paket — mit Vendor-Fallback.

    Reihenfolge der Quellen:
    1. `monolith/vendor/chore/app/migrations.py` (Build-Artefakt des
       Vercel-Builds, monolith/sync_vendor.py) — so wird der Runner
       nach einem `sync_vendor.py` benutzt.
    2. `services/chore-service/app/migrations.py` (Repo-Quelle) — so
       funktioniert es direkt aus dem Repo, ohne Build.
    """
    vendor = REPO_ROOT / "monolith" / "vendor" / "chore"
    if (vendor / "app" / "migrations.py").exists():
        sys.path.insert(0, str(vendor))
        from app.migrations import migrate_rooms  # type: ignore

        return migrate_rooms, "monolith/vendor/chore"

    sys.path.insert(0, str(REPO_ROOT / "services" / "chore-service"))
    from app.migrations import migrate_rooms  # type: ignore

    return migrate_rooms, "services/chore-service"


def main() -> int:
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print(
            "FEHLER: DATABASE_URL ist nicht gesetzt.\n"
            "Beispiel:\n"
            "  DATABASE_URL='postgresql://user:pw@host:5432/db?sslmode=require' \\\n"
            "    python3 scripts/run_migrations.py",
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
        migrate_rooms, source = _load_migrate_rooms()
    except Exception as exc:
        print(f"FEHLER: Migrations-Modul nicht ladbar: {exc}", file=sys.stderr)
        return 1

    print(f"Migrations-Quelle : {source}")
    # Host/DB nicht das Passwort ausgeben.
    safe_url = url.split("@")[-1]
    print(f"Ziel              : {safe_url}")

    engine = create_engine(url, pool_pre_ping=True, connect_args=connect_args)
    try:
        with engine.connect() as conn:
            migrate_rooms(conn)
            conn.commit()
            rooms = conn.execute(text("SELECT count(*) FROM chores.rooms")).scalar_one()
            has_column = conn.execute(
                text(
                    "SELECT count(*) FROM information_schema.columns "
                    "WHERE table_schema='chores' AND table_name='chores' "
                    "AND column_name='room_id'"
                )
            ).scalar_one()
    except Exception as exc:
        print(f"FEHLER: Migration abgebrochen: {exc}", file=sys.stderr)
        return 1
    finally:
        engine.dispose()

    if has_column != 1:
        print(
            "FEHLER: chores.chores.room_id fehlt nach der Migration.",
            file=sys.stderr,
        )
        return 1

    print(f"OK: chores.rooms existiert ({rooms} Raeume), chores.room_id vorhanden.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
