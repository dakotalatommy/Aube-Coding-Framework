import os
import httpx
import asyncio
import random
from typing import Dict, Any, List


class AIClient:
    def __init__(self, api_key: str | None = None, base_url: str | None = None, model: str | None = None):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY", "")
        self.base_url = base_url or os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
        self.model = model or os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        self.fallback_models = [m.strip() for m in os.getenv("OPENAI_FALLBACK_MODELS", "").split(",") if m.strip()]
        self.provider = os.getenv("AI_PROVIDER", "chat").lower()  # chat | agents
        self.agent_id = os.getenv("OPENAI_AGENT_ID", "")
        self.agents_url = os.getenv("OPENAI_AGENTS_URL", f"{self.base_url}/responses")

    async def generate(self, system: str, messages: List[Dict[str, str]], max_tokens: int = 512) -> str:
        if not self.api_key:
            return "AI not configured. Add OPENAI_API_KEY to enable chat and message generation."
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        # Prefer agents if explicitly requested and agent_id is present
        if self.provider == "agents" and self.agent_id:
            text = await self._generate_via_agents(system, messages, max_tokens)
            if text:
                return text
        # Otherwise use chat completions with model fallbacks
        candidates = [self.model] + [m for m in self.fallback_models if m]
        last_error_message = None
        for model_name in candidates:
            payload: Dict[str, Any] = {
                "model": model_name,
                "messages": ([{"role": "system", "content": system}] + messages),
                "max_tokens": max_tokens,
                "temperature": 0.4,
            }
            backoff_seconds = 1.0
            for attempt in range(3):
                try:
                    async with httpx.AsyncClient(timeout=60) as client:
                        r = await client.post(f"{self.base_url}/chat/completions", headers=headers, json=payload)
                        if r.status_code in (429,) or r.status_code >= 500:
                            if attempt < 2:
                                await asyncio.sleep(backoff_seconds + random.uniform(0, 0.5))
                                backoff_seconds *= 2
                                continue
                        if r.status_code == 400:
                            # capture provider error details
                            try:
                                err = r.json().get("error", {})
                                last_error_message = err.get("message") or str(err)
                            except Exception:
                                last_error_message = r.text
                        r.raise_for_status()
                        data = r.json()
                        return data["choices"][0]["message"]["content"].strip()
                except httpx.HTTPError as e:
                    last_error_message = str(e)
                    if attempt < 2:
                        await asyncio.sleep(backoff_seconds + random.uniform(0, 0.5))
                        backoff_seconds *= 2
                        continue
                    # give next model a chance
                    break
        return last_error_message or "AI is temporarily busy. Please try again in a moment."

    async def _generate_via_agents(self, system: str, messages: List[Dict[str, str]], max_tokens: int) -> str | None:
        if not self.api_key or not self.agent_id:
            return None
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        # Flatten messages into a single input while preserving roles
        # Many agents endpoints accept a single text input; we include system as a preface
        user_transcript = "\n".join([f"{m['role']}: {m['content']}" for m in messages])
        input_text = f"System: {system}\n{user_transcript}".strip()
        payload: Dict[str, Any] = {
            "agent_id": self.agent_id,
            "input": input_text,
            "max_output_tokens": max_tokens,
        }
        backoff_seconds = 1.0
        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=90) as client:
                    r = await client.post(self.agents_url, headers=headers, json=payload)
                    # If this path/shape isn't supported, bail to chat provider
                    if r.status_code in (404, 405):
                        return None
                    if r.status_code in (429,) or r.status_code >= 500:
                        if attempt < 2:
                            await asyncio.sleep(backoff_seconds + random.uniform(0, 0.5))
                            backoff_seconds *= 2
                            continue
                    r.raise_for_status()
                    data = r.json()
                    # Try a few possible shapes
                    # responses API: { output_text: "..." }
                    if isinstance(data, dict) and data.get("output_text"):
                        return str(data["output_text"]).strip()
                    # choices-like
                    if isinstance(data, dict) and data.get("choices"):
                        return data["choices"][0]["message"]["content"].strip()
                    # generic text field
                    if isinstance(data, dict) and data.get("text"):
                        return str(data["text"]).strip()
                    # If unknown, return None to trigger chat fallback
                    return None
            except httpx.HTTPError:
                if attempt < 2:
                    await asyncio.sleep(backoff_seconds + random.uniform(0, 0.5))
                    backoff_seconds *= 2
                    continue
        return None

    async def embed(self, texts: List[str], model: str | None = None) -> List[List[float]]:
        if not self.api_key:
            return []
        embed_model = model or os.getenv("OPENAI_EMBED_MODEL", "text-embedding-3-small")
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload: Dict[str, Any] = {"model": embed_model, "input": texts}
        backoff_seconds = 1.0
        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=60) as client:
                    r = await client.post(f"{self.base_url}/embeddings", headers=headers, json=payload)
                    if r.status_code in (429,) or r.status_code >= 500:
                        if attempt < 2:
                            await asyncio.sleep(backoff_seconds + random.uniform(0, 0.5))
                            backoff_seconds *= 2
                            continue
                    r.raise_for_status()
                    data = r.json()
                    return [item["embedding"] for item in data.get("data", [])]
            except httpx.HTTPError:
                if attempt < 2:
                    await asyncio.sleep(backoff_seconds + random.uniform(0, 0.5))
                    backoff_seconds *= 2
                    continue
        return []


