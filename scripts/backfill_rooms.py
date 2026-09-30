#!/usr/bin/env python3
"""Backfill: bestehende Chores einem Raum zuordnen und Titel entzerren.

ANLASS
------
Die rooms-Migration legt die Tabelle an und seedet die Raeume, setzt aber
bewusst KEINEN Raum an bestehenden Chores — `room_id` ist nullable, es
gibt keinen Breaking-Change. Damit startet die App aber mit zehn Chores,
die keinen Raum haben und im ChoreCard deshalb kein Raum-Chip zeigen.

Dieses Skript ist die Daten-Gegenstuecke zur DDL: es weist die Chores
logisch zu und entzerrt die Titel, weil der Raum jetzt als Chip neben dem
Titel steht.

DIE ZUORDNUNG IST EINE DOMAENENTSCHEIDUNG
-----------------------------------------
Sie ist hier bewusst als explizite Tabelle ausgeschrieben und NICHT
automatisch aus dem Titel erraten. "Kühlschrank innen wischen" gehoert in
die Küche, "Wiegen" in den Raum "Dave", und "Papiermüll" ist hausweit
und bekommt deshalb gar keinen Raum. Ein Heuristik-Scraper wuerde genau
diese Faelle falsch treffen.

DESHALB: Doppelter Schluessel
-----------------------------
Jeder Eintrag nennt Chore-ID **und** den aktuell erwarteten Titel. Stimmt
beides nicht, bricht das Skript ab, statt einen unbekannten Chore zu
treffen. Grund: Chore-IDs sind in einer Fremd-DB nicht stabil, und ein
Backfill, der still auf die falsche Zeile schreibt, ist schlimmer als
einer, der abbricht.

IDEMPOTENZ
----------
Wird ein Chore erneut ausgefuehrt, aendert sich nichts (gleicher Raum,
gleicher Titel). Der Lauf ist damit gefahrlos wiederholbar. Ohne
`--apply` passiert NICHTS — der Default ist ein reiner Dry-Run, damit
niemand versehentlich Produktionsdaten anfasst.

BEISPIEL
--------
    # 1) Dry-Run: zeigt, was passieren wuerde
    DATABASE_URL='postgresql://...' python3 scripts/backfill_rooms.py

    # 2) Schreiben
    DATABASE_URL='postgresql://...' python3 scripts/backfill_rooms.py --apply
"""

import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]

# (chore_id, erwarteter_aktueller_titel, raum_name_oder_None, neuer_titel)
#
# `None` als Raum heisst bewusst: diesen Chore nicht raumlich zuordnen.
# `neuer_titel == erwarteter_titel` heisst: Titel bleibt unveraendert.
BACKFILL = [
    # --- Kueche: vier Chores, drei davon mit redundantem "Kuechen-" im Titel
    (86, "Heisluftfriteuse säubern ", "Küche", "Heisluftfriteuse säubern"),
    (23, "Küchenfronten abwischen ", "Küche", "Fronten abwischen"),
    (
        83,
        "Küchenschubladen innen wischen & sortieren",
        "Küche",
        "Schubladen innen wischen & sortieren",
    ),
    (6, "Kühlschrank innen wischen", "Küche", "Kühlschrank innen wischen"),
    # --- Wohnzimmer / Flur
    (33, "Fernbedienungen reinigen", "Wohnzimmer", "Fernbedienungen reinigen"),
    (39, "Briefkasten leeren", "Flur", "Briefkasten leeren"),
    # --- Dave: personenbezogene Chores
    (84, "Gesichtsmaske verwenden", "Dave", "Gesichtsmaske verwenden"),
    (102, "Trinkflasche reinigen ", "Dave", "Trinkflasche reinigen"),
    (28, "Wiegen", "Dave", "Wiegen"),
    # --- Hausweit, nicht raumspezifisch: bewusst ohne Raum
    (61, "Papiermüll", None, "Papiermüll"),
]


def _load_orm():
    """Holt Session/Model aus dem chore-Paket — mit Vendor-Fallback.

    Identisch zur Aufloesung in `scripts/run_migrations.py`, inklusive des
    Importpfad-Unterschieds: `sync_vendor.py` schreibt in den vendor-Dateien
    jedes `from app.x` zu `from chore.app.x`. Wer hier den Vendor-Pfad nimmt
    und `app.database` importiert, laeuft in "No module named 'chore'".
    """
    vendor_root = REPO_ROOT / "monolith" / "vendor"
    if (vendor_root / "chore" / "app" / "database.py").exists():
        sys.path.insert(0, str(vendor_root))
        from chore.app.database import SessionLocal  # type: ignore
        from chore.app.models import Chore, Room  # type: ignore

        return SessionLocal, Chore, Room, "monolith/vendor/chore"

    sys.path.insert(0, str(REPO_ROOT / "services" / "chore-service"))
    from app.database import SessionLocal  # type: ignore
    from app.models import Chore, Room  # type: ignore

    return SessionLocal, Chore, Room, "services/chore-service"


