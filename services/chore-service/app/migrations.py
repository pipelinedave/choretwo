"""Idempotentes DDL fuer das Raum-Feature.

WARUM EIGENE DATEI
------------------
Das Repo hat an drei Stellen Migrations-DDL: `app/database.py`
(chore-service, wird beim Service-Start ausgefuehrt),
`monolith/database.py::_migrate_chore_service()` (Legacy, wird aktuell
NICHT aufgerufen) und `scripts/run_migrations.py` (expliziter Prod-Runner).
Die Rooms-DDL steht deshalb bewusst nur HIER und wird von allen drei
Stellen importiert. Ein drittes Kopieren der Statements waere die
Garantie fuer eine Drift, bei der lokal etwas existiert und in Prod nicht.

IDEMPOTENZ
----------
Jedes Statement ist mit IF NOT EXISTS bzw. einem pg_constraint-Guard
abgesichert. Die Migration kann beliebig oft laufen (Service-Start,
mehrfach ausgefuehrter Prod-Runner) und ist danach ein No-op.

WARUM ueberhaupt eine Spalte auf chores
--------------------------------------
`room_id` ist NULLBAR. Bestehende Chores bleiben ohne Room gueltig, es
gibt keine Breaking-Migration und kein Backfill. `ON DELETE SET NULL`
ist die zweite Haelfte der Optionalitaet: ein geloeschter Raum loescht
keine Chores, er entkoppelt sie nur wieder.
"""

# Reihenfolge ist bedeutsam: rooms muss existieren, BEVOR der FK auf
# chores.room_id zeigt.

CREATE_ROOMS_TABLE = """
CREATE TABLE IF NOT EXISTS chores.rooms (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(32) NOT NULL DEFAULT '#c6e7dc',
    icon VARCHAR(64) NOT NULL DEFAULT 'home',
    is_personal BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
"""

# UNIQUE als eigener Index statt im CREATE TABLE: so greift er auch,
# wenn die Tabelle aus einem frueheren Stand schon existiert.
CREATE_ROOMS_NAME_UNIQUE = """
CREATE UNIQUE INDEX IF NOT EXISTS uq_rooms_name ON chores.rooms(name)
"""

CREATE_CHORES_ROOM_ID = """
ALTER TABLE chores.chores ADD COLUMN IF NOT EXISTS room_id INT
"""

CREATE_CHORES_ROOM_INDEX = """
CREATE INDEX IF NOT EXISTS idx_chores_room_id ON chores.chores(room_id)
"""

# FK mit ON DELETE SET NULL. Als DO-Block mit pg_constraint-Guard, weil
# Postgres kein "ADD CONSTRAINT IF NOT EXISTS" kennt.
CREATE_CHORES_ROOM_FK = """
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_chores_room_id'
          AND conrelid = 'chores.chores'::regclass
    ) THEN
        ALTER TABLE chores.chores
            ADD CONSTRAINT fk_chores_room_id
            FOREIGN KEY (room_id) REFERENCES chores.rooms(id)
            ON DELETE SET NULL;
    END IF;
END $$;
"""

# ── Default-Raeume ───────────────────────────────────────────────────
#
# Die Icons MUESSEN in ALLOWED_ROOM_ICONS (app/schemas.py) stehen,
# sonst lehnt das Backend spaeter jedes Update dieses Raums ab.
# Das ist Absicht: die Allowlist ist die eine Wahrheit, der Seed ist
# dagegen abgesichert durch test_rooms.py::test_seeded_rooms_use_allowed_icons.
#
# "Dave" ist der Spezialfall: is_personal=True. Er bekommt bewusst KEINE
# Pastellfarbe aus dem Haushalts-Schema, sondern einen kräftigeren
# Ton, damit die Dave-Sonderbehandlung schon an der Farbe erkennbar ist.
DEFAULT_ROOMS = [
    # (name, color, icon, is_personal, sort_order)
    ("Küche", "#f6c7ae", "silverware-fork-knife", False, 10),
    ("Bad", "#b7e1d7", "shower", False, 20),
    ("Schlafzimmer", "#c6e7dc", "bed", False, 30),
    ("Wohnzimmer", "#f2ddba", "sofa", False, 40),
    ("Flur", "#eee7c9", "stairs", False, 50),
    ("Keller", "#e2e6d2", "garage", False, 60),
    ("Garage", "#d3ead8", "car", False, 70),
    ("Waschraum", "#c6e7dc", "washing-machine", False, 80),
    ("Garten", "#d3ead8", "flower", False, 90),
    ("Abwasch", "#f6c7ae", "broom", False, 100),
    # Spezialbehandlung: personenbezogener Raum.
    ("Dave", "#8d6e63", "account", True, 900),
]

SEED_ROOMS = """
INSERT INTO chores.rooms (name, color, icon, is_personal, sort_order)
VALUES (:name, :color, :icon, :is_personal, :sort_order)
ON CONFLICT (name) DO NOTHING
"""


def migrate_rooms(conn, seed: bool = True) -> None:
    """Legt rooms + chores.room_id an. Idempotent.

    `conn` ist eine SQLAlchemy Connection (nicht autocommit) — der Aufrufer
    committet. In `_seed_rooms` wird bewusst ein zweites Mal geprüft:
    ON CONFLICT braucht den UNIQUE-Index aus CREATE_ROOMS_NAME_UNIQUE.
    """
    from sqlalchemy import text

    conn.execute(text("CREATE SCHEMA IF NOT EXISTS chores"))
    conn.execute(text(CREATE_ROOMS_TABLE))
    conn.execute(text(CREATE_ROOMS_NAME_UNIQUE))
    conn.execute(text(CREATE_CHORES_ROOM_ID))
    conn.execute(text(CREATE_CHORES_ROOM_INDEX))
    conn.execute(text(CREATE_CHORES_ROOM_FK))

    if seed:
        _seed_rooms(conn)


def _seed_rooms(conn) -> None:
    from sqlalchemy import text

    for name, color, icon, is_personal, sort_order in DEFAULT_ROOMS:
        conn.execute(
            text(SEED_ROOMS),
            {
                "name": name,
                "color": color,
                "icon": icon,
                "is_personal": is_personal,
                "sort_order": sort_order,
            },
        )
