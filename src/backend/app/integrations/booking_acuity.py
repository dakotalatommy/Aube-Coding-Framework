import hashlib
import sys
import time
from time import perf_counter
from typing import Dict, Any, Optional, List, Tuple, Set
from contextlib import contextmanager
import base64
import json
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


@contextmanager
def tenant_connection(tenant_id: str, role: str = "owner_admin"):
    """
    Long-lived connection for bulk imports with session-level RLS context.
    Sets GUCs once per connection (not per transaction) for efficiency.
    Caller must use conn.begin() to create explicit transaction boundaries.
    """
    conn = engine.connect()
    try:
        # Set session-level GUCs (false = lasts for connection lifetime)
        conn.execute(_sql_text("SELECT set_config('app.role', :role, false)"), {"role": role})
        conn.execute(_sql_text("SELECT set_config('app.tenant_id', :tenant_id, false)"), {"tenant_id": tenant_id})
        # Commit to close autobegin transaction; GUCs persist (session-level)
        conn.commit()
        print(f"[acuity] tenant_connection opened: tenant={tenant_id}, role={role}, autobegin_committed=True")
        yield conn
    except Exception:
        logger.exception("Error in tenant_connection for tenant=%s", tenant_id)
        raise
    finally:
        try:
            conn.close()
            print(f"[acuity] tenant_connection closed: tenant={tenant_id}")
        except Exception:
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


def _normalize_phone(phone: Optional[str]) -> Optional[str]:
    """
    Normalize phone number to 10-digit US format.
    Handles formats like: 2707765409, +12707765409, (270) 776-5409, etc.
    Returns None if phone is empty or invalid.
    """
    if not phone:
        return None
    
    # Strip to digits only
    digits = ''.join(c for c in str(phone) if c.isdigit())
    
    # If 11 digits starting with 1 (US country code), remove it
    if len(digits) == 11 and digits.startswith('1'):
        digits = digits[1:]
    
    # Return normalized 10-digit number, or None if invalid
    return digits if len(digits) == 10 else None


def _collect_appointment_payments(
    ledger: Dict[str, Dict[str, Any]],
    contact_id: str,
    client: httpx.Client,
    base: str,
    appointment_id: str,
    *,
    appointment_date: Optional[int] = None,  # NEW: epoch timestamp of appointment
    tenant_id: Optional[str] = None,
    conn = None,
    payment_records: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, int]:
    metrics = {
        "payments_processed": 0,
        "transactions_created": 0,
        "transactions_skipped": 0,
    }
    if not appointment_id:
        return metrics
    try:
        resp = client.get(f"{base}/appointments/{appointment_id}/payments")
    except httpx.HTTPError as exc:
        logger.warning(
            "Acuity appointment payments request failed",
            extra={"appointment_id": appointment_id, "error": str(exc)},
        )
        return metrics
    if resp.status_code >= 400:
        logger.warning(
            "Acuity appointment payments returned error",
            extra={
                "appointment_id": appointment_id,
                "status": resp.status_code,
                "body": (resp.text or "")[:200],
            },
        )
        return metrics
    payments = resp.json() or []
    if not isinstance(payments, list) or not payments:
        return metrics
    entry = _get_entry(ledger, contact_id)
    txn_ids: Set[str] = entry["_txn_ids"]  # type: ignore[assignment]
    for payment in payments:
        metrics["payments_processed"] += 1
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

        if payment_records is not None:
            payment_records.append(
                {
                    "contact_id": contact_id,
                    "amount_cents": cents,
                    "created_ts": created_ts,
                    "timestamp_iso": payment.get("created") or payment.get("paidDate") or payment.get("datePaid"),
                    "payment": payment,
                    "transaction_id": transaction_id,
                    "appointment_id": appointment_id,
                    "payment_method": payment.get("paymentType") or payment.get("paymentMethod") or "appointment",
                    "payment_source": "appointment",
                }
            )

        if conn is not None and tenant_id and cents > 0:
            try:
                # Use appointment date as transaction date (when service occurs)
                # Store payment date in metadata for cash flow tracking
                payment_created = payment.get("created") or payment.get("paidDate") or payment.get("datePaid")
                transaction_date = None
                if appointment_date:
                    # Convert epoch to ISO timestamp for Postgres
                    from datetime import datetime
                    transaction_date = datetime.utcfromtimestamp(appointment_date).isoformat()
                else:
                    # Fallback to payment date if appointment date not available
                    transaction_date = payment_created

                external_ref = transaction_id or f"acuity_appt_payment_{appointment_id}_{created_ts or int(time.time())}"
                payment_method = payment.get("processor") or payment.get("paymentType") or payment.get("paymentMethod") or "appointment"
                
                # Log date attribution for first few transactions
                if metrics["payments_processed"] < 3:
                    print(
                        f"[acuity] DATE_ATTRIBUTION: aid={appointment_id}, "
                        f"appointment_date={transaction_date}, payment_date={payment_created}"
                    )

                result = conn.execute(
                    _sql_text(
                        """
                        INSERT INTO transactions 
                        (tenant_id, contact_id, amount_cents, transaction_date, source, external_ref, metadata)
                        VALUES (
                            CAST(:t AS uuid), :cid, :amt, CAST(:tdate AS timestamp), 'acuity', :ref,
                            CAST(:meta AS jsonb)
                        )
                        ON CONFLICT (tenant_id, external_ref) DO NOTHING
                        """
                    ),
                    {
                        "t": tenant_id,
                        "cid": contact_id,
                        "amt": cents,
                        "tdate": transaction_date or payment_created or None,
                        "ref": external_ref,
                        "meta": json.dumps(
                            {
                                "appointment_id": appointment_id,
                                "payment_method": payment_method,
                                "transaction_id": transaction_id,
                                "payment_date": payment_created,  # NEW: original payment date
                                "appointment_date": transaction_date,  # NEW: for reference
                            }
                        ),
                    },
                )
                if int(getattr(result, "rowcount", 0) or 0) > 0:
                    metrics["transactions_created"] += 1
                else:
                    metrics["transactions_skipped"] += 1
            except Exception as exc:
                logger.warning(
                    "Failed to insert Acuity appointment payment",
                    extra={
                        "appointment_id": appointment_id,
                        "transaction_id": transaction_id,
                        "error": str(exc),
                    },
                )
                metrics["transactions_skipped"] += 1
        elif conn is not None and tenant_id and cents == 0:
            metrics["transactions_skipped"] += 1
    return metrics


