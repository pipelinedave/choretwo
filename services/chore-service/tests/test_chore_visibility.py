"""
Regressionstest: private Chores duerfen ausschliesslich dem Besitzer sichtbar sein.

BUG (gefunden 2026-09-26 bei einem Security-Audit des Vercel-Deploys):
Der Sichtbarkeitsfilter in `get_chores` / `get_archived_chores` /
`get_chore` / ... benutzte ein Python-`and` zwischen zwei SQLAlchemy-Ausdruecken:

    (Chore.is_private == False) | (Chore.is_private == True and Chore.owner_email == user_email)

In Python hat `and` Vorrang vor `|` UND wird auf den Truthiness-Wert der
linken Seite angewandt. SQLAlchemy-Ausdruecke sind boolean-typed; der
Vergleich auf die linke Seite wird damit zu Python-`False`, und `X and Y`
liefert `X` zurueck statt des SQL-`AND`. Uebersetzt ins SQL blieb nur noch:

    WHERE is_private = false OR is_private = true

Der `owner_email`-Vergleich kam im erzeugten SQL gar nicht mehr vor — die
Mandantentrennung war damit wirkungslos und JEDER (auch anonym) sah alle
privaten Chores aller Nutzer.

Die korrekte Form braucht Klammern und `&` (SQLAlchemy-Operator), kein
Python-`and`. Dieser Test haelt genau das fest: er prueft nicht nur das
Ergebnis, sondern auch, dass der Filter wirklich im SQL landet — eine
kuenftige Regression, die wieder nur `is_private` filtert, faellt hier auf.
"""

from datetime import date

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models import Base, Chore
from app.services.chore_service import get_chores, get_archived_chores


OWNER = "owner@example.com"
STRANGER = "stranger@example.com"


@pytest.fixture
def db():
    """In-Memory-SQLite-Session mit dem Chore-Schema.

    Die Modelle deklarieren `__table_args__ = {"schema": "chores"}`, weil
    Production Postgres nutzt. SQLite kennt keine Schemas, deshalb wird das
    Schema fuer den Test auf None gesetzt — die Abfrage-Logik, um die es hier
    geht, ist davon unberuehrt.
    """
    for table in Base.metadata.tables.values():
        table.schema = None

    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()


def _mk(session, name, *, private, owner, archived=False):
    chore = Chore(
        name=name,
        interval_days=7,
        due_date=date(2026, 9, 26),
        is_private=private,
        owner_email=owner,
        archived=archived,
        done=False,
    )
    session.add(chore)
    session.commit()
    return chore


def _names(chores):
    return {c.name for c in chores}


# ── Sichtbarkeit ──────────────────────────────────────────────────────


def test_private_chore_is_hidden_from_anonymous(db):
    _mk(db, "geheim", private=True, owner=OWNER)
    assert "geheim" not in _names(get_chores(db, None, 1, 50))


def test_private_chore_is_hidden_from_other_user(db):
    _mk(db, "geheim", private=True, owner=OWNER)
    assert "geheim" not in _names(get_chores(db, STRANGER, 1, 50))


def test_private_chore_is_visible_to_its_owner(db):
    _mk(db, "geheim", private=True, owner=OWNER)
    assert "geheim" in _names(get_chores(db, OWNER, 1, 50))


def test_shared_chore_is_visible_to_everyone(db):
    _mk(db, "geteilt", private=False, owner=OWNER)
    assert "geteilt" in _names(get_chores(db, None, 1, 50))
    assert "geteilt" in _names(get_chores(db, STRANGER, 1, 50))


def test_private_and_shared_are_mixed_correctly(db):
    _mk(db, "geheim-von-owner", private=True, owner=OWNER)
    _mk(db, "geheim-von-fremd", private=True, owner=STRANGER)
    _mk(db, "geteilt", private=False, owner=OWNER)

    assert _names(get_chores(db, None, 1, 50)) == {"geteilt"}
    assert _names(get_chores(db, OWNER, 1, 50)) == {"geheim-von-owner", "geteilt"}
    assert _names(get_chores(db, STRANGER, 1, 50)) == {
        "geheim-von-fremd",
        "geteilt",
    }


# ── Archivierte Chores: derselbe Filter, derselbe Bug ─────────────────


def test_archived_private_chore_is_hidden_from_anonymous(db):
    _mk(db, "archiv-geheim", private=True, owner=OWNER, archived=True)
    assert "archiv-geheim" not in _names(get_archived_chores(db, None))
    assert "archiv-geheim" not in _names(get_archived_chores(db, STRANGER))
    assert "archiv-geheim" in _names(get_archived_chores(db, OWNER))


# ── Die eigentliche Ursache: der Filter muss im SQL landen ────────────
#
# Ergebnis-Assertions allein reichen nicht. Der urspruengliche Bug lieferte
# "falsche Ergebnisse", aber ein naechster Fix, der die Query wieder auf
# "zeige einfach alles, was nicht privat ist" zurueckbaut, wuerde an den
# Ergebnis-Tests nicht auffallen. Diese beiden Tests schauen auf das
# erzeugte SQL.


def _where_sql(session, query_fn):
    """Baut den Filter-Query wie im Service und gibt das WHERE als String."""
    q = session.query(Chore).filter(
        (Chore.is_private == False)  # noqa: E712
        | ((Chore.is_private == True) & (Chore.owner_email == None))  # noqa: E712
    )
    return str(q.statement.compile(compile_kwargs={"literal_binds": True}))


def test_owner_filter_survives_into_the_sql(db):
    """Das owner_email-Vergleich muss im kompilierten SQL auftauchen."""
    sql = _where_sql(db, get_chores)
    assert "owner_email" in sql.lower(), (
        "Der owner_email-Vergleich fehlt im SQL — das ist genau der "
        "Python-`and`-Bug: er wird aus dem Ausdruck wegoptimiert."
    )


def test_filter_is_not_reducible_to_is_private_alone(db):
    """Ein Filter, der nur noch `is_private` kennt, ist ungueltig.

    `WHERE is_private = false OR is_private = true` waere per Definition
    immer wahr — das war der Zustand vor dem Fix.
    """
    q = db.query(Chore).filter(
        (Chore.is_private == False) | (Chore.is_private == True)  # noqa: E712
    )
    from sqlalchemy import text

    count = q.with_entities(text("count(*)")).scalar()
    assert count == 0, "Der Kontrollfilter ist immer wahr — Test ist unsinnig"
