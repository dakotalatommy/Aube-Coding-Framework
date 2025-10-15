import hashlib
import sys
import time
from time import perf_counter
from typing import Dict, Any, Optional, List, Tuple, Set
from contextlib import contextmanager
import base64
import os
import httpx
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from sqlalchemy import text as _sql_text
from ..db import engine
from ..crypto import decrypt_text
from ..events import emit_event
import hmac
import hashlib
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


@contextmanager
def _with_conn(tenant_id: str, role: str = "owner_admin"):
    conn_cm = engine.begin()
    exc_info = (None, None, None)
    try:
        conn = conn_cm.__enter__()
        try:
            conn.execute(_sql_text("SELECT set_config('app.role', :role, true)"), {"role": role})
        except Exception:
            logger.exception("Failed to set app.role GUC (role=%s)", role)
            raise
        try:
            conn.execute(_sql_text("SELECT set_config('app.tenant_id', :tenant_id, true)"), {"tenant_id": tenant_id})
        except Exception:
            logger.exception("Failed to set app.tenant_id GUC (tenant_id=%s)", tenant_id)
            raise
        yield conn
    except Exception:
        exc_info = sys.exc_info()
        raise
    finally:
        # Always call __exit__ with proper exception info, suppress any cleanup errors
        try:
            conn_cm.__exit__(*exc_info)
        except Exception:
            # Suppress cleanup errors to prevent connection leaks
            pass


def _read_one(conn, sql: str, params: Dict[str, object]) -> Optional[Tuple[object, ...]]:
    try:
        return conn.execute(_sql_text(sql), params).fetchone()
    except Exception:
        return None


def _fetch_acuity_token(tenant_id: str) -> str:
    token = ""
    for attempt in range(2):
        try:
            with _with_conn(tenant_id) as conn:  # type: ignore
                row = _read_one(
                    conn,
                    """
                    SELECT access_token_enc
                    FROM connected_accounts_v2
                    WHERE tenant_id = CAST(:t AS uuid)
                      AND provider='acuity'
                      AND access_token_enc IS NOT NULL
                      AND access_token_enc <> ''
                    ORDER BY id DESC
                    LIMIT 1
                    """,
                    {"t": tenant_id},
                )
                if row and row[0]:
                    candidate = str(row[0]).strip()
                    dec = decrypt_text(candidate) if candidate else None
                    if dec and dec.strip():
                        token = dec.strip()
                    elif candidate:
                        token = candidate
                if token:
                    return token
        except Exception:
            logger.exception("Error fetching Acuity token (attempt %s)", attempt + 1)
            if attempt == 0:
                time.sleep(0.05)
                continue
            raise
        break
    return token or ""


def _timestamp_expr(conn) -> str:
    try:
        r = conn.execute(
            _sql_text(
                "SELECT lower(data_type) FROM information_schema.columns "
                "WHERE table_schema='public' AND table_name='contacts' AND column_name='created_at'"
            )
        ).fetchone()
        if r and isinstance(r[0], str) and "timestamp" in r[0].lower():
            return "NOW()"
    except Exception:
        pass
    return "EXTRACT(EPOCH FROM now())::bigint"


def _acuity_headers(tenant_id: str) -> Dict[str, str]:
    t = _fetch_acuity_token(tenant_id)
    if t:
        return {"Authorization": f"Bearer {t}", "Accept": "application/json"}
    user_id = os.getenv("ACUITY_USER_ID", os.getenv("ACUITY_CLIENT_ID", "")).strip()
    api_key = os.getenv("ACUITY_API_KEY", "").strip()
    if user_id and api_key:
        raw = f"{user_id}:{api_key}".encode("utf-8")
        return {"Authorization": f"Basic {base64.b64encode(raw).decode('utf-8')}", "Accept": "application/json"}
    return {"Accept": "application/json"}


def _parse_epoch(s: Optional[str]) -> int:
    if not s:
        return 0
    normalized = str(s).strip()
    if not normalized:
        return 0
    try:
        iso_candidate = normalized
        if "T" not in iso_candidate and " " in iso_candidate:
            iso_candidate = iso_candidate.replace(" ", "T", 1)
        dt = datetime.fromisoformat(iso_candidate.replace("Z", "+00:00"))
        return int(dt.timestamp())
    except Exception:
        pass
    try:
        dt = datetime.strptime(normalized, "%Y-%m-%d %H:%M:%S")
        return int(dt.timestamp())
    except Exception:
        pass
    try:
        return int(float(normalized))
    except Exception:
        return 0