def _collect_orders_payments(
    ledger: Dict[str, Dict[str, Any]],
    client: httpx.Client,
    base: str,
    email_to_contact: Dict[str, str],
    conn = None,
    tenant_id: Optional[str] = None,
    *,
    allow_phone_lookup: bool = False,
    phone_map: Optional[Dict[str, str]] = None,
    client_contact_map: Optional[Dict[str, str]] = None,
    payment_records: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, int]:
    """
    Collect payment data from Acuity Orders API.
    If conn and tenant_id are provided, also creates transaction records in database.
    Otherwise, only aggregates into ledger (backward compatible).
    """
    offset = 0
    page_size = 100
    metrics = {
        "orders_processed": 0,
        "transactions_created": 0,
        "transactions_skipped": 0,
    }

    while True:
        try:
            resp = client.get(f"{base}/orders", params={"max": page_size, "offset": offset})
        except httpx.HTTPError as exc:
            logger.warning(
                "Acuity orders request failed",
                extra={"offset": offset, "error": str(exc)},
            )
            return metrics
        if resp.status_code >= 400:
            logger.warning(
                "Acuity orders returned error",
                extra={
                    "offset": offset,
                    "status": resp.status_code,
                    "body": (resp.text or "")[:200],
                },
            )
            return metrics
        orders = resp.json() or []
        if not isinstance(orders, list) or not orders:
            break
        for order in orders:
            metrics["orders_processed"] += 1
            email_key = str(order.get("email") or "").strip().lower()
            contact_id = email_to_contact.get(email_key)

            if not contact_id and allow_phone_lookup and phone_map is not None:
                phone_raw = order.get("phone") or order.get("phoneNumber") or order.get("phone_number")
                phone_normalized = "".join(c for c in str(phone_raw) if c and str(c).isdigit())
                if phone_normalized:
                    contact_id = phone_map.get(phone_normalized) or contact_id

            if not contact_id and client_contact_map:
                raw_client_id = order.get("clientID") or order.get("clientId") or order.get("client_id")
                if raw_client_id:
                    fallback = f"acuity:{raw_client_id}"
                    contact_id = (
                        client_contact_map.get(raw_client_id)
                        or client_contact_map.get(fallback)
                        or contact_id
                    )

            if not contact_id:
                metrics["transactions_skipped"] += 1
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

            if payment_records is not None:
                payment_records.append(
                    {
                        "contact_id": contact_id,
                        "amount_cents": cents,
                        "created_ts": created_ts,
                        "timestamp_iso": order.get("time") or order.get("paidDate"),
                        "order_id": order_id,
                        "payment_method": order.get("paymentType", "unknown"),
                        "payment_source": "order",
                        "order": order,
                    }
                )
            
            # NEW: Create transaction record if database connection provided
            if conn is not None and tenant_id is not None and cents > 0:
                try:
                    paid_date = order.get("paidDate") or order.get("time")
                    external_ref = f"acuity_order_{order_id}"
                    payment_method = order.get("paymentType", "unknown")
                    
                    # Insert transaction record with idempotency (ON CONFLICT DO NOTHING)
                    result = conn.execute(
                        _sql_text(
                            """
                            INSERT INTO transactions 
                            (tenant_id, contact_id, amount_cents, transaction_date, source, external_ref, metadata)
                            VALUES (
                                CAST(:t AS uuid), :cid, :amt, CAST(:tdate AS timestamp), 'acuity', :ref, 
                                CAST(:meta AS jsonb)
                            )
                            ON CONFLICT (tenant_id, external_ref) DO NOTHING
                            """
                        ),
                        {
                            "t": tenant_id,
                            "cid": contact_id,
                            "amt": cents,
                            "tdate": paid_date,
                            "ref": external_ref,
                            "meta": json.dumps({"payment_method": payment_method, "order_id": order_id}),
                        },
                    )
                    if int(getattr(result, "rowcount", 0) or 0) > 0:
                        metrics["transactions_created"] += 1
                    else:
                        metrics["transactions_skipped"] += 1
                except Exception as exc:
                    # Log error but continue processing other orders
                    logger.warning(
                        "Failed to insert Acuity transaction",
                        extra={"order_id": order_id, "error": str(exc)},
                    )
                    metrics["transactions_skipped"] += 1
            elif conn is not None and tenant_id is not None and cents == 0:
                metrics["transactions_skipped"] += 1
        if len(orders) < page_size:
            break
        offset += page_size

    return metrics


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
    allow_historical: bool = False,
    skip_contact_rollups: bool = False,
) -> Dict[str, Any]:
    base = (os.getenv("ACUITY_API_BASE", "https://acuityscheduling.com/api/v1").strip().rstrip(" /."))
    headers = _acuity_headers(tenant_id)
    try:
        auth_hdr = str(headers.get("Authorization", ""))
        auth_mode = "basic" if auth_hdr.startswith("Basic ") else ("bearer" if auth_hdr.startswith("Bearer ") else "none")
    except Exception:
        auth_mode = "none"
    updated = 0
    skipped = 0
    appt_imported = 0
    appointments_attempted = 0
    appointments_persisted = 0
    appointments_skipped_historical = 0
    appointments_skipped_unmatched = 0
    appointments_skipped_write_failures = 0
    appointments_skipped_missing_time = 0
    dbg_clients_status: Optional[int] = None
    dbg_clients_count = 0
    dbg_clients_error: Optional[str] = None
    dbg_appts_status: Optional[int] = None
    dbg_appts_count = 0
    dbg_appts_error: Optional[str] = None
    payments_map: Dict[str, Dict[str, Any]] = {}
    appointment_payment_metrics = {
        "payments_processed": 0,
        "transactions_created": 0,
        "transactions_skipped": 0,
    }
    orders_metrics = {
        "orders_processed": 0,
        "transactions_created": 0,
        "transactions_skipped": 0,
    }
    payment_records: List[Dict[str, Any]] = []
    payments_checked = 0

    if skip_appt_payments is None:
        skip_appt_payments = os.getenv("ACUITY_SKIP_APPOINTMENT_PAYMENTS", "1") == "1"  # Default to True

    if allow_historical:
        skip_appt_payments = False
    if page_limit is None:
        page_limit = int(os.getenv("ACUITY_PAGE_LIMIT", "100") or "100")

    # Default to importing only future appointments (from today onward) for CRM relevance
    # Revenue data will still be collected for all historical transactions via orders API
    from datetime import datetime, timezone
    if not since:
        if allow_historical:
            since = "1900-01-01"
            print("[acuity] appointments_filter: allow_historical enabled, fetching all appointments")
        else:
            since = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            print(f"[acuity] appointments_filter: importing future appointments only (from {since} onward)")
    
    print(f"[acuity] import_started: tenant={tenant_id}, since={since}, until={until}, cursor={cursor}, page_limit={page_limit}, skip_appt_payments={skip_appt_payments}")
    if skip_appt_payments:
        print(f"[acuity] payment_collection_disabled: skipping per-appointment payment API calls for faster import")

    client_map: Dict[str, str] = {}
    email_map: Dict[str, str] = {}
    seen_client_ids: Set[str] = set()  # Track seen contacts to detect API pagination issues
    
    # Pre-populate email_map from database to ensure ALL contacts available for revenue matching
    # This fixes issue where only API-fetched contacts got revenue data (17 vs 650 contacts)
    try:
        with _with_conn(tenant_id) as conn:  # type: ignore
            rows = conn.execute(
                _sql_text("SELECT contact_id, email FROM contacts WHERE tenant_id = CAST(:t AS uuid) AND email IS NOT NULL"),
                {"t": tenant_id},
            ).fetchall()
            for row in rows:
                email_normalized = str(row[1]).strip().lower()
                if email_normalized:
                    email_map[email_normalized] = str(row[0])  # Map email -> contact_id for revenue matching
            print(f"[acuity] email_map_preloaded: tenant={tenant_id}, emails={len(email_map)} (ensures all contacts can receive revenue data)")
    except Exception:
        pass
    
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
                
                # Batch contacts to avoid 1000+ separate transactions
                # Process all contacts from this page in a single transaction
                new_contacts_this_page = 0
                try:
                    with _with_conn(tenant_id) as conn:  # type: ignore
                        ts_expr = _timestamp_expr(conn)
                        for c in arr:
                            try:
                                cid_raw = str(c.get("id") or "")
                                contact_id = f"acuity:{cid_raw}" if cid_raw else (
                                    f"acuity:email/{c.get('email', '')}"
                                    if c.get("email")
                                    else f"acuity:{hashlib.md5(str(c).encode()).hexdigest()[:10]}"
                                )
                                
                                # Skip if we've already processed this contact in this import run
                                if contact_id in seen_client_ids:
                                    continue
                                seen_client_ids.add(contact_id)
                                new_contacts_this_page += 1
                                
                                client_map[cid_raw] = contact_id
                                email_val = str(c.get("email") or "").strip().lower()
                                if email_val:
                                    email_map[email_val] = contact_id
                                
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
                            except Exception:
                                skipped += 1
                except Exception:
                    # If batch fails, skip this entire page
                    print(f"[acuity] contacts_batch_error: tenant={tenant_id}, page={client_pages}, skipping batch")
                    skipped += len(arr)
                
                # Break if API returned fewer records than requested OR if we've seen all these contacts before
                if len(arr) < limit or new_contacts_this_page == 0:
                    print(f"[acuity] contacts_pagination_complete: tenant={tenant_id}, new_this_page={new_contacts_this_page}, fetched={len(arr)}, limit={limit}")
                    break
                
                # Acuity API may return all records regardless of offset - break after safety ceiling
                max_pages = int(os.getenv("ACUITY_MAX_PAGES", "200"))
                if client_pages >= max_pages:
                    print(f"[acuity] contacts_max_pages_reached: tenant={tenant_id}, pages={client_pages}, max={max_pages}, unique_contacts={len(seen_client_ids)}")
                    break
                
                offset += len(arr)  # Use actual records returned, not limit

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
            payment_records: List[Dict[str, Any]] = []
            appointment_payment_metrics = {
                "payments_processed": 0,
                "transactions_created": 0,
                "transactions_skipped": 0,
            }
            
            # Build contact_id -> UUID mapping to avoid per-appointment DB lookups
            # Also build email and phone-based lookups with normalization for robust matching
            contact_uuid_map: Dict[str, str] = {}
            email_to_uuid_map: Dict[str, str] = {}
            email_to_contact_id_map: Dict[str, str] = {}
            phone_to_uuid_map: Dict[str, str] = {}
            phone_to_contact_id_map: Dict[str, str] = {}
            uuid_to_contact_id: Dict[str, str] = {}
            client_contact_map: Dict[str, str] = {}
            try:
                with _with_conn(tenant_id) as conn:  # type: ignore
                    rows = conn.execute(
                        _sql_text("SELECT id, contact_id, email, phone FROM contacts WHERE tenant_id = CAST(:t AS uuid)"),
                        {"t": tenant_id},
                    ).fetchall()
                    for row in rows:
                        uuid = str(row[0])
                        contact_id_value = str(row[1])
                        contact_uuid_map[contact_id_value] = uuid
                        uuid_to_contact_id[uuid] = contact_id_value
                        client_contact_map[contact_id_value] = contact_id_value
                        if contact_id_value.startswith("acuity:"):
                            raw_identifier = contact_id_value.split(":", 1)[1]
                            if raw_identifier:
                                client_contact_map[raw_identifier] = contact_id_value
                        
                        # Build email lookup with NORMALIZED (lowercase) keys for case-insensitive matching
                        if row[2]:
                            email_normalized = str(row[2]).strip().lower()
                            if email_normalized:
                                email_to_uuid_map[email_normalized] = uuid
                                email_to_contact_id_map[email_normalized] = contact_id_value
                        
                        # Build phone lookup with enhanced normalization (handles +1 country codes)
                        if row[3]:
                            phone_normalized = _normalize_phone(row[3])
                            if phone_normalized:
                                phone_to_uuid_map[phone_normalized] = uuid
                                phone_to_contact_id_map[phone_normalized] = contact_id_value
                print(
                    "[acuity] contact_maps_built: "
                    f"tenant={tenant_id}, contact_ids={len(contact_uuid_map)}, "
                    f"emails={len(email_to_uuid_map)}, phones={len(phone_to_uuid_map)}"
                )
                if email_to_uuid_map:
                    sample_email = next(iter(email_to_uuid_map))
                    print(
                        f"[acuity] contact_map_sample: email={sample_email}, "
                        f"uuid={email_to_uuid_map[sample_email]}, "
                        f"contact_id={email_to_contact_id_map.get(sample_email)}"
                    )
            except Exception:
                pass
            
            # Use long-lived connection for appointment writes with explicit transaction boundaries
            # Appointments fetching and writing loop
            max_pages = int(os.getenv("ACUITY_MAX_PAGES", "200"))
            print(f"[acuity] DEBUG: Starting appointments loop, page_limit={page_limit}, max_pages={max_pages}")
            while True:
                print(f"[acuity] DEBUG: Loop iteration start, appt_pages={appt_pages}, offset={offset}, cumulative_processed={appointments_processed}")
                # Safety guard: prevent infinite pagination
                if appt_pages >= max_pages:
                    print(f"[acuity] appointments_max_pages_reached: tenant={tenant_id}, pages={appt_pages}, max={max_pages}, cumulative_processed={appointments_processed}, cumulative_offset={offset}")
                    break
                
                params: Dict[str, object] = {"limit": limit, "offset": offset}
                if since:
                    params["minDate"] = since
                if until:
                    params["maxDate"] = until
                print(f"[acuity] DEBUG: Fetching appointments from API, params={params}")
                fetch_started = perf_counter()
                r = client.get(f"{base}/appointments", params=params)
                fetch_ms = int((perf_counter() - fetch_started) * 1000)
                dbg_appts_status = r.status_code
                print(f"[acuity] DEBUG: API response received, status={r.status_code}, fetch_ms={fetch_ms}")
                if r.status_code >= 400:
                    dbg_appts_error = (r.text or "")[:300]
                    print(f"[acuity] DEBUG: API error, breaking loop")
                    break
                arr = r.json() or []
                if not isinstance(arr, list) or not arr:
                    print(f"[acuity] DEBUG: No more appointments (empty array), breaking loop")
                    break
                dbg_appts_count += len(arr)
                appt_pages += 1
                print(f"[acuity] appointments_page: tenant={tenant_id}, page={appt_pages}, fetched={len(arr)}, offset={offset}, elapsed_ms={fetch_ms}")
                print(f"[acuity] DEBUG: Starting appointment processing, array_length={len(arr)}")
                
                # Pre-process appointments and collect payments in memory, then batch database writes
                appt_batch = []
                match_stats = {"by_email": 0, "by_phone": 0, "by_client_id": 0, "no_match": 0}
                now_ts = int(time.time())
                for a in arr:
                    try:
                        aid = str(a.get("id") or "")
                        ext = f"acuity:{aid}" if aid else f"acuity:{hashlib.md5(str(a).encode()).hexdigest()[:10]}"
                        cid = str(a.get("clientID") or a.get("clientId") or a.get("client_id") or "")
                        start_ts = _parse_epoch(a.get("datetime") or a.get("startTime") or a.get("start_ts"))
                        end_ts = _parse_epoch(a.get("endTime") or a.get("end_ts")) or None
                        status = str(a.get("status") or "booked").lower()
                        service = str(a.get("type") or a.get("title") or a.get("service") or "")

                        if not start_ts:
                            appointments_skipped_missing_time += 1
                            skipped += 1
                            continue
                        if not allow_historical and start_ts < now_ts:
                            appointments_skipped_historical += 1
                            skipped += 1
                            continue
                        
                        # Match contact by email (case-insensitive), phone, or client ID
                        contact_uuid = None
                        external_contact_id = None
                        matched_by = None

                        # Try email first (most reliable) - normalize for case-insensitive match
                        if a.get("email"):
                            email_normalized = str(a.get("email")).strip().lower()
                            contact_uuid = email_to_uuid_map.get(email_normalized)
                            if contact_uuid:
                                external_contact_id = email_to_contact_id_map.get(email_normalized)
                                if not external_contact_id:
                                    external_contact_id = uuid_to_contact_id.get(contact_uuid)
                                matched_by = "email"

                        # Try phone as fallback - enhanced normalization (handles +1 country codes)
                        if not contact_uuid and a.get("phone"):
                            phone_normalized = _normalize_phone(a.get("phone"))
                            if phone_normalized:
                                contact_uuid = phone_to_uuid_map.get(phone_normalized)
                                if contact_uuid:
                                    external_contact_id = uuid_to_contact_id.get(contact_uuid)
                                    matched_by = "phone"

                        # Try client ID as last resort - exact match on contact_id
                        if not contact_uuid and cid:
                            client_contact_id = f"acuity:{cid}"
                            contact_uuid = contact_uuid_map.get(client_contact_id)
                            if contact_uuid:
                                external_contact_id = client_contact_id
                                matched_by = "client_id"

                        # Auto-create contact if no match found
                        if not contact_uuid:
                            # Generate unique contact ID based on available identifiers
                            if a.get("email"):
                                auto_contact_id = f"acuity:email/{a.get('email').lower()}"
                            elif phone_normalized:
                                auto_contact_id = f"acuity:phone/{phone_normalized}"
                            else:
                                auto_contact_id = f"acuity:auto/{aid}"
                            
                            # Try to create contact in database
                            try:
                                with _with_conn(tenant_id) as auto_conn:
                                    # Insert new contact
                                    result = auto_conn.execute(
                                        _sql_text("""
                                            INSERT INTO contacts (tenant_id, contact_id, email, phone, first_name, last_name, creation_source, created_at, updated_at)
                                            VALUES (CAST(:t AS uuid), :cid, :email, :phone, :fname, :lname, 'acuity_auto', EXTRACT(EPOCH FROM now())::bigint, EXTRACT(EPOCH FROM now())::bigint)
                                            ON CONFLICT (tenant_id, contact_id) DO UPDATE SET updated_at = EXTRACT(EPOCH FROM now())::bigint
                                            RETURNING id, contact_id
                                        """),
                                        {
                                            "t": tenant_id,
                                            "cid": auto_contact_id,
                                            "email": a.get("email") or None,
                                            "phone": a.get("phone") or None,
                                            "fname": a.get("firstName") or None,
                                            "lname": a.get("lastName") or None,
                                        }
                                    )
                                    row = result.fetchone()
                                    if row:
                                        contact_uuid = str(row[0])
                                        external_contact_id = auto_contact_id
                                        matched_by = "auto_created"
                                        match_stats["no_match"] += 1  # Track these for reporting
                                        
                                        # Log auto-creation (first 10 only)
                                        if match_stats["no_match"] <= 10:
                                            print(
                                                f"[acuity] AUTO_CREATED_CONTACT: aid={aid}, contact_id={auto_contact_id}, "
                                                f"email={a.get('email')}, phone={a.get('phone')}"
                                            )
                            except Exception as exc:
                                # If auto-create fails, skip this appointment
                                print(f"[acuity] AUTO_CREATE_FAILED: aid={aid}, error={str(exc)[:100]}")
                                skipped += 1
                                appointments_skipped_unmatched += 1
                                continue
                        
                        # If still no contact (auto-create failed), skip
                        if not contact_uuid or not external_contact_id:
                            skipped += 1
                            appointments_skipped_unmatched += 1
                            continue
                        
                        if matched_by:
                            match_stats[f"by_{matched_by}"] += 1
                        appointments_attempted += 1
                        
                        fetch_appt_payments = False
                        if external_contact_id:
                            entry = _get_entry(payments_map, external_contact_id)
                            if start_ts:
                                _apply_visit(entry, int(start_ts))
                            if not skip_appt_payments:
                                fetch_appt_payments = True
                        
                        appt_batch.append(
                            {
                                "ext": ext,
                                "contact_uuid": str(contact_uuid),
                                "service": service,
                                "start_ts": int(start_ts or 0),
                                "end_ts": (int(end_ts) if end_ts else 0),
                                "status": status,
                                "contact_id": external_contact_id,
                                "appointment_id": aid,
                                "fetch_payments": fetch_appt_payments,
                            }
                        )
                    except Exception:
                        skipped += 1
                
                # Log matching results for this page
                if appt_pages == 1 or appt_pages % 5 == 0:
                    print(
                        f"[acuity] match_stats: page={appt_pages}, by_email={match_stats['by_email']}, "
                        f"by_phone={match_stats['by_phone']}, by_client_id={match_stats['by_client_id']}, "
                        f"no_match={match_stats['no_match']}, batch_size={len(appt_batch)}, "
                        f"fetched={len(arr)}, total_processed={appointments_processed}"
                    )
            
                print(f"[acuity] DEBUG: Finished processing appointments, appt_batch_size={len(appt_batch)}")
                # Write appointments in small sub-batches with explicit transaction boundaries
                # Reuse the same connection but commit after every 10 appointments
                inserts_this_page = 0  # Track actual new appointments
                if appt_batch:
                    print(f"[acuity] DEBUG: Starting database writes, total_to_write={len(appt_batch)}")
                    sub_batch_size = 10
                    for i in range(0, len(appt_batch), sub_batch_size):
                        sub_batch = appt_batch[i:i+sub_batch_size]
                        sub_batch_num = i//sub_batch_size + 1
                        
                        # Use proven _with_conn() pattern (same as contacts) - auto-commits on success
                        with _with_conn(tenant_id) as conn:
                            for appt_data in sub_batch:
                                persisted = False
                                was_insert = False
                                try:
                                    r1 = conn.execute(
                                        _sql_text(
                                            "UPDATE appointments SET contact_id=CAST(:c AS uuid), service=:s, start_ts=to_timestamp(:st), end_ts=to_timestamp(:et), status=:stt "
                                            "WHERE tenant_id = CAST(:t AS uuid) AND external_ref = :x"
                                        ),
                                        {
                                            "t": tenant_id,
                                            "x": appt_data["ext"],
                                            "c": appt_data["contact_uuid"],
                                            "s": appt_data["service"],
                                            "st": appt_data["start_ts"],
                                            "et": appt_data["end_ts"],
                                            "stt": appt_data["status"],
                                        },
                                    )
                                    if int(getattr(r1, "rowcount", 0) or 0) > 0:
                                        persisted = True  # Was an UPDATE
                                    else:
                                        conn.execute(
                                            _sql_text(
                                                "INSERT INTO appointments(tenant_id,contact_id,service,start_ts,end_ts,status,external_ref,created_at,updated_at) "
                                                "VALUES (CAST(:t AS uuid),CAST(:c AS uuid),:s,to_timestamp(:st),to_timestamp(:et),:stt,:x,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"
                                            ),
                                            {
                                                "t": tenant_id,
                                                "x": appt_data["ext"],
                                                "c": appt_data["contact_uuid"],
                                                "s": appt_data["service"],
                                                "st": appt_data["start_ts"],
                                                "et": appt_data["end_ts"],
                                                "stt": appt_data["status"],
                                            },
                                        )
                                        persisted = True
                                        was_insert = True
                                        inserts_this_page += 1
                                except Exception as exc:
                                    print(f"[acuity] appointment_write_error: tenant={tenant_id}, external_ref={appt_data['ext']}, error={exc}")
                                    appointments_skipped_write_failures += 1
                                    skipped += 1
                                    continue

                                if persisted:
                                    appt_imported += 1
                                    appointments_persisted += 1
                                    appointments_processed += 1
                                else:
                                    appointments_skipped_write_failures += 1
                                    skipped += 1

                                if appt_data.get("fetch_payments") and appt_data.get("contact_id"):
                                    try:
                                        appt_metrics = _collect_appointment_payments(
                                            payments_map,
                                            appt_data["contact_id"],
                                            client,
                                            base,
                                            appt_data["appointment_id"],
                                            appointment_date=appt_data.get("start_ts"),  # NEW: pass appointment date
                                            tenant_id=tenant_id,
                                            conn=conn,
                                            payment_records=payment_records,
                                        )
                                        payments_checked += 1
                                        
                                        # Log payment collection results
                                        if appt_metrics.get("payments_processed", 0) > 0:
                                            print(
                                                f"[acuity] PAYMENT_COLLECTED: aid={appt_data['appointment_id']}, "
                                                f"payments={appt_metrics.get('payments_processed', 0)}, "
                                                f"txns_created={appt_metrics.get('transactions_created', 0)}, "
                                                f"txns_skipped={appt_metrics.get('transactions_skipped', 0)}"
                                            )
                                        elif payments_checked <= 5:
                                            # Log first few appointments with no payments for diagnosis
                                            print(
                                                f"[acuity] NO_PAYMENTS: aid={appt_data['appointment_id']}, "
                                                f"service={appt_data.get('service', '')[:30]}"
                                            )
                                        
                                        for k, v in appt_metrics.items():
                                            appointment_payment_metrics[k] = appointment_payment_metrics.get(k, 0) + (v or 0)
                                    except Exception as exc:
                                        logger.debug(
                                            "Acuity appointment payment fetch failed",
                                            extra={"appointment_id": appt_data.get("appointment_id"), "error": str(exc)},
                                        )
                            # end for appt_data
                        # end with _with_conn
                            
                            print(f"[acuity] appointments_batch_committed: tenant={tenant_id}, sub_batch={sub_batch_num}, count={len(sub_batch)}, total_processed={appointments_processed}")
                
                print(f"[acuity] DEBUG: Finished database writes for page {appt_pages}")
                
                # Early exit: If we had zero inserts, all future appointments are up-to-date
                if not allow_historical and inserts_this_page == 0 and appt_pages > 0:
                    print(f"[acuity] appointments_up_to_date: All future appointments exist, stopping import after page {appt_pages}")
                    break
                
                print(
                    f"[acuity] pagination_check: len(arr)={len(arr)}, limit={limit}, "
                    f"inserts_this_page={inserts_this_page}, appt_pages={appt_pages}, "
                    f"total_processed={appointments_processed}, total_skipped={skipped}"
                )
                if len(arr) < limit:
                    print(
                        f"[acuity] PAGINATION_END: Last page reached (fetched {len(arr)} < limit {limit}), "
                        f"total_pages={appt_pages}, total_appointments={appointments_processed}, final_offset={offset}"
                    )
                    break
                print(f"[acuity] pagination_continue: offset {offset} -> {offset + len(arr)}, cumulative_appointments={appointments_processed}")
                offset += len(arr)  # Use actual records returned for accurate offset tracking

            print(f"[acuity] DEBUG: Exited appointments loop, appt_pages={appt_pages}, total_processed={appointments_processed}")
            print(f"[acuity] appointments_fetched: tenant={tenant_id}, pages={appt_pages}, count={dbg_appts_count}, payments_checked={payments_checked}, seconds={round(perf_counter() - appointments_started, 2)}")

            # Collect ALL historical revenue data via orders API (not date-filtered)
            # This gives complete financial history even though appointments are future-only
            print(f"[acuity] DEBUG: About to start revenue collection")
            if client_map:
                for cid_key, contact_id_value in client_map.items():
                    if not contact_id_value:
                        continue
                    client_contact_map.setdefault(cid_key, contact_id_value)
                    if cid_key and not str(cid_key).startswith("acuity:"):
                        client_contact_map.setdefault(f"acuity:{cid_key}", contact_id_value)
            orders_metrics = {
                "orders_processed": 0,
                "transactions_created": 0,
                "transactions_skipped": 0,
            }
            try:
                payments_started = perf_counter()
                print(f"[acuity] revenue_collection_started: fetching ALL historical payment data from orders API, creating transaction records")
                # Create transaction records by passing database connection
                with _with_conn(tenant_id) as conn:
                    orders_metrics = _collect_orders_payments(
                        payments_map,
                        client,
                        base,
                        email_map,
                        conn,
                        tenant_id,
                        allow_phone_lookup=True,
                        phone_map=phone_to_contact_id_map,
                        client_contact_map=client_contact_map,
                        payment_records=payment_records,
                    )
                print(f"[acuity] DEBUG: Revenue collection completed")
                print(
                    f"[acuity] orders_processed: tenant={tenant_id}, payments={orders_metrics.get('orders_processed', 0)}, "
                    f"transactions_created={orders_metrics.get('transactions_created', 0)}, "
                    f"transactions_skipped={orders_metrics.get('transactions_skipped', 0)}, "
                    f"contacts_with_payments={len(payments_map)}, "
                    f"seconds={round(perf_counter() - payments_started, 2)}"
                )
            except Exception as exc:
                print(f"[acuity] DEBUG: Revenue collection failed with exception: {exc}")
                logger.debug(
                    "Acuity order payments fetch failed",
                    extra={"error": str(exc)},
                )

    except httpx.HTTPError:
        pass

    if payments_map and not skip_contact_rollups:
        try:
            print(f"[acuity] revenue_update_starting: tenant={tenant_id}, payments_map_size={len(payments_map)}, skip_contact_rollups={skip_contact_rollups}")
            # Sample first 3 contact_ids from payments_map
            sample_cids = list(payments_map.keys())[:3]
            print(f"[acuity] revenue_update_sample_cids: {sample_cids}")
            update_success = 0
            update_failed = 0
            failed_samples = []
            
            # Process contacts in batches of 100 to avoid hanging
            contact_items = list(payments_map.items())
            batch_size = 100
            total_batches = (len(contact_items) + batch_size - 1) // batch_size
            
            for batch_num in range(total_batches):
                start_idx = batch_num * batch_size
                end_idx = min(start_idx + batch_size, len(contact_items))
                batch = contact_items[start_idx:end_idx]
                
                print(f"[acuity] revenue_update_batch: {batch_num + 1}/{total_batches}, contacts={len(batch)}")
                
                with _with_conn(tenant_id) as conn:
                    ts_expr = _timestamp_expr(conn)
                    for cid, meta in batch:
                        if not cid:
                            continue
                        meta.setdefault("first", 0)
                        meta.setdefault("last", 0)
                        meta.setdefault("txn_count", 0)
                        meta.setdefault("lifetime_cents", 0)
                        meta.pop("_txn_ids", None)
                        meta.pop("_order_ids", None)
                        
                        result = conn.execute(
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
                        
                        # Track success/failure
                        if int(getattr(result, "rowcount", 0) or 0) > 0:
                            update_success += 1
                        else:
                            update_failed += 1
                            if len(failed_samples) < 5:
                                failed_samples.append({"cid": cid, "cents": meta.get("lifetime_cents", 0)})
                    
                    # Commit this batch before moving to next
                    print(f"[acuity] revenue_update_batch_committed: batch={batch_num + 1}, success={update_success}, failed={update_failed}")
                
                # Summary logging
                print(
                    "[acuity] revenue_update_complete: "
                    f"tenant={tenant_id}, total_payments={len(payments_map)}, successful_updates={update_success}, "
                    f"failed_updates={update_failed}, "
                    f"appt_transactions_created={appointment_payment_metrics['transactions_created']}, "
                    f"order_transactions_created={orders_metrics.get('transactions_created', 0)}"
                )
                if failed_samples:
                    print(f"[acuity] revenue_update_failures: failed_sample={failed_samples[:3]}")
        except Exception as exc:
            logger.exception("Failed to apply Acuity payment rollups", extra={"tenant_id": tenant_id, "error": str(exc)})
    elif payments_map and skip_contact_rollups:
        print(f"[acuity] SKIPPING contact rollups (skip_contact_rollups=True), contacts_with_payments={len(payments_map)}")

    try:
        with _with_conn(tenant_id) as conn:  # type: ignore
            conn.execute(
                _sql_text("UPDATE connected_accounts_v2 SET last_sync = EXTRACT(EPOCH FROM now())::bigint WHERE tenant_id = CAST(:t AS uuid) AND provider='acuity'"),
                {"t": tenant_id},
            )
    except Exception:
        pass
    total_skipped = (
        appointments_skipped_historical
        + appointments_skipped_unmatched
        + appointments_skipped_write_failures
        + appointments_skipped_missing_time
    )

    try:
        emit_event("AcuityImportCompleted", {"tenant_id": tenant_id, "contacts": int(contacts_processed), "appointments": int(appointments_persisted)})
    except Exception:
        pass
    total_transactions_created = appointment_payment_metrics["transactions_created"] + orders_metrics["transactions_created"]
    total_transactions_skipped = appointment_payment_metrics["transactions_skipped"] + orders_metrics["transactions_skipped"]
    payment_records_sample = [
        {
            "contact_id": record.get("contact_id"),
            "amount_cents": record.get("amount_cents"),
            "timestamp_iso": record.get("timestamp_iso"),
            "payment_method": record.get("payment_method"),
            "payment_source": record.get("payment_source"),
            "appointment_id": record.get("appointment_id"),
            "order_id": record.get("order_id"),
            "transaction_id": record.get("transaction_id"),
        }
        for record in payment_records[:5]
    ]
    print(
        "[acuity] import_summary: "
        f"tenant={tenant_id}, contacts_processed={contacts_processed}, contacts_updated={updated}, "
        f"appointments_attempted={appointments_attempted}, appointments_persisted={appointments_persisted}, "
        f"skipped_historical={appointments_skipped_historical}, skipped_unmatched={appointments_skipped_unmatched}, "
        f"skipped_write_failures={appointments_skipped_write_failures}, skipped_missing_time={appointments_skipped_missing_time}, "
        f"appointments_fetched={dbg_appts_count}, payments_contacts={len(payments_map)}, "
        f"clients_status={dbg_clients_status}, appointments_status={dbg_appts_status}, skipped_total={total_skipped}, "
        f"appointment_transactions_created={appointment_payment_metrics['transactions_created']}, "
        f"appointment_transactions_skipped={appointment_payment_metrics['transactions_skipped']}, "
        f"order_transactions_created={orders_metrics['transactions_created']}, "
        f"order_transactions_skipped={orders_metrics['transactions_skipped']}, "
        f"transactions_created_total={total_transactions_created}, transactions_skipped_total={total_transactions_skipped}"
    )
    print(f"[acuity] DEBUG: About to return result dictionary")
    return {
        "imported": appointments_persisted,
        "appointments_attempted": appointments_attempted,
        "appointments_persisted": appointments_persisted,
        "appointments_skipped_historical": appointments_skipped_historical,
        "appointments_skipped_unmatched": appointments_skipped_unmatched,
        "appointments_skipped_missing_time": appointments_skipped_missing_time,
        "appointments_skipped_write_failures": appointments_skipped_write_failures,
        "appointments_skipped_total": total_skipped,
        "updated": int(updated),
        "skipped_duplicates": int(total_skipped),
        "clients_status": dbg_clients_status,
        "clients_count": dbg_clients_count,
        "appointments_status": dbg_appts_status,
        "appointments_count": dbg_appts_count,
        "auth_mode": auth_mode,
        "page_limit": page_limit,
        "skip_appt_payments": skip_appt_payments,
        "transactions_created": total_transactions_created,
        "transactions_skipped": total_transactions_skipped,
        "appointment_transactions_created": appointment_payment_metrics["transactions_created"],
        "appointment_transactions_skipped": appointment_payment_metrics["transactions_skipped"],
        "appointment_payments_checked": payments_checked,
        "orders_processed": orders_metrics["orders_processed"],
        "order_transactions_created": orders_metrics["transactions_created"],
        "order_transactions_skipped": orders_metrics["transactions_skipped"],
        "payment_records_total": len(payment_records),
        "payment_records_sample": payment_records_sample,
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
