from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
import json

from app.models import ChoreLog


def create_log(
    db: Session,
    chore_id: Optional[int],
    done_by: Optional[str],
    action_type: str,
    action_details: Optional[dict] = None,
) -> ChoreLog:
    log_entry = ChoreLog(
        chore_id=chore_id,
        done_by=done_by,
        action_type=action_type,
        action_details=action_details,
    )

    db.add(log_entry)
    db.commit()
    db.refresh(log_entry)

    return log_entry


def get_logs(db: Session, user_email: str, page: int = 1, limit: int = 50):
    offset = (page - 1) * limit

    query = text("""
        SELECT l.id, l.chore_id, l.done_by, l.done_at, l.action_details, l.action_type
        FROM logs.chore_logs l
        LEFT JOIN chores.chores c ON l.chore_id = c.id
        WHERE c.id IS NULL
           OR c.is_private = FALSE
           OR (c.is_private = TRUE AND c.owner_email = :email)
        ORDER BY l.done_at DESC
        LIMIT :limit OFFSET :offset
    """)

    result = db.execute(query, {"email": user_email, "limit": limit, "offset": offset})
    return result.fetchall()


def get_log_by_id(db: Session, log_id: int, user_email: str):
    query = text("""
        SELECT l.id, l.chore_id, l.done_by, l.done_at, l.action_details, l.action_type
        FROM logs.chore_logs l
        LEFT JOIN chores.chores c ON l.chore_id = c.id
        WHERE l.id = :log_id
          AND (c.id IS NULL OR c.is_private = FALSE OR (c.is_private = TRUE AND c.owner_email = :email))
    """)

    result = db.execute(query, {"log_id": log_id, "email": user_email})
    row = result.fetchone()
    return row
