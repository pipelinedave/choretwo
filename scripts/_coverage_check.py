#!/usr/bin/env python3
"""Prueft, ob BACKFILL + SPLIT_MULTIROOM jeden Chore der DB abdecken.

WARUM DIESES SKRIPT ES GIBT
---------------------------
`GET /api/chores` hat `limit=10` als Default. Ein Aufruf ohne Parameter
liefert also eine SEITE und nicht den Bestand. Genau das ist passiert:
Es wurden 71 Chores angenommen, weil die API zehn lieferte, und darauf
hin nur diese zehn einem Raum zugeordnet.

Ein Backfill, der stillschweigend einen Teil des Bestands auslaesst,
ist das Schlimmste an so einem Werkzeug — es sieht erfolgreich aus.
Deshalb wird die Abdeckung hier aktiv geprueft, gegen die DB oder
gegen einen API-Dump.

BEISPIEL
--------
    # aus der laufenden App
    python3 scripts/_coverage_check.py --api https://choretwo.stillon.top

    # aus einem Dump
    python3 scripts/_coverage_check.py --json /tmp/chores.json

Exit 0 = vollstaendig, Exit 1 = Luecke oder unbekannte ID.
"""

import argparse
import json
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from backfill_rooms import BACKFILL, SPLIT_MULTIROOM  # noqa: E402


def fetch(api: str) -> list:
    # limit=100 ist das Maximum des Endpoints (le=100). Ohne das
    # bekommt man 10 zurueck und haelt sie fuer alles.
    url = f"{api.rstrip('/')}/api/chores?limit=100"
    with urllib.request.urlopen(url, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--api", help="Basis-URL, z.B. https://choretwo.stillon.top")
    ap.add_argument("--json", help="Pfad zu einem API-Dump (Array von Chores)")
    args = ap.parse_args()

    if args.json:
        chores = json.loads(Path(args.json).read_text(encoding="utf-8"))
    elif args.api:
        chores = fetch(args.api)
    else:
        print("Fehler: --api oder --json noetig.", file=sys.stderr)
        return 2

    # `limit=100` ist die Obergrenze. Wer mehr Chores hat, bekommt
    # abgeschnittene Daten — das muss hier auffallen, nicht spaeter.
    if len(chores) >= 100:
        print(
            f"FEHLER: {len(chores)} Chores geliefert — das ist das Limit des "
            "Endpunkts (limit=100). Es koennen mehr sein; Abdeckung nicht "
            "verlaesslich prüfbar.",
            file=sys.stderr,
        )
        return 1

    ids = {c["id"] for c in chores}
    names = {c["id"]: c["name"] for c in chores}

    covered = {cid for cid, *_ in BACKFILL} | {cid for cid, *_ in SPLIT_MULTIROOM}
    # Gesplittete Quellen sind in BACKFILL nicht nochmal enthalten.
    missing = sorted(ids - covered)
    unknown = sorted(covered - ids)

    print(f"Chores in der DB        : {len(ids)}")
    print(f"Durch BACKFILL erfasst   : {len({cid for cid, *_ in BACKFILL})}")
    print(f"Als Split-Quelle         : {len(SPLIT_MULTIROOM)}")
    print(f"Fehlend (kein Mapping)   : {missing or 'keine'}")
    print(f"Unbekannte IDs im Mapping: {unknown or 'keine'}")

    if missing:
        print(file=sys.stderr)
        for cid in missing:
            print(f"  ! {cid:>3} {names[cid]!r} hat keinen Raum", file=sys.stderr)

    if unknown:
        print(file=sys.stderr)
        for cid in unknown:
            print(
                f"  ! {cid:>3} steht im Skript, existiert aber nicht", file=sys.stderr
            )

    # Titel-Drift: der Guard im Backfill bricht bei Abweichung ab. Der
    # Check sagt hier vorher Bescheid, was sich geaendert hat.
    drift = []
    for cid, expected, new_title in [(b[0], b[1], b[3]) for b in BACKFILL]:
        if cid in names and names[cid] not in (expected, new_title):
            drift.append((cid, expected, new_title, names[cid]))
    for cid, expected, _ in [(s[0], s[1], None) for s in SPLIT_MULTIROOM]:
        if cid in names and names[cid] != expected:
            drift.append((cid, expected, None, names[cid]))

    if drift:
        print()
        print("Titel weichen ab (der Backfill wuerde abbrechen):")
        for cid, expected, new_title, actual in drift:
            target = f" oder Ziel: {new_title!r}" if new_title else ""
            print(f"  ! {cid:>3} erwartet {expected!r}{target} — in der DB: {actual!r}")

    if missing or unknown:
        print()
        print("ERGEBNIS: NICHT VOLLSTAENDIG.", file=sys.stderr)
        return 1

    print()
    print("ERGEBNIS: vollstaendig — jeder Chore hat genau eine Zuordnung.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
