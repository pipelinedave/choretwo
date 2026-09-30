from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException, Request, Query, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.database import get_db
from app.schemas import ChoreCreate, ChoreUpdate, ChoreResponse, ChoreStats
from app.services.chore_service import (
    get_chores,
    get_archived_chores,
    create_chore,
    get_chore,
    update_chore,
    mark_chore_done,
    archive_chore,
    delete_chore,
    get_chore_stats,
    get_household_health,
    get_chore_bucket_counts,
    UnknownRoom,
)
from app.utils import log_action

router = APIRouter(prefix="/api/chores")


def _to_response(c, **overrides) -> ChoreResponse:
    """Baut die Chore-Response inkl. Raum.

    Der Raum wird eingebettet (`room` = RoomBrief, `room_id` = FK), damit
    das Frontend Icon + Farbe + is_personal fuer den Chip in EINEM Request
    bekommt. `c.room` ist ueber `lazy="joined"` bereits geladen, greift also
    auch nach `db.commit()`/`db.refresh()` nicht ins Leere.
    """
    data = {
        "id": c.id,
        "name": c.name,
        "interval_days": c.interval_days,
        "due_date": c.due_date,
        "done": c.done,
        "done_by": c.done_by,
        "last_done": c.last_done,
        "owner_email": c.owner_email,
        "is_private": c.is_private,
        "archived": c.archived,
        "room_id": c.room_id,
        "room": c.room,
    }
    data.update(overrides)
    return ChoreResponse(**data)


@router.get("/")
async def list_chores(
    request: Request,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    user_email = request.state.user_email
    chores = get_chores(db, user_email, page, limit)

    return [_to_response(c) for c in chores]


@router.post("/")
async def add_chore(
    request: Request, chore: ChoreCreate, db: Session = Depends(get_db)
):
    user_email = request.state.user_email
    try:
        db_chore = create_chore(db, chore, user_email)
    except UnknownRoom:
        raise HTTPException(status_code=400, detail="Unknown room_id")

    return {
        "message": "Chore added successfully",
        "id": db_chore.id,
        "chore": _to_response(db_chore),
    }


@router.get("/archived")
async def list_archived_chores(request: Request, db: Session = Depends(get_db)):
    user_email = request.state.user_email
    chores = get_archived_chores(db, user_email)

    return [_to_response(c) for c in chores]


@router.get("/count")
async def get_chore_counts(request: Request, db: Session = Depends(get_db)):
    user_email = request.state.user_email
    return get_chore_bucket_counts(db, user_email)


@router.get("/household-health")
async def get_household_health_score(request: Request, db: Session = Depends(get_db)):
    user_email = request.state.user_email
    return get_household_health(db, user_email)


@router.get("/stats")
async def get_chores_stats(request: Request, db: Session = Depends(get_db)):
    user_email = request.state.user_email
    stats = get_chore_stats(db, user_email)
    return stats


@router.get("/{chore_id}")
async def get_single_chore(
    request: Request, chore_id: int, db: Session = Depends(get_db)
):
    user_email = request.state.user_email
    chore = get_chore(db, chore_id, user_email)

    if not chore:
        raise HTTPException(status_code=404, detail="Chore not found")

    return _to_response(
        chore,
        # Bei Done zieht die Recurrence die Fälligkeit nach vorn. Diese
        # bereits vorgezogene due_date wird zusätzlich als new_due_date
        # zurückgegeben, damit das Frontend den "Nächste Fälligkeit"-Toast
        # anzeigen kann (store.markDone liest response.data.new_due_date).
        new_due_date=chore.due_date,
    )


@router.put("/{chore_id}")
async def update_single_chore(
    request: Request,
    chore_id: int,
    chore_update: ChoreUpdate,
    db: Session = Depends(get_db),
):
    user_email = request.state.user_email
    try:
        chore = update_chore(db, chore_id, chore_update, user_email)
    except UnknownRoom:
        raise HTTPException(status_code=400, detail="Unknown room_id")

    if not chore:
        raise HTTPException(status_code=404, detail="Chore not found")

    return {"message": f"Chore {chore_id} updated successfully"}


@router.put("/{chore_id}/done")
async def mark_chore_as_done(
    request: Request, chore_id: int, db: Session = Depends(get_db), done_by: str = None
):
    user_email = request.state.user_email

    # `done_by` kann als Query-Param (Legacy-Clients) ODER im JSON-Body kommen
    # (Frontend-Store markDone/undoDone senden `{ "done_by": ... }` im Body).
    # Ohne diese Auflösung geht der Wert verloren → der UNDO-Zweig (done_by=="undo")
    # im Backend würde nie greifen.
    if not done_by:
        try:
            body = await request.json()
            done_by = (body or {}).get("done_by")
        except Exception:
            done_by = None

    try:
        chore = mark_chore_done(db, chore_id, user_email, done_by)
        if not chore:
            raise HTTPException(status_code=404, detail="Chore not found")

        # `new_due_date` liefert dem Frontend die durch die Recurrence
        # vorgezogene nächste Fälligkeit (für den "Nächste Fälligkeit"-Toast).
        # mark_chore_done setzt chore.due_date bereits auf das nächste Vorkommen;
        # beim UNDO (done_by=="undo") gibt es keine neue Fälligkeit.
        return _to_response(
            chore,
            # `new_due_date` liefert dem Frontend die durch die Recurrence
            # vorgezogene nächste Fälligkeit (für den "Nächste Fälligkeit"-Toast).
            # mark_chore_done setzt chore.due_date bereits auf das nächste Vorkommen;
            # beim UNDO (done_by=="undo") gibt es keine neue Fälligkeit.
            new_due_date=chore.due_date if done_by != "undo" else None,
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.put("/{chore_id}/archive")
async def archive_chore_endpoint(
    request: Request, chore_id: int, db: Session = Depends(get_db)
):
    user_email = request.state.user_email
    chore = archive_chore(db, chore_id, user_email)

    if not chore:
        raise HTTPException(status_code=404, detail="Chore not found")

    return {"message": f"Chore {chore_id} archived successfully"}


@router.put("/{chore_id}/unarchive")
async def unarchive_chore_endpoint(
    request: Request, chore_id: int, db: Session = Depends(get_db)
):
    user_email = request.state.user_email
    chore = get_chore(db, chore_id, user_email)

    if not chore:
        raise HTTPException(status_code=404, detail="Chore not found")

    chore.archived = False
    db.commit()
    db.refresh(chore)

    log_action(chore_id, user_email, "unarchived", {"chore_id": chore_id})

    return {"message": f"Chore {chore_id} unarchived successfully"}


@router.delete("/{chore_id}")
async def delete_single_chore(
    request: Request, chore_id: int, db: Session = Depends(get_db)
):
    user_email = request.state.user_email
    chore = delete_chore(db, chore_id, user_email)

    if not chore:
        raise HTTPException(status_code=404, detail="Chore not found")

    return {"message": f"Chore {chore_id} deleted successfully"}
