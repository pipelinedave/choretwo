from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class NotificationPreferencesCreate(BaseModel):
    enabled: bool = True
    notify_times: List[str] = Field(default=["09:00", "18:00"])
    notify_overdue: bool = True
    notify_soon: bool = True


class NotificationPreferencesResponse(BaseModel):
    user_email: str
    enabled: bool
    notify_times: List[str]
    notify_overdue: bool
    notify_soon: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ScheduledNotificationCreate(BaseModel):
    user_email: str
    chore_id: Optional[int] = None
    scheduled_for: datetime
    notification_type: str


class ScheduledNotificationResponse(BaseModel):
    id: int
    user_email: str
    chore_id: Optional[int]
    scheduled_for: datetime
    sent_at: Optional[datetime]
    notification_type: str
    processed: bool

    class Config:
        from_attributes = True


class TestNotificationRequest(BaseModel):
    message: str = "This is a test notification"
    priority: int = 1
