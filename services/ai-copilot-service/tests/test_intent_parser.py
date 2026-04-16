import pytest
from unittest.mock import AsyncMock, Mock, patch
from app.nlp.intent_parser import parse_intent, validate_intent


class TestIntentParser:
    @pytest.mark.asyncio
    async def test_parse_mark_done_intent(self):
        mock_ollama = AsyncMock()
        mock_ollama.generate_json = AsyncMock(
            return_value={
                "intent": "mark_done",
                "parameters": {"chore_name": "dishes"},
                "confidence": 0.95,
            }
        )

        result = await parse_intent("Mark dishes done", mock_ollama)

        assert result["intent"] == "mark_done"
        assert result["parameters"]["chore_name"] == "dishes"
        assert result["confidence"] == 0.95

    @pytest.mark.asyncio
    async def test_parse_create_chore_intent(self):
        mock_ollama = AsyncMock()
        mock_ollama.generate_json = AsyncMock(
            return_value={
                "intent": "create_chore",
                "parameters": {"name": "laundry", "interval_days": 3},
                "confidence": 0.9,
            }
        )

        result = await parse_intent("Add laundry every 3 days", mock_ollama)

        assert result["intent"] == "create_chore"
        assert result["parameters"]["name"] == "laundry"
        assert result["parameters"]["interval_days"] == 3

    @pytest.mark.asyncio
    async def test_validate_valid_intent(self):
        is_valid = await validate_intent("mark_done", {"chore_name": "dishes"}, 0.95)
        assert is_valid is True

    @pytest.mark.asyncio
    async def test_validate_low_confidence(self):
        is_valid = await validate_intent("mark_done", {"chore_name": "dishes"}, 0.3)
        assert is_valid is False

    @pytest.mark.asyncio
    async def test_validate_missing_parameter(self):
        is_valid = await validate_intent("mark_done", {}, 0.95)
        assert is_valid is False
