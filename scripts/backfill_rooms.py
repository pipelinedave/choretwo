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

ALLE Chores sind gelistet — 71 in Produktion. Das ist nicht theoretisch:
`GET /api/chores` hat `limit=10` als Default. Wer ohne Parameter
anfragt, sieht eine Seite und haelt sie fuer den Gesamtbestand. Die
Vollstaendigkeit wird von `scripts/_coverage_check.py` gegen die API
geprueft.

Erlaubt ist jeder der beiden Titel: der erwartete Vorher-Titel ODER
der Ziel-Titel. Sonst waere ein zweiter Lauf auf bereits backfillten
Daten eine Sackgasse — die vier umbenannten Chores haetten dann einen
Titel, der weder "Vorher" noch "Nachher" ist, und der Guard wuerde
ausloesen, obwohl das Zielbild längst erreicht ist.

IDEMPOTENZ
----------
Ein wiederholter Lauf aendert nichts: gleicher Raum, gleicher Titel,
Exit 0, "Geaendert: 0". Das gilt fuer den Lauf gegen den Ausgangs-
ZUSTAND wie gegen den bereits backfillten Datenbestand. Ohne
`--apply` passiert NICHTS — der Default ist ein reiner Dry-Run, damit
niemand versehentlich Produktionsdaten anfasst.

