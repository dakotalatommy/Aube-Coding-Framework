import hashlib
import time
from typing import Dict, Any, Optional, List
import base64
from ..events import emit_event
import hmac
import hashlib


def import_appointments(tenant_id: str, since: Optional[str] = None, until: Optional[str] = None, cursor: Optional[str] = None) -> Dict[str, Any]:
    # Simulated import window
    count = 3
    emit_event(
        "AppointmentIngested",
        {"tenant_id": tenant_id, "external_ref": f"acuity:{hashlib.md5((since or '0').encode()).hexdigest()[:8]}", "dedup_key": cursor or ""},
    )
    # placeholder retry/backoff behavior
    # backoff placeholder
    time.sleep(0.1)
    return {"imported": count, "updated": 0, "skipped_duplicates": 0, "next_cursor": None}


def acuity_verify_signature(secret: str, payload: bytes, signature: str) -> bool:
    """
    Acuity signs webhooks with HMAC-SHA256 over the raw request body using the account API key.
    Many setups send the signature as base64, but some integrations use hex. Accept both.
    """
    if not (secret and signature):
        return False
    try:
        mac_raw = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).digest()
        sig_b64 = base64.b64encode(mac_raw).decode("utf-8")
        sig_hex = mac_raw.hex()
        given = signature.strip()
        # Compare against base64 first, then hex (case-insensitive for hex)
        if hmac.compare_digest(sig_b64, given):
            return True
        if hmac.compare_digest(sig_hex, given.lower()) or hmac.compare_digest(sig_hex.upper(), given.upper()):
            return True
        return False
    except Exception:
        return False


def fetch_bookings(tenant_id: str) -> List[Dict[str, object]]:
    now = int(time.time())
    # Scaffolded sample bookings; replace with Acuity API
    return [
        {"id": f"ac-{now}", "title": "Booking: Follow-up (Acuity)", "start_ts": now + 10800, "provider": "acuity"},
    ]

