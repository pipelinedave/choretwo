from datetime import date, datetime, timedelta
from typing import List, Optional, Tuple
from sqlalchemy import text
from sqlalchemy.orm import Session

from chore.app.models import Chore
from chore.app.schemas import ChoreCreate, ChoreUpdate
from chore.app.services.recurrence import calculate_next_due_date
from chore.app.utils import log_action


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
        due_date=chore_data.due_date or date.today(),
        is_private=chore_data.is_private,
        owner_email=user_email,
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
            "id": chore.id,
            "name": chore.name,
            "interval_days": chore.interval_days,
            "due_date": chore.due_date.isoformat(),
            "is_private": chore.is_private,
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


def mark_chore_done(
    db: Session, chore_id: int, user_email: str, done_by: str = None
) -> Optional[Chore]:
    chore = get_chore(db, chore_id, user_email)
    if not chore:
        return None

    if done_by == "undo":
        chore.done = False
        chore.done_by = None
        db.commit()
        db.refresh(chore)
        return chore

    if chore.done:
        today = date.today()
        if chore.last_done and chore.last_done == today:
            raise ValueError("Chore already completed today")

    previous_due_date = chore.due_date
    previous_last_done = chore.last_done

    new_due_date = calculate_next_due_date(chore, date.today())

    chore.done = True
    chore.done_by = done_by or user_email
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

    log_action(chore.id, user_email, "archived", {"id": chore.id})

    return chore


def delete_chore(db: Session, chore_id: int, user_email: str) -> Optional[Chore]:
    chore = (
        db.query(Chore)
        .filter(
            Chore.id == chore_id,
            (Chore.is_private == False)
            | (Chore.is_private == True and Chore.owner_email == user_email),
        )
        .first()
    )

    if not chore:
        return None

    db.delete(chore)
    db.commit()

    log_action(chore.id, user_email, "deleted", {"id": chore.id, "name": chore.name})

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


def get_chore_bucket_counts(db: Session, user_email: str) -> dict:
    """Get chore counts by urgency bucket (mirrors choremane /chores/count)."""
    today = date.today()
    tomorrow = today + timedelta(days=1)
    next_week = today + timedelta(days=7)

    query = text("""
        SELECT COUNT(*),
               SUM(CASE WHEN due_date < :today THEN 1 ELSE 0 END),
               SUM(CASE WHEN due_date = :today THEN 1 ELSE 0 END),
               SUM(CASE WHEN due_date = :tomorrow THEN 1 ELSE 0 END),
               SUM(CASE WHEN due_date > :tomorrow AND due_date <= :next_week THEN 1 ELSE 0 END),
               SUM(CASE WHEN due_date > :next_week THEN 1 ELSE 0 END)
        FROM chores.chores
        WHERE archived = FALSE
        AND (is_private = FALSE OR (is_private = TRUE AND owner_email = :email))
    """)
    row = db.execute(
        query,
        {
            "email": user_email,
            "today": today,
            "tomorrow": tomorrow,
            "next_week": next_week,
        },
    ).fetchone()

    total = row[0] or 0
    overdue = row[1] or 0
    today_count = row[2] or 0
    tomorrow_count = row[3] or 0
    this_week_count = row[4] or 0
    upcoming_count = row[5] or 0

    return {
        "all": total,
        "overdue": overdue,
        "today": today_count,
        "tomorrow": tomorrow_count,
        "thisWeek": this_week_count,
        "upcoming": upcoming_count,
    }


def calculate_single_chore_score(
    due_date: datetime, interval_days: int, now: Optional[datetime] = None
) -> float:
    """Calculate health score for a single chore (from choremane services.py)."""
    if now is None:
        now = datetime.now()

    interval_ms = interval_days * 24 * 60 * 60 * 1000
    diff = now - due_date
    diff_ms = diff.total_seconds() * 1000

    score = 100.0

    if diff_ms > 0:
        overdue_ratio = diff_ms / interval_ms
        score = max(0, 80 - (overdue_ratio * 80))
    else:
        time_until_due = -diff_ms
        fraction_elapsed = 1 - (time_until_due / interval_ms)
        safe_fraction = max(0, min(1, fraction_elapsed))

        if safe_fraction <= 0.5:
            score = 100
        else:
            score = 100 + ((safe_fraction - 0.5) * -40)

    return score


def calculate_household_health_score(
    chore_rows: List[Tuple], now: Optional[datetime] = None
) -> int:
    """Calculate overall household health score from chore rows (from choremane services.py)."""
    if not chore_rows:
        return 100

    if now is None:
        now = datetime.now()

    total_score = 0.0
    active_chore_count = 0

    for row in chore_rows:
        due_date = row[0]
        interval_days = row[1]

        if interval_days is None or interval_days <= 0:
            continue

        try:
            if isinstance(due_date, str):
                due_date = datetime.fromisoformat(due_date)
            elif hasattr(due_date, "year") and not isinstance(due_date, datetime):
                due_date = datetime.combine(due_date, datetime.min.time())

            score = calculate_single_chore_score(due_date, interval_days, now)
            total_score += score
            active_chore_count += 1
        except (ValueError, TypeError):
            continue

    if active_chore_count == 0:
        return 100

    return int(round(total_score / active_chore_count))


def get_household_health(db: Session, user_email: str) -> dict:
    """Get household health score 0-100 (mirrors choremane /chores/household-health)."""
    query = text("""
        SELECT due_date, interval_days
        FROM chores.chores
        WHERE archived = FALSE
        AND interval_days IS NOT NULL
        AND interval_days > 0
        AND (is_private = FALSE OR (is_private = TRUE AND owner_email = :email))
    """)
    rows = db.execute(query, {"email": user_email}).fetchall()

    chore_rows = [(row[0], row[1]) for row in rows]
    score = calculate_household_health_score(chore_rows)
    return {"score": score}
