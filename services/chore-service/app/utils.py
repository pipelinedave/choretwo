import json
import logging
from datetime import datetime, date, timezone
from typing import Optional
from sqlalchemy import text

from app.database import SessionLocal


def to_utc_iso(dt: Optional[datetime]) -> Optional[str]:
    """Serialize datetime as UTC ISO-8601 with explicit offset.

    Duplicated from log-service (cross-service import impractical).
    Naive datetimes are treated as UTC; output is Z-suffixed.
    """
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def log_action(chore_id, done_by, action_type, action_details=None):
    if isinstance(action_details, dict):
        action_details = {
            key: (value.isoformat() if isinstance(value, (datetime, date)) else value)
            for key, value in action_details.items()
        }
    action_details_str = json.dumps(action_details) if action_details else "{}"
    logging.info(
        f"Logging action for chore_id={chore_id}, action_type={action_type}, details={action_details_str}"
    )

    db = SessionLocal()
    try:
        db.execute(
            text(
                "INSERT INTO logs.chore_logs (chore_id, done_by, action_type, action_details) VALUES (:chore_id, :done_by, :action_type, :action_details)"
            ),
            {
                "chore_id": chore_id,
                "done_by": done_by,
                "action_type": action_type,
                "action_details": action_details_str,
            },
        )
        db.commit()
        logging.info(f"Action logged successfully for action_type={action_type}")
    except Exception as e:
        logging.error(f"Error logging action for chore_id={chore_id}: {e}")
        db.rollback()
    finally:
        db.close()
