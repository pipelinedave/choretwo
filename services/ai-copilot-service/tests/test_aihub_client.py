"""Tests für den OpenAI-kompatiblen adesso AI Hub Sovereign Client."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.aihub_client import AIHubClient, AIHubError, _extract_json


class TestAIHubClient:
    def test_extract_json_plain(self):
        assert _extract_json('{"intent":"mark_done"}') == {"intent": "mark_done"}

    def test_extract_json_codefence(self):
        text = '```json\n{"intent":"create_chore"}\n```'
        assert _extract_json(text) == {"intent": "create_chore"}

    def test_extract_json_garbage(self):
        assert _extract_json("no json here") == {}

    def test_config_requires_key(self):
        client = AIHubClient(api_key="")
        assert client.configured is False

    def test_configured_when_key_present(self):
        client = AIHubClient(api_key="test-key")
        assert client.configured is True

    @pytest.mark.asyncio
    async def test_generate_json_mocked(self):
        client = AIHubClient(api_key="test-key")
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "choices": [{"message": {"content": '{"intent":"mark_done"}'}}]
        }
        client.client = AsyncMock()
        client.client.post = AsyncMock(return_value=mock_resp)

        result = await client.generate_json(
            [{"role": "user", "content": "Mark dishes done"}]
        )
        assert result == {"intent": "mark_done"}

    @pytest.mark.asyncio
    async def test_generate_json_missing_key_raises(self):
        client = AIHubClient(api_key="")
        with pytest.raises(AIHubError):
            await client.generate_json([{"role": "user", "content": "hi"}])

    @pytest.mark.asyncio
    async def test_generate_json_http_error(self):
        client = AIHubClient(api_key="test-key")
        mock_resp = MagicMock()
        mock_resp.status_code = 401
        mock_resp.text = "unauthorized"
        mock_resp.json.return_value = {}
        client.client = AsyncMock()
        client.client.post = AsyncMock(return_value=mock_resp)

        with pytest.raises(AIHubError):
            await client.generate_json([{"role": "user", "content": "hi"}])

    @pytest.mark.asyncio
    async def test_chat_mocked(self):
        client = AIHubClient(api_key="test-key")
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"choices": [{"message": {"content": "Hallo!"}}]}
        client.client = AsyncMock()
        client.client.post = AsyncMock(return_value=mock_resp)

        text = await client.chat([{"role": "user", "content": "hi"}])
        assert text == "Hallo!"

    @pytest.mark.asyncio
    async def test_is_healthy_false_without_key(self):
        client = AIHubClient(api_key="")
        assert await client.is_healthy() is False

    @pytest.mark.asyncio
    async def test_get_available_models_empty_without_key(self):
        client = AIHubClient(api_key="")
        assert await client.get_available_models() == []

    def test_get_available_models_with_key(self):
        client = AIHubClient(api_key="k", model="deepseek-v4-flash-sovereign")
        # get_available_models ist async
        import asyncio

        assert asyncio.run(client.get_available_models()) == [
            "deepseek-v4-flash-sovereign"
        ]
