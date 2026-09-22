import logging
import re
from typing import Optional

from app.llm_client import LLMClient, LLMError

logger = logging.getLogger(__name__)

NLP_SYSTEM_PROMPT = """
You are a chore management assistant. Parse the user's message and return ONLY a JSON object with:
- intent: one of ["mark_done", "create_chore", "update_chore", "archive", "unknown"]
- parameters: object with relevant fields based on intent
- confidence: float 0-1 indicating how sure you are

Supported intents and parameters:
1. mark_done: {chore_name: string}
2. create_chore: {name: string, interval_days: int (optional), due_date: string (optional)}
3. update_chore: {chore_name: string, new_name: string (optional), new_interval: int (optional), new_due_date: string (optional)}
4. archive: {chore_name: string}

Examples:
User: "Mark dishes done"
{"intent": "mark_done", "parameters": {"chore_name": "dishes"}, "confidence": 0.95}

User: "Add laundry every 3 days"
{"intent": "create_chore", "parameters": {"name": "laundry", "interval_days": 3}, "confidence": 0.9}

User: "Push trash to next week"
{"intent": "update_chore", "parameters": {"chore_name": "trash", "new_due_date": "7 days from now"}, "confidence": 0.85}

User: "Archive old chores"
{"intent": "archive", "parameters": {"chore_name": "old chores"}, "confidence": 0.8}

Now parse this message and return ONLY JSON: "{user_message}"
"""

CHAT_SYSTEM_PROMPT = (
    "Du bist ein hilfreicher Haushalts-Copilot für die Chore-App Choretwo. "
    "Antworte kurz, freundlich und auf Deutsch."
)

# --- Deterministischer Regex-Fallback (kein LLM nötig) ---------------------
# greift, wenn der LLM-Provider nicht erreichbar ist, damit der Chat nie tot ist.
# Regex-Klassen ohne eingebettete doppelte Anführungszeichen, um String-
# Terminierungsfehler zu vermeiden.

_DONE_PATTERNS = [
    r"mark\s+['\"]?([\w\s-]+?)['\"]?\s+(?:as\s+)?done",
    r"['\"]?([\w\s-]+?)['\"]?\s+(?:erledigt|abhaken|abgehakt)\b",
    r"(?:done|erledigt)\s+with\s+['\"]?([\w\s-]+)['\"]?",
]

_CREATE_PATTERNS = [
    r"(?:add|create|neues?|neuen?|hinzuf[uü]gen|anlegen)\s+['\"]?([\w\s-]+)['\"]?\s+(?:every|alle|aller)\s+(\d+)\s*(?:day|days|tagen?|tage)",
    r"(?:add|create|anlegen|hinzuf[uü]gen)\s+['\"]?([\w\s-]+)['\"]?\s+(?:every|alle)\s+(\d+)\s*(?:day|days|tagen?|tage)",
    # DE-Wortstellung: "<name> alle <n> tage hinzufügen/anlegen" (Verb am Satzende)
    r"['\"]?([\w\s-]+)['\"]?\s+alle[r]?\s+(\d+)\s*tagen?\s+(?:hinzuf[uü]gen|anlegen|neu)",
]

_UPDATE_PATTERNS = [
    r"(?:push|shift|move|verschiebe?|schiebe?)\s+['\"]?([\w\s-]+)['\"]?\s+(?:to|um|auf)\s+(.+)$",
    r"['\"]?([\w\s-]+)['\"]?\s+(?:auf\s+sp[äa]ter|umbenennen|[äa]ndern)\s+(.+)$",
]

_ARCHIVE_PATTERNS = [
    r"(?:archive|archivier)\s+['\"]?([\w\s-]+)['\"]?",
    r"['\"]?([\w\s-]+)['\"]?\s+(?:archivier|ins\s+archiv)",
]

_GENERIC_CREATE_PATTERN = (
    r"(?:add|create|anlegen|hinzuf[uü]gen|neue)\s+['\"]?([\w\s-]+)['\"]?"
)


