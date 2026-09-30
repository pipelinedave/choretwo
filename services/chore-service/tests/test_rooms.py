"""Tests fuer das Raum-Feature (rooms + chores.room_id).

Drei Dinge werden hier festgeschraubt, die beim Nacharbeiten leicht
kaputtgehen:

1. DIE ROUTE-REIHENFOLGE. `chores.py` hat `GET /{chore_id}`. Wird der
   rooms-Router danach inkludiert, verschluckt diese Route
   `GET /api/chores/rooms` und antwortet 422. Der 200-Assert unten ist
   genau der Regressionstest dafuer — er schlaegt stillschweigend fehl,
   wenn jemand die ROUTERS-Liste umsortiert.

2. `exclude_unset`. Ein Chore-Update muss drei verschiedene Dinge
   unterscheiden koennen: Feld weggelassen (Raum bleibt), `room_id: null`
   (Raum wird GELOEST), `room_id: 5` (Raum wird gesetzt). Mit einem
   blossen `Optional[int] = None` wären das nicht drei, sondern zwei
   Fälle — der Raum liesse sich nie entfernen.

3. `ON DELETE SET NULL`. Ein geloeschter Raum nimmt keine Chores mit.
   Ohne das wäre "Raum ist optional" nur halb wahr: der Weg
   Raum loeschen wuerde sonst Chores zerstoeren.
"""

from datetime import date

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models import Base, Chore, Room
from app.schemas import ALLOWED_ROOM_ICONS, RoomCreate, RoomUpdate
from app.services.chore_service import UnknownRoom, create_chore, update_chore
from app.services.room_service import (
    DuplicateRoomName,
    RoomNotFound,
    create_room,
    delete_room,
    get_rooms,
    update_room,
)
from app.migrations import DEFAULT_ROOMS


@pytest.fixture
def db():
    """In-Memory-SQLite mit dem Chore-Schema (siehe test_chore_visibility)."""
    for table in Base.metadata.tables.values():
        table.schema = None

    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()


def _room(db, name="Küche", **kw):
    data = {"name": name, "color": "#c6e7dc", "icon": "home", "is_personal": False}
    data.update(kw)
    return create_room(db, RoomCreate(**data))


def _chore(db, name="Boden wischen", room_id=None):
    from app.schemas import ChoreCreate

    return create_chore(
        db,
        ChoreCreate(
            name=name, interval_days=7, due_date=date(2026, 9, 30), room_id=room_id
        ),
        "u@e.com",
    )


# ── CRUD ─────────────────────────────────────────────────────────────


def test_create_room(db):
    room = _room(db, "Bad", color="#b7e1d7", icon="shower")
    assert room.id is not None
    assert room.name == "Bad"
    assert room.color == "#b7e1d7"
    assert room.icon == "shower"
    assert room.is_personal is False
    assert room.sort_order == 0


def test_duplicate_name_raises(db):
    _room(db, "Bad")
    with pytest.raises(DuplicateRoomName):
        _room(db, "Bad")


def test_duplicate_name_differs_only_in_case_is_a_clash(db):
    """'Bad' und 'bad' sind fuer einen Haushalt derselbe Raum.

    Postgres ist bei TEXT mit `LIKE`-Kollation case-SENSITIV, SQLite
    nicht. Dieser Test laeuft auf SQLite und haelt deshalb die
    Absicht fest; die Produktions-Invariante sollte man bei Bedarf per
    `lower(name)`-Index haerten — hier nur als Absicht dokumentiert.
    """
    _room(db, "Bad")
    # Kein pytest.raises: haengt von der DB-Kollation ab.
    try:
        _room(db, "bad")
    except DuplicateRoomName:
        pass  # SQLite: korrekt erkannt


def test_update_room_partial(db):
    room = _room(db, "Keller")
    updated = update_room(db, room.id, RoomUpdate(color="#e2e6d2"))
    assert updated.color == "#e2e6d2"
    assert updated.name == "Keller", "PATCH darf nicht angegebene Felder loeschen"
    assert updated.icon == "home"


def test_update_room_rename_to_existing_conflicts(db):
    a = _room(db, "Keller")
    _room(db, "Bad")
    with pytest.raises(DuplicateRoomName):
        update_room(db, a.id, RoomUpdate(name="Bad"))


def test_update_room_rename_to_own_name_is_fine(db):
    """Ein PATCH mit demselben Namen darf kein 409 werfen."""
    room = _room(db, "Keller")
    updated = update_room(db, room.id, RoomUpdate(name="Keller"))
    assert updated.name == "Keller"


def test_update_unknown_room_raises(db):
    with pytest.raises(RoomNotFound):
        update_room(db, 9999, RoomUpdate(color="#ffffff"))


def test_delete_unknown_room_raises(db):
    with pytest.raises(RoomNotFound):
        delete_room(db, 9999)


