from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException, Request, Depends, Query
from sqlalchemy.orm import Session
import json

from app.database import get_db
from app.schemas import ChoreLogCreate, ChoreLogResponse, UndoRequest, UndoResponse
from app.services.log_service import create_log, get_logs, get_log_by_id
from app.services.undo_service import undo_action

router = APIRouter(prefix="/api/logs")


@router.get("/")
async def list_logs(
    request: Request,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    user_email = request.state.user_email
    log_rows = get_logs(db, user_email, page, limit)

    logs = []
    for row in log_rows:
        action_details = row[4]
        if action_details and isinstance(action_details, str):
            try:
                action_details = json.loads(action_details)
            except json.JSONDecodeError:
                action_details = {}

        logs.append(
            {
                "id": row[0],
                "chore_id": row[1],
                "done_by": row[2],
                "done_at": row[3].isoformat() if row[3] else None,
                "action_details": action_details,
                "action_type": row[5],
            }
        )

    return logs


@router.get("/{log_id}")
async def get_log(request: Request, log_id: int, db: Session = Depends(get_db)):
    user_email = request.state.user_email
    row = get_log_by_id(db, log_id, user_email)

    if not row:
        raise HTTPException(status_code=404, detail="Log entry not found")

    action_details = row[4]
    if action_details and isinstance(action_details, str):
        try:
            action_details = json.loads(action_details)
        except json.JSONDecodeError:
            action_details = {}

    return {
        "id": row[0],
        "chore_id": row[1],
        "done_by": row[2],
        "done_at": row[3].isoformat() if row[3] else None,
        "action_details": action_details,
        "action_type": row[5],
    }


@router.post("/")
async def create_log_entry(
    request: Request, log_data: ChoreLogCreate, db: Session = Depends(get_db)
):
    user_email = request.state.user_email

    log_entry = create_log(
        db,
        log_data.chore_id,
        log_data.done_by or user_email,
        log_data.action_type,
        log_data.action_details,
    )

    return {
        "id": log_entry.id,
        "chore_id": log_entry.chore_id,
        "done_by": log_entry.done_by,
        "done_at": log_entry.done_at.isoformat(),
        "action_type": log_entry.action_type,
        "action_details": log_entry.action_details,
    }


@router.post("/bulk")
async def create_bulk_logs(
    request: Request, logs_data: list, db: Session = Depends(get_db)
):
    user_email = request.state.user_email
    created_logs = []

    for log_data in logs_data:
        log_entry = create_log(
            db,
            log_data.get("chore_id"),
            log_data.get("done_by") or user_email,
            log_data["action_type"],
            log_data.get("action_details"),
        )
        created_logs.append({"id": log_entry.id, "action_type": log_entry.action_type})

    return {"created": len(created_logs), "logs": created_logs}


@router.post("/undo")
async def undo_log_action(
    request: Request, undo_request: UndoRequest, db: Session = Depends(get_db)
):
    user_email = request.state.user_email

    try:
        result = await undo_action(undo_request.log_id, user_email, db)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Undo failed: {str(e)}")