def main() -> int:
    apply = "--apply" in sys.argv[1:]
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print(
            "FEHLER: DATABASE_URL ist nicht gesetzt.\n"
            "Beispiel:\n"
            "  DATABASE_URL='postgresql://user:pw@host:5432/db?sslmode=require' "
            "python3 scripts/backfill_rooms.py --apply",
            file=sys.stderr,
        )
        return 2

    url = database_url
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    connect_args = {}
    if ("localhost" not in url and "127.0.0.1" not in url) and "sslmode=" not in url:
        connect_args["sslmode"] = "require"

    from sqlalchemy import create_engine

    engine = create_engine(url, pool_pre_ping=True, connect_args=connect_args)

    try:
        SessionLocal, Chore, Room, source = _load_orm()
    except Exception as exc:
        print(f"FEHLER: ORM nicht ladbar: {exc}", file=sys.stderr)
        return 1

    print(f"Modell-Quelle     : {source}")
    print(f"Ziel              : {url.split('@')[-1]}")
    print(
        f"Modus             : {'SCHREIBEN' if apply else 'DRY-RUN (nichts wird geschrieben)'}"
    )
    print()

    changed = 0
    skipped = 0
    problems = []

    try:
        with SessionLocal(bind=engine) as session:
            rooms = {r.name: r.id for r in session.query(Room).all()}
            print(f"Raeume in der DB  : {', '.join(sorted(rooms)) or '(keine)'}")
            print()

            for chore_id, expected, room_name, new_title in BACKFILL:
                chore = session.query(Chore).filter(Chore.id == chore_id).one_or_none()
                if chore is None:
                    problems.append(
                        f"Chore {chore_id} existiert nicht "
                        f"(erwarteter Titel: {expected!r})"
                    )
                    continue
                if chore.name != expected:
                    problems.append(
                        f"Chore {chore_id}: Titel weicht ab.\n"
                        f"    erwartet: {expected!r}\n"
                        f"    in der DB: {chore.name!r}"
                    )
                    continue

                target_room = None
                if room_name is not None:
                    if room_name not in rooms:
                        problems.append(
                            f"Chore {chore_id}: Raum {room_name!r} existiert nicht. "
                            f"Seed-Raum zuerst anlegen (scripts/run_migrations.py)."
                        )
                        continue
                    target_room = rooms[room_name]

                room_changed = chore.room_id != target_room
                title_changed = chore.name != new_title
                if not room_changed and not title_changed:
                    skipped += 1
                    print(f"  [=] {chore_id:>3} {chore.name!r} — bereits korrekt")
                    continue

                changed += 1
                bits = []
                if room_changed:
                    bits.append(f"Raum -> {room_name or '(kein Raum)'}")
                if title_changed:
                    bits.append(f"Titel -> {new_title!r}")
                print(f"  [~] {chore_id:>3} {chore.name!r}: {'; '.join(bits)}")

                if apply:
                    chore.room_id = target_room
                    chore.name = new_title

            if problems:
                print(file=sys.stderr)
                print("ABBRUCH — Datenlage passt nicht zum Skript:", file=sys.stderr)
                for p in problems:
                    print(f"  ! {p}", file=sys.stderr)
                print(
                    "\nNichts geschrieben. Skript anpassen oder Chores im UI "
                    "korrigieren, dann erneut laufen lassen.",
                    file=sys.stderr,
                )
                return 1

            if apply and changed:
                session.commit()
                print()
                print(f"Commit: {changed} Chore(s) geschrieben.")
            elif apply:
                session.commit()
                print()
                print("Commit: nichts zu tun (alles bereits korrekt).")
    except Exception as exc:
        print(f"FEHLER: {exc}", file=sys.stderr)
        return 1
    finally:
        engine.dispose()

    print(f"Geaendert: {changed}   Unveraendert: {skipped}")
    if not apply and changed:
        print()
        print("Das war ein Dry-Run. Mit --apply wird geschrieben.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
