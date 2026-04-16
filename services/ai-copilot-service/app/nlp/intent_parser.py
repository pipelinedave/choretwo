import logging
from typing import Optional
from app.ollama_client import OllamaClient

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


async def parse_intent(user_message: str, ollama_client: OllamaClient) -> dict:
    """Parse user message to extract intent and parameters"""
    prompt = NLP_SYSTEM_PROMPT.replace("{user_message}", user_message)

    response = await ollama_client.generate_json(prompt)

    if not response:
        return {"intent": "unknown", "parameters": {}, "confidence": 0.0}

    # Ensure required fields exist
    return {
        "intent": response.get("intent", "unknown"),
        "parameters": response.get("parameters", {}),
        "confidence": float(response.get("confidence", 0.0)),
    }


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
