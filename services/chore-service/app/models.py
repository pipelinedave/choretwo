from datetime import datetime, date
from sqlalchemy import Column, Integer, String, Boolean, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.schema import CreateTable

from app.database import Base


class Room(Base):
    """Ein Raum (Küche, Bad, Schlafzimmer, ...).

    Warum eine eigene Tabelle und kein Freitext-Feld am Chore:
    - Farbe und Icon muessen an EINEM Ort gepflegt werden. Freitext am
      Chore hiesse, dass "Bad" in drei various Auspraegungen existiert und
      die ChoreCards alle unterschiedlich eingefaerbt sind.
    - `is_personal` traegt die "Dave"-Spezialbehandlung. Das ist eine
      Eigenschaft des Raums, nicht des Chores.

    `color` ist ein Hex-Wert (z.B. "#c6e7dc"), `icon` ein MDI-Klassenname
    OHNE "mdi-"-Praefix (z.B. "silverware-fork-knife"). Beide werden im
    Frontend direkt als Inline-Style bzw. CSS-Klasse gerendert und sind
    deshalb Fremdeingaben — die Validierung sitzt in schemas.py
    (Allowlist), nicht hier.
    """

    __tablename__ = "rooms"
    __table_args__ = {"schema": "chores"}

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, unique=True)
    color = Column(String(32), nullable=False, default="#c6e7dc")
    icon = Column(String(64), nullable=False, default="home")
    is_personal = Column(Boolean, nullable=False, default=False)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    chores = relationship("Chore", back_populates="room")

    def __repr__(self):
        return (
            f"<Room(id={self.id}, name='{self.name}', color='{self.color}', "
            f"icon='{self.icon}', is_personal={self.is_personal})>"
        )


class Chore(Base):
    __tablename__ = "chores"
    __table_args__ = {"schema": "chores"}

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    interval_days = Column(Integer, nullable=False, default=1)
    due_date = Column(Date, nullable=False)
    done = Column(Boolean, default=False)
    done_by = Column(String(255))
    last_done = Column(Date)
    owner_email = Column(String(255))
    is_private = Column(Boolean, default=False)
    archived = Column(Boolean, default=False)
    # Optional: NULL = kein Raum. Das ist bewusst nullable, damit bereits
    # existierende Chores gueltig bleiben und der Chip im Frontend nur
    # erscheint, wenn wirklich ein Raum gesetzt ist.
    # ON DELETE SET NULL: ein geloeschter Raum nimmt die Chores NICHT mit,
    # er entkoppelt sie nur wieder vom Raum.
    room_id = Column(
        Integer, ForeignKey("chores.rooms.id", ondelete="SET NULL"), nullable=True
    )
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # joined: die Chore-Responses betten den Raum ein, damit das Frontend
    # Icon+Farbe fuer den Chip in EINEM Request bekommt (kein N+1 aus dem
    # Client, und kein Lazy-Load nach Session-CLose).
    room = relationship("Room", back_populates="chores", lazy="joined")

    def __repr__(self):
        return f"<Chore(id={self.id}, name='{self.name}', due_date={self.due_date})>"
