import hmac
import hashlib
from typing import Dict, List, Optional
import time
import httpx
from sqlalchemy import text as _sql_text
from ..db import engine
from ..crypto import decrypt_text


def verify_square_signature(body: bytes, signature: str, secret: str) -> bool:
    if not (signature and secret):
        return False
    mac = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    # Square may include prefix; use constant time compare on hex
    try:
        return hmac.compare_digest(signature, mac)
    except Exception:
        return False


def _load_square_token(tenant_id: str, auto_refresh: bool = True) -> Optional[str]:
    """Load Square access token with automatic refresh support."""
    try:
        # Import here to avoid circular dependency
        from ..main import _get_connected_account
        
        info = _get_connected_account(tenant_id, "square", auto_refresh=auto_refresh)
        return str(info.get("access_token") or "") or None
    except Exception:
        # Fallback to direct DB query if helper function fails
        try:
            with engine.begin() as conn:
                row = conn.execute(
                    _sql_text(
                        "SELECT access_token_enc FROM connected_accounts_v2 WHERE tenant_id = CAST(:t AS uuid) AND provider='square' ORDER BY id DESC LIMIT 1"
                    ),
                    {"t": tenant_id},
                ).fetchone()
            if row and row[0]:
                return decrypt_text(str(row[0])) or str(row[0])
        except Exception:
            return None
        return None


def fetch_bookings(tenant_id: str) -> List[Dict[str, object]]:
    """
    Fetch upcoming bookings via Square Bookings API and map to unified calendar entries.
    """
    at = _load_square_token(tenant_id)
    if not at:
        return []
    headers = {"Authorization": f"Bearer {at}", "Content-Type": "application/json"}
    # Square Bookings API: list bookings (v2). We'll bound to next 14 days.
    now = int(time.time())
    start = now - 24 * 3600
    end = now + 14 * 86400
    # Square expects RFC3339 timestamps
    import datetime as _dt
    time_min = _dt.datetime.utcfromtimestamp(start).replace(microsecond=0).isoformat() + "Z"
    time_max = _dt.datetime.utcfromtimestamp(end).replace(microsecond=0).isoformat() + "Z"
    params = {
        "limit": 200,
        "min_start_at": time_min,
        "max_start_at": time_max,
        # optionally: location_id
    }
    try:
        r = httpx.get("https://connect.squareup.com/v2/bookings", headers=headers, params=params, timeout=20)
        if r.status_code >= 400:
            return []
        items = r.json().get("bookings", [])
        out: List[Dict[str, object]] = []
        for b in items:
            try:
                bid = str(b.get("id") or "")
                status = str(b.get("status") or "")
                start_at = ((b.get("start_at") or {}) if isinstance(b.get("start_at"), dict) else {"start_at": b.get("start_at")}).get("start_at") or b.get("start_at")
                end_at = ((b.get("end_at") or {}) if isinstance(b.get("end_at"), dict) else {"end_at": b.get("end_at")}).get("end_at") or b.get("end_at")
                service_names = []
                try:
                    for appt in b.get("appointment_segments", []) or []:
                        name = (appt.get("service_variation_name") or appt.get("service_variation_version")) or ""
                        if name:
                            service_names.append(str(name))
                except Exception:
                    pass
                title = ", ".join([s for s in service_names if s]) or "Square booking"
                def _parse_iso(val: Optional[str]) -> int:
                    if not val:
                        return 0
                    try:
                        return int(_dt.datetime.fromisoformat(val.replace("Z", "+00:00")).timestamp())
                    except Exception:
                        return 0
                st_ts = _parse_iso(str(start_at) if start_at else None)
                et_ts = _parse_iso(str(end_at) if end_at else None)
                if not bid or not st_ts:
                    continue
                out.append({
                    "id": bid,
                    "title": title,
                    "start_ts": st_ts,
                    "end_ts": (et_ts or None),
                    "provider": "square",
                    "status": status,
                })
            except Exception:
                continue
        return out
    except Exception:
        return []

