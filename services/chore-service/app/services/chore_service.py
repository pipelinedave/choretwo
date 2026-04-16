from datetime import date, datetime
from typing import List, Optional
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models import Chore
from app.schemas import ChoreCreate, ChoreUpdate
from app.services.recurrence import calculate_next_due_date
from app.utils import log_action


def get_chores(
    db: Session, user_email: str, page: int = 1, limit: int = 10
) -> List[Chore]:
    offset = (page - 1) * limit
    query = (
        db.query(Chore)
        .filter(
            Chore.archived == False,
            (Chore.is_private == False)
            | (Chore.is_private == True and Chore.owner_email == user_email),
        )
        .order_by(Chore.due_date.asc())
        .offset(offset)
        .limit(limit)
    )

    return query.all()


def get_archived_chores(db: Session, user_email: str) -> List[Chore]:
    query = (
        db.query(Chore)
        .filter(
            Chore.archived == True,
            (Chore.is_private == False)
            | (Chore.is_private == True and Chore.owner_email == user_email),
        )
        .order_by(Chore.updated_at.desc())
    )

    return query.all()


def create_chore(db: Session, chore_data: ChoreCreate, user_email: str) -> Chore:
    chore = Chore(
        name=chore_data.name,
        interval_days=chore_data.interval_days,
        due_date=chore_data.due_date,
        is_private=chore_data.is_private,
        owner_email=user_email if chore_data.is_private else None,
        done=False,
        archived=False,
    )

    db.add(chore)
    db.commit()
    db.refresh(chore)

    log_action(
        chore.id,
        user_email,
        "created",
        {
            "name": chore.name,
            "interval_days": chore.interval_days,
            "due_date": chore.due_date.isoformat(),
        },
    )

    return chore


def get_chore(db: Session, chore_id: int, user_email: str) -> Optional[Chore]:
    chore = (
        db.query(Chore)
        .filter(
            Chore.id == chore_id,
            (Chore.is_private == False)
            | (Chore.is_private == True and Chore.owner_email == user_email),
        )
        .first()
    )

    return chore


def update_chore(
    db: Session, chore_id: int, chore_data: ChoreUpdate, user_email: str
) -> Optional[Chore]:
    chore = get_chore(db, chore_id, user_email)
    if not chore:
        return None

    previous_state = {
        "id": chore.id,
        "name": chore.name,
        "interval_days": chore.interval_days,
        "due_date": chore.due_date.isoformat(),
    }

    update_data = chore_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(chore, field, value)

    db.commit()
    db.refresh(chore)

    log_action(
        chore.id,
        user_email,
        "updated",
        {
            "previous_state": previous_state,
            "new_state": {
                "name": chore.name,
                "interval_days": chore.interval_days,
                "due_date": chore.due_date.isoformat(),
            },
        },
    )

    return chore


def mark_chore_done(db: Session, chore_id: int, user_email: str) -> Optional[Chore]:
    chore = get_chore(db, chore_id, user_email)
    if not chore:
        return None

    if chore.done:
        today = date.today()
        if chore.last_done and chore.last_done == today:
            raise ValueError("Chore already completed today")

    previous_due_date = chore.due_date
    previous_last_done = chore.last_done

    new_due_date = calculate_next_due_date(chore, date.today())

    chore.done = True
    chore.done_by = user_email
    chore.due_date = new_due_date
    chore.last_done = date.today()

    db.commit()
    db.refresh(chore)

    log_action(
        chore.id,
        user_email,
        "marked_done",
        {
            "chore_id": chore.id,
            "new_due_date": new_due_date.isoformat(),
            "previous_due_date": previous_due_date.isoformat(),
            "previous_last_done": previous_last_done.isoformat()
            if previous_last_done
            else None,
        },
    )

    return chore


def archive_chore(db: Session, chore_id: int, user_email: str) -> Optional[Chore]:
    chore = get_chore(db, chore_id, user_email)
    if not chore:
        return None

    chore.archived = True
    db.commit()
    db.refresh(chore)

    log_action(chore.id, user_email, "archived", {"chore_id": chore.id})

    return chore


def get_chore_stats(db: Session, user_email: str) -> dict:
    chores = (
        db.query(Chore)
        .filter(
            Chore.archived == False,
            (Chore.is_private == False)
            | (Chore.is_private == True and Chore.owner_email == user_email),
        )
        .all()
    )

    today = date.today()
    overdue = 0
    due_soon = 0
    on_track = 0

    for chore in chores:
        if chore.done:
            continue

        if chore.due_date < today:
            overdue += 1
        elif chore.due_date == today or (chore.due_date - today).days <= max(
            1, chore.interval_days // 3
        ):
            due_soon += 1
        else:
            on_track += 1

    return {
        "overdue": overdue,
        "due_soon": due_soon,
        "on_track": on_track,
        "total": len(chores),
    }
