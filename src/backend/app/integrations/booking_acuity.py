import hashlib
import time
from typing import Dict, Any, Optional, List
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
    if not (secret and signature):
        return False
    mac = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    try:
        return hmac.compare_digest(mac, signature)
    except Exception:
        return False


def fetch_bookings(tenant_id: str) -> List[Dict[str, object]]:
    now = int(time.time())
    # Scaffolded sample bookings; replace with Acuity API
    return [
        {"id": f"ac-{now}", "title": "Booking: Follow-up (Acuity)", "start_ts": now + 10800, "provider": "acuity"},
    ]

