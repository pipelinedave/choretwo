"""Tests für den provider-agnostischen LLM-Client."""

import pytest
from unittest.mock import AsyncMock, MagicMock

import httpx

from app.llm_client import LLMClient, LLMError, _extract_json, _normalize_base_url


def _mock_response(status_code=200, json_data=None, text=""):
    resp = MagicMock()
    resp.status_code = status_code
    resp.text = text
    resp.json.return_value = json_data if json_data is not None else {}
    return resp


class TestExtractJson:
    def test_plain(self):
        assert _extract_json('{"intent":"mark_done"}') == {"intent": "mark_done"}

    def test_codefence(self):
        text = '```json\n{"intent":"create_chore"}\n```'
        assert _extract_json(text) == {"intent": "create_chore"}

    def test_embedded_object(self):
        text = 'Hier ist das Ergebnis: {"intent":"archive"} fertig.'
        assert _extract_json(text) == {"intent": "archive"}

    def test_garbage(self):
        assert _extract_json("no json here") == {}

    def test_empty(self):
        assert _extract_json("") == {}


class TestBaseUrlNormalization:
    def test_strips_chat_completions_suffix(self):
        assert (
            _normalize_base_url("https://api.synthetic.new/openai/v1/chat/completions")
            == "https://api.synthetic.new/openai/v1"
        )

    def test_strips_trailing_slash(self):
        assert (
            _normalize_base_url("https://api.synthetic.new/openai/v1/")
            == "https://api.synthetic.new/openai/v1"
        )

    def test_keeps_plain_base_url(self):
        assert (
            _normalize_base_url("https://api.synthetic.new/openai/v1")
            == "https://api.synthetic.new/openai/v1"
        )


class TestClientConfig:
    def test_not_configured_without_key(self):
        client = LLMClient(api_key="")
        assert client.configured is False

    def test_configured_with_key(self):
        client = LLMClient(api_key="syn_test")
        assert client.configured is True

    def test_default_model_is_glm(self):
        client = LLMClient(api_key="syn_test")
        assert client.model == "hf:zai-org/GLM-5.3-Flash"

    def test_default_provider_is_synthetic(self):
        client = LLMClient(api_key="syn_test")
        assert client.provider == "api.synthetic.new"

    def test_full_url_normalized_in_constructor(self):
        client = LLMClient(
            base_url="https://api.synthetic.new/openai/v1/chat/completions",
            api_key="syn_test",
        )
        assert client.base_url == "https://api.synthetic.new/openai/v1"


class TestEnvResolution:
    def test_llm_vars_win(self, monkeypatch):
        monkeypatch.setenv("LLM_BASE_URL", "https://llm.example.com/v1")
        monkeypatch.setenv("LLM_API_KEY", "syn_new")
        monkeypatch.setenv("LLM_MODEL", "hf:zai-org/GLM-5.2")
        monkeypatch.setenv("ADESSO_API_KEY", "adesso_old")
        monkeypatch.setenv("ADESSO_HUB_URL", "https://adesso-ai-hub.3asabc.de/v1")
        client = LLMClient()
        assert client.base_url == "https://llm.example.com/v1"
        assert client.api_key == "syn_new"
        assert client.model == "hf:zai-org/GLM-5.2"

    def test_legacy_adesso_fallback(self, monkeypatch):
        monkeypatch.delenv("LLM_BASE_URL", raising=False)
        monkeypatch.delenv("LLM_API_KEY", raising=False)
        monkeypatch.delenv("LLM_MODEL", raising=False)
        monkeypatch.setenv(
            "ADESSO_HUB_URL", "https://adesso-ai-hub.3asabc.de/v1/chat/completions"
        )
        monkeypatch.setenv("ADESSO_API_KEY", "adesso_old")
        monkeypatch.setenv("ADESSO_MODEL", "deepseek-v4-flash-sovereign")
        client = LLMClient()
        assert client.base_url == "https://adesso-ai-hub.3asabc.de/v1"
        assert client.api_key == "adesso_old"
        assert client.model == "deepseek-v4-flash-sovereign"

    def test_defaults_without_any_env(self, monkeypatch):
        for var in (
            "LLM_BASE_URL",
            "LLM_API_KEY",
            "LLM_MODEL",
            "ADESSO_HUB_URL",
            "ADESSO_API_KEY",
            "ADESSO_MODEL",
        ):
            monkeypatch.delenv(var, raising=False)
        client = LLMClient()
        assert client.base_url == "https://api.synthetic.new/openai/v1"
        assert client.model == "hf:zai-org/GLM-5.3-Flash"
        assert client.configured is False


