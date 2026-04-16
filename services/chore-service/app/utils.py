import json
import logging
from datetime import datetime, date
from sqlalchemy import text

from app.database import get_db


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

    try:
        db = next(get_db())
        cur = db.cursor()
        cur.execute(
            """
            INSERT INTO logs.chore_logs (chore_id, done_by, action_type, action_details)
            VALUES (%s, %s, %s, %s)
            """,
            (chore_id, done_by, action_type, action_details_str),
        )
        db.commit()
        cur.close()
        db.close()
        logging.info(f"Action logged successfully for action_type={action_type}")
    except Exception as e:
        logging.error(f"Error logging action for chore_id={chore_id}: {e}")
