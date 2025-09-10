import os
from typing import Any, Dict, Optional

_ph = None

def _get_posthog():
    """Lazy init PostHog client if API key present; return None otherwise.
    Safe to call even if package is not installed — will no-op.
    """
    global _ph
    if _ph is not None:
        return _ph
    api_key = os.getenv("POSTHOG_API_KEY", "").strip()
    if not api_key:
        _ph = False
        return None
    try:
        from posthog import Posthog  # type: ignore

        host = os.getenv("POSTHOG_HOST", "https://us.i.posthog.com").strip()
        _ph = Posthog(api_key=api_key, host=host, timeout=3)
        return _ph
    except Exception:
        _ph = False
        return None


def ph_capture(event: str, distinct_id: str, properties: Optional[Dict[str, Any]] = None) -> None:
    """Best-effort capture; never raises.
    If PostHog is not configured/available, silently no-ops.
    """
    try:
        client = _get_posthog()
        if client is None or client is False:
            return
        props = properties or {}
        client.capture(distinct_id=distinct_id or "anonymous", event=event, properties=props)
    except Exception:
        return

