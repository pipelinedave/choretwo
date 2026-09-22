from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str
    user_id: Optional[str] = None


class ChatResponse(BaseModel):
    intent: str
    parameters: dict
    confidence: float
    requires_confirmation: bool = True
    suggested_action: Optional[str] = None
    # Direkt anzeigbarer, menschenlesbarer Text für das Frontend
    message: Optional[str] = None
    # ID des gespeicherten Vorschlags (ai.command_history) für den
    # /execute-Endpoint — nur gesetzt, wenn requires_confirmation.
    proposal_id: Optional[int] = None


class ExecuteRequest(BaseModel):
    proposal_id: int = Field(..., description="ID des bestätigten Vorschlags")


class ExecuteResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None


class Suggestion(BaseModel):
    chore_name: str
    reason: str
    priority: float


class AnalysisRequest(BaseModel):
    period: str = "30d"


class TrendData(BaseModel):
    completion_rate: Optional[str] = None
    avg_delay: Optional[str] = None
    chores_completed: Optional[int] = None


class AnalysisResponse(BaseModel):
    health_score: int
    trends: TrendData
    recommendations: List[str]


class StatusResponse(BaseModel):
    status: str
    llm_connected: bool
    llm_provider: str
    available_models: List[str]
    current_model: str
