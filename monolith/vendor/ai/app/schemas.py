from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    intent: str
    parameters: dict
    confidence: float
    requires_confirmation: bool = True
    suggested_action: Optional[str] = None


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
    ollama_connected: bool
    available_models: List[str]
    current_model: str
