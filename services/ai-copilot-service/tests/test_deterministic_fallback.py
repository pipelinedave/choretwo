"""Tests für den deterministischen Regex-Fallback des Intent-Parsers."""

import pytest
from unittest.mock import AsyncMock
from app.nlp.intent_parser import parse_intent, parse_intent_deterministic


class TestDeterministicFallback:
    def test_mark_done_en(self):
        r = parse_intent_deterministic("Mark dishes done")
        assert r["intent"] == "mark_done"
        assert r["parameters"]["chore_name"] == "dishes"

    def test_mark_done_de(self):
        r = parse_intent_deterministic("Geschirr erledigt")
        assert r["intent"] == "mark_done"
        assert r["parameters"]["chore_name"] == "geschirr"

    def test_create_chore_en_with_interval(self):
        r = parse_intent_deterministic("Add laundry every 3 days")
        assert r["intent"] == "create_chore"
        assert r["parameters"]["name"] == "laundry"
        assert r["parameters"]["interval_days"] == 3

    def test_create_chore_de_with_interval(self):
        r = parse_intent_deterministic("Wäsche alle 5 Tage hinzufügen")
        assert r["intent"] == "create_chore"
        assert r["parameters"]["interval_days"] == 5

    def test_update_chore(self):
        r = parse_intent_deterministic("Push trash to next week")
        assert r["intent"] == "update_chore"
        assert r["parameters"]["chore_name"] == "trash"

    def test_archive_en(self):
        r = parse_intent_deterministic("Archive old toys")
        assert r["intent"] == "archive"
        assert r["parameters"]["chore_name"] == "old toys"

    def test_unknown(self):
        r = parse_intent_deterministic("hello how are you")
        assert r["intent"] == "unknown"


class TestParseIntentHubFallback:
    @pytest.mark.asyncio
    async def test_uses_deterministic_when_client_not_configured(self):
        client = AsyncMock()
        client.configured = False
        r = await parse_intent("Mark dishes done", client)
        assert r["intent"] == "mark_done"

    @pytest.mark.asyncio
    async def test_uses_deterministic_when_client_none(self):
        r = await parse_intent("Mark dishes done", None)
        assert r["intent"] == "mark_done"

    @pytest.mark.asyncio
    async def test_uses_hub_result_when_configured(self):
        client = AsyncMock()
        client.configured = True
        client.generate_json = AsyncMock(
            return_value={
                "intent": "create_chore",
                "parameters": {"name": "laundry", "interval_days": 3},
                "confidence": 0.9,
            }
        )
        r = await parse_intent("Add laundry every 3 days", client)
        assert r["intent"] == "create_chore"
        assert r["parameters"]["name"] == "laundry"
