from datetime import date, timedelta
from typing import Optional

from app.models import Chore


def calculate_next_due_date(
    chore: "Chore", completed_date: Optional[date] = None
) -> date:
    base_date = completed_date or date.today()
    return base_date + timedelta(days=chore.interval_days)


def calculate_chore_score(due_date: date, interval_days: int) -> float:
    now = date.today()
    interval_days_float = float(interval_days)

    diff = (now - due_date).days

    if diff > 0:
        overdue_ratio = diff / interval_days_float
        score = max(0.0, 80.0 - (overdue_ratio * 80.0))
    else:
        time_until_due = -diff
        fraction_elapsed = 1.0 - (time_until_due / interval_days_float)

        if fraction_elapsed <= 0.5:
            score = 100.0
        else:
            score = 100.0 + ((fraction_elapsed - 0.5) * -40.0)

    return max(0.0, min(100.0, score))


def is_chore_overdue(chore: "Chore") -> bool:
    return date.today() > chore.due_date and not chore.done


def get_due_soon_threshold(interval_days: int) -> int:
    return max(1, interval_days // 3)