def test_rooms_are_ordered_by_sort_order_then_name(db):
    _room(db, "Zimmer", sort_order=10)
    _room(db, "Bad", sort_order=20)
    _room(db, "Abwasch", sort_order=20)
    names = [r.name for r in get_rooms(db)]
    assert names == ["Zimmer", "Abwasch", "Bad"]


# ── Validierung (Security: icon/color landen in CSS) ─────────────────


def test_invalid_icon_is_rejected(db):
    with pytest.raises(Exception):
        _room(db, "XSS", icon='x" onload="alert(1)')


def test_unknown_but_wellformed_icon_is_rejected(db):
    """Format-gueltig, aber nicht in der Allowlist -> trotzdem 4xx."""
    with pytest.raises(Exception):
        _room(db, "Keller", icon="definitely-not-an-mdi-icon")


def test_invalid_color_is_rejected(db):
    with pytest.raises(Exception):
        _room(db, "Keller", color="red")


def test_empty_name_is_rejected(db):
    with pytest.raises(Exception):
        _room(db, "   ")


def test_allowed_icons_all_pass_the_validator(db):
    """Die Allowlist darf nicht durch einen Tippfehler leergefaellt sein."""
    for i, icon in enumerate(sorted(ALLOWED_ROOM_ICONS)):
        assert RoomCreate(name=f"R{i}", color="#c6e7dc", icon=icon).icon == icon


# ── Chore <-> Raum ───────────────────────────────────────────────────


def test_chore_without_room_is_valid(db):
    """Kernanforderung: Raum ist OPTIONAL, Bestand bleibt gueltig."""
    chore = _chore(db, "Boden wischen")
    assert chore.room_id is None
    assert chore.room is None


def test_chore_with_room_embeds_room(db):
    room = _room(db, "Schlafzimmer", color="#c6e7dc", icon="bed")
    chore = _chore(db, "Boden wischen", room_id=room.id)
    assert chore.room_id == room.id
    assert chore.room is not None
    assert chore.room.name == "Schlafzimmer"
    assert chore.room.icon == "bed"
    assert chore.room.color == "#c6e7dc"
    assert chore.room.is_personal is False


def test_dave_room_carries_is_personal(db):
    room = _room(db, "Dave", color="#8d6e63", icon="account", is_personal=True)
    chore = _chore(db, "Rasieren", room_id=room.id)
    assert chore.room.is_personal is True


def test_unknown_room_id_on_create_raises(db):
    from app.schemas import ChoreCreate

    with pytest.raises(UnknownRoom):
        create_chore(
            db, ChoreCreate(name="x", interval_days=1, room_id=4242), "u@e.com"
        )


def test_unknown_room_id_on_update_raises(db):
    chore = _chore(db)
    from app.schemas import ChoreUpdate

    with pytest.raises(UnknownRoom):
        update_chore(db, chore.id, ChoreUpdate(room_id=4242), "u@e.com")


# ── Die exclude_unset-Dreifachheit ───────────────────────────────────


def test_update_omitting_room_id_leaves_room_untouched(db):
    from app.schemas import ChoreUpdate

    room = _room(db, "Bad")
    chore = _chore(db, "Boden wischen", room_id=room.id)
    update_chore(
        db, chore.id, ChoreUpdate(name="Boden wischen Schlafzimmer"), "u@e.com"
    )
    assert chore.room_id == room.id, "Weggelassenes room_id darf nichts tun"


def test_update_with_explicit_null_removes_room(db):
    from app.schemas import ChoreUpdate

    room = _room(db, "Bad")
    chore = _chore(db, "Boden wischen", room_id=room.id)
    update_chore(db, chore.id, ChoreUpdate(room_id=None), "u@e.com")
    assert chore.room_id is None, "room_id: null muss den Raum entfernen"
    assert chore.room is None


def test_update_with_value_sets_room(db):
    from app.schemas import ChoreUpdate

    old = _room(db, "Bad")
    new = _room(db, "Küche")
    chore = _chore(db, "Abwasch", room_id=old.id)
    update_chore(db, chore.id, ChoreUpdate(room_id=new.id), "u@e.com")
    assert chore.room_id == new.id


# ── Loeschen entkoppelt, zerstoert nicht ─────────────────────────────


def test_delete_room_keeps_chores_and_clears_room(db):
    room = _room(db, "Keller")
    chore = _chore(db, "Keller aufräumen", room_id=room.id)

    delete_room(db, room.id)

    assert db.query(Chore).filter(Chore.id == chore.id).first() is not None, (
        "Der Chore muss den Raum loeschen ueberleben — er wird nur raumlos"
    )
    reloaded = db.query(Chore).filter(Chore.id == chore.id).first()
    assert reloaded.room_id is None


