from typing import Dict, Any
import os
import httpx
from ..cache import breaker_allow, breaker_on_result
import re

# Optional dependency: PyNaCl for webhook verification. Guard import so the API can run without it in dev.
try:  # pragma: no cover - import guard
    import nacl.signing  # type: ignore
    import nacl.encoding  # type: ignore
    _NACL_AVAILABLE = True
except Exception:  # pragma: no cover - import guard
    nacl = None  # type: ignore
    _NACL_AVAILABLE = False


def sendgrid_send_email(to_email: str, subject: str, body_html: str) -> Dict[str, Any]:
    api_key = os.getenv("SENDGRID_API_KEY", "")
    from_email = os.getenv("SENDGRID_FROM_EMAIL", "")
    if not (api_key and from_email and to_email):
        raise RuntimeError("sendgrid not configured")
    url = "https://api.sendgrid.com/v3/mail/send"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    # Plain-text fallback by stripping HTML tags
    text_fallback = re.sub(r"<[^>]+>", " ", body_html)
    text_fallback = re.sub(r"\s+", " ", text_fallback).strip()
    payload = {
        "personalizations": [{"to": [{"email": to_email}]}],
        "from": {"email": from_email},
        "subject": subject,
        "content": [
            {"type": "text/plain", "value": text_fallback or "Hello from BrandVX"},
            {"type": "text/html", "value": body_html},
        ],
    }
    name = "sendgrid_send"
    if not breaker_allow(name):
        raise RuntimeError("sendgrid circuit open")
    ok = False
    try:
        with httpx.Client(timeout=20) as client:
            r = client.post(url, headers=headers, json=payload)
            if r.status_code not in (200, 202):
                r.raise_for_status()
            ok = True
            return {"status": "queued", "provider_id": r.headers.get("X-Message-Id", "")}
    finally:
        breaker_on_result(name, ok)


def sendgrid_verify_signature(headers: Dict[str, str], payload: bytes) -> bool:
    """Verify SendGrid Event Webhook signature (Ed25519).

    Env:
      - SENDGRID_PUBLIC_KEY: base64 or hex public key
      - SENDGRID_ACCEPT_UNSIGNED: 'true' to temporarily allow unsigned payloads (dev only)
    """
    accept_unsigned = os.getenv("SENDGRID_ACCEPT_UNSIGNED", "false").lower() == "true"
    public_key = os.getenv("SENDGRID_PUBLIC_KEY", "").strip()
    sig = headers.get("X-Twilio-Email-Event-Webhook-Signature") or headers.get("X-Signature-Ed25519")
    ts = headers.get("X-Twilio-Email-Event-Webhook-Timestamp") or headers.get("X-Signature-Timestamp")
    if not public_key:
        return accept_unsigned
    if not (sig and ts):
        return accept_unsigned
    if not _NACL_AVAILABLE:
        # If PyNaCl is not installed, allow unsigned in dev only; otherwise fail closed
        return accept_unsigned
    try:
        verify_key = nacl.signing.VerifyKey(public_key, encoder=nacl.encoding.Base64Encoder)
        message = (ts.encode() + payload)
        verify_key.verify(message, nacl.encoding.Base64Encoder.decode(sig))
        return True
    except Exception:
        return False


