import hashlib
import time
from typing import Dict, Any, Optional, List, Tuple
import base64
import os
import httpx
from sqlalchemy import text as _sql_text
from ..db import engine
from ..crypto import decrypt_text
from ..events import emit_event
import hmac
import hashlib


def _with_conn(tenant_id: str, role: str = "owner_admin"):
    """Yield a short-lived connection with RLS GUCs set. Caller must not hold across network calls."""
    conn = engine.begin()
    # Set GUCs (tolerant)
    try:
        conn.__enter__()
        try:
            conn.execute(_sql_text("SET LOCAL app.role = :r"), {"r": role})
        except Exception:
            pass
        try:
            conn.execute(_sql_text("SET LOCAL app.tenant_id = :t"), {"t": tenant_id})
        except Exception:
            pass
        yield conn
    finally:
        try:
            conn.__exit__(None, None, None)
        except Exception:
            pass


def _read_one(conn, sql: str, params: Dict[str, object]) -> Optional[Tuple[object, ...]]:
    try:
        return conn.execute(_sql_text(sql), params).fetchone()
    except Exception:
        return None


def _fetch_acuity_token(tenant_id: str) -> str:
    """Return decrypted Acuity access token if present in connected_accounts_v2, else ''."""
    token = ""
    # v2 via short-lived conn
    for _ in range(2):  # one retry on transient disconnect
        try:
            with _with_conn(tenant_id) as conn:  # type: ignore
                row = _read_one(conn, "SELECT access_token_enc FROM connected_accounts_v2 WHERE tenant_id = CAST(:t AS uuid) AND provider='acuity' ORDER BY id DESC LIMIT 1", {"t": tenant_id})
                if row and row[0]:
                    try:
                        token = decrypt_text(str(row[0])) or str(row[0])
                    except Exception:
                        token = str(row[0])
                if token:
                    return token
        except Exception:
            time.sleep(0.05)
            continue
        break
    # Do not fallback to legacy connected_accounts; v2-only
    return token or ""


def _timestamp_expr(conn) -> str:
    """Return NOW() or EXTRACT(EPOCH FROM now())::bigint based on contacts.created_at type."""
    try:
        r = conn.execute(
            _sql_text(
                "SELECT lower(data_type) FROM information_schema.columns WHERE table_schema='public' AND table_name='contacts' AND column_name='created_at'"
            )
        ).fetchone()
        if r and isinstance(r[0], str) and "timestamp" in r[0].lower():
            return "NOW()"
    except Exception:
        pass
    return "EXTRACT(EPOCH FROM now())::bigint"


def _acuity_headers(tenant_id: str) -> Dict[str, str]:
    # Prefer OAuth Bearer first for multi-tenant app connect flow
    t = _fetch_acuity_token(tenant_id)
    if t:
        return {"Authorization": f"Bearer {t}", "Accept": "application/json"}
    # Fallback to Basic only if Bearer absent
    user_id = os.getenv("ACUITY_USER_ID", os.getenv("ACUITY_CLIENT_ID", "")).strip()
    api_key = os.getenv("ACUITY_API_KEY", "").strip()
    if user_id and api_key:
        raw = f"{user_id}:{api_key}".encode("utf-8")
        return {"Authorization": f"Basic {base64.b64encode(raw).decode('utf-8')}", "Accept": "application/json"}
    return {"Accept": "application/json"}


def _parse_epoch(s: Optional[str]) -> int:
    if not s:
        return 0
    try:
        # Try ISO8601
        from datetime import datetime
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return int(dt.timestamp())
    except Exception:
        try:
            return int(float(s))
        except Exception:
            return 0


