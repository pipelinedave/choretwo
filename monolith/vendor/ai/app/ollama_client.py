import os
import json
import logging
from typing import Optional
import httpx

logger = logging.getLogger(__name__)

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
AI_MODEL = os.getenv("AI_MODEL", "mistral")


class OllamaClient:
    def __init__(self, base_url: str = OLLAMA_URL, model: str = AI_MODEL):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.client = httpx.AsyncClient(timeout=30.0)

    async def close(self):
        await self.client.aclose()

    async def is_healthy(self) -> bool:
        try:
            response = await self.client.get(f"{self.base_url}/api/tags", timeout=5.0)
            return response.status_code == 200
        except Exception as e:
            logger.error(f"Ollama health check failed: {e}")
            return False

    async def get_available_models(self) -> list:
        try:
            response = await self.client.get(f"{self.base_url}/api/tags", timeout=5.0)
            if response.status_code == 200:
                data = response.json()
                return [model["name"] for model in data.get("models", [])]
        except Exception as e:
            logger.error(f"Failed to get available models: {e}")
        return []

    async def generate(self, prompt: str, model: Optional[str] = None) -> str:
        """Generate text from a prompt"""
        model = model or self.model
        try:
            response = await self.client.post(
                f"{self.base_url}/api/generate",
                json={"model": model, "prompt": prompt, "stream": False},
                timeout=60.0,
            )
            if response.status_code == 200:
                return response.json().get("response", "")
            else:
                logger.error(
                    f"Ollama generate failed: {response.status_code} - {response.text}"
                )
                return ""
        except Exception as e:
            logger.error(f"Ollama generate error: {e}")
            return ""

    async def chat(self, messages: list, model: Optional[str] = None) -> str:
        """Chat with the model"""
        model = model or self.model
        try:
            response = await self.client.post(
                f"{self.base_url}/api/chat",
                json={"model": model, "messages": messages, "stream": False},
                timeout=60.0,
            )
            if response.status_code == 200:
                return response.json().get("message", {}).get("content", "")
            else:
                logger.error(
                    f"Ollama chat failed: {response.status_code} - {response.text}"
                )
                return ""
        except Exception as e:
            logger.error(f"Ollama chat error: {e}")
            return ""

    async def generate_json(self, prompt: str, model: Optional[str] = None) -> dict:
        """Generate JSON response from a prompt"""
        model = model or self.model
        response_text = await self.generate(prompt, model)
        try:
            # Try to extract JSON from response
            import re

            json_match = re.search(r"\{.*\}", response_text, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            return json.loads(response_text)
        except json.JSONDecodeError:
            logger.error(f"Failed to parse JSON from: {response_text}")
            return {}
