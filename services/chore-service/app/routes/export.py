from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
import json

from app.database import get_db
from app.models import Room
from app.schemas import RoomCreate
from app.services.room_service import get_room_by_name
from app.utils import log_action, to_utc_iso

router = APIRouter(prefix="/api")


@router.get("/export")
async def export_data(request: Request, db: Session = Depends(get_db)):
    user_email = request.state.user_email

    chores_query = db.execute(
        text("""
        SELECT c.id, c.name, c.interval_days, c.due_date, c.done, c.done_by, c.archived, c.owner_email, c.is_private, c.last_done,
               c.room_id, r.name
        FROM chores.chores c
        LEFT JOIN chores.rooms r ON r.id = c.room_id
        WHERE c.archived = FALSE AND (c.is_private = FALSE OR (c.is_private = TRUE AND c.owner_email = :email))
    """),
        {"email": user_email},
    )

    chores = []
    for row in chores_query:
        chore = {
            "id": row[0],
            "name": row[1],
            "interval_days": row[2],
            "due_date": row[3].isoformat() if row[3] else None,
            "done": row[4],
            "done_by": row[5],
            "archived": row[6],
            "owner_email": row[7],
            "is_private": row[8],
            "last_done": row[9].isoformat() if row[9] else None,
            # Raum per NAME, nicht per ID: die room_id ist lokal und
            # bedeutet in einer anderen Datenbank nichts. Der Import
            # loest den Namen auf bzw. legt den Raum an.
            "room_name": row[11],
        }
        chores.append(chore)

    # Raeume mit exportieren, damit ein Import in eine frische DB die
    # Farben/Icons mitnimmt und nicht nur leere Namen erzeugt.
    rooms = [
        {
            "name": r[0],
            "color": r[1],
            "icon": r[2],
            "is_personal": r[3],
            "sort_order": r[4],
        }
        for r in db.execute(
            text("""
            SELECT name, color, icon, is_personal, sort_order
            FROM chores.rooms ORDER BY sort_order, name
        """)
        )
    ]

    logs_query = db.execute(
        text("""
        SELECT id, chore_id, done_by, done_at, action_type, action_details
        FROM logs.chore_logs
        ORDER BY done_at DESC
    """)
    )

    logs = []
    for row in logs_query:
        log_entry = {
            "id": row[0],
            "chore_id": row[1],
            "done_by": row[2],
            "done_at": to_utc_iso(row[3]),
            "action_type": row[4],
            "action_details": row[5]
            if isinstance(row[5], dict)
            else json.loads(row[5])
            if row[5]
            else {},
        }
        logs.append(log_entry)

    log_action(
        None, user_email, "export", {"chore_count": len(chores), "log_count": len(logs)}
    )

    return {"chores": chores, "rooms": rooms, "logs": logs}


@router.post("/import")
async def import_data(request: Request, db: Session = Depends(get_db)):
    user_email = request.state.user_email

    try:
        import_data = await request.json()
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    if not import_data.get("chores"):
        raise HTTPException(status_code=400, detail="No chores data found")

    # 1) Raeume anlegen. Die Icon-/Farbwerte werden gegen die Allowlist
    #    validiert; ein fremder/kaputter Wert faellt auf Default zurueck,
    #    statt den ganzen Import zu sprengen.
    for room in import_data.get("rooms") or []:
        try:
            payload = RoomCreate(
                name=room["name"],
                color=room.get("color", "#c6e7dc"),
                icon=room.get("icon", "home"),
                is_personal=bool(room.get("is_personal", False)),
                sort_order=int(room.get("sort_order", 0)),
            )
            if get_room_by_name(db, payload.name) is None:
                db.add(
                    Room(
                        name=payload.name,
                        color=payload.color,
                        icon=payload.icon,
                        is_personal=payload.is_personal,
                        sort_order=payload.sort_order,
                    )
                )
        except Exception as e:
            print(f"Skipping room {room.get('name')} on import: {e}")
    db.commit()

    # 2) Chores importieren und den Raum ueber seinen NAMEN aufloesen.
    imported_chores = []

    for chore in import_data["chores"]:
        try:
            room_id = None
            room_name = chore.get("room_name")
            if room_name:
                room = get_room_by_name(db, room_name)
                if room is None:
                    # Raum existiert in dieser DB noch nicht -> anlegen.
                    # Sonst waere der importierte Chore still verwais't.
                    room = Room(name=room_name.strip(), color="#c6e7dc", icon="home")
                    db.add(room)
                    db.flush()
                room_id = room.id

            if chore.get("id"):
                existing = db.execute(
                    text("""
                    SELECT id FROM chores.chores WHERE id = :id
                """),
                    {"id": chore["id"]},
                ).fetchone()

                if existing:
                    db.execute(
                        text("""
                        UPDATE chores.chores
                        SET name = :name, interval_days = :interval_days, due_date = :due_date,
                            is_private = :is_private, owner_email = :owner_email, last_done = :last_done,
                            room_id = :room_id
                        WHERE id = :id
                    """),
                        {
                            "name": chore["name"],
                            "interval_days": chore["interval_days"],
                            "due_date": chore["due_date"],
                            "is_private": chore.get("is_private", False),
                            "owner_email": user_email
                            if chore.get("is_private", False)
                            else None,
                            "last_done": chore.get("last_done"),
                            "room_id": room_id,
                            "id": chore["id"],
                        },
                    )
                    imported_chores.append({"id": chore["id"], "status": "updated"})
                    continue

            # RETURNING id statt separatem currval()-Call: pgbouncer/konforme
            # Pooler (Supabase Transaction-Pooler :6543) garantieren keine
            # Session-Pinning, currval wäre dort nicht zuverlässig.
            new_id = db.execute(
                text("""
                INSERT INTO chores.chores (name, interval_days, due_date, archived, owner_email, is_private, last_done, room_id)
                VALUES (:name, :interval_days, :due_date, :archived, :owner_email, :is_private, :last_done, :room_id)
                RETURNING id
            """),
                {
                    "name": chore["name"],
                    "interval_days": chore["interval_days"],
                    "due_date": chore["due_date"],
                    "archived": chore.get("archived", False),
                    "owner_email": user_email
                    if chore.get("is_private", False)
                    else None,
                    "is_private": chore.get("is_private", False),
                    "last_done": chore.get("last_done"),
                    "room_id": room_id,
                },
            ).scalar_one()
            imported_chores.append({"id": new_id, "status": "created"})

        except Exception as e:
            print(f"Error importing chore {chore.get('name')}: {e}")
            continue

    db.commit()
    log_action(None, user_email, "import", {"imported_chores": imported_chores})

    return {
        "message": "Import successful",
        "imported_chores": len(imported_chores),
        "details": imported_chores,
    }
