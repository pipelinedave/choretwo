from fastapi import APIRouter, Request, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
import json

from app.database import get_db
from app.utils import log_action

router = APIRouter(prefix="/api")


@router.get("/export")
async def export_data(request: Request, db: Session = Depends(get_db)):
    user_email = request.state.user_email

    chores_query = db.execute(
        text("""
        SELECT id, name, interval_days, due_date, done, done_by, archived, owner_email, is_private, last_done
        FROM chores.chores
        WHERE archived = FALSE AND (is_private = FALSE OR (is_private = TRUE AND owner_email = :email))
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
        }
        chores.append(chore)

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
            "done_at": row[3].isoformat() if row[3] else None,
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

    return {"chores": chores, "logs": logs}


@router.post("/import")
async def import_data(request: Request, db: Session = Depends(get_db)):
    user_email = request.state.user_email

    try:
        import_data = await request.json()
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    if not import_data.get("chores"):
        raise HTTPException(status_code=400, detail="No chores data found")

    imported_chores = []

    for chore in import_data["chores"]:
        try:
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
                            is_private = :is_private, owner_email = :owner_email, last_done = :last_done
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
                            "id": chore["id"],
                        },
                    )
                    imported_chores.append({"id": chore["id"], "status": "updated"})
                    continue

            db.execute(
                text("""
                INSERT INTO chores.chores (name, interval_days, due_date, archived, owner_email, is_private, last_done)
                VALUES (:name, :interval_days, :due_date, :archived, :owner_email, :is_private, :last_done)
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
                },
            )

            new_id = db.execute(
                text("SELECT currval('chores.chores_id_seq')")
            ).fetchone()[0]
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
