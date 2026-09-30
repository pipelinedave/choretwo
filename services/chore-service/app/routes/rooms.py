"""Raeume-CRUD.

WICHTIG — Registrierungsreihenfolge:
Dieser Router MUSS vor dem chores-Router (`routes/chores.py`)
inkludiert werden. `chores.py` deklariert `GET /{chore_id}`; kommt
`/rooms` danach, matcht FastAPI `GET /api/chores/rooms` auf
`/{chore_id}` mit chore_id="rooms" und antwortet 422
("value is not a valid integer") statt 200.

Die Reihenfolge ist in `app/main.py` und in `monolith/main.py`
(ROUTERS-Liste) festgeschrieben und durch den Test
`test_rooms.py::test_rooms_route_is_not_swallowed_by_chore_id`
abgesichert. Bitte beim Umstellen von Routern mitdenken.
"""

from fastapi import APIRouter, HTTPException, Request, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import RoomCreate, RoomUpdate, RoomResponse
from app.services.room_service import (
    DuplicateRoomName,
    RoomNotFound,
    create_room,
    delete_room,
    get_rooms,
    update_room,
)
from app.utils import log_action

router = APIRouter(prefix="/api/chores", tags=["rooms"])


@router.get("/rooms")
async def list_rooms(db: Session = Depends(get_db)):
    # Kein `request.state.user_email`: Raeume sind bewusst GLOBAL (die
    # Haushaltsliste), es gibt also nichts pro Nutzer zu filtern. Die
    # Auth erzwingt trotzdem die AuthMiddleware — die laeuft vor der Route
    # und antwortet ohne Token mit 401.
    rooms = get_rooms(db)
    return [RoomResponse.model_validate(r) for r in rooms]


@router.post("/rooms", status_code=201)
async def add_room(request: Request, room: RoomCreate, db: Session = Depends(get_db)):
    user_email = request.state.user_email
    try:
        room_obj = create_room(db, room)
    except DuplicateRoomName:
        raise HTTPException(
            status_code=409, detail=f"Room '{room.name}' existiert bereits"
        )

    log_action(
        None,
        user_email,
        "room_created",
        {
            "id": room_obj.id,
            "name": room_obj.name,
            "color": room_obj.color,
            "icon": room_obj.icon,
            "is_personal": room_obj.is_personal,
        },
    )
    return RoomResponse.model_validate(room_obj)


@router.patch("/rooms/{room_id}")
async def patch_room(
    room_id: int, room: RoomUpdate, request: Request, db: Session = Depends(get_db)
):
    user_email = request.state.user_email
    try:
        room_obj = update_room(db, room_id, room)
    except RoomNotFound:
        raise HTTPException(status_code=404, detail="Room not found")
    except DuplicateRoomName:
        raise HTTPException(
            status_code=409, detail=f"Room '{room.name}' existiert bereits"
        )

    log_action(
        None,
        user_email,
        "room_updated",
        {"id": room_obj.id, "name": room_obj.name},
    )
    return RoomResponse.model_validate(room_obj)


@router.delete("/rooms/{room_id}")
async def remove_room(room_id: int, request: Request, db: Session = Depends(get_db)):
    user_email = request.state.user_email
    try:
        room_obj = delete_room(db, room_id)
    except RoomNotFound:
        raise HTTPException(status_code=404, detail="Room not found")

    # Kein 204: der Client nutzt die Antwort, um den Cache zu aktualisieren.
    # Die Chores, die den Raum hatten, existieren weiter — nur ohne Raum.
    log_action(
        None,
        user_email,
        "room_deleted",
        {"id": room_obj.id, "name": room_obj.name},
    )
    return {
        "message": f"Room {room_obj.name} deleted successfully",
        "id": room_obj.id,
    }