class TestGenerateJson:
    @pytest.mark.asyncio
    async def test_success(self):
        client = LLMClient(api_key="syn_test")
        client.client = AsyncMock()
        client.client.post = AsyncMock(
            return_value=_mock_response(
                200, {"choices": [{"message": {"content": '{"intent":"mark_done"}'}}]}
            )
        )
        result = await client.generate_json([{"role": "user", "content": "hi"}])
        assert result == {"intent": "mark_done"}

    @pytest.mark.asyncio
    async def test_posts_to_chat_completions_path(self):
        client = LLMClient(
            base_url="https://api.synthetic.new/openai/v1", api_key="syn_test"
        )
        client.client = AsyncMock()
        client.client.post = AsyncMock(
            return_value=_mock_response(
                200, {"choices": [{"message": {"content": "{}"}}]}
            )
        )
        await client.generate_json([{"role": "user", "content": "hi"}])
        args, kwargs = client.client.post.call_args
        assert args[0] == "https://api.synthetic.new/openai/v1/chat/completions"
        assert kwargs["headers"]["Authorization"] == "Bearer syn_test"
        assert kwargs["json"]["model"] == "hf:zai-org/GLM-5.3-Flash"

    @pytest.mark.asyncio
    async def test_codefence_content_parsed(self):
        client = LLMClient(api_key="syn_test")
        client.client = AsyncMock()
        client.client.post = AsyncMock(
            return_value=_mock_response(
                200,
                {
                    "choices": [
                        {"message": {"content": '```json\n{"intent":"archive"}\n```'}}
                    ]
                },
            )
        )
        result = await client.generate_json([{"role": "user", "content": "hi"}])
        assert result == {"intent": "archive"}

    @pytest.mark.asyncio
    async def test_http_401_raises(self):
        client = LLMClient(api_key="syn_test")
        client.client = AsyncMock()
        client.client.post = AsyncMock(
            return_value=_mock_response(401, text="unauthorized")
        )
        with pytest.raises(LLMError, match="401"):
            await client.generate_json([{"role": "user", "content": "hi"}])

    @pytest.mark.asyncio
    async def test_http_500_raises(self):
        client = LLMClient(api_key="syn_test")
        client.client = AsyncMock()
        client.client.post = AsyncMock(return_value=_mock_response(500, text="boom"))
        with pytest.raises(LLMError, match="500"):
            await client.generate_json([{"role": "user", "content": "hi"}])

    @pytest.mark.asyncio
    async def test_network_error_raises(self):
        client = LLMClient(api_key="syn_test")
        client.client = AsyncMock()
        client.client.post = AsyncMock(
            side_effect=httpx.ConnectError("connection refused")
        )
        with pytest.raises(LLMError):
            await client.generate_json([{"role": "user", "content": "hi"}])

    @pytest.mark.asyncio
    async def test_timeout_raises(self):
        client = LLMClient(api_key="syn_test")
        client.client = AsyncMock()
        client.client.post = AsyncMock(side_effect=httpx.ReadTimeout("timed out"))
        with pytest.raises(LLMError):
            await client.generate_json([{"role": "user", "content": "hi"}])

    @pytest.mark.asyncio
    async def test_unexpected_response_structure_raises(self):
        client = LLMClient(api_key="syn_test")
        client.client = AsyncMock()
        client.client.post = AsyncMock(return_value=_mock_response(200, {"weird": 1}))
        with pytest.raises(LLMError):
            await client.generate_json([{"role": "user", "content": "hi"}])

    @pytest.mark.asyncio
    async def test_missing_key_raises(self):
        client = LLMClient(api_key="")
        with pytest.raises(LLMError, match="LLM_API_KEY"):
            await client.generate_json([{"role": "user", "content": "hi"}])


