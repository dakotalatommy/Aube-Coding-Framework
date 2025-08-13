import os
import httpx
from typing import Dict, Any, List


class AIClient:
    def __init__(self, api_key: str | None = None, base_url: str | None = None, model: str | None = None):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY", "")
        self.base_url = base_url or os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
        self.model = model or os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    async def generate(self, system: str, messages: List[Dict[str, str]], max_tokens: int = 512) -> str:
        if not self.api_key:
            return "AI not configured. Add OPENAI_API_KEY to enable chat and message generation."
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        payload: Dict[str, Any] = {
            "model": self.model,
            "messages": ([{"role": "system", "content": system}] + messages),
            "max_tokens": max_tokens,
            "temperature": 0.4,
        }
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(f"{self.base_url}/chat/completions", headers=headers, json=payload)
            r.raise_for_status()
            data = r.json()
            return data["choices"][0]["message"]["content"].strip()


