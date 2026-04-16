from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel


class ChoreLogCreate(BaseModel):
    chore_id: Optional[int] = None
    done_by: Optional[str] = None
    action_type: str
    action_details: Optional[dict] = None


class ChoreLogResponse(BaseModel):
    id: int
    chore_id: Optional[int]
    done_by: Optional[str]
    done_at: datetime
    action_type: str
    action_details: Optional[dict]

    class Config:
        from_attributes = True


class UndoRequest(BaseModel):
    log_id: int


class UndoResponse(BaseModel):
    message: str
    undone_action_type: str
    log_id: int
