"""Regressionstests: done-Flag-Re-Arm nach Zyklus-Ablauf + List/Detail-Feldkonsistenz.

BUG 1 (Prod, 03.11.2026, choretwo.stillon.top):
`done` war ein globales Bool am Chore. mark_done setzte done=True und schob
due_date auf den naechsten Zyklus — verstrich dieser, blieb done=True fuer
immer kleben (Beweis: Chore 28 "Wiegen" und Chore 60 "Rasieren" waren real
ueberfaellig, appseitig aber "erledigt").

Korrektes Modell: done ist ZYKLUSbezogen. Der Chore gilt genau dann als
erledigt, wenn done=True UND die naechste Faeligkeit (due_date) noch in der
Zukunft liegt. Ab dem Faellichkeitstag ist der neue Zyklus offen.

BUG 2: GET /api/chores (Liste) lieferte new_due_date=null, waehrend
GET /api/chores/{id} (Detail) das Datum enthielt. Liste und Detail muessen
dieselben Felder liefern.

FOLGE: Buckets/Stats zaehlen Chores mit klebendem done-Flag falsch
("22 overdue", obwohl laut App alles erledigt war).
"""

import os
from datetime import date, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker
from starlette.testclient import TestClient

# Muss VOR app-Import stehen (conftest setzt es per setdefault, hier nochmal
# explizit, falls dieses Modul standalone geladen wird).
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

from app.database import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base, Chore  # noqa: E402
from app.services.chore_service import get_chore_bucket_counts, get_chore_stats  # noqa: E402
from app.services.recurrence import is_chore_overdue  # noqa: E402

FAKE_EMAIL = "test@example.com"
TODAY = date.today()


