"""Provider-agnostischer OpenAI-kompatibler LLM-Client.

Standard-Provider ist Synthetic (synthetic.new) mit GLM-Modellen. Der Client
ist env-getrieben und funktioniert mit jedem OpenAI-kompatiblen
Chat-Completions-Endpunkt (u. a. adesso AI Hub Sovereign als Legacy-Provider).

Env-Vars:
    LLM_BASE_URL  (Default https://api.synthetic.new/openai/v1 — Basis-URL
                   bis /v1, der Client hängt /chat/completions an)
    LLM_API_KEY   (Pflicht, Secret — kommt aus Env, kein Default im Code)
    LLM_MODEL     (Default hf:zai-org/GLM-5.3-Flash)

Backward-Compat: Sind ALLE LLM_*-Vars unset, aber ADESSO_HUB_URL /
ADESSO_API_KEY / ADESSO_MODEL gesetzt, werden die Legacy-Vars verwendet
(mit Deprecated-Warnung im Log). Sobald mindestens eine LLM_*-Var gesetzt
ist, gelten ausschließlich die LLM_*-Vars.
"""

import os
import json
import re
import logging
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

DEFAULT_LLM_BASE_URL = "https://api.synthetic.new/openai/v1"
DEFAULT_LLM_MODEL = "hf:zai-org/GLM-5.3-Flash"

_CHAT_COMPLETIONS_SUFFIX = "/chat/completions"


def _normalize_base_url(url: str) -> str:
    """Normalisiert die Base-URL: ohne /chat/completions-Suffix, ohne Slash."""
    url = (url or "").strip().rstrip("/")
    if url.endswith(_CHAT_COMPLETIONS_SUFFIX):
        url = url[: -len(_CHAT_COMPLETIONS_SUFFIX)]
    return url


def _resolve_env() -> tuple:
    """Löst die LLM_*-Env-Vars auf, mit All-or-nothing-Legacy-Fallback."""
    base_url = os.getenv("LLM_BASE_URL", "").strip()
    api_key = os.getenv("LLM_API_KEY", "").strip()
    model = os.getenv("LLM_MODEL", "").strip()

    if base_url or api_key or model:
        return (
            _normalize_base_url(base_url or DEFAULT_LLM_BASE_URL),
            api_key,
            model or DEFAULT_LLM_MODEL,
        )

    legacy_url = os.getenv("ADESSO_HUB_URL", "").strip()
    legacy_key = os.getenv("ADESSO_API_KEY", "").strip()
    legacy_model = os.getenv("ADESSO_MODEL", "").strip()

    if legacy_url or legacy_key or legacy_model:
        logger.warning(
            "ADESSO_*-Env-Vars sind deprecated. Bitte auf LLM_BASE_URL / "
            "LLM_API_KEY / LLM_MODEL migrieren."
        )
        return (
            _normalize_base_url(legacy_url or DEFAULT_LLM_BASE_URL),
            legacy_key,
            legacy_model or DEFAULT_LLM_MODEL,
        )

    return (_normalize_base_url(DEFAULT_LLM_BASE_URL), "", DEFAULT_LLM_MODEL)


def _extract_json(text: str) -> dict:
    """Robust JSON aus der Modell-Antwort extrahieren.

    Der Provider antwortet als reines JSON-Objekt, aber wir fallen defensiv
    auf Markdown-/Codefence-Umgebungen und den ersten JSON-Block zurück.
    """
    if not text:
        return {}
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if fence:
        text = fence.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if m:
        try:
            return json.loads(m.group())
        except json.JSONDecodeError:
            pass
    return {}


class LLMError(RuntimeError):
    """Fehler bei der Kommunikation mit dem LLM-Provider."""


