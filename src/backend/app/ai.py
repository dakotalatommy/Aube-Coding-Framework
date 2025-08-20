import os
import httpx
import asyncio
import random
from typing import Dict, Any, List, Optional
import base64


class AIClient:
    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY", "")
        self.base_url = base_url or os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
        # Default to GPT-5 if available; override via OPENAI_MODEL
        self.model = model or os.getenv("OPENAI_MODEL", "gpt-5")
        self.fallback_models = [m.strip() for m in os.getenv("OPENAI_FALLBACK_MODELS", "").split(",") if m.strip()]
        self.provider = os.getenv("AI_PROVIDER", "chat").lower()  # chat | agents
        self.agent_id = os.getenv("OPENAI_AGENT_ID", "")
        if self.provider == "agents" and not self.agent_id:
            # Gracefully fall back to chat if no agent is configured
            self.provider = "chat"
        # Agents API endpoint (customizable for GPT-5 agents)
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
        # If model suggests Responses API (e.g., gpt-5) or explicitly requested, try Responses first
        try_responses = os.getenv("OPENAI_USE_RESPONSES", "false").lower() == "true" or self.model.lower().startswith("gpt-5")
        if try_responses:
            text = await self._generate_via_responses(system, messages, max_tokens)
            if text:
                return text
        # Otherwise use chat completions with model fallbacks
        # Important: if we already tried Responses with a GPT-5 model, skip attempting
        # Chat Completions with that same GPT-5 model (it will 400). Prefer safe fallbacks.
        candidates: List[str]
        if try_responses and self.model.lower().startswith("gpt-5"):
            fallbacks = [m for m in self.fallback_models if m]
            # Ensure a sane default fallback exists
            if not fallbacks:
                fallbacks = ["gpt-4o-mini"]
            candidates = fallbacks
        else:
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

    async def _generate_via_agents(self, system: str, messages: List[Dict[str, str]], max_tokens: int) -> Optional[str]:
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
                    # Unified extraction helpers
                    def _extract_text_from_output(obj) -> Optional[str]:
                        if not isinstance(obj, dict):
                            return None
                        if obj.get("output_text") and isinstance(obj.get("output_text"), str):
                            return obj["output_text"].strip()
                        # Newer shape: output: [{ type: 'message', content: [{ type: 'output_text', text: '...' }] }]
                        out = obj.get("output")
                        if isinstance(out, list):
                            chunks = []
                            for item in out:
                                if isinstance(item, dict):
                                    content = item.get("content")
                                    if isinstance(content, list):
                                        for ch in content:
                                            if isinstance(ch, dict):
                                                ch_type = ch.get("type")
                                                if ch_type in ("output_text", "text", "input_text"):
                                                    t = ch.get("text") or ch.get("content")
                                                    if isinstance(t, str) and t.strip():
                                                        chunks.append(t.strip())
                            if chunks:
                                return " ".join(chunks)[:4000]
                        # Fallback: choices/message/content
                        if obj.get("choices"):
                            try:
                                return obj["choices"][0]["message"]["content"].strip()
                            except Exception:
                                pass
                        # Fallback: plain text if string
                        t = obj.get("text")
                        if isinstance(t, str):
                            return t.strip()
                        return None

                    text = _extract_text_from_output(data)
                    if text:
                        return text
                    return None
            except httpx.HTTPError:
                if attempt < 2:
                    await asyncio.sleep(backoff_seconds + random.uniform(0, 0.5))
                    backoff_seconds *= 2
                    continue
        return None

    async def _generate_via_responses(self, system: str, messages: List[Dict[str, str]], max_tokens: int) -> Optional[str]:
        """Call OpenAI Responses API directly (no agent), useful for newer models like gpt-5."""
        if not self.api_key:
            return None
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        # Flatten to a single input text while preserving roles
        user_transcript = "\n".join([f"{m['role']}: {m['content']}" for m in messages])
        input_text = f"System: {system}\n{user_transcript}".strip()
        payload: Dict[str, Any] = {
            "model": self.model,
            "input": input_text,
            "max_output_tokens": max_tokens,
        }
        backoff_seconds = 1.0
        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=90) as client:
                    r = await client.post(f"{self.base_url}/responses", headers=headers, json=payload)
                    if r.status_code in (429,) or r.status_code >= 500:
                        if attempt < 2:
                            await asyncio.sleep(backoff_seconds + random.uniform(0, 0.5))
                            backoff_seconds *= 2
                            continue
                    if r.status_code in (404, 405):
                        return None
                    r.raise_for_status()
                    data = r.json()
                    # Robust parsing across potential response shapes
                    def _flatten_text(obj) -> str:
                        texts: List[str] = []
                        def _walk(o):
                            if isinstance(o, dict):
                                # capture explicit text fields
                                val = o.get("text")
                                if isinstance(val, str) and val.strip():
                                    texts.append(val.strip())
                                # also capture output_text
                                val2 = o.get("output_text")
                                if isinstance(val2, str) and val2.strip():
                                    texts.append(val2.strip())
                                for v in o.values():
                                    _walk(v)
                            elif isinstance(o, list):
                                for v in o:
                                    _walk(v)
                        _walk(obj)
                        # de-dup while preserving order
                        seen = set()
                        uniq: List[str] = []
                        for t in texts:
                            if t not in seen:
                                seen.add(t)
                                uniq.append(t)
                        return " ".join(uniq)

                    if isinstance(data, dict):
                        if data.get("output_text") and isinstance(data.get("output_text"), str):
                            return str(data["output_text"]).strip()
                        # Responses 2025 shape: output array
                        out = data.get("output")
                        if isinstance(out, list):
                            collected: List[str] = []
                            for item in out:
                                if isinstance(item, dict) and item.get("type") in ("message", "assistant_message", "response"):
                                    content = item.get("content")
                                    if isinstance(content, list):
                                        for ch in content:
                                            if isinstance(ch, dict) and ch.get("type") in ("output_text", "text", "input_text"):
                                                t = ch.get("text") or ch.get("content")
                                                if isinstance(t, str) and t.strip():
                                                    collected.append(t.strip())
                            if collected:
                                return " ".join(collected)[:4000]
                        if data.get("choices"):
                            try:
                                return data["choices"][0]["message"]["content"].strip()
                            except Exception:
                                pass
                        # As a last resort, attempt to flatten any nested text fields and ignore non-text dicts (like {format, verbosity})
                        flat = _flatten_text(data)
                        if flat:
                            return flat[:4000]
                    return None
            except httpx.HTTPError:
                if attempt < 2:
                    await asyncio.sleep(backoff_seconds + random.uniform(0, 0.5))
                    backoff_seconds *= 2
                    continue
        return None

    async def embed(self, texts: List[str], model: Optional[str] = None) -> List[List[float]]:
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

    async def analyze_image(self, image_b64: str, prompt: Optional[str] = None, max_tokens: int = 400) -> Optional[str]:
        """Analyze an image using the Responses API with vision input.
        Expects image_b64 without data: prefix; will add based on best-effort mime.
        """
        if not self.api_key:
            return None
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        # Guess mime from header if present in b64 string; default to image/png
        data_url = image_b64.strip()
        if not data_url.startswith("data:"):
            # assume png
            data_url = "data:image/png;base64," + data_url
        content: List[Dict[str, Any]] = []
        if prompt:
            content.append({"type": "input_text", "text": prompt})
        content.append({"type": "input_image", "image_url": data_url})
        payload: Dict[str, Any] = {
            "model": self.model,
            "input": [
                {
                    "role": "user",
                    "content": content,
                }
            ],
            "max_output_tokens": max_tokens,
        }
        backoff_seconds = 1.0
        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=90) as client:
                    r = await client.post(f"{self.base_url}/responses", headers=headers, json=payload)
                    if r.status_code in (429,) or r.status_code >= 500:
                        if attempt < 2:
                            await asyncio.sleep(backoff_seconds + random.uniform(0, 0.5))
                            backoff_seconds *= 2
                            continue
                    if r.status_code in (404, 405, 400):
                        # Provider may not support this shape
                        return None
                    r.raise_for_status()
                    data = r.json()
                    # Reuse robust extraction
                    def _extract(obj) -> Optional[str]:
                        if not isinstance(obj, dict):
                            return None
                        t = obj.get("output_text")
                        if isinstance(t, str) and t.strip():
                            return t.strip()
                        out = obj.get("output")
                        if isinstance(out, list):
                            chunks: List[str] = []
                            for item in out:
                                if isinstance(item, dict):
                                    content = item.get("content")
                                    if isinstance(content, list):
                                        for ch in content:
                                            if isinstance(ch, dict) and ch.get("type") in ("output_text", "text", "input_text"):
                                                tx = ch.get("text") or ch.get("content")
                                                if isinstance(tx, str) and tx.strip():
                                                    chunks.append(tx.strip())
                            if chunks:
                                return " ".join(chunks)[:4000]
                        if obj.get("choices"):
                            try:
                                return obj["choices"][0]["message"]["content"].strip()
                            except Exception:
                                pass
                        t2 = obj.get("text")
                        if isinstance(t2, str) and t2.strip():
                            return t2.strip()
                        return None
                    return _extract(data)
            except httpx.HTTPError:
                if attempt < 2:
                    await asyncio.sleep(backoff_seconds + random.uniform(0, 0.5))
                    backoff_seconds *= 2
                    continue
        return None

    async def generate_image(self, prompt: str, size: str = "1024x1024") -> Optional[str]:
        """Generate an image via the Images API. Returns base64 PNG string (no data: prefix)."""
        if not self.api_key:
            return None
        model = os.getenv("OPENAI_IMAGE_MODEL", "gpt-image-1")
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload: Dict[str, Any] = {
            "model": model,
            "prompt": prompt,
            "size": size,
            "response_format": "b64_json",
        }
        backoff_seconds = 1.0
        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=120) as client:
                    r = await client.post(f"{self.base_url}/images/generations", headers=headers, json=payload)
                    if r.status_code in (429,) or r.status_code >= 500:
                        if attempt < 2:
                            await asyncio.sleep(backoff_seconds + random.uniform(0, 0.5))
                            backoff_seconds *= 2
                            continue
                    if r.status_code in (404, 405, 400):
                        return None
                    r.raise_for_status()
                    data = r.json()
                    try:
                        b64 = data["data"][0]["b64_json"]
                        if isinstance(b64, str) and b64.strip():
                            return b64.strip()
                    except Exception:
                        return None
            except httpx.HTTPError:
                if attempt < 2:
                    await asyncio.sleep(backoff_seconds + random.uniform(0, 0.5))
                    backoff_seconds *= 2
                    continue
        return None