def parse_intent_deterministic(user_message: str) -> dict:
    """Deterministischer Fallback ohne LLM: erkennt DE/EN-Phrasen per Regex."""
    msg = (user_message or "").strip().lower()

    # mark_done
    for pat in _DONE_PATTERNS:
        m = re.search(pat, msg)
        if m:
            return {
                "intent": "mark_done",
                "parameters": {"chore_name": m.group(1).strip()},
                "confidence": 0.6,
            }

    # create_chore (mit Intervall)
    for pat in _CREATE_PATTERNS:
        m = re.search(pat, msg)
        if m:
            try:
                interval = int(m.group(2))
            except (ValueError, IndexError):
                interval = 7
            return {
                "intent": "create_chore",
                "parameters": {"name": m.group(1).strip(), "interval_days": interval},
                "confidence": 0.6,
            }

    # create_chore (generisch)
    m = re.search(_GENERIC_CREATE_PATTERN, msg)
    if m:
        return {
            "intent": "create_chore",
            "parameters": {"name": m.group(1).strip(), "interval_days": 7},
            "confidence": 0.5,
        }

    # update_chore
    for pat in _UPDATE_PATTERNS:
        m = re.search(pat, msg)
        if m:
            return {
                "intent": "update_chore",
                "parameters": {"chore_name": m.group(1).strip()},
                "confidence": 0.5,
            }

    # archive
    for pat in _ARCHIVE_PATTERNS:
        m = re.search(pat, msg)
        if m:
            return {
                "intent": "archive",
                "parameters": {"chore_name": m.group(1).strip()},
                "confidence": 0.6,
            }

    return {"intent": "unknown", "parameters": {}, "confidence": 0.0}


async def _parse_with_llm(user_message: str, client: LLMClient) -> dict:
    """Versucht die Intent-Parsing über den konfigurierten LLM-Provider."""
    messages = [
        {
            "role": "system",
            "content": NLP_SYSTEM_PROMPT.replace("{user_message}", user_message),
        },
        {"role": "user", "content": user_message},
    ]
    response = await client.generate_json(messages)
    if not response:
        return {"intent": "unknown", "parameters": {}, "confidence": 0.0}

    return {
        "intent": response.get("intent", "unknown"),
        "parameters": response.get("parameters", {}),
        "confidence": float(response.get("confidence", 0.0)),
    }


async def parse_intent(user_message: str, client: Optional[LLMClient] = None) -> dict:
    """Parse user message to extract intent and parameters.

    Versucht zuerst den LLM-Provider. Fällt bei nicht konfiguriertem/
    erreichbarem Provider auf den deterministischen Regex-Fallback zurück,
    damit der Chat funktioniert, ohne dass der Provider verfügbar sein muss.
    """
    if client is None or not getattr(client, "configured", False):
        return parse_intent_deterministic(user_message)

    try:
        return await _parse_with_llm(user_message, client)
    except LLMError as e:
        logger.warning(
            f"LLM-Provider nicht verfügbar, nutze deterministischen Fallback: {e}"
        )
        return parse_intent_deterministic(user_message)
    except Exception as e:  # defensiv: nie crashen
        logger.warning(f"Intent-Parsing über LLM-Provider fehlgeschlagen: {e}")
        return parse_intent_deterministic(user_message)


async def validate_intent(intent: str, parameters: dict, confidence: float) -> bool:
    """Validate parsed intent"""
    valid_intents = ["mark_done", "create_chore", "update_chore", "archive", "unknown"]

    if intent not in valid_intents:
        return False

    if confidence < 0.5:
        return False

    # Basic parameter validation
    if intent == "mark_done" and "chore_name" not in parameters:
        return False
    if intent == "create_chore" and "name" not in parameters:
        return False
    if intent == "update_chore" and "chore_name" not in parameters:
        return False
    if intent == "archive" and "chore_name" not in parameters:
        return False

    return True