def _get_entry(ledger: Dict[str, Dict[str, Any]], contact_id: str) -> Dict[str, Any]:
    entry = ledger.get(contact_id)
    if entry is None:
        entry = {
            "first": 0,
            "last": 0,
            "txn_count": 0,
            "lifetime_cents": 0,
            "_txn_ids": set(),
            "_order_ids": set(),
        }
        ledger[contact_id] = entry
    else:
        entry.setdefault("_txn_ids", set())
        entry.setdefault("_order_ids", set())
        entry.setdefault("txn_count", 0)
        entry.setdefault("lifetime_cents", 0)
        entry.setdefault("first", 0)
        entry.setdefault("last", 0)
    return entry


def _apply_visit(entry: Dict[str, Any], ts: int) -> None:
    if not ts:
        return
    first = int(entry.get("first", 0) or 0)
    last = int(entry.get("last", 0) or 0)
    if not first or ts < first:
        entry["first"] = ts
    if ts > last:
        entry["last"] = ts


def _parse_amount_to_cents(amount: Any) -> int:
    if amount is None:
        return 0
    try:
        if isinstance(amount, (int, float)):
            decimal_val = Decimal(str(amount))
        else:
            decimal_val = Decimal(str(amount).strip())
        cents = int((decimal_val * 100).to_integral_value(rounding=ROUND_HALF_UP))
        return cents
    except (InvalidOperation, ValueError, TypeError):
        return 0


def _collect_appointment_payments(
    ledger: Dict[str, Dict[str, Any]],
    contact_id: str,
    client: httpx.Client,
    base: str,
    appointment_id: str,
) -> None:
    if not appointment_id:
        return
    try:
        resp = client.get(f"{base}/appointments/{appointment_id}/payments")
    except httpx.HTTPError as exc:
        logger.warning(
            "Acuity appointment payments request failed",
            extra={"appointment_id": appointment_id, "error": str(exc)},
        )
        return
    if resp.status_code >= 400:
        logger.warning(
            "Acuity appointment payments returned error",
            extra={
                "appointment_id": appointment_id,
                "status": resp.status_code,
                "body": (resp.text or "")[:200],
            },
        )
        return
    payments = resp.json() or []
    if not isinstance(payments, list) or not payments:
        return
    entry = _get_entry(ledger, contact_id)
    txn_ids: Set[str] = entry["_txn_ids"]  # type: ignore[assignment]
    for payment in payments:
        amount_raw = payment.get("amount")
        cents = _parse_amount_to_cents(amount_raw)
        transaction_id = str(payment.get("transactionID") or "").strip()
        if transaction_id and transaction_id in txn_ids:
            continue
        if transaction_id:
            txn_ids.add(transaction_id)
        if cents:
            entry["lifetime_cents"] = int(entry.get("lifetime_cents", 0)) + cents
        entry["txn_count"] = int(entry.get("txn_count", 0)) + 1
        created_ts = _parse_epoch(payment.get("created"))
        _apply_visit(entry, created_ts)


def _collect_orders_payments(
    ledger: Dict[str, Dict[str, Any]],
    client: httpx.Client,
    base: str,
    email_to_contact: Dict[str, str],
) -> None:
    offset = 0
    page_size = 100
    while True:
        try:
            resp = client.get(f"{base}/orders", params={"max": page_size, "offset": offset})
        except httpx.HTTPError as exc:
            logger.warning(
                "Acuity orders request failed",
                extra={"offset": offset, "error": str(exc)},
            )
            return
        if resp.status_code >= 400:
            logger.warning(
                "Acuity orders returned error",
                extra={
                    "offset": offset,
                    "status": resp.status_code,
                    "body": (resp.text or "")[:200],
                },
            )
            return
        orders = resp.json() or []
        if not isinstance(orders, list) or not orders:
            break
        for order in orders:
            email_key = str(order.get("email") or "").strip().lower()
            contact_id = email_to_contact.get(email_key)
            if not contact_id:
                continue
            entry = _get_entry(ledger, contact_id)
            order_id = str(order.get("id") or "").strip()
            order_ids: Set[str] = entry["_order_ids"]  # type: ignore[assignment]
            if order_id and order_id in order_ids:
                continue
            if order_id:
                order_ids.add(order_id)
            cents = _parse_amount_to_cents(order.get("total"))
            if cents:
                entry["lifetime_cents"] = int(entry.get("lifetime_cents", 0)) + cents
            entry["txn_count"] = int(entry.get("txn_count", 0)) + 1
            created_ts = _parse_epoch(order.get("time"))
            _apply_visit(entry, created_ts)
        if len(orders) < page_size:
            break
        offset += page_size


