from datetime import datetime, timezone
from typing import Optional


def to_utc_iso(dt: Optional[datetime]) -> Optional[str]:
    """Serialize datetime as UTC ISO-8601 with explicit offset.

    DB stores naive UTC (TIMESTAMP without tz, datetime.utcnow).
    Tz-less ISO is parsed as local time by the frontend (+2h bias in CEST),
    so always emit a Z-suffixed UTC string.
    """
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
