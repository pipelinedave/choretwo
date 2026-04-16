import logging
from typing import List, Optional
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


async def generate_suggestions(user_email: str, chores: List[dict]) -> List[dict]:
    """Generate chore suggestions based on patterns"""
    suggestions = []

    if not chores:
        return suggestions

    # Simple pattern-based suggestions
    for chore in chores:
        if chore.get("done"):
            continue

        due_date = chore.get("due_date")
        if due_date:
            try:
                due = (
                    datetime.fromisoformat(due_date)
                    if isinstance(due_date, str)
                    else due_date
                )
                days_until_due = (due - datetime.now()).days

                if days_until_due <= 1:
                    suggestions.append(
                        {
                            "chore_name": chore.get("name"),
                            "reason": "Due soon" if days_until_due == 1 else "Overdue",
                            "priority": 0.9 if days_until_due <= 0 else 0.7,
                        }
                    )
            except Exception as e:
                logger.error(f"Error processing chore due date: {e}")

    # Sort by priority
    suggestions.sort(key=lambda x: x["priority"], reverse=True)

    return suggestions[:5]  # Return top 5 suggestions


async def analyze_patterns(user_email: str, period: str = "30d") -> dict:
    """Analyze chore completion patterns"""
    # Parse period
    if period == "7d":
        days = 7
    elif period == "30d":
        days = 30
    elif period == "90d":
        days = 90
    else:
        days = 30

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


def calculate_health_score(chores: List[dict]) -> int:
    """Calculate overall health score from chores"""
    if not chores:
        return 100

    total = len(chores)
    done = sum(1 for c in chores if c.get("done"))
    overdue = sum(
        1
        for c in chores
        if c.get("due_date")
        and c.get("due_date") < datetime.now().isoformat()
        and not c.get("done")
    )

    completion_rate = done / total if total > 0 else 1.0
    overdue_penalty = min(overdue * 5, 30)  # Max 30 point penalty

    score = int(completion_rate * 100 - overdue_penalty)
    return max(0, min(100, score))
