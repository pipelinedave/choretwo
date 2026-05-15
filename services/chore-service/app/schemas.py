from datetime import date
from typing import Optional, List
from pydantic import BaseModel, Field


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
