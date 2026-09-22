from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List, Optional
import logging

from app.database import get_db
from app.llm_client import LLMClient
from app.nlp.intent_parser import parse_intent, validate_intent
from app.schemas import (
    ChatRequest,
    ChatResponse,
    ExecuteRequest,
    ExecuteResponse,
    Suggestion,
    AnalysisRequest,
    AnalysisResponse,
    TrendData,
    StatusResponse,
)
from app.models import CommandHistory
from app.services.suggestions import generate_suggestions, analyze_patterns
from app.services.action_executor import (
    execute_proposal,
    _chore_service,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai")

# Globaler LLM-Client (initialisiert auf Startup)
llm_client: Optional[LLMClient] = None


def get_llm_client() -> LLMClient:
    global llm_client
    if llm_client is None:
        llm_client = LLMClient()
    return llm_client


def _chore_service_available() -> bool:
    return _chore_service() is not None


def _load_user_chores(db: Session, user_email: str, limit: int = 100):
    """Lädt offene Chores des Users über die chore-service-Funktionen."""
    svc = _chore_service()
    if svc is None:
        return []
    try:
        return svc.get_chores(db, user_email, page=1, limit=limit)
    except Exception as e:  # pragma: no cover
        logger.error(f"Fehler beim Laden der Chores: {e}")
        return []


@router.post("/chat", response_model=ChatResponse)
async def chat_with_ai(
    request: Request,
    chat_request: ChatRequest,
    db: Session = Depends(get_db),
    llm: LLMClient = Depends(get_llm_client),
):
    """Parse natural language command, return a Proposal (nie direkt ausführen)."""
    user_email = request.state.user_email

    # Parse intent (LLM-Provider mit deterministischem Fallback)
    parsed = await parse_intent(chat_request.message, llm)

    # Validieren
    is_valid = await validate_intent(
        parsed["intent"], parsed["parameters"], parsed["confidence"]
    )

    if not is_valid:
        return ChatResponse(
            intent="unknown",
            parameters={},
            confidence=parsed["confidence"],
            requires_confirmation=False,
            suggested_action="I couldn't understand that command. Try phrases like 'Mark dishes done' or 'Add laundry every 3 days'",
            message="Ich konnte den Befehl nicht verstehen. Versuche z.B. 'Markiere Geschirr als erledigt' oder 'Lege Wäsche alle 3 Tage an'.",
        )

    # Vorschlags-/Bestätigungstext aufbauen
    intent = parsed["intent"]
    params = parsed["parameters"]

    if intent == "mark_done":
        suggested_action = f"Mark chore '{params.get('chore_name')}' as complete?"
        message = f"Soll ich **'{params.get('chore_name')}'** als erledigt markieren?"
    elif intent == "create_chore":
        interval = params.get("interval_days", 7)
        suggested_action = (
            f"Create new chore '{params.get('name')}' with {interval} day interval?"
        )
        message = (
            f"Soll ich die neue Aufgabe **'{params.get('name')}'** "
            f"mit einem Intervall von {interval} Tagen anlegen?"
        )
    elif intent == "update_chore":
        suggested_action = f"Update chore '{params.get('chore_name')}'?"
        message = (
            f"Soll ich die Aufgabe **'{params.get('chore_name')}'** aktualisieren?"
        )
    elif intent == "archive":
        suggested_action = f"Archive chore '{params.get('chore_name')}'?"
        message = f"Soll ich die Aufgabe **'{params.get('chore_name')}'** archivieren?"
    else:
        suggested_action = "Perform this action?"
        message = "Was soll ich als Nächstes tun?"

    # Proposal als Vorschlag (executed=FALSE) speichern — nie direkt ausführen.
    hist = CommandHistory(
        user_email=user_email,
        original_message=chat_request.message,
        parsed_intent=intent,
        executed=False,
    )
    db.add(hist)
    db.commit()
    db.refresh(hist)

    return ChatResponse(
        intent=intent,
        parameters=params,
        confidence=parsed["confidence"],
        requires_confirmation=True,
        suggested_action=suggested_action,
        message=message,
        proposal_id=hist.id,
    )


@router.post("/execute", response_model=ExecuteResponse)
@router.post("/confirm", response_model=ExecuteResponse)
async def execute_proposal_endpoint(
    request: Request,
    execute_request: ExecuteRequest,
    db: Session = Depends(get_db),
):
    """Führt ein bestätigtes Proposal (proposal_id) real aus via chore-service."""
    user_email = request.state.user_email

    hist = (
        db.query(CommandHistory)
        .filter(CommandHistory.id == execute_request.proposal_id)
        .first()
    )
    if hist is None:
        raise HTTPException(
            status_code=404,
            detail=f"Proposal {execute_request.proposal_id} nicht gefunden",
        )
    if hist.user_email != user_email:
        raise HTTPException(status_code=403, detail="Zugriff verweigert")

    if hist.executed:
        return ExecuteResponse(
            success=True, message="Dieser Vorschlag wurde bereits ausgeführt."
        )

    # Parameter aus dem CommandHistory rehydrieren — wir speichern die
    # parameters nicht explizit am Model, daher re-parsen wir die Nachricht.
    # Fallback: Intent ohne detail -> unknown / Fehler.
    from app.nlp.intent_parser import parse_intent_deterministic

    llm = get_llm_client()
    if llm.configured:
        parsed = await parse_intent(hist.original_message, llm)
    else:
        parsed = parse_intent_deterministic(hist.original_message)
    params = parsed.get("parameters", {})

    if not _chore_service_available():
        raise HTTPException(
            status_code=503,
            detail="chore-service ist im Monolith nicht verfügbar (Copilot-Execute inaktiv)",
        )

    result = execute_proposal(db, hist.parsed_intent, params, user_email)

    if result.get("success"):
        hist.executed = True
        db.commit()
        return ExecuteResponse(
            success=True,
            message=f"Aktion ausgeführt ({hist.parsed_intent}).",
            data=result.get("data"),
        )

    raise HTTPException(
        status_code=422,
        detail=result.get("error", "Ausführung fehlgeschlagen"),
    )


@router.get("/suggestions", response_model=List[Suggestion])
async def get_suggestions(request: Request, db: Session = Depends(get_db)):
    """Echte, deterministische Vorschläge aus der chore-service-DB."""
    user_email = request.state.user_email

    chores = _load_user_chores(db, user_email)
    suggestions = await generate_suggestions(user_email, chores)

    return [
        Suggestion(
            chore_name=s["chore_name"],
            reason=s["reason"],
            priority=s["priority"],
        )
        for s in suggestions
    ]


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
async def get_ai_status(llm: LLMClient = Depends(get_llm_client)):
    """Get AI service status and LLM provider connectivity"""
    try:
        is_connected = await llm.is_healthy()
        models = await llm.get_available_models() if is_connected else []

        return StatusResponse(
            status="healthy" if is_connected else "degraded",
            llm_connected=is_connected,
            llm_provider=llm.provider,
            available_models=models,
            current_model=llm.model,
        )
    except Exception as e:
        logger.error(f"Status check error: {e}")
        return StatusResponse(
            status="unhealthy",
            llm_connected=False,
            llm_provider="unknown",
            available_models=[],
            current_model="unknown",
        )
