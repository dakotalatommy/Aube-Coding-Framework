from typing import Dict, Any
import os
import httpx


def sendgrid_send_email(to_email: str, subject: str, body_html: str) -> Dict[str, Any]:
    api_key = os.getenv("SENDGRID_API_KEY", "")
    from_email = os.getenv("SENDGRID_FROM_EMAIL", "")
    if not (api_key and from_email and to_email):
        raise RuntimeError("sendgrid not configured")
    url = "https://api.sendgrid.com/v3/mail/send"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload = {
        "personalizations": [{"to": [{"email": to_email}]}],
        "from": {"email": from_email},
        "subject": subject,
        "content": [{"type": "text/html", "value": body_html}],
    }
    with httpx.Client(timeout=20) as client:
        r = client.post(url, headers=headers, json=payload)
        if r.status_code not in (200, 202):
            r.raise_for_status()
        return {"status": "queued", "provider_id": r.headers.get("X-Message-Id", "")}


def sendgrid_verify_signature(headers: Dict[str, str], payload: bytes) -> bool:
    # Placeholder: SendGrid uses Ed25519 signature verification with a public key
    # Expose env to toggle acceptance until keys are configured
    accept_unsigned = os.getenv("SENDGRID_ACCEPT_UNSIGNED", "false").lower() == "true"
    return accept_unsigned