MEHRRAUM-CHORES
---------------
Sechs Chores nennen zwei Raeume im Titel ("Boden wischen Schlafzimmer
und Bad"), das Modell erlaubt aber genau einen Raum pro Chore. Ein
einziger stillschweigend gewaehlter Raum wuerde im Chip etwas anderes
zeigen als im Titel. Stattdessen wird jeder davon in zwei Chores
geteilt (pro Raum einer, Titel entzerrt) und das Original archiviert
— archiviert, nicht geloescht, damit die Historie nachvollziehbar
bleibt.

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
#
# ALLE 71 Chores der Produktionsdatenbank sind hier gelistet, dazu die
# 6 Splits. Vollstaendigkeit siehe _coverage_check.py.
BACKFILL = [
    # === Bad ===
    (5, "Duschkopf entkalken", "Bad", "Duschkopf entkalken"),
    (15, "Duschabfluss reinigen", "Bad", "Duschabfluss reinigen"),
    (54, "Bad Müll leeren und putzen", "Bad", "Müll leeren und putzen"),
    (63, "Bad Waschbecken wischen", "Bad", "Waschbecken wischen"),
    (64, "Klo putzen", "Bad", "Klo putzen"),
    (71, "Bad Spiegel putzen", "Bad", "Spiegel putzen"),
    (89, "Dusche putzen", "Bad", "Dusche putzen"),
    (103, "Tür Badezimmer wischen ", "Bad", "Tür wischen"),
    # === Kueche ===
    (6, "Kühlschrank innen wischen", "Küche", "Kühlschrank innen wischen"),
    (10, "Wasserkocher entkalken", "Küche", "Wasserkocher entkalken"),
    (
        14,
        "Küchen Oberschränke Top Staubwischen",
        "Küche",
        "Oberschränke Top Staubwischen",
    ),
    (23, "Küchenfronten abwischen ", "Küche", "Fronten abwischen"),
    (34, "Gefrierfach enteisen", "Küche", "Gefrierfach enteisen"),
    (48, "Dunstabzugshaube reinigen ", "Küche", "Dunstabzugshaube reinigen"),
    (65, "Küche Spülbecken wischen", "Küche", "Spülbecken wischen"),
    (
        83,
        "Küchenschubladen innen wischen & sortieren",
        "Küche",
        "Schubladen innen wischen & sortieren",
    ),
    (86, "Heisluftfriteuse säubern ", "Küche", "Heisluftfriteuse säubern"),
    (91, "Kochfelder reinigen", "Küche", "Kochfelder reinigen"),
    (92, "Boden wischen Küche", "Küche", "Boden wischen"),
    (93, "Mikrowelle reinigen ", "Küche", "Mikrowelle reinigen"),
    # === Wohnzimmer / Flur ===
    (33, "Fernbedienungen reinigen", "Wohnzimmer", "Fernbedienungen reinigen"),
    (39, "Briefkasten leeren", "Flur", "Briefkasten leeren"),
    (41, "Boden wischen Wohnzimmer", "Wohnzimmer", "Boden wischen"),
    (68, "Staubsaugen Sideboard", "Wohnzimmer", "Staubwischen Sideboard"),
    (70, "Sofa absaugen", "Wohnzimmer", "Sofa absaugen"),
    (74, "Fernseher wischen", "Wohnzimmer", "Fernseher wischen"),
    (78, "Couchtisch abwischen", "Wohnzimmer", "Couchtisch abwischen"),
    # === Schlafzimmer ===
    (80, "Bettwäsche wechseln ", "Schlafzimmer", "Bettwäsche wechseln"),
    (97, "Kopfkissen waschen", "Schlafzimmer", "Kopfkissen waschen"),
    (99, "Bettdecke waschen", "Schlafzimmer", "Bettdecke waschen"),
    # === Keller / Waschraum / Abwasch ===
    (
        40,
        "Waschmaschinen Pfleger anwenden",
        "Waschraum",
        "Waschmaschinen Pfleger anwenden",
    ),
    (
        52,
        "Sommer/Winterkleidung in Keller bringen",
        "Keller",
        "Sommer/Winterkleidung bringen",
    ),
    (76, "Waschmaschine putzen", "Waschraum", "Waschmaschine putzen"),
    (
        88,
        "Waschmaschine Wasser ablassen und Filter leeren",
        "Waschraum",
        "Wasser ablassen und Filter leeren",
    ),
    (101, "Wäsche waschen", "Waschraum", "Wäsche waschen"),
    (104, "Geschirr Abwasch", "Abwasch", "Geschirr Abwasch"),
    # === Garten ===
    (8, "Terrasse Bodenleisten säubern ", "Garten", "Bodenleisten säubern"),
    (47, "Terrasse Geländer wischen", "Garten", "Geländer wischen"),
    (55, "Terrasse fegen", "Garten", "Terrasse fegen"),
    (56, "Efeututen auffrischen", "Garten", "Efeututen auffrischen"),
    (58, "Pflanzen gießen ", "Garten", "Pflanzen gießen"),
    (96, "Drehtablett aufräumen ", "Garten", "Drehtablett aufräumen"),
    (98, "Pflanzen abstauben", "Garten", "Pflanzen abstauben"),
    # === Dave: personenbezogen ===
    (28, "Wiegen", "Dave", "Wiegen"),
    (
        57,
        "Router Neustart + Staub entfernen",
        "Dave",
        "Router Neustart + Staub entfernen",
    ),
    (60, "Rasieren", "Dave", "Rasieren"),
    (66, "Schreibtisch Staubwischen", "Dave", "Schreibtisch Staubwischen"),
    (82, "Seiten rasieren", "Dave", "Seiten rasieren"),
    (84, "Gesichtsmaske verwenden", "Dave", "Gesichtsmaske verwenden"),
    (87, "Tastatur reinigen", "Dave", "Tastatur reinigen"),
    (90, "Oneblade Klinge wechseln", "Dave", "Oneblade Klinge wechseln"),
    (94, "Fußnägel feilen ", "Dave", "Fußnägel feilen"),
    (100, "Fingernägel feilen", "Dave", "Fingernägel feilen"),
    (102, "Trinkflasche reinigen ", "Dave", "Trinkflasche reinigen"),
    # === Hausweit: nicht raumspezifisch, bewusst OHNE Raum ===
    # Entsorgung laeuft hausweit, nicht in einem Raum. Gleiche Logik wie
    # Papiermuell: kein Chip, statt einen Raum zu behaupten, der nicht da ist.
    (61, "Papiermüll", None, "Papiermüll"),
    (67, "Pfand wegbringen", None, "Pfand wegbringen"),
    (69, "Altglas wegbringen ", None, "Altglas wegbringen"),
    (79, "Restmüll", None, "Restmüll"),
    (81, "Recyclingmüll", None, "Recyclingmüll"),
    # Hausweite Aufgaben ueber mehrere Raeume. Ein Split wuerde hier eine
    # Raumliste erfinden, die im Titel nicht steht — deshalb kein Raum.
    (17, "Fenster außen putzen", None, "Fenster außen putzen"),
    (
        51,
        "Türgriffe & Lichtschalter desinfizieren",
        None,
        "Türgriffe & Lichtschalter desinfizieren",
    ),
    (62, "Fenster innen putzen", None, "Fenster innen putzen"),
    (72, "Lampen und Leuchten abstauben", None, "Lampen und Leuchten abstauben"),
    # Mehrdeutig, per Entscheidung so aufgeloest
    (53, "Teppich reinigen", "Wohnzimmer", "Teppich reinigen"),
    (95, "Glastür reinigen", "Garten", "Glastür reinigen"),
]

# === Mehrraum-Chores -> Einzelschores ==================================
#
# Das Modell erlaubt pro Chore genau EINEN Raum, sechs Chores nennen aber
# zwei. Statt einen davon stillschweigend auszuwaehlen (und damit im Titel
# zwei Raeume, im Chip aber einen zu zeigen) wird jeder davon in zwei
# Chores geteilt und das Original archiviert.
#
# (original_id, erwarteter_titel, [(raum, titel), (raum, titel)])
SPLIT_MULTIROOM = [
    (
        20,
        "Bodenleisten Wohnzimmer und Küche säubern",
        [("Wohnzimmer", "Bodenleisten säubern"), ("Küche", "Bodenleisten säubern")],
    ),
    (
        37,
        "Boden wischen Schlafzimmer und Bad",
        [("Schlafzimmer", "Boden wischen"), ("Bad", "Boden wischen")],
    ),
    (
        59,
        "Staubsaugen Wohnzimmer und Küche ",
        [("Wohnzimmer", "Staubsaugen"), ("Küche", "Staubsaugen")],
    ),
    (
        73,
        "Bodenleisten Schlafzimmer und Bad säubern ",
        [("Schlafzimmer", "Bodenleisten säubern"), ("Bad", "Bodenleisten säubern")],
    ),
    (
        75,
        "Spiegel Wohnzimmer & Diele putzen",
        [("Wohnzimmer", "Spiegel putzen"), ("Flur", "Spiegel putzen")],
    ),
    (
        85,
        "Staubsaugen Schlafzimmer und Bad",
        [("Schlafzimmer", "Staubsaugen"), ("Bad", "Staubsaugen")],
    ),
]


def sequence_needs_sync(session) -> bool:
    """True, wenn die ID-Sequence hinter der groessten ID zurueckliegt."""
    from sqlalchemy import text

    row = session.execute(
        text("SELECT last_value FROM chores.chores_id_seq")
    ).scalar_one_or_none()
    max_id = session.execute(
        text("SELECT COALESCE(MAX(id), 0) FROM chores.chores")
    ).scalar_one()
    return row is None or row < max_id


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

    from sqlalchemy import create_engine, text

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
                # Erlaubt ist der Vorher-Titel ODER der Ziel-Titel. Damit
                # bleibt der Guard scharf (ein wirklich unbekannter Chore
                # faellt durch), ohne dass ein zweiter Lauf auf bereits
                # backfillten Daten in einer Sackgasse endet.
                if chore.name not in (expected, new_title):
                    problems.append(
                        f"Chore {chore_id}: Titel weicht ab.\n"
                        f"    erwartet: {expected!r}\n"
                        f"    oder Ziel: {new_title!r}\n"
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

            # === Mehrraum-Chores aufteilen =============================
            #
            # Läuft NACH der Raum-Zuordnung und im selben Commit: ein
            # halb gesplitteter Bestand (Original archiviert, aber die
            # beiden Ersatz-Chores fehlen) waere schlimmer als gar nichts.
            split_created = 0
            for chore_id, expected, targets in SPLIT_MULTIROOM:
                chore = session.query(Chore).filter(Chore.id == chore_id).one_or_none()
                if chore is None:
                    problems.append(
                        f"Split-Quelle {chore_id} existiert nicht "
                        f"(erwarteter Titel: {expected!r})"
                    )
                    continue

                # Schon gesplittet? Dann ist das Original archiviert und
                # die Ziel-Chores existieren. Beides pruefen, sonst legt
                # ein zweiter Lauf Duplikate an.
                already = all(
                    session.query(Chore)
                    .filter(Chore.name == title, Chore.archived.is_(False))
                    .first()
                    is not None
                    for _, title in targets
                )
                if already and chore.archived:
                    print(f"  [=] {chore_id:>3} {expected!r} — bereits aufgeteilt")
                    continue

                if chore.name != expected and not chore.archived:
                    problems.append(
                        f"Split-Quelle {chore_id}: Titel weicht ab.\n"
                        f"    erwartet: {expected!r}\n"
                        f"    in der DB: {chore.name!r}"
                    )
                    continue

                missing_rooms = [r for r, _ in targets if r not in rooms]
                if missing_rooms:
                    problems.append(
                        f"Split-Quelle {chore_id}: Raum(e) fehlen: {missing_rooms}"
                    )
                    continue

                # Sequence synchronisieren, BEVOR hier etwas eingefuegt
                # wird. `id` ist SERIAL: die Sequence vergibt die naechste
                # ID, ohne den Tabelleninhalt zu kennen. Wer die Chores
                # einmal mit expliziten IDs importiert hat (Dump-Restore,
                # Datenmigration, Test-Seed) — und das ist in diesem Repo
                # passiert — steht die Sequence weiter hinten als der
                # groesste vorhandene ID. Der erste INSERT laeuft dann in
                # `duplicate key value violates unique constraint
                # "chores_pkey"` und bricht den ganzen Lauf ab, statt
                # einfach die naechste ID zu nehmen.
                if apply and sequence_needs_sync(session):
                    session.execute(
                        text(
                            "SELECT setval("
                            "pg_get_serial_sequence('chores.chores', 'id'), "
                            "COALESCE((SELECT MAX(id) FROM chores.chores), 1)"
                            ")"
                        )
                    )
                    print("  [i] chores.chores_id_seq auf MAX(id) synchronisiert")

                print(f"  [S] {chore_id:>3} {expected!r} -> {len(targets)} Chores")
                for room_name, title in targets:
                    print(f"        + {title!r} ({room_name})")
                    split_created += 1
                    if apply:
                        new_chore = Chore(
                            name=title,
                            interval_days=chore.interval_days,
                            due_date=chore.due_date,
                            done=False,
                            room_id=rooms[room_name],
                        )
                        session.add(new_chore)
                if apply:
                    # Original archivieren statt loeschen: die Historie
                    # bleibt nachvollziehbar, und ein Rueckbau ist eine
                    # Zeile Aenderung.
                    chore.archived = True

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

            if apply and (changed or split_created):
                session.commit()
                print()
                print(
                    f"Commit: {changed} Chore(s) angepasst, "
                    f"{split_created} Chore(s) neu aus dem Split."
                )
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
    if not apply and (changed or split_created):
        print()
        print("Das war ein Dry-Run. Mit --apply wird geschrieben.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