# -----------------------------------------------------------------------------
#  Main import flow
# -----------------------------------------------------------------------------

def import_appointments(
    tenant_id: str,
    since: Optional[str] = None,
    until: Optional[str] = None,
    cursor: Optional[str] = None,
    *,
    page_limit: Optional[int] = None,
    skip_appt_payments: Optional[bool] = None,
) -> Dict[str, Any]:
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
    appt_imported = 0
    dbg_clients_status: Optional[int] = None
    dbg_clients_count = 0
    dbg_clients_error: Optional[str] = None
    dbg_appts_status: Optional[int] = None
    dbg_appts_count = 0
    dbg_appts_error: Optional[str] = None
    payments_map: Dict[str, Dict[str, Any]] = {}

    if skip_appt_payments is None:
        skip_appt_payments = os.getenv("ACUITY_SKIP_APPOINTMENT_PAYMENTS", "0") == "1"
    if page_limit is None:
        page_limit = int(os.getenv("ACUITY_PAGE_LIMIT", "100") or "100")

    try:
        with _with_conn(tenant_id) as conn:  # type: ignore
            conn.execute(
                _sql_text("INSERT INTO public.tenants(id,name,created_at) VALUES (CAST(:t AS uuid), 'Workspace', NOW()) ON CONFLICT(id) DO NOTHING"),
                {"t": tenant_id},
            )
    except Exception:
        pass

    print(f"[acuity] import_started: tenant={tenant_id}, since={since}, until={until}, cursor={cursor}, page_limit={page_limit}, skip_appt_payments={skip_appt_payments}")

    client_map: Dict[str, str] = {}
    email_map: Dict[str, str] = {}
    try:
        with httpx.Client(timeout=20, headers=headers) as client:
            clients_started = perf_counter()
            client_pages = 0
            offset = 0
            limit = page_limit
            contacts_processed = 0
            while True:
                params: Dict[str, object] = {"limit": limit, "offset": offset}
                if since:
                    params["minDate"] = since
                if until:
                    params["maxDate"] = until
                fetch_started = perf_counter()
                r = client.get(f"{base}/clients", params=params)
                fetch_ms = int((perf_counter() - fetch_started) * 1000)
                dbg_clients_status = r.status_code
                if r.status_code >= 400:
                    dbg_clients_error = (r.text or "")[:300]
                    break
                arr = r.json() or []
                if not isinstance(arr, list) or not arr:
                    break
                dbg_clients_count += len(arr)
                client_pages += 1
                print(f"[acuity] clients_page: tenant={tenant_id}, page={client_pages}, fetched={len(arr)}, offset={offset}, elapsed_ms={fetch_ms}")
                for c in arr:
                    try:
                        cid_raw = str(c.get("id") or "")
                        contact_id = f"acuity:{cid_raw}" if cid_raw else (
                            f"acuity:email/{c.get('email', '')}"
                            if c.get("email")
                            else f"acuity:{hashlib.md5(str(c).encode()).hexdigest()[:10]}"
                        )
                        client_map[cid_raw] = contact_id
                        email_val = str(c.get("email") or "").strip().lower()
                        if email_val:
                            email_map[email_val] = contact_id
                        
                        # Each contact gets its own transaction to avoid lock timeout cascades
                        with _with_conn(tenant_id) as conn:  # type: ignore
                            ts_expr = _timestamp_expr(conn)
                            u = conn.execute(
                                _sql_text(
                                    "UPDATE contacts SET first_name=:fn,last_name=:ln,display_name=:dn,email=:em,phone=:ph,updated_at="
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
                                        "INSERT INTO contacts(tenant_id,contact_id,first_name,last_name,display_name,email,phone,consent_sms,consent_email,first_visit,last_visit,txn_count,lifetime_cents,instant_profile,created_at,updated_at) "
                                        "VALUES (CAST(:t AS uuid),:cid,:fn,:ln,:dn,:em,:ph,false,false,0,0,0,0,false,"
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
                        contacts_processed += 1
                        if contacts_processed % 50 == 0:
                            print(f"[acuity] contacts_progress: tenant={tenant_id}, processed={contacts_processed}, pages={client_pages}")
                        imported += 1
                    except Exception:
                        skipped += 1
                if len(arr) < limit:
                    break
                offset += limit

            print(f"[acuity] clients_fetched: tenant={tenant_id}, pages={client_pages}, count={dbg_clients_count}, seconds={round(perf_counter() - clients_started, 2)}")

            # Rebuild maps from database if empty (e.g., when running appointment-only import in background worker)
            # This ensures we can match Acuity client IDs to existing contacts even without re-importing contacts
            if not client_map or not email_map:
                try:
                    # First, rebuild email_map from database
                    with _with_conn(tenant_id) as conn:  # type: ignore
                        db_contacts = conn.execute(
                            _sql_text("SELECT contact_id, email FROM contacts WHERE tenant_id = CAST(:t AS uuid) AND email IS NOT NULL"),
                            {"t": tenant_id},
                        ).fetchall()
                        for row in db_contacts:
                            email_lower = str(row[1] or "").strip().lower()
                            if email_lower:
                                email_map[email_lower] = str(row[0])
                    
                    # Then fetch Acuity clients to rebuild client_map
                    with httpx.Client(timeout=20, headers=headers) as rebuild_client:
                        rebuild_offset = 0
                        rebuild_limit = 100
                        for _ in range(20):  # Max 20 pages (2000 clients) to avoid infinite loop
                            params_rebuild: Dict[str, object] = {"limit": rebuild_limit, "offset": rebuild_offset}
                            rebuild_resp = rebuild_client.get(f"{base}/clients", params=params_rebuild)
                            if rebuild_resp.status_code != 200:
                                break
                            rebuild_arr = rebuild_resp.json() or []
                            if not isinstance(rebuild_arr, list) or not rebuild_arr:
                                break
                            for c in rebuild_arr:
                                cid_raw = str(c.get("id") or "")
                                email_val = str(c.get("email") or "").strip().lower()
                                if cid_raw:
                                    # Match by email if available, otherwise use expected format
                                    if email_val and email_val in email_map:
                                        client_map[cid_raw] = email_map[email_val]
                                    else:
                                        client_map[cid_raw] = f"acuity:{cid_raw}"
                            if len(rebuild_arr) < rebuild_limit:
                                break
                            rebuild_offset += rebuild_limit
                except Exception:
                    pass

            offset = 0
            appt_pages = 0
            appointments_started = perf_counter()
            payments_checked = 0
            appointments_processed = 0
            
            # Build contact_id -> UUID mapping to avoid per-appointment DB lookups
            # Also build phone-based lookup since Acuity client IDs are often null
            contact_uuid_map: Dict[str, str] = {}
            phone_to_uuid_map: Dict[str, str] = {}
            try:
                with _with_conn(tenant_id) as conn:  # type: ignore
                    rows = conn.execute(
                        _sql_text("SELECT id, contact_id, phone FROM contacts WHERE tenant_id = CAST(:t AS uuid)"),
                        {"t": tenant_id},
                    ).fetchall()
                    for row in rows:
                        contact_uuid_map[row[1]] = str(row[0])
                        # Also map by normalized phone for fallback matching
                        if row[2]:
                            # Normalize phone: remove all non-digits
                            phone_normalized = ''.join(c for c in str(row[2]) if c.isdigit())
                            if phone_normalized:
                                phone_to_uuid_map[phone_normalized] = str(row[0])
            except Exception:
                pass
            
            while True:
                params: Dict[str, object] = {"limit": limit, "offset": offset}
                if since:
                    params["minDate"] = since
                if until:
                    params["maxDate"] = until
                fetch_started = perf_counter()
                r = client.get(f"{base}/appointments", params=params)
                fetch_ms = int((perf_counter() - fetch_started) * 1000)
                dbg_appts_status = r.status_code
                if r.status_code >= 400:
                    dbg_appts_error = (r.text or "")[:300]
                    break
                arr = r.json() or []
                if not isinstance(arr, list) or not arr:
                    break
                dbg_appts_count += len(arr)
                appt_pages += 1
                print(f"[acuity] appointments_page: tenant={tenant_id}, page={appt_pages}, fetched={len(arr)}, offset={offset}, elapsed_ms={fetch_ms}")
                for a in arr:
                    try:
                        aid = str(a.get("id") or "")
                        ext = f"acuity:{aid}" if aid else f"acuity:{hashlib.md5(str(a).encode()).hexdigest()[:10]}"
                        cid = str(a.get("clientID") or a.get("clientId") or a.get("client_id") or "")
                        start_ts = _parse_epoch(a.get("datetime") or a.get("startTime") or a.get("start_ts"))
                        end_ts = _parse_epoch(a.get("endTime") or a.get("end_ts")) or None
                        status = str(a.get("status") or "booked").lower()
                        service = str(a.get("type") or a.get("title") or a.get("service") or "")
                        
                        # Match contact primarily by email and phone from appointment data
                        # (not via client_map, since most Acuity clients have id=null → MD5 hashes)
                        contact_uuid = None
                        external_contact_id = None
                        
                        # Try email first (most reliable)
                        if a.get("email"):
                            email_contact_id = f"acuity:email/{a.get('email')}"
                            contact_uuid = contact_uuid_map.get(email_contact_id)
                            if contact_uuid:
                                external_contact_id = email_contact_id
                        
                        # Try phone as fallback
                        if not contact_uuid and a.get("phone"):
                            phone_normalized = ''.join(c for c in str(a.get("phone")) if c.isdigit())
                            if phone_normalized:
                                contact_uuid = phone_to_uuid_map.get(phone_normalized)
                                # Don't set external_contact_id here, we don't have it
                        
                        # Try client ID as last resort (only works if client has actual ID, not null)
                        if not contact_uuid and cid:
                            client_contact_id = f"acuity:{cid}"
                            contact_uuid = contact_uuid_map.get(client_contact_id)
                            if contact_uuid:
                                external_contact_id = client_contact_id
                        
                        if not contact_uuid:
                            # Skip appointments without valid contact linkage
                            skipped += 1
                            continue
                        
                        if external_contact_id:
                            entry = _get_entry(payments_map, external_contact_id)
                            if start_ts:
                                _apply_visit(entry, int(start_ts))
                            if not skip_appt_payments:
                                try:
                                    _collect_appointment_payments(payments_map, external_contact_id, client, base, aid)
                                    payments_checked += 1
                                except Exception as exc:
                                    logger.debug(
                                        "Acuity appointment payment fetch failed",
                                        extra={"appointment_id": aid, "error": str(exc)},
                                    )
                        
                        # Each appointment gets its own transaction to avoid lock timeout cascades
                        with _with_conn(tenant_id) as conn:  # type: ignore
                            r1 = conn.execute(
                                _sql_text(
                                    "UPDATE appointments SET contact_id=CAST(:c AS uuid), service=:s, start_ts=to_timestamp(:st), end_ts=to_timestamp(:et), status=:stt "
                                    "WHERE tenant_id = CAST(:t AS uuid) AND external_ref = :x"
                                ),
                                {
                                    "t": tenant_id,
                                    "x": ext,
                                    "c": str(contact_uuid),
                                    "s": service,
                                    "st": int(start_ts or 0),
                                    "et": (int(end_ts) if end_ts else 0),
                                    "stt": status,
                                },
                            )
                            if int(getattr(r1, "rowcount", 0) or 0) == 0:
                                conn.execute(
                                    _sql_text(
                                        "INSERT INTO appointments(tenant_id,contact_id,service,start_ts,end_ts,status,external_ref,created_at,updated_at) "
                                        "VALUES (CAST(:t AS uuid),CAST(:c AS uuid),:s,to_timestamp(:st),to_timestamp(:et),:stt,:x,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"
                                    ),
                                    {
                                        "t": tenant_id,
                                        "x": ext,
                                        "c": str(contact_uuid),
                                        "s": service,
                                        "st": int(start_ts or 0),
                                        "et": (int(end_ts) if end_ts else 0),
                                        "stt": status,
                                    },
                                )
                        appt_imported += 1
                        appointments_processed += 1
                        if appointments_processed % 25 == 0:
                            print(f"[acuity] appointments_progress: tenant={tenant_id}, processed={appointments_processed}, pages={appt_pages}")
                    except Exception:
                        skipped += 1
                if len(arr) < limit:
                    break
                offset += limit

            print(f"[acuity] appointments_fetched: tenant={tenant_id}, pages={appt_pages}, count={dbg_appts_count}, payments_checked={payments_checked}, seconds={round(perf_counter() - appointments_started, 2)}")

            try:
                payments_started = perf_counter()
                _collect_orders_payments(payments_map, client, base, email_map)
                print(f"[acuity] orders_processed: tenant={tenant_id}, contacts_with_payments={len(payments_map)}, seconds={round(perf_counter() - payments_started, 2)}")
            except Exception as exc:
                logger.debug(
                    "Acuity order payments fetch failed",
                    extra={"error": str(exc)},
                )

    except httpx.HTTPError:
        pass

    if payments_map:
        try:
            with _with_conn(tenant_id) as conn:
                ts_expr = _timestamp_expr(conn)
                for cid, meta in payments_map.items():
                    if not cid:
                        continue
                    meta.setdefault("first", 0)
                    meta.setdefault("last", 0)
                    meta.setdefault("txn_count", 0)
                    meta.setdefault("lifetime_cents", 0)
                    meta.pop("_txn_ids", None)
                    meta.pop("_order_ids", None)
                    conn.execute(
                        _sql_text(
                            "UPDATE contacts SET first_visit = CASE WHEN first_visit=0 OR first_visit IS NULL THEN :first ELSE LEAST(first_visit, :first) END, "
                            "last_visit = GREATEST(COALESCE(last_visit,0), :last), "
                            "txn_count = COALESCE(txn_count,0) + :cnt, "
                            "lifetime_cents = COALESCE(lifetime_cents,0) + :cents, "
                            "updated_at = " + ts_expr + " WHERE tenant_id = CAST(:t AS uuid) AND contact_id = :cid"
                        ),
                        {
                            "t": tenant_id,
                            "cid": cid,
                            "first": int(meta.get("first", 0) or 0),
                            "last": int(meta.get("last", 0) or 0),
                            "cnt": int(meta.get("txn_count", 0) or 0),
                            "cents": int(meta.get("lifetime_cents", 0) or 0),
                        },
                    )
                    logger.debug(
                        "Acuity payments applied",
                        extra={
                            "tenant_id": tenant_id,
                            "contact_id": cid,
                            "txn_count": int(meta.get("txn_count", 0) or 0),
                            "lifetime_cents": int(meta.get("lifetime_cents", 0) or 0),
                            "first_visit": int(meta.get("first", 0) or 0),
                            "last_visit": int(meta.get("last", 0) or 0),
                        },
                    )
        except Exception as exc:
            logger.exception("Failed to apply Acuity payment rollups", extra={"tenant_id": tenant_id, "error": str(exc)})

    try:
        with _with_conn(tenant_id) as conn:  # type: ignore
            conn.execute(
                _sql_text("UPDATE connected_accounts_v2 SET last_sync = EXTRACT(EPOCH FROM now())::bigint WHERE tenant_id = CAST(:t AS uuid) AND provider='acuity'"),
                {"t": tenant_id},
            )
    except Exception:
        pass
    try:
        emit_event("AcuityImportCompleted", {"tenant_id": tenant_id, "contacts": int(imported), "appointments": int(appt_imported)})
    except Exception:
        pass
    print(f"[acuity] import_summary: tenant={tenant_id}, contacts_processed={imported}, contacts_updated={updated}, appointments_imported={appt_imported}, appointments_fetched={dbg_appts_count}, payments_contacts={len(payments_map)}, clients_status={dbg_clients_status}, appointments_status={dbg_appts_status}, skipped={skipped}")
    return {
        "imported": appt_imported,
        "updated": int(updated),
        "skipped_duplicates": int(skipped),
        "clients_status": dbg_clients_status,
        "clients_count": dbg_clients_count,
        "appointments_status": dbg_appts_status,
        "appointments_count": dbg_appts_count,
        "auth_mode": auth_mode,
        "page_limit": page_limit,
        "skip_appt_payments": skip_appt_payments,
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
