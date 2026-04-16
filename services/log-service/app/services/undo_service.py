from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
import httpx
import json
import logging

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

    chore_service_url = "http://chore-service:80/api"

    if action_type == "created":
        chore_id = action_details.get("id")
        if chore_id:
            async with httpx.AsyncClient() as client:
                await client.put(f"{chore_service_url}/chores/{chore_id}/archive")

    elif action_type == "updated":
        previous_state = action_details.get("previous_state", {})
        if previous_state:
            async with httpx.AsyncClient() as client:
                await client.put(
                    f"{chore_service_url}/chores/{previous_state['id']}",
                    json={
                        "name": previous_state.get("name"),
                        "interval_days": previous_state.get("interval_days"),
                        "due_date": previous_state.get("due_date"),
                    },
                )

    elif action_type == "marked_done":
        chore_id = action_details.get("chore_id")
        if chore_id:
            async with httpx.AsyncClient() as client:
                await client.put(
                    f"{chore_service_url}/chores/{chore_id}/done",
                    json={"done_by": "undo", "restore": True},
                )

    elif action_type == "archived":
        chore_id = action_details.get("id")
        if chore_id:
            async with httpx.AsyncClient() as client:
                await client.put(f"{chore_service_url}/chores/{chore_id}/unarchive")

    create_log(
        db, chore_id, user_email, "undo", {"action_type": action_type, "undone": True}
    )

    return {
        "message": f"Action {action_type} undone successfully",
        "undone_action_type": action_type,
        "log_id": log_id,
    }
