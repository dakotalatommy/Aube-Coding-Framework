from typing import Dict, List, Optional
import time
import os
import datetime as _dt
import httpx
from sqlalchemy import text as _sql_text
from ..db import engine
from ..crypto import decrypt_text, encrypt_text


def _google_oauth_creds() -> tuple[str, str]:
    return os.getenv("GOOGLE_CLIENT_ID", ""), os.getenv("GOOGLE_CLIENT_SECRET", "")


def _load_google_tokens(tenant_id: str) -> Dict[str, Optional[str]]:
    access_enc: Optional[str] = None
    refresh_enc: Optional[str] = None
    exp: Optional[int] = None
    try:
        with engine.begin() as conn:
            row = conn.execute(
                _sql_text(
                    "SELECT access_token_enc, refresh_token_enc, expires_at FROM connected_accounts_v2 WHERE tenant_id = CAST(:t AS uuid) AND provider='google' ORDER BY id DESC LIMIT 1"
                ),
                {"t": tenant_id},
            ).fetchone()
        if row:
            access_enc = row[0]
            refresh_enc = row[1]
            try:
                exp = int(row[2] or 0)
            except Exception:
                exp = None
    except Exception:
        pass
    return {"access": access_enc, "refresh": refresh_enc, "exp": (str(exp) if exp else None)}


def _ensure_access_token(tenant_id: str) -> Optional[str]:
    tokens = _load_google_tokens(tenant_id)
    access = decrypt_text(tokens.get("access") or "") or ""
    now = int(time.time())
    try:
        exp = int(tokens.get("exp") or 0)
    except Exception:
        exp = 0
    if access and exp and (exp - now) > 60:
        return access
    # Attempt refresh if we have a RT
    client_id, client_secret = _google_oauth_creds()
    rt = decrypt_text(tokens.get("refresh") or "") or ""
    if not (client_id and client_secret and rt):
        return access or None
    try:
        data = {
            "client_id": client_id,
            "client_secret": client_secret,
            "grant_type": "refresh_token",
            "refresh_token": rt,
        }
        r = httpx.post("https://oauth2.googleapis.com/token", data=data, timeout=15)
        if r.status_code == 200:
            j = r.json()
            at = str(j.get("access_token") or "")
            expires_in = int(j.get("expires_in") or 0)
            if at:
                # Persist new access token and expiry
                try:
                    with engine.begin() as conn:
                        conn.execute(
                            _sql_text(
                                "UPDATE connected_accounts_v2 SET access_token_enc=:at, expires_at=:exp WHERE tenant_id = CAST(:t AS uuid) AND provider='google'"
                            ),
                            {"t": tenant_id, "at": encrypt_text(at), "exp": (int(time.time()) + int(expires_in or 0))},
                        )
                except Exception:
                    pass
                return at
    except Exception:
        pass
    return access or None


def _rfc3339(ts: int) -> str:
    try:
        return _dt.datetime.utcfromtimestamp(int(ts)).replace(microsecond=0).isoformat() + "Z"
    except Exception:
        return _dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def fetch_events(tenant_id: str) -> List[Dict[str, object]]:
    """
    Fetch next 14 days from primary Google Calendar using stored OAuth tokens.
    """
    at = _ensure_access_token(tenant_id)
    if not at:
        return []
    now = int(time.time())
    start = now - 24 * 3600  # include yesterday for safety
    end = now + 14 * 86400
    headers = {"Authorization": f"Bearer {at}"}
    params = {
        "singleEvents": "true",
        "orderBy": "startTime",
        "timeMin": _rfc3339(start),
        "timeMax": _rfc3339(end),
        "maxResults": "200",
    }
    try:
        r = httpx.get("https://www.googleapis.com/calendar/v3/calendars/primary/events", headers=headers, params=params, timeout=20)
        if r.status_code >= 400:
            return []
        items = r.json().get("items", [])
        out: List[Dict[str, object]] = []
        for it in items:
            try:
                eid = str(it.get("id") or "")
                summary = str(it.get("summary") or "")
                st = it.get("start") or {}
                et = it.get("end") or {}
                # dateTime may be missing if all-day event; fallback to date
                def _parse(v: Dict[str, str]) -> int:
                    val = v.get("dateTime") or v.get("date")
                    if not val:
                        return 0
                    try:
                        # Accept both with/without timezone suffix
                        return int(_dt.datetime.fromisoformat(val.replace("Z", "+00:00")).timestamp())
                    except Exception:
                        return 0
                st_ts = _parse(st)
                et_ts = _parse(et)
                if not eid or not st_ts:
                    continue
                out.append({
                    "id": eid,
                    "title": summary or "Google Event",
                    "start_ts": st_ts,
                    "end_ts": (et_ts or None),
                    "provider": "google",
                    "status": str(it.get("status") or ""),
                })
            except Exception:
                continue
        return out
    except Exception:
        return []



def create_event(tenant_id: str, summary: str, start_ts: int, end_ts: Optional[int] = None, description: Optional[str] = None) -> Dict[str, str]:
    """Create a Google Calendar event on the primary calendar using stored OAuth.
    Returns { status, id? , error? }.
    """
    at = _ensure_access_token(tenant_id)
    if not at:
        return {"status": "error", "error": "no_access_token"}
    headers = {"Authorization": f"Bearer {at}", "Content-Type": "application/json"}
    body: Dict[str, object] = {
        "summary": summary or "Appointment",
        "start": {"dateTime": _rfc3339(int(start_ts))},
        "end": {"dateTime": _rfc3339(int(end_ts or (int(start_ts) + 3600)))},
    }
    if description:
        body["description"] = description
    try:
        r = httpx.post("https://www.googleapis.com/calendar/v3/calendars/primary/events", headers=headers, json=body, timeout=20)
        if r.status_code >= 400:
            return {"status": "error", "error": f"google_http_{r.status_code}", "detail": (r.text or "")[:200]}
        eid = str((r.json() or {}).get("id") or "")
        return {"status": "ok", "id": eid}
    except httpx.HTTPError as e:
        return {"status": "error", "error": str(e)[:160]}

