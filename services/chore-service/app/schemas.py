from datetime import date
from typing import Optional, List
from pydantic import BaseModel, Field


class ChoreCreate(BaseModel):
    name: str
    interval_days: int = Field(..., ge=1, description="Interval in days")
    due_date: date
    is_private: bool = False


class ChoreUpdate(BaseModel):
    name: Optional[str] = None
    interval_days: Optional[int] = Field(None, ge=1)
    due_date: Optional[date] = None


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
