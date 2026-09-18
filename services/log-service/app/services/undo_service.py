import json

from sqlalchemy.orm import Session
from sqlalchemy import text

from app.services.log_service import create_log


async def undo_action(log_id: int, user_email: str, db: Session) -> dict:
    log_entry = db.execute(
        text("""
        SELECT action_type, action_details, chore_id FROM logs.chore_logs WHERE id = :log_id
    """),
        {"log_id": log_id},
    ).fetchone()

    if not log_entry:
        raise ValueError("Log entry not found")

    action_type = log_entry[0]
    action_details = log_entry[1]
    chore_id = log_entry[2]

    if isinstance(action_details, str):
        action_details = json.loads(action_details)

    # Undo führt die Chore-Zustandsänderungen DIREKT in der geteilten DB aus
    # (Monolith: eine Engine/DB für alle Services) statt per HTTP-Round-Trip zu
    # `CHORE_SERVICE_URL` (Standard "http://chore-service:8000/api" ist ein
    # Kubernetes/Docker-DNS-Name, der im Monolith nicht auflösbar ist → 500
    # "Name or service not known"). In-process-DB-Update funktioniert in beiden
    # Deployment-Varianten (Standalone + Monolith) und ist nicht von Netzwerk/
    # Hostname abhängig.
    _archieve_owner = "AND owner_email = :owner"

    if action_type == "created":
        chore_id = action_details.get("id")
        if chore_id:
            db.execute(
                text(
                    "UPDATE chores.chores SET archived = TRUE "
                    "WHERE id = :cid " + _archieve_owner
                ),
                {"cid": chore_id, "owner": user_email},
            )
            db.commit()

    elif action_type == "updated":
        previous_state = action_details.get("previous_state", {})
        pid = previous_state.get("id")
        if previous_state and pid:
            db.execute(
                text(
                    "UPDATE chores.chores SET name = :name, interval_days = :iv, "
                    "due_date = :due, updated_at = CURRENT_TIMESTAMP "
                    "WHERE id = :cid " + _archieve_owner
                ),
                {
                    "name": previous_state.get("name"),
                    "iv": previous_state.get("interval_days"),
                    "due": previous_state.get("due_date"),
                    "cid": pid,
                    "owner": user_email,
                },
            )
            db.commit()

    elif action_type == "marked_done":
        chore_id = action_details.get("chore_id")
        if chore_id:
            previous_due_date = action_details.get("previous_due_date")
            if previous_due_date:
                db.execute(
                    text(
                        "UPDATE chores.chores SET done = FALSE, last_done = NULL, "
                        "done_by = NULL, due_date = :due "
                        "WHERE id = :cid " + _archieve_owner
                    ),
                    {"due": previous_due_date, "cid": chore_id, "owner": user_email},
                )
            else:
                db.execute(
                    text(
                        "UPDATE chores.chores SET done = FALSE, last_done = NULL, "
                        "done_by = NULL WHERE id = :cid " + _archieve_owner
                    ),
                    {"cid": chore_id, "owner": user_email},
                )
            db.commit()

    elif action_type == "archived":
        chore_id = action_details.get("id")
        if chore_id:
            db.execute(
                text(
                    "UPDATE chores.chores SET archived = FALSE "
                    "WHERE id = :cid " + _archieve_owner
                ),
                {"cid": chore_id, "owner": user_email},
            )
            db.commit()

    create_log(
        db, chore_id, user_email, "undo", {"action_type": action_type, "undone": True}
    )

    return {
        "message": f"Action {action_type} undone successfully",
        "undone_action_type": action_type,
        "log_id": log_id,
    }