class LLMClient:
    def __init__(self, base_url: str = None, api_key: str = None, model: str = None):
        if base_url is None and api_key is None and model is None:
            base_url, api_key, model = _resolve_env()
        else:
            base_url = _normalize_base_url(base_url or DEFAULT_LLM_BASE_URL)
            api_key = (api_key or "").strip()
            model = model or DEFAULT_LLM_MODEL
        self.base_url = base_url
        self.api_key = api_key
        self.model = model
        self.client = httpx.AsyncClient(timeout=30.0)

    @property
    def provider(self) -> str:
        """Hostname des konfigurierten Providers (z. B. api.synthetic.new)."""
        return urlparse(self.base_url).netloc or "unknown"

    @property
    def configured(self) -> bool:
        """True, wenn ein API-Key gesetzt ist."""
        return bool(self.api_key)

    async def close(self):
        await self.client.aclose()

    async def is_healthy(self) -> bool:
        """Konnektivität zum konfigurierten Provider prüfen (GET /models).

        200 = healthy, 401/403 = Key abgelehnt (nicht healthy), alle anderen
        Statuscodes/Netzwerkfehler fallen auf `configured` zurück, damit eine
        nicht implementierte /models-Route den Status nicht kippt.
        """
        if not self.configured:
            return False
        try:
            resp = await self.client.get(
                f"{self.base_url}/models",
                headers={"Authorization": f"Bearer {self.api_key}"},
                timeout=5.0,
            )
        except Exception as e:
            logger.error(f"LLM health check failed: {e}")
            return self.configured
        if resp.status_code == 200:
            return True
        if resp.status_code in (401, 403):
            logger.error(
                f"LLM-Provider {self.provider} lehnt den API-Key ab "
                f"({resp.status_code}) — Key prüfen."
            )
            return False
        return self.configured

    async def get_available_models(self) -> list:
        """Listet die Modelle des Providers; Fallback auf das konfigurierte."""
        if not self.configured:
            return []
        try:
            resp = await self.client.get(
                f"{self.base_url}/models",
                headers={"Authorization": f"Bearer {self.api_key}"},
                timeout=5.0,
            )
            if resp.status_code == 200:
                data = resp.json()
                models = [
                    m.get("id") for m in data.get("data", []) if m.get("id")
                ]
                if models:
                    return models
        except Exception as e:
            logger.warning(
                f"Modell-Listing fehlgeschlagen, nutze konfiguriertes Modell: {e}"
            )
        return [self.model]

    async def _post(self, body: dict) -> str:
        if not self.configured:
            raise LLMError(
                "LLM_API_KEY nicht gesetzt. Bitte das Secret konfigurieren "
                "(k3s-config / .env), sonst ist der LLM-Provider nicht erreichbar."
            )
        try:
            resp = await self.client.post(
                f"{self.base_url}{_CHAT_COMPLETIONS_SUFFIX}",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json=body,
                timeout=60.0,
            )
        except httpx.HTTPError as e:
            logger.error(f"LLM request error: {e}")
            raise LLMError(f"LLM-Provider nicht erreichbar: {e}")

        if resp.status_code >= 400:
            logger.error(f"LLM error {resp.status_code}: {resp.text[:300]}")
            raise LLMError(f"LLM-Provider {resp.status_code}: {resp.text[:300]}")
        data = resp.json()
        try:
            return data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError):
            logger.error(f"Unerwartete LLM-Antwort: {data}")
            raise LLMError("Unerwartete LLM-Antwort-Struktur")

    async def generate_json(self, messages: list) -> dict:
        """Rufe den Provider mit response_format=json_object auf, parse JSON."""
        content = await self._post(
            {
                "model": self.model,
                "messages": messages,
                "response_format": {"type": "json_object"},
            }
        )
        result = _extract_json(content)
        if not result:
            logger.error(f"Kein JSON aus LLM-Antwort geparst: {content}")
        return result

    async def chat(self, messages: list) -> str:
        """Einfache Text-Chat-Antwort (kein JSON-Zwang)."""
        return await self._post({"model": self.model, "messages": messages})
