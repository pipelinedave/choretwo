from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List
import logging

from app.database import get_db
from app.ollama_client import OllamaClient
from app.nlp.intent_parser import parse_intent, validate_intent
from app.schemas import (
    ChatRequest,
    ChatResponse,
    Suggestion,
    AnalysisRequest,
    AnalysisResponse,
    StatusResponse,
)
from app.services.suggestions import (
    generate_suggestions,
    analyze_patterns,
    calculate_health_score,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai")

# Global Ollama client (initialized on startup)
ollama_client: Optional[OllamaClient] = None


def get_ollama_client() -> OllamaClient:
    global ollama_client
    if ollama_client is None:
        ollama_client = OllamaClient()
    return ollama_client


@router.post("/chat")
async def chat_with_ai(
    request: Request,
    chat_request: ChatRequest,
    db: Session = Depends(get_db),
    ollama: OllamaClient = Depends(get_ollama_client),
):
    """Parse natural language command and return intent"""
    user_email = request.state.user_email

    try:
        # Parse intent using LLM
        parsed = await parse_intent(chat_request.message, ollama)

        # Validate intent
        is_valid = await validate_intent(
            parsed["intent"], parsed["parameters"], parsed["confidence"]
        )

        if not is_valid:
            return ChatResponse(
                intent="unknown",
                parameters={},
                confidence=0.0,
                requires_confirmation=False,
                suggested_action="I couldn't understand that command. Try phrases like 'Mark dishes done' or 'Add laundry every 3 days'",
            )

        # Generate suggested action text
        intent = parsed["intent"]
        params = parsed["parameters"]

        if intent == "mark_done":
            suggested_action = f"Mark chore '{params.get('chore_name')}' as complete?"
        elif intent == "create_chore":
            interval = params.get("interval_days", 1)
            suggested_action = (
                f"Create new chore '{params.get('name')}' with {interval} day interval?"
            )
        elif intent == "update_chore":
            suggested_action = f"Update chore '{params.get('chore_name')}'?"
        elif intent == "archive":
            suggested_action = f"Archive chore '{params.get('chore_name')}'?"
        else:
            suggested_action = "Perform this action?"

        # Log command to history
        db.execute(
            text("""
            INSERT INTO ai.command_history (user_email, original_message, parsed_intent, executed)
            VALUES (:email, :message, :intent, FALSE)
        """),
            {"email": user_email, "message": chat_request.message, "intent": intent},
        )
        db.commit()

        return ChatResponse(
            intent=intent,
            parameters=params,
            confidence=parsed["confidence"],
            requires_confirmation=True,
            suggested_action=suggested_action,
        )

    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=f"AI processing failed: {str(e)}")


@router.get("/suggestions", response_model=List[Suggestion])
async def get_suggestions(request: Request, db: Session = Depends(get_db)):
    """Get AI-powered chore suggestions"""
    user_email = request.state.user_email

    # In production, fetch actual chores from chore-service
    # For now, return placeholder suggestions
    suggestions = [
        Suggestion(
            chore_name="dishes", reason="Typically done at this time", priority=0.9
        ),
        Suggestion(
            chore_name="trash", reason="Due soon based on pattern", priority=0.7
        ),
    ]

    return suggestions


@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_chore_patterns(
    request: Request, analysis_request: AnalysisRequest, db: Session = Depends(get_db)
):
    """Analyze chore completion patterns and provide insights"""
    user_email = request.state.user_email

    try:
        result = await analyze_patterns(user_email, analysis_request.period)

        return AnalysisResponse(
            health_score=result["health_score"],
            trends=TrendData(
                completion_rate=result["trends"]["completion_rate"],
                avg_delay=result["trends"]["avg_delay"],
                chores_completed=result["trends"]["chores_completed"],
            ),
            recommendations=result["recommendations"],
        )
    except Exception as e:
        logger.error(f"Analysis error: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.get("/status", response_model=StatusResponse)
async def get_ai_status(ollama: OllamaClient = Depends(get_ollama_client)):
    """Get AI service status and Ollama connectivity"""
    try:
        is_connected = await ollama.is_healthy()
        models = await ollama.get_available_models() if is_connected else []

        return StatusResponse(
            status="healthy" if is_connected else "degraded",
            ollama_connected=is_connected,
            available_models=models,
            current_model=ollama.model,
        )
    except Exception as e:
        logger.error(f"Status check error: {e}")
        return StatusResponse(
            status="unhealthy",
            ollama_connected=False,
            available_models=[],
            current_model="unknown",
        )
