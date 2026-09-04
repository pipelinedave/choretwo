import logging
import re
from typing import Optional
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


def extract_interval(message: str) -> Optional[int]:
    """Extract interval in days from message"""
    patterns = [
        r"every\s+(\d+)\s+day(?:s)?",
        r"every\s+(\d+)\s+week(?:s)?",
        r"every\s+(\d+)\s+month(?:s)?",
        r"(\d+)\s+day(?:s)?",
        r"(\d+)\s+week(?:s)?",
    ]

    message_lower = message.lower()

    for pattern in patterns:
        match = re.search(pattern, message_lower)
        if match:
            value = int(match.group(1))
            if "week" in pattern:
                return value * 7
            if "month" in pattern:
                return value * 30
            return value

    return None


def extract_chore_name(message: str) -> Optional[str]:
    """Extract chore name from message"""
    # Common patterns
    patterns = [
        r"mark\s+(.+?)\s+done",
        r"add\s+(.+?)(?:\s+every|\s+to|\s+for|$)",
        r"push\s+(.+?)\s+to",
        r"archive\s+(.+?)(?:\s+|$)",
    ]

    message_lower = message.lower()

    for pattern in patterns:
        match = re.search(pattern, message_lower)
        if match:
            return match.group(1).strip()

    # Default: return last word or phrase before action word
    return None


def parse_due_date(message: str) -> Optional[str]:
    """Parse due date from message"""
    message_lower = message.lower()

    if "next week" in message_lower:
        return (datetime.now() + timedelta(days=7)).isoformat()
    if "next month" in message_lower:
        return (datetime.now() + timedelta(days=30)).isoformat()
    if "tomorrow" in message_lower:
        return (datetime.now() + timedelta(days=1)).isoformat()

    # Try to parse specific date
    date_patterns = [
        r"(\d{1,2})\/(\d{1,2})\/(\d{2,4})",
        r"(\d{4})-(\d{2})-(\d{2})",
    ]

    for pattern in date_patterns:
        match = re.search(pattern, message)
        if match:
            # Simple parsing - could be improved
            try:
                if len(match.groups()) == 3:
                    if len(match.group(3)) == 2:
                        year = "20" + match.group(3)
                    else:
                        year = match.group(3)
                    date_str = f"{year}-{match.group(2)}-{match.group(1)}"
                    return datetime.strptime(date_str, "%Y-%m-%d").isoformat()
            except:
                pass

    return None


def extract_entities(message: str) -> dict:
    """Extract all entities from message"""
    return {
        "chore_name": extract_chore_name(message),
        "interval_days": extract_interval(message),
        "due_date": parse_due_date(message),
    }
