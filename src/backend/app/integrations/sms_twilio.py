import os
import hmac
import hashlib
import base64
from typing import Dict, Any
import httpx


def twilio_send_sms(to_e164: str, body: str) -> Dict[str, Any]:
    account_sid = os.getenv("TWILIO_ACCOUNT_SID", "")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN", "")
    from_number = os.getenv("TWILIO_FROM_NUMBER", "")
    if not (account_sid and auth_token and from_number and to_e164):
        raise RuntimeError("twilio not configured")
    url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
    data = {"To": to_e164, "From": from_number, "Body": body}
    with httpx.Client(timeout=20) as client:
        r = client.post(url, data=data, auth=(account_sid, auth_token))
        r.raise_for_status()
        j = r.json()
        return {"status": j.get("status", "queued"), "provider_id": j.get("sid", "")}


def twilio_verify_signature(url: str, payload: Dict[str, Any], signature: str) -> bool:
    token = os.getenv("TWILIO_AUTH_TOKEN", "")
    if not token or not signature:
        return False
    s = url + "".join([f"{k}{v}" for k, v in sorted(payload.items())])
    mac = hmac.new(token.encode(), s.encode(), hashlib.sha1).digest()
    expected = base64.b64encode(mac).decode()
    return hmac.compare_digest(signature, expected)


