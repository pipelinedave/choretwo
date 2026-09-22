import logging
from typing import List, Optional
from datetime import datetime, date

logger = logging.getLogger(__name__)


def _to_date(value) -> Optional[date]:
    """Konvertiert date/datetime/ISO-String in ein date-Objekt."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
        except (ValueError, TypeError):
            return None
    return None


async def generate_suggestions(user_email: str, chores: List) -> List[dict]:
    """Erzeugt echte, deterministische Vorschläge aus den geladenen Chores.

    Priorisiert überfällige > heute fällige > bald fällige (7 Tage) Chores.
    `chores` sind chore-service-ORM-Objekte (Attribute .name/.due_date/.done).
    """
    suggestions = []

    if not chores:
        return suggestions

    today = date.today()
    for chore in chores:
        if getattr(chore, "done", False) or getattr(chore, "archived", False):
            continue

        due = _to_date(getattr(chore, "due_date", None))
        name = getattr(chore, "name", "Chore")
        if due is None:
            continue

        days_until_due = (due - today).days

        if days_until_due < 0:
            suggestions.append(
                {
                    "chore_name": name,
                    "reason": "Overdue",
                    "priority": 1.0,
                }
            )
        elif days_until_due == 0:
            suggestions.append(
                {
                    "chore_name": name,
                    "reason": "Due today",
                    "priority": 0.9,
                }
            )
        elif days_until_due <= 7:
            suggestions.append(
                {
                    "chore_name": name,
                    "reason": "Due within a week",
                    "priority": 0.7,
                }
            )

    # Nach Priorität sortieren
    suggestions.sort(key=lambda x: x["priority"], reverse=True)
    return suggestions[:5]  # Top 5


async def analyze_patterns(user_email: str, period: str = "30d") -> dict:
    """Analyze chore completion patterns"""
    # Parse period
    # Placeholder for actual analysis
    # In production, this would query chore history
    return {
        "health_score": 75,
        "trends": {
            "completion_rate": "+5%",
            "avg_delay": "-1h",
            "chores_completed": 12,
        },
        "recommendations": [
            "Consider increasing frequency for weekly chores",
            "Great progress on overdue chores!",
            "Try to complete chores earlier in the day",
        ],
    }


def calculate_health_score(chores: List) -> int:
    """Calculate overall health score from chores"""
    if not chores:
        return 100

    total = len(chores)
    done = sum(1 for c in chores if getattr(c, "done", False))

    today = date.today()
    overdue = 0
    for c in chores:
        due = _to_date(getattr(c, "due_date", None))
        if due and due < today and not getattr(c, "done", False):
            overdue += 1

    completion_rate = done / total if total > 0 else 1.0
    overdue_penalty = min(overdue * 5, 30)  # Max 30 point penalty

    score = int(completion_rate * 100 - overdue_penalty)
    return max(0, min(100, score))
