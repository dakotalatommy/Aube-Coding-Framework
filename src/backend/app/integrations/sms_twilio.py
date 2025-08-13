import os
import hmac
import hashlib
import base64
from typing import Dict, Any


def twilio_send_sms(to_e164: str, body: str) -> Dict[str, Any]:
    # placeholder: wire httpx to Twilio Messages API
    # returns a stubbed success
    return {"status": "queued", "provider_id": "twilio-stub"}


def twilio_verify_signature(url: str, payload: Dict[str, Any], signature: str) -> bool:
    token = os.getenv("TWILIO_AUTH_TOKEN", "")
    if not token or not signature:
        return False
    s = url + "".join([f"{k}{v}" for k, v in sorted(payload.items())])
    mac = hmac.new(token.encode(), s.encode(), hashlib.sha1).digest()
    expected = base64.b64encode(mac).decode()
    return hmac.compare_digest(signature, expected)