def import_appointments(tenant_id: str, since: Optional[str] = None, until: Optional[str] = None, cursor: Optional[str] = None) -> Dict[str, Any]:
    base = (os.getenv("ACUITY_API_BASE", "https://acuityscheduling.com/api/v1").strip().rstrip(" /."))
    headers = _acuity_headers(tenant_id)
    try:
        auth_hdr = str(headers.get("Authorization", ""))
        auth_mode = "basic" if auth_hdr.startswith("Basic ") else ("bearer" if auth_hdr.startswith("Bearer ") else "none")
    except Exception:
        auth_mode = "none"
    imported = 0
    updated = 0
    skipped = 0
    dbg_clients_status: Optional[int] = None
    dbg_clients_count = 0
    dbg_clients_error: Optional[str] = None
    dbg_appts_status: Optional[int] = None
    dbg_appts_count = 0
    dbg_appts_error: Optional[str] = None
    # 1) ensure tenant row for FK
    try:
        with _with_conn(tenant_id) as conn:  # type: ignore
            conn.execute(
                _sql_text("INSERT INTO public.tenants(id,name,created_at) VALUES (CAST(:t AS uuid), 'Workspace', NOW()) ON CONFLICT(id) DO NOTHING"),
                {"t": tenant_id},
            )
    except Exception:
        pass
    # 2) fetch clients and cache minimal map: clientId -> contact_id
    client_map: Dict[str, str] = {}
    try:
        with httpx.Client(timeout=20, headers=headers) as client:
            offset = 0
            limit = 100
            while True:
                params: Dict[str, object] = {"limit": limit, "offset": offset}
                r = client.get(f"{base}/clients", params=params)
                dbg_clients_status = r.status_code
                if r.status_code >= 400:
                    try:
                        dbg_clients_error = (r.text or "")[:300]
                    except Exception:
                        dbg_clients_error = None
                    break
                arr = r.json() or []
                if not isinstance(arr, list):
                    break
                if not arr:
                    break
                try:
                    dbg_clients_count += len(arr)
                except Exception:
                    pass
                # upsert contacts in batches
                for c in arr:
                    try:
                        cid_raw = str(c.get("id") or "")
                        contact_id = f"acuity:{cid_raw}" if cid_raw else (f"acuity:email/{c.get('email', '')}" if c.get("email") else f"acuity:{hashlib.md5(str(c).encode()).hexdigest()[:10]}")
                        client_map[cid_raw] = contact_id
                        # Upsert
                        with _with_conn(tenant_id) as conn:  # type: ignore
                            ts_expr = _timestamp_expr(conn)
                            # UPDATE first
                            u = conn.execute(
                                _sql_text(
                                    "UPDATE contacts SET first_name=:fn,last_name=:ln,display_name=:dn,email_hash=:em,phone_hash=:ph,updated_at="
                                    + ts_expr
                                    + " WHERE tenant_id = CAST(:t AS uuid) AND contact_id=:cid"
                                ),
                                {
                                    "t": tenant_id,
                                    "cid": contact_id,
                                    "fn": (c.get("firstName") or c.get("first_name") or ""),
                                    "ln": (c.get("lastName") or c.get("last_name") or ""),
                                    "dn": (c.get("name") or ""),
                                    "em": (c.get("email") or None),
                                    "ph": (c.get("phone") or None),
                                },
                            )
                            rc = int(getattr(u, "rowcount", 0) or 0)
                            if rc == 0:
                                conn.execute(
                                    _sql_text(
                                        "INSERT INTO contacts(tenant_id,contact_id,first_name,last_name,display_name,email_hash,phone_hash,consent_sms,consent_email,created_at,updated_at) "
                                        "VALUES (CAST(:t AS uuid),:cid,:fn,:ln,:dn,:em,:ph,false,false,"
                                        + ts_expr
                                        + ","
                                        + ts_expr
                                        + ")"
                                    ),
                                    {
                                        "t": tenant_id,
                                        "cid": contact_id,
                                        "fn": (c.get("firstName") or c.get("first_name") or ""),
                                        "ln": (c.get("lastName") or c.get("last_name") or ""),
                                        "dn": (c.get("name") or ""),
                                        "em": (c.get("email") or None),
                                        "ph": (c.get("phone") or None),
                                    },
                                )
                            else:
                                updated += 1
                            imported += 1
                    except Exception:
                        skipped += 1
                if len(arr) < limit:
                    break
                offset += limit
    except httpx.HTTPError:
        pass
    # 3) fetch appointments and upsert
    appt_imported = 0
    try:
        with httpx.Client(timeout=20, headers=headers) as client:
            offset = 0
            limit = 100
            while True:
                params: Dict[str, object] = {"limit": limit, "offset": offset}
                if since:
                    params["minDate"] = since  # Acuity accepts ISO like 2024-01-01 per docs; tolerant usage
                if until:
                    params["maxDate"] = until
                r = client.get(f"{base}/appointments", params=params)
                dbg_appts_status = r.status_code
                if r.status_code >= 400:
                    try:
                        dbg_appts_error = (r.text or "")[:300]
                    except Exception:
                        dbg_appts_error = None
                    break
                arr = r.json() or []
                if not isinstance(arr, list) or not arr:
                    break
                try:
                    dbg_appts_count += len(arr)
                except Exception:
                    pass
                for a in arr:
                    try:
                        aid = str(a.get("id") or "")
                        ext = f"acuity:{aid}" if aid else f"acuity:{hashlib.md5(str(a).encode()).hexdigest()[:10]}"
                        cid = str(a.get("clientID") or a.get("clientId") or a.get("client_id") or "")
                        contact_id = client_map.get(cid) or (f"acuity:{cid}" if cid else (f"acuity:email/{a.get('email','')}" if a.get("email") else None))
                        start_ts = _parse_epoch(a.get("datetime") or a.get("startTime") or a.get("start_ts"))
                        end_ts = _parse_epoch(a.get("endTime") or a.get("end_ts")) or None
                        status = str(a.get("status") or "booked").lower()
                        service = str(a.get("type") or a.get("title") or a.get("service") or "")
                        with _with_conn(tenant_id) as conn:  # type: ignore
                            r1 = conn.execute(_sql_text("UPDATE appointments SET contact_id=:c, service=:s, start_ts=:st, end_ts=:et, status=:stt WHERE tenant_id = CAST(:t AS uuid) AND external_ref = :x"), {"t": tenant_id, "x": ext, "c": (contact_id or ""), "s": service, "st": int(start_ts or 0), "et": (int(end_ts) if end_ts else None), "stt": status})
                            if int(getattr(r1, "rowcount", 0) or 0) == 0:
                                conn.execute(_sql_text("INSERT INTO appointments(tenant_id,contact_id,service,start_ts,end_ts,status,external_ref,created_at) VALUES (CAST(:t AS uuid),:c,:s,:st,:et,:stt,:x,EXTRACT(EPOCH FROM now())::bigint)"), {"t": tenant_id, "x": ext, "c": (contact_id or ""), "s": service, "st": int(start_ts or 0), "et": (int(end_ts) if end_ts else None), "stt": status})
                        appt_imported += 1
                    except Exception:
                        skipped += 1
                if len(arr) < limit:
                    break
                offset += limit
    except httpx.HTTPError:
        pass
    # 4) update last_sync
    try:
        with _with_conn(tenant_id) as conn:  # type: ignore
            conn.execute(_sql_text("UPDATE connected_accounts_v2 SET last_sync = EXTRACT(EPOCH FROM now())::bigint WHERE tenant_id = CAST(:t AS uuid) AND provider='acuity'"), {"t": tenant_id})
    except Exception:
        pass
    try:
        emit_event("AcuityImportCompleted", {"tenant_id": tenant_id, "contacts": int(imported), "appointments": int(appt_imported)})
    except Exception:
        pass
    return {
        "imported": appt_imported,
        "updated": int(updated),
        "skipped_duplicates": int(skipped),
        "clients_status": dbg_clients_status,
        "clients_count": dbg_clients_count,
        "appointments_status": dbg_appts_status,
        "appointments_count": dbg_appts_count,
        "auth_mode": auth_mode,
        **({"clients_error": dbg_clients_error} if dbg_clients_error else {}),
        **({"appointments_error": dbg_appts_error} if dbg_appts_error else {}),
        "next_cursor": None,
    }


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

