from datetime import date
from typing import Optional, List
from pydantic import BaseModel, Field


class NotificationPreferencesUpdate(BaseModel):
    enabled: Optional[bool] = None
    notify_times: Optional[List[str]] = None
    notify_overdue: Optional[bool] = None
    notify_soon: Optional[bool] = None


class AIUserPreferencesUpdate(BaseModel):
    learning_enabled: Optional[bool] = None
    suggestion_types: Optional[List[str]] = None


class NotificationPreferencesGet(BaseModel):
    enabled: bool
    notify_times: List[str]
    notify_overdue: bool
    notify_soon: bool
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class AIUserPreferencesGet(BaseModel):
    learning_enabled: bool
    suggestion_types: List[str]
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class AppearanceSettings(BaseModel):
    theme: str = Field(default="system", pattern="^(light|dark|system)$")


class SettingsResponse(BaseModel):
    notifications: NotificationPreferencesGet
    ai: AIUserPreferencesGet
    appearance: AppearanceSettings


class SettingsUpdate(BaseModel):
    notifications: Optional[NotificationPreferencesUpdate] = None
    ai: Optional[AIUserPreferencesUpdate] = None
    appearance: Optional[AppearanceSettings] = None


class ChoreCreate(BaseModel):
    name: str
    interval_days: Optional[int] = Field(
        default=1, ge=1, description="Interval in days"
    )
    due_date: Optional[date] = Field(
        default=None, description="Due date (defaults to today)"
    )
    is_private: bool = False


class ChoreUpdate(BaseModel):
    name: Optional[str] = None
    interval_days: Optional[int] = Field(None, ge=1)
    due_date: Optional[date] = None
    done: Optional[bool] = None
    last_done: Optional[date] = None
    done_by: Optional[str] = None


class ChoreResponse(BaseModel):
    id: int
    name: str
    interval_days: int
    due_date: date
    done: bool
    done_by: Optional[str]
    last_done: Optional[date]
    owner_email: Optional[str]
    is_private: bool
    archived: bool

    class Config:
        from_attributes = True


class ChoreStats(BaseModel):
    overdue: int
    due_soon: int
    on_track: int
    total: int


class ImportExportData(BaseModel):
    chores: List[ChoreResponse]
    logs: Optional[List[dict]] = []
