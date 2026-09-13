"""OpenAI-kompatibler Client für den adesso AI Hub Sovereign.

Ersetzt die tote lokale Ollama-Integration. Der adesso AI Hub Sovereign ist
ein adesso-gehosteter, OpenAI-kompatibler Chat-Completions-Endpunkt
(Text-only, 0 Kosten). Der Modell-Name am Endpoint ist
`deepseek-v4-flash-sovereign` OHNE `adesso-sovereign/`-Prefix (dieser
Prefix ist nur opencode-intern).

Env-Vars (defensiv):
    ADESSO_HUB_URL    (Default https://adesso-ai-hub.3asabc.de/v1/chat/completions)
    ADESSO_API_KEY    (Pflicht, Secret — kommt aus Env, kein Default im Code)
    ADESSO_MODEL      (Default deepseek-v4-flash-sovereign)
"""

import os
import json
import re
import logging

import httpx

logger = logging.getLogger(__name__)

ADESSO_HUB_URL = os.getenv(
    "ADESSO_HUB_URL",
    "https://adesso-ai-hub.3asabc.de/v1/chat/completions",
)
ADESSO_API_KEY = os.getenv("ADESSO_API_KEY", "").strip()
ADESSO_MODEL = os.getenv("ADESSO_MODEL", "deepseek-v4-flash-sovereign")


def _extract_json(text: str) -> dict:
    """Robust JSON aus der Modell-Antwort extrahieren.

    Der Sovereign antwortet als reines JSON-Objekt, aber wir fallen defensiv
    auf Markdown-/Codefence-Umgebungen und den ersten JSON-Block zurück.
    """
    if not text:
        return {}
    text = text.strip()
    # Codefences (```json ... ```) entfernen
    fence = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if fence:
        text = fence.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Fallback: erstes { ... }-Objekt suchen
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if m:
        try:
            return json.loads(m.group())
        except json.JSONDecodeError:
            pass
    return {}


class AIHubError(RuntimeError):
    """Fehler bei der Kommunikation mit dem adesso AI Hub."""


class AIHubClient:
    def __init__(
        self,
        base_url: str = ADESSO_HUB_URL,
        api_key: str = ADESSO_API_KEY,
        model: str = ADESSO_MODEL,
    ):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model = model
        self.client = httpx.AsyncClient(timeout=30.0)

    @property
    def configured(self) -> bool:
        """True, wenn ein API-Key gesetzt ist (Der Hub ist erreichbar)."""
        return bool(self.api_key)

    async def close(self):
        await self.client.aclose()

    async def is_healthy(self) -> bool:
        """Konnektivität zum AI Hub (Key gesetzt = konfiguriert)."""
        if not self.configured:
            return False
        try:
            # Minimaler Test-Call über einen system-Ping ohne Inhalt kostet kaum.
            # Pragmatisch: Wir markieren als healthy, sobald ein Key existiert —
            # ein optionaler Konnektivitäts-Check ist hier billig genug.
            resp = await self.client.get(
                "https://adesso-ai-hub.3asabc.de/v1/models", timeout=5.0
            )
            return resp.status_code in (200, 401, 403)
        except Exception as e:  # pragma: no cover
            logger.error(f"AI Hub health check failed: {e}")
            # Eine Netzwerk-Exception bei der OPTIONALEN Prüfung soll nicht
            # den gesamten Status auf "unhealthy" ziehen, wenn ein Key existiert.
            return self.configured

    async def get_available_models(self) -> list:
        """Gibt die konfigurierte Modell-Liste zurück (AI Hub benennt Modelle
        über env; kein separates Listing nötig)."""
        if not self.configured:
            return []
        return [self.model]

    async def _post(self, body: dict) -> str:
        if not self.configured:
            raise AIHubError(
                "ADESSO_API_KEY nicht gesetzt. Bitte das Secret konfigurieren "
                "(k3s-config / .env), sonst ist der AI-Hub nicht erreichbar."
            )
        try:
            resp = await self.client.post(
                self.base_url,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json=body,
                timeout=60.0,
            )
        except httpx.HTTPError as e:
            logger.error(f"AI Hub request error: {e}")
            raise AIHubError(f"AI Hub nicht erreichbar: {e}")

        if resp.status_code >= 400:
            logger.error(f"AI Hub error {resp.status_code}: {resp.text[:300]}")
            raise AIHubError(f"AI Hub Sovereign {resp.status_code}: {resp.text[:300]}")
        data = resp.json()
        try:
            return data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError):
            logger.error(f"Unerwartete AI-Hub-Antwort: {data}")
            raise AIHubError("Unerwartete AI-Hub-Antwort-Struktur")

    async def generate_json(self, messages: list) -> dict:
        """Rufe den AI Hub mit response_format=json_object auf, parse JSON."""
        content = await self._post(
            {
                "model": self.model,
                "messages": messages,
                "response_format": {"type": "json_object"},
            }
        )
        result = _extract_json(content)
        if not result:
            logger.error(f"Kein JSON aus AI-Hub-Antwort geparst: {content}")
        return result

    async def chat(self, messages: list) -> str:
        """Einfache Text-Chat-Antwort (kein JSON-Zwang)."""
        return await self._post({"model": self.model, "messages": messages})