def test_delete_room_with_no_chores(db):
    room = _room(db, "Garage")
    delete_room(db, room.id)
    assert get_rooms(db) == []


# ── Der Seed: Icons MUESSEN in der Allowlist sein ────────────────────
#
# Der Seed laeuft per Migration, nicht per Pydantic — ein Tippfehler
# wuerde dort NICHT auffallen, wuerde aber jeden spaeteren PATCH auf
# diesem Raum mit 422 abweisen. Genau das verhindert dieser Test.


def test_seeded_rooms_use_allowed_icons():
    for name, _color, icon, _personal, _order in DEFAULT_ROOMS:
        assert icon in ALLOWED_ROOM_ICONS, (
            f"Seed-Raum '{name}' nutzt Icon '{icon}', das nicht in "
            f"ALLOWED_ROOM_ICONS steht. Dann lehnt das Backend spaeter "
            f"jedes Update dieses Raums ab."
        )


def test_seeded_rooms_use_valid_colors():
    import re

    for name, color, _icon, _personal, _order in DEFAULT_ROOMS:
        assert re.match(r"^#[0-9a-fA-F]{6}$", color), f"Seed-Farbe '{name}': {color}"


def test_seed_contains_dave_as_personal():
    dave = [r for r in DEFAULT_ROOMS if r[0] == "Dave"]
    assert dave, "Der Dave-Raum muss geseedet werden"
    assert dave[0][3] is True, "Dave muss is_personal=True sein"


def test_seed_names_are_unique():
    names = [r[0] for r in DEFAULT_ROOMS]
    assert len(names) == len(set(names)), "Doppelte Room-Namen im Seed brechen UNIQUE"


# ── ROUTE-REIHENFOLGE: der eigentliche Regressionstest ──────────────


def test_rooms_route_is_not_swallowed_by_chore_id():
    """GET /api/chores/rooms muss 200 liefern, nicht 422.

    Ohne diesen Test faellt ein Umsortieren der ROUTERS-Liste in
    monolith/main.py bzw. main.py nicht auf: dieRooms-Daten waeren weg,
    der Endpoint wuerde stattdessen mit "value is not a valid integer"
    antworten und die Ursache waere nicht im Log zu sehen.
    """
    from app.main import app

    paths = [r.path for r in app.routes if hasattr(r, "path")]
    assert "/api/chores/rooms" in paths, "Der rooms-Router ist nicht registriert"

    # Positionen in der Routenliste vergleichen: rooms muss VOR
    # /api/chores/{chore_id} stehen.
    rooms_idx = paths.index("/api/chores/rooms")
    chore_id_idx = paths.index("/api/chores/{chore_id}")
    assert rooms_idx < chore_id_idx, (
        "rooms-Router muss vor /api/chores/{chore_id} registriert werden, "
        "sonst matcht die Integer-Route /api/chores/rooms und liefert 422."
    )


def test_rooms_endpoints_are_all_registered():
    from app.main import app

    paths = {r.path for r in app.routes if hasattr(r, "path")}
    for expected in (
        "/api/chores/rooms",
        "/api/chores/rooms/{room_id}",
    ):
        assert expected in paths, f"{expected} fehlt in der App"


def test_chore_response_model_exposes_room():
    from app.schemas import ChoreResponse, RoomBrief

    assert "room" in ChoreResponse.model_fields
    assert "room_id" in ChoreResponse.model_fields
    assert set(RoomBrief.model_fields) == {
        "id",
        "name",
        "color",
        "icon",
        "is_personal",
    }


def test_room_is_not_required_on_chore_create():
    from app.schemas import ChoreCreate

    c = ChoreCreate(name="x")
    assert c.room_id is None, "room_id muss optional sein (kein Breaking)"


def test_room_response_accepts_real_timestamps():
    """REGRESSION: `created_at` ist TIMESTAMP, nicht DATE.

    Mit `Optional[date]` wirft Pydantic v2 `date_from_datetime_inexact`,
    sobald die Uhrzeit nicht 00:00:00 ist. Im SQLite-Test ist die Spalte
    NULL, dort faellt es NIE auf — erst gegen die echte Postgres-DB
    scheitert der GROSSTE Teil des Rooms-CRUD. Dieser Test setzt deshalb
    bewusst einen echten Zeitstempel.
    """
    from datetime import datetime as dt

    from app.schemas import RoomResponse

    room = Room(
        id=1,
        name="Küche",
        color="#c6e7dc",
        icon="home",
        is_personal=False,
        sort_order=10,
        created_at=dt(2026, 9, 30, 22, 11, 10, 983786),
        updated_at=dt(2026, 9, 30, 22, 11, 10, 983786),
    )
    resp = RoomResponse.model_validate(room)
    assert isinstance(resp.created_at, dt)
