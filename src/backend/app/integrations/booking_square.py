import hmac
import hashlib
from typing import Dict, List
import time


def verify_square_signature(body: bytes, signature: str, secret: str) -> bool:
    if not (signature and secret):
        return False
    mac = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    # Square may include prefix; use constant time compare on hex
    try:
        return hmac.compare_digest(signature, mac)
    except Exception:
        return False


def fetch_bookings(tenant_id: str) -> List[Dict[str, object]]:
    now = int(time.time())
    # Scaffolded sample bookings; replace with Square Bookings API
    return [
        {"id": f"sq-{now}", "title": "Booking: New consult (Square)", "start_ts": now + 1800, "provider": "square"},
    ]