class TestChat:
    @pytest.mark.asyncio
    async def test_success(self):
        client = LLMClient(api_key="syn_test")
        client.client = AsyncMock()
        client.client.post = AsyncMock(
            return_value=_mock_response(
                200, {"choices": [{"message": {"content": "Hallo!"}}]}
            )
        )
        text = await client.chat([{"role": "user", "content": "hi"}])
        assert text == "Hallo!"


class TestHealth:
    @pytest.mark.asyncio
    async def test_false_without_key(self):
        client = LLMClient(api_key="")
        assert await client.is_healthy() is False

    @pytest.mark.asyncio
    async def test_true_on_200(self):
        client = LLMClient(api_key="syn_test")
        client.client = AsyncMock()
        client.client.get = AsyncMock(return_value=_mock_response(200, {"data": []}))
        assert await client.is_healthy() is True

    @pytest.mark.asyncio
    async def test_false_on_401(self):
        client = LLMClient(api_key="syn_bad")
        client.client = AsyncMock()
        client.client.get = AsyncMock(return_value=_mock_response(401, text="nope"))
        assert await client.is_healthy() is False

    @pytest.mark.asyncio
    async def test_falls_back_to_configured_on_network_error(self):
        client = LLMClient(api_key="syn_test")
        client.client = AsyncMock()
        client.client.get = AsyncMock(
            side_effect=httpx.ConnectError("connection refused")
        )
        assert await client.is_healthy() is True


class TestAvailableModels:
    @pytest.mark.asyncio
    async def test_empty_without_key(self):
        client = LLMClient(api_key="")
        assert await client.get_available_models() == []

    @pytest.mark.asyncio
    async def test_lists_models_on_200(self):
        client = LLMClient(api_key="syn_test", model="hf:zai-org/GLM-5.3-Flash")
        client.client = AsyncMock()
        client.client.get = AsyncMock(
            return_value=_mock_response(
                200, {"data": [{"id": "hf:zai-org/GLM-5.3-Flash"}, {"id": "other"}]}
            )
        )
        models = await client.get_available_models()
        assert "hf:zai-org/GLM-5.3-Flash" in models
        assert "other" in models

    @pytest.mark.asyncio
    async def test_fallback_to_configured_model(self):
        client = LLMClient(api_key="syn_test", model="hf:zai-org/GLM-5.3-Flash")
        client.client = AsyncMock()
        client.client.get = AsyncMock(return_value=_mock_response(500, text="boom"))
        assert await client.get_available_models() == ["hf:zai-org/GLM-5.3-Flash"]


class TestIntentFallbackPath:
    @pytest.mark.asyncio
    async def test_falls_back_on_llm_error(self):
        from app.nlp.intent_parser import parse_intent

        client = LLMClient(api_key="syn_test")
        client.client = AsyncMock()
        client.client.post = AsyncMock(
            side_effect=httpx.ConnectError("connection refused")
        )
        result = await parse_intent("Mark dishes done", client)
        assert result["intent"] == "mark_done"
        assert result["parameters"]["chore_name"] == "dishes"
        assert result["confidence"] == 0.6

    @pytest.mark.asyncio
    async def test_deterministic_without_client(self):
        from app.nlp.intent_parser import parse_intent

        result = await parse_intent("Mark dishes done", None)
        assert result["intent"] == "mark_done"