@pytest.fixture
def db():
    """In-Memory-SQLite-Session mit Chore-Schema (Schema-Praefix fuer SQLite entfernt)."""
    for table in Base.metadata.tables.values():
        table.schema = None
    engine = create_engine(
        "sqlite:///:memory:",
        # TestClient fuehrt die App in einem anderen Thread aus — die
        # geteilte In-Memory-Verbindung muss thread-uebergreifend nutzbar sein.
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()


@pytest.fixture
def client(db):
    """TestClient, dessen get_db auf die Test-Session zeigt."""
    # Kein `with`: wie im bestehenden conftest-Client-Fixture wird der
    # Lifespan (run_migrations, Postgres-DDL) bewusst NICHT gefahren —
    # die Tabellen kommen aus Base.metadata.create_all oben.
    app.dependency_overrides[get_db] = lambda: db
    yield TestClient(app, base_url="http://test", headers={"X-User-Email": FAKE_EMAIL})
    app.dependency_overrides.pop(get_db, None)


def _mk(db, name, *, interval=7, due=None, done=False, last_done=None, done_by=None):
    chore = Chore(
        name=name,
        interval_days=interval,
        due_date=due or TODAY,
        done=done,
        last_done=last_done,
        done_by=done_by,
    )
    db.add(chore)
    db.commit()
    db.refresh(chore)
    return chore


def _api_chore(client, chore_id):
    r = client.get(f"/api/chores/{chore_id}")
    assert r.status_code == 200
    return r.json()


def _list_item(client, chore_id):
    r = client.get("/api/chores/?page=1&limit=100")
    assert r.status_code == 200
    for item in r.json():
        if item["id"] == chore_id:
            return item
    pytest.fail(f"Chore {chore_id} fehlt in der Liste")


# ── Bug 1: Zyklus-Ablauf muss den Chore re-armen ──────────────────────


def test_mark_done_opens_next_cycle(client, db):
    """Baseline: mark_done -> done=True, due_date = heute + Interval."""
    chore = _mk(db, "Baseline", interval=7, due=TODAY)
    r = client.put(f"/api/chores/{chore.id}/done", json={"done_by": FAKE_EMAIL})
    assert r.status_code == 200
    body = r.json()
    assert body["done"] is True
    assert body["new_due_date"] == (TODAY + timedelta(days=7)).isoformat()


def test_expired_cycle_rearms_chore(client, db):
    """Der Prod-Fall (Chore 28 'Wiegen'): done=True, aber due_date verstrichen
    -> der Chore muss in Liste UND Detail wieder als offen erscheinen."""
    chore = _mk(
        db,
        "Wiegen",
        interval=7,
        due=TODAY - timedelta(days=17),  # verstrichener Zyklus
        done=True,
        last_done=TODAY - timedelta(days=24),
        done_by="kingovi@gmail.com",
    )
    assert _api_chore(client, chore.id)["done"] is False
    assert _list_item(client, chore.id)["done"] is False


def test_due_today_rearms_chore(client, db):
    """Am Faellichkeitstag selbst ist der neue Zyklus offen (faellig heute)."""
    chore = _mk(
        db,
        "Heute faellig",
        interval=4,
        due=TODAY,
        done=True,
        last_done=TODAY - timedelta(days=4),
    )
    assert _api_chore(client, chore.id)["done"] is False
    assert _list_item(client, chore.id)["done"] is False


def test_running_cycle_stays_done(client, db):
    """done=True UND due_date in der Zukunft -> Zyklus laeuft noch, bleibt erledigt."""
    chore = _mk(
        db,
        "Laeuft noch",
        interval=7,
        due=TODAY + timedelta(days=3),
        done=True,
        last_done=TODAY - timedelta(days=4),
    )
    assert _api_chore(client, chore.id)["done"] is True
    assert _list_item(client, chore.id)["done"] is True


def test_mark_done_after_rearm_starts_new_cycle(client, db):
    """Ein re-armter (klebender) Chore kann wieder abgehakt werden und
    startet damit einen sauberen neuen Zyklus."""
    chore = _mk(
        db,
        "Klebend",
        interval=7,
        due=TODAY - timedelta(days=1),
        done=True,
        last_done=TODAY - timedelta(days=8),
    )
    r = client.put(f"/api/chores/{chore.id}/done", json={"done_by": FAKE_EMAIL})
    assert r.status_code == 200
    body = r.json()
    assert body["done"] is True
    assert body["due_date"] == (TODAY + timedelta(days=7)).isoformat()
    assert body["last_done"] == TODAY.isoformat()


def test_double_done_same_day_still_rejected(client, db):
    """Schutz bleibt: zweimal am selben Tag abhaken -> 409."""
    chore = _mk(
        db,
        "Doppelt",
        interval=7,
        due=TODAY + timedelta(days=7),
        done=True,
        last_done=TODAY,
    )
    r = client.put(f"/api/chores/{chore.id}/done", json={"done_by": FAKE_EMAIL})
    assert r.status_code == 409


# ── Bug 2: Liste und Detail liefern dieselben Felder ──────────────────


def test_list_and_detail_fields_identical(client, db):
    """done, last_done, due_date und new_due_date muessen in Liste und
    Detail identisch sein — inkl. new_due_date, das die Liste vorher
    immer als null lieferte."""
    chore = _mk(
        db,
        "Feldkonsistenz",
        interval=7,
        due=TODAY + timedelta(days=5),
        done=True,
        last_done=TODAY - timedelta(days=2),
    )
    detail = _api_chore(client, chore.id)
    item = _list_item(client, chore.id)

    for field in ("done", "last_done", "due_date", "new_due_date"):
        assert item[field] == detail[field], (
            f"Feld '{field}' unterscheidet sich zwischen Liste ({item[field]!r}) "
            f"und Detail ({detail[field]!r})"
        )
    assert detail["new_due_date"] == (TODAY + timedelta(days=5)).isoformat()


def test_list_includes_new_due_date_for_expired_cycle(client, db):
    """Auch ein klebender (re-armter) Chore liefert in der Liste ein
    konsistentes new_due_date (= due_date)."""
    chore = _mk(
        db,
        "Klebend-Felder",
        interval=7,
        due=TODAY - timedelta(days=2),
        done=True,
        last_done=TODAY - timedelta(days=9),
    )
    detail = _api_chore(client, chore.id)
    item = _list_item(client, chore.id)
    assert item["new_due_date"] == detail["new_due_date"]
    assert item["new_due_date"] == (TODAY - timedelta(days=2)).isoformat()


# ── Folge-Bug: Stats & Buckets zaehlen nur offene Chores ──────────────


def test_stats_count_rearmed_chore_as_overdue(db):
    """Klebender Chore (done=True, due verstrichen) ist effektiv offen und
    damit overdue — ein laufender Zyklus zaehlt in KEINE Kategorie."""
    _mk(
        db,
        "ueberfaellig-klebend",
        interval=7,
        due=TODAY - timedelta(days=1),
        done=True,
        last_done=TODAY - timedelta(days=8),
    )
    _mk(
        db,
        "laeuft-noch",
        interval=7,
        due=TODAY + timedelta(days=3),
        done=True,
        last_done=TODAY - timedelta(days=4),
    )
    stats = get_chore_stats(db, FAKE_EMAIL)
    assert stats["overdue"] == 1
    assert stats["due_soon"] == 0
    assert stats["on_track"] == 0
    assert stats["total"] == 2


def test_buckets_exclude_running_cycle_and_count_rearmed(db):
    """Buckets zaehlen nur effektiv offene Chores:
    - klebender Chore (due verstrichen) -> overdue
    - offener Chore (due heute)         -> today
    - laufender Zyklus (due Zukunft)    -> GAR NICHT (auch nicht thisWeek/upcoming)
    'all' ist die Summe der Buckets."""
    _mk(
        db,
        "ueberfaellig-klebend",
        interval=7,
        due=TODAY - timedelta(days=1),
        done=True,
        last_done=TODAY - timedelta(days=8),
    )
    _mk(db, "heute-offen", interval=7, due=TODAY)
    _mk(
        db,
        "laeuft-noch",
        interval=7,
        due=TODAY + timedelta(days=3),
        done=True,
        last_done=TODAY - timedelta(days=4),
    )
    _mk(
        db,
        "upcoming-offen",
        interval=30,
        due=TODAY + timedelta(days=20),
    )
    buckets = get_chore_bucket_counts(db, FAKE_EMAIL)
    assert buckets["overdue"] == 1
    assert buckets["today"] == 1
    assert buckets["tomorrow"] == 0
    assert buckets["thisWeek"] == 0  # 'laeuft-noch' (due +3) zaehlt nicht
    assert buckets["upcoming"] == 1
    assert buckets["all"] == 3


def test_is_chore_overdue_respects_cycle_rearm(db):
    stuck = _mk(
        db,
        "klebend-ueberfaellig",
        interval=7,
        due=TODAY - timedelta(days=1),
        done=True,
        last_done=TODAY - timedelta(days=8),
    )
    running = _mk(
        db,
        "laeuft-noch",
        interval=7,
        due=TODAY + timedelta(days=3),
        done=True,
        last_done=TODAY - timedelta(days=4),
    )
    assert is_chore_overdue(stuck) is True
    assert is_chore_overdue(running) is False
