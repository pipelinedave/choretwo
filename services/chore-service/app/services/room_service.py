"""Datenlogik der Raeume.

Getrennt von den Routen, analog zu `chore_service.py` — haelt die
Route-Dateien duenn und die Regeln (Duplikat-Name, ON DELETE SET NULL)
an einer Stelle testbar.
"""

from typing import List, Optional

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Room
from app.schemas import RoomCreate, RoomUpdate


class DuplicateRoomName(Exception):
    """Name existiert bereits (UNIQUE auf chores.rooms.name)."""


class RoomNotFound(Exception):
    pass


def get_rooms(db: Session) -> List[Room]:
    """Alle Raeume, stabil sortiert nach sort_order, dann Name."""
    return db.query(Room).order_by(Room.sort_order.asc(), Room.name.asc()).all()


def get_room(db: Session, room_id: int) -> Optional[Room]:
    return db.query(Room).filter(Room.id == room_id).first()


def get_room_by_name(db: Session, name: str) -> Optional[Room]:
    return db.query(Room).filter(Room.name == name.strip()).first()


def create_room(db: Session, data: RoomCreate) -> Room:
    # Vorabpruefung, damit der Client eine klare 409 bekommt statt eines
    # rohen IntegrityError. Der Catch unten bleibt trotzdem, weil zwischen
    # Pruefung und INSERT ein zweiter Request durchrutschen kann.
    if get_room_by_name(db, data.name):
        raise DuplicateRoomName(data.name)

    room = Room(
        name=data.name.strip(),
        color=data.color,
        icon=data.icon,
        is_personal=data.is_personal,
        sort_order=data.sort_order,
    )
    db.add(room)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise DuplicateRoomName(data.name)
    db.refresh(room)
    return room


def update_room(db: Session, room_id: int, data: RoomUpdate) -> Room:
    room = get_room(db, room_id)
    if not room:
        raise RoomNotFound(room_id)

    update_data = data.model_dump(exclude_unset=True)
    if "name" in update_data:
        new_name = update_data["name"].strip()
        clash = get_room_by_name(db, new_name)
        if clash and clash.id != room_id:
            raise DuplicateRoomName(new_name)
        update_data["name"] = new_name

    for field, value in update_data.items():
        setattr(room, field, value)

    db.commit()
    db.refresh(room)
    return room


def delete_room(db: Session, room_id: int) -> Room:
    """Loescht den Raum. Chores bleiben bestehen, verlieren nur ihren Raum.

    `room_id` ist mit ON DELETE SET NULL definiert; die Chores werden hier
    trotzdem explizit noch einmal auf NULL gesetzt, damit das Verhalten
    auch dann korrekt ist, wenn die Tabelle in einer Alt-DB noch ohne FK
    existiert (Migration nicht gelaufen) und damit kein DB-seitiger
    Default greift.
    """
    room = get_room(db, room_id)
    if not room:
        raise RoomNotFound(room_id)

    from app.models import Chore

    db.query(Chore).filter(Chore.room_id == room_id).update(
        {Chore.room_id: None}, synchronize_session=False
    )
    db.delete(room)
    db.commit()
    return room


def count_chores_per_room(db: Session) -> dict:
    """Raum-ID -> Anzahl zugewiesener Chores (fuer die Raumverwaltung)."""
    from app.models import Chore

    rows = (
        db.query(Chore.room_id, func.count(Chore.id))
        .filter(Chore.room_id.isnot(None))
        .group_by(Chore.room_id)
        .all()
    )
    return {row[0]: row[1] for row in rows}
