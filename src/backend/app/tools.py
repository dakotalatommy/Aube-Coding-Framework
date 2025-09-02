from typing import Any, Dict, Optional, List
from sqlalchemy.orm import Session
from .auth import UserContext
from . import models as dbm
from .ai import AIClient
from .brand_prompts import BRAND_SYSTEM, cadence_intro_prompt
from .cadence import get_cadence_definition
from .messaging import send_message
from sqlalchemy import text as _sql_text
from .db import engine
from .crypto import decrypt_text
import re as _re
import math
import io
import csv
import time
import os
import httpx
import secrets as _secrets
from .rate_limit import check_and_increment
from .metrics_counters import DB_QUERY_TOOL_USED


class ToolError(Exception):
    pass


def _require_tenant(ctx: UserContext, tenant_id: str) -> None:
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        raise ToolError("forbidden")


async def tool_draft_message(
    db: Session,
    ctx: UserContext,
    tenant_id: str,
    contact_id: str,
    channel: str = "sms",
    service: Optional[str] = None,
) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    contact = (
        db.query(dbm.Contact)
        .filter(dbm.Contact.tenant_id == tenant_id, dbm.Contact.contact_id == contact_id)
        .first()
    )
    if not contact:
        return {"status": "not_found"}
    if channel == "sms" and contact.consent_sms is False:
        return {"status": "suppressed"}
    client = AIClient()
    body = await client.generate(
        BRAND_SYSTEM,
        [{"role": "user", "content": cadence_intro_prompt(service or "service")}],
        max_tokens=160,
    )
    return {"status": "ok", "draft": body, "channel": channel}


# Quick connector actions
async def tool_connectors_cleanup(db: Session, ctx: UserContext, tenant_id: str) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    base_api = os.getenv("BACKEND_BASE_URL", "http://localhost:8000").rstrip("/")
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(f"{base_api}/integrations/connectors/cleanup", json={"tenant_id": tenant_id})
        return r.json() if r.headers.get("content-type", "").startswith("application/json") else {"status": r.status_code}

async def tool_connectors_normalize(db: Session, ctx: UserContext, tenant_id: str) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    base_api = os.getenv("BACKEND_BASE_URL", "http://localhost:8000").rstrip("/")
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(f"{base_api}/integrations/connectors/normalize", json={"tenant_id": tenant_id, "migrate_legacy": True, "dedupe": True})
        return r.json() if r.headers.get("content-type", "").startswith("application/json") else {"status": r.status_code}

async def tool_calendar_sync(db: Session, ctx: UserContext, tenant_id: str, provider: Optional[str] = None) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    base_api = os.getenv("BACKEND_BASE_URL", "http://localhost:8000").rstrip("/")
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(f"{base_api}/calendar/sync", json={"tenant_id": tenant_id, "provider": provider or "auto"})
        return r.json() if r.headers.get("content-type", "").startswith("application/json") else {"status": r.status_code}

async def tool_calendar_merge(db: Session, ctx: UserContext, tenant_id: str) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    base_api = os.getenv("BACKEND_BASE_URL", "http://localhost:8000").rstrip("/")
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(f"{base_api}/calendar/merge", json={"tenant_id": tenant_id})
        return r.json() if r.headers.get("content-type", "").startswith("application/json") else {"status": r.status_code}

async def tool_oauth_refresh(db: Session, ctx: UserContext, tenant_id: str, provider: str) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    base_api = os.getenv("BACKEND_BASE_URL", "http://localhost:8000").rstrip("/")
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(f"{base_api}/oauth/refresh", json={"tenant_id": tenant_id, "provider": provider})
        return r.json() if r.headers.get("content-type", "").startswith("application/json") else {"status": r.status_code}

async def tool_square_backfill(db: Session, ctx: UserContext, tenant_id: str) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    base_api = os.getenv("BACKEND_BASE_URL", "http://localhost:8000").rstrip("/")
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(f"{base_api}/integrations/booking/square/backfill-metrics", json={"tenant_id": tenant_id})
        return r.json() if r.headers.get("content-type", "").startswith("application/json") else {"status": r.status_code}
async def tool_twilio_provision(db: Session, ctx: UserContext, tenant_id: str, area_code: str = "") -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    base_api = os.getenv("BACKEND_BASE_URL", "http://localhost:8000").rstrip("/")
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(f"{base_api}/integrations/twilio/provision", json={"tenant_id": tenant_id, "area_code": area_code})
        return r.json() if r.headers.get("content-type", "").startswith("application/json") else {"status": r.status_code}


def tool_propose_next_cadence_step(
    db: Session,
    ctx: UserContext,
    tenant_id: str,
    contact_id: str,
    cadence_id: str,
) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    state = (
        db.query(dbm.CadenceState)
        .filter(
            dbm.CadenceState.tenant_id == tenant_id,
            dbm.CadenceState.contact_id == contact_id,
            dbm.CadenceState.cadence_id == cadence_id,
        )
        .first()
    )
    steps = get_cadence_definition(cadence_id)
    if not steps:
        return {"status": "unknown_cadence"}
    next_idx = 0 if not state else state.step_index + 1
    if next_idx >= len(steps):
        return {"status": "complete"}
    return {"status": "ok", "next_step_index": next_idx, "next_step": steps[next_idx]}


# Simple pricing model calculator
def tool_pricing_model(
    db: Session,
    ctx: UserContext,
    tenant_id: str,
    price: float,
    product_cost: float,
    service_time_minutes: float,
) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    service_hours = max(0.01, service_time_minutes / 60.0)
    effective_hourly = (price - product_cost) / service_hours
    margin = 0.0
    try:
        margin = (price - product_cost) / max(0.01, price)
    except Exception:
        margin = 0.0
    suggestions = []
    target_hourly = 100.0  # default benchmark; UI can pass a target later
    if effective_hourly < target_hourly:
        suggestions.append("Consider adjusting price, reducing time, or adding profitable add-ons.")
    else:
        suggestions.append("Effective hourly meets or exceeds a common target benchmark.")
    return {
        "status": "ok",
        "effective_hourly": round(effective_hourly, 2),
        "margin_ratio": round(margin, 2),
        "inputs": {
            "price": price,
            "product_cost": product_cost,
            "service_time_minutes": service_time_minutes,
        },
        "suggestions": suggestions,
    }


# Safety check: light moderation/sanity pass using AI
async def tool_safety_check(
    db: Session,
    ctx: UserContext,
    tenant_id: str,
    text: str,
) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    client = AIClient()
    prompt = (
        "Review the following marketing or client messaging for medical/legal claims, PII, or non-compliant promises. "
        "Return a brief list of issues and suggested safe rewrites. If acceptable, say 'OK'.\n\nTEXT:\n" + text
    )
    result = await client.generate(BRAND_SYSTEM, [{"role": "user", "content": prompt}], max_tokens=240)
    return {"status": "ok", "review": result}


# Stop cadence for a contact

def tool_stop_cadence(
    db: Session,
    ctx: UserContext,
    tenant_id: str,
    contact_id: str,
    cadence_id: str,
) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    q = (
        db.query(dbm.CadenceState)
        .filter(
            dbm.CadenceState.tenant_id == tenant_id,
            dbm.CadenceState.contact_id == contact_id,
            dbm.CadenceState.cadence_id == cadence_id,
        )
    )
    count = q.count()
    q.delete()
    db.commit()
    return {"status": "ok", "stopped": count}


# Notify waitlist candidates and send message (gated externally)

def tool_notify_trigger_send(
    db: Session,
    ctx: UserContext,
    tenant_id: str,
    max_candidates: int = 5,
    message_template: Optional[str] = None,
) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    q = db.query(dbm.NotifyListEntry).filter(dbm.NotifyListEntry.tenant_id == tenant_id)
    rows = q.limit(max(1, min(max_candidates, 50))).all()
    targets = [r for r in rows if str(r.preference).lower() == "soonest"]
    sent = 0
    for t in targets:
        try:
            body = message_template or "A spot just opened. Reply YES for the soonest appointment."
            # We use channel sms; send_message routes to TEST_SMS_TO in dev
            send_message(db, tenant_id, t.contact_id, "sms", None, body, None)
            sent += 1
        except Exception:
            continue
    return {"status": "ok", "count": len(targets), "sent": sent}


REGISTRY = {
    "draft_message": tool_draft_message,  # async
    "propose_next_cadence_step": tool_propose_next_cadence_step,  # sync
    "pricing_model": tool_pricing_model,  # sync
    "safety_check": tool_safety_check,    # async
    "stop_cadence": tool_stop_cadence,    # sync
    "notify_trigger_send": tool_notify_trigger_send,  # sync
}


async def execute_tool(name: str, params: Dict[str, Any], db: Session, ctx: UserContext) -> Dict[str, Any]:
    # Prefer extended tools first so registry presence doesn't block routing
    ext = await _dispatch_extended(name, params, db, ctx)
    if ext is not None:
        return ext
    fn = REGISTRY.get(name)
    if not fn:
        return {"status": "unknown_tool"}
    try:
        if name == "draft_message":
            return await fn(
                db,
                ctx,
                tenant_id=str(params.get("tenant_id", ctx.tenant_id)),
                contact_id=str(params.get("contact_id", "")),
                channel=str(params.get("channel", "sms")),
                service=params.get("service"),
            )
        if name == "safety_check":
            return await fn(
                db,
                ctx,
                tenant_id=str(params.get("tenant_id", ctx.tenant_id)),
                text=str(params.get("text", "")),
            )
        # sync tools
        if name == "propose_next_cadence_step":
            return fn(
                db,
                ctx,
                tenant_id=str(params.get("tenant_id", ctx.tenant_id)),
                contact_id=str(params.get("contact_id", "")),
                cadence_id=str(params.get("cadence_id", "")),
            )
        if name == "pricing_model":
            return fn(
                db,
                ctx,
                tenant_id=str(params.get("tenant_id", ctx.tenant_id)),
                price=float(params.get("price", 0)),
                product_cost=float(params.get("product_cost", 0)),
                service_time_minutes=float(params.get("service_time_minutes", 0)),
            )
        if name == "stop_cadence":
            return fn(
                db,
                ctx,
                tenant_id=str(params.get("tenant_id", ctx.tenant_id)),
                contact_id=str(params.get("contact_id", "")),
                cadence_id=str(params.get("cadence_id", "")),
            )
        if name == "notify_trigger_send":
            return fn(
                db,
                ctx,
                tenant_id=str(params.get("tenant_id", ctx.tenant_id)),
                max_candidates=int(params.get("max_candidates", 5)),
                message_template=params.get("message_template"),
            )
        if name == "messages.send":
            return send_message(
                db,
                tenant_id=str(params.get("tenant_id", ctx.tenant_id)),
                contact_id=str(params.get("contact_id", "")),
                channel=str(params.get("channel", "sms")),
                template_id=str(params.get("template_id") or ""),
                body=str(params.get("body") or ""),
                subject=str(params.get("subject") or ""),
            )
        # CRM helpers
        if name == "contacts.list.top_ltv":
            return tool_contacts_list_top_ltv(
                db,
                ctx,
                tenant_id=str(params.get("tenant_id", ctx.tenant_id)),
                limit=int(params.get("limit", 10)),
            )
        if name == "contacts.import.square":
            return await tool_contacts_import_square(
                db,
                ctx,
                tenant_id=str(params.get("tenant_id", ctx.tenant_id)),
            )
        return {"status": "not_implemented"}
    except ToolError as te:
        return {"status": str(te)}
    except Exception:
        return {"status": "error"}


# ---------------------- Additional high-ROI tools ----------------------

def tool_contacts_dedupe(
    db: Session,
    ctx: UserContext,
    tenant_id: str,
) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    removed = 0
    seen: Dict[str, int] = {}
    q = (
        db.query(dbm.Contact)
        .filter(dbm.Contact.tenant_id == tenant_id, dbm.Contact.deleted == False)  # type: ignore
        .order_by(dbm.Contact.id.asc())
    )
    for c in q.all():
        key = f"{c.email_hash or ''}|{c.phone_hash or ''}"
        if key.strip() == "|":
            continue
        if key in seen:
            c.deleted = True  # type: ignore
            removed += 1
        else:
            seen[key] = c.id  # type: ignore
    db.commit()
    return {"status": "ok", "removed": removed}


def tool_campaigns_dormant_start(
    db: Session,
    ctx: UserContext,
    tenant_id: str,
    threshold_days: int = 60,
) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    # Ensure no pending aborted transaction
    try:
        db.rollback()
    except Exception:
        pass
    try:
        with engine.begin() as conn:
            # Set RLS GUCs
            conn.execute(_sql_text("SET LOCAL app.role = 'owner_admin'"))
            conn.execute(_sql_text("SET LOCAL app.tenant_id = :t"), {"t": tenant_id})

            # Build last_seen per contact
            last_seen_rows = conn.execute(
                _sql_text(
                    """
                    SELECT contact_id::text AS cid, MAX(start_ts) AS last_ts
                    FROM appointments
                    WHERE tenant_id = CAST(:tenant AS uuid)
                    GROUP BY contact_id
                    """
                ),
                {"tenant": tenant_id},
            ).fetchall()
            last_seen_map: Dict[str, str] = {str(r[0]): (str(r[1]) if r[1] is not None else "") for r in last_seen_rows}

            # Fetch contacts
            contact_rows = conn.execute(
                _sql_text(
                    """
                    SELECT id::text AS id
                    FROM contacts
                    WHERE tenant_id = CAST(:tenant AS uuid)
                    """
                ),
                {"tenant": tenant_id},
            ).fetchall()
            if not contact_rows:
                return {"status": "ok", "started": 0, "threshold_days": threshold_days}

            started = 0
            for (cid_text,) in contact_rows:
                ls_ts = last_seen_map.get(cid_text)
                should_start = False
                if not ls_ts:
                    should_start = True
                else:
                    row = conn.execute(
                        _sql_text(
                            "SELECT (CAST(:ls AS timestamptz) < now() - (:days || ' days')::interval)"
                        ),
                        {"ls": ls_ts, "days": str(int(max(0, threshold_days)))},
                    ).scalar()
                    should_start = bool(row)
                if should_start:
                    conn.execute(
                        _sql_text(
                            """
                            INSERT INTO cadence_states (tenant_id, contact_id, cadence_id, step_index, next_action_epoch, created_at)
                            VALUES (:tenant_txt, :cid_txt, 'retargeting_no_answer', 0, extract(epoch from now())::int, now())
                            """
                        ),
                        {"tenant_txt": tenant_id, "cid_txt": cid_text},
                    )
                    started += 1
            return {"status": "ok", "started": started, "threshold_days": threshold_days}
    except Exception as e:
        try:
            db.rollback()
        except Exception:
            pass
        return {"status": "error", "detail": str(e)}


def tool_segment_dormant_preview(
    db: Session,
    ctx: UserContext,
    tenant_id: str,
    threshold_days: int = 60,
) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    try:
        with engine.begin() as conn:
            conn.execute(_sql_text("SET LOCAL app.role = 'owner_admin'"))
            conn.execute(_sql_text("SET LOCAL app.tenant_id = :t"), {"t": tenant_id})
            # Compute last_seen per contact (appointments.start_ts is epoch seconds)
            last_seen_rows = conn.execute(
                _sql_text(
                    """
                    SELECT contact_id::text AS cid, MAX(start_ts) AS last_ts
                    FROM appointments
                    WHERE tenant_id = CAST(:tenant AS uuid)
                    GROUP BY contact_id
                    """
                ),
                {"tenant": tenant_id},
            ).fetchall()
            last_seen = {}
            for r in last_seen_rows:
                cid = str(r[0])
                val = r[1]
                ts = 0
                try:
                    # Handle integer epoch or datetime
                    if val is None:
                        ts = 0
                    elif isinstance(val, (int, float)):
                        ts = int(val)
                    else:
                        # datetime-like
                        ts = int(getattr(val, 'timestamp')() if hasattr(val, 'timestamp') else int(val))
                except Exception:
                    ts = 0
                last_seen[cid] = ts
            cutoff = int(time.time()) - int(threshold_days) * 86400
            # Fetch contacts and count dormant
            rows = conn.execute(
                _sql_text(
                    "SELECT contact_id::text FROM contacts WHERE tenant_id = CAST(:tenant AS uuid)"
                ),
                {"tenant": tenant_id},
            ).fetchall()
            count = 0
            for (cid,) in rows:
                ls = last_seen.get(cid, 0)
                if ls == 0 or ls < cutoff:
                    count += 1
            return {"status": "ok", "count": count, "threshold_days": threshold_days}
    except Exception as e:
        return {"status": "error", "detail": str(e)}

def tool_appointments_schedule_reminders(
    db: Session,
    ctx: UserContext,
    tenant_id: str,
) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    # Ensure no pending aborted transaction
    try:
        db.rollback()
    except Exception:
        pass
    try:
        # Use Supabase-native schema: lead_status next_action_at is timestamptz
        # For upcoming booked appointments, set next_action_at triggers
        with engine.begin() as conn:
            conn.execute(_sql_text("SET LOCAL app.role = 'owner_admin'"))
            conn.execute(_sql_text("SET LOCAL app.tenant_id = :t"), {"t": tenant_id})
            appts = conn.execute(
                _sql_text(
                    """
                    SELECT contact_id::text AS cid, start_ts
                    FROM appointments
                    WHERE tenant_id = CAST(:tenant AS uuid) AND status = 'booked'
                    LIMIT 200
                    """
                ),
                {"tenant": tenant_id},
            ).fetchall()
            if not appts:
                return {"status": "ok", "scheduled": 0}
            scheduled = 0
            for cid_text, start_ts in appts:
                for delta in (7, 3, 1, 0):
                    row = conn.execute(
                        _sql_text(
                            """
                            WITH triggers AS (
                              SELECT (CAST(:start AS timestamptz) - (:d || ' days')::interval) AS t
                            )
                            UPDATE lead_status ls
                            SET next_action_at = COALESCE(ls.next_action_at, (SELECT t FROM triggers))
                            WHERE ls.tenant_id = CAST(:tenant AS uuid) AND ls.contact_id = CAST(:cid AS uuid)
                            RETURNING 1
                            """
                        ),
                        {"start": str(start_ts), "d": str(delta), "tenant": tenant_id, "cid": cid_text},
                    ).rowcount
                    if row == 0:
                        ins = conn.execute(
                            _sql_text(
                                """
                                INSERT INTO lead_status (id, tenant_id, contact_id, bucket, tag, next_action_at)
                                VALUES (gen_random_uuid(), CAST(:tenant AS uuid), CAST(:cid AS uuid), 4, 'reminder', CAST(:start AS timestamptz) - (:d || ' days')::interval)
                                ON CONFLICT DO NOTHING
                                """
                            ),
                            {"tenant": tenant_id, "cid": cid_text, "start": str(start_ts), "d": str(delta)},
                        )
                        scheduled += ins.rowcount or 0
                    else:
                        scheduled += row or 0
            return {"status": "ok", "scheduled": scheduled}
    except Exception as e:
        try:
            db.rollback()
        except Exception:
            pass
        return {"status": "error", "detail": str(e)}


def tool_inventory_alerts_get(
    db: Session,
    ctx: UserContext,
    tenant_id: str,
    low_stock_threshold: int = 5,
) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    # Placeholder until inventory is persisted; return empty list with threshold
    return {"status": "ok", "items": [], "threshold": int(low_stock_threshold)}


def tool_export_contacts(
    db: Session,
    ctx: UserContext,
    tenant_id: str,
) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    rows = (
        db.query(dbm.Contact)
        .filter(dbm.Contact.tenant_id == tenant_id, dbm.Contact.deleted == False)  # type: ignore
        .order_by(dbm.Contact.id.asc())
        .all()
    )
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["contact_id", "email_hash", "phone_hash", "consent_sms", "consent_email"])
    for r in rows:
        writer.writerow([r.contact_id, r.email_hash or "", r.phone_hash or "", bool(r.consent_sms), bool(r.consent_email)])
    return {"status": "ok", "csv": buffer.getvalue()}


# Extend registry with new tools
REGISTRY.update(
    {
        "contacts.dedupe": tool_contacts_dedupe,
        "campaigns.dormant.start": tool_campaigns_dormant_start,
        "appointments.schedule_reminders": tool_appointments_schedule_reminders,
        "inventory.alerts.get": tool_inventory_alerts_get,
        "export.contacts": tool_export_contacts,
        "campaigns.dormant.preview": tool_segment_dormant_preview,
        # Link and OAuth pseudo-tools (frontend or endpoint triggers)
        "link.hubspot.signup": lambda *a, **k: {"status": "ok", "url": "https://app.hubspot.com/signup"},
        "oauth.hubspot.connect": lambda *a, **k: {"status": "ok", "url": "/oauth/hubspot/login"},
        "crm.hubspot.import": lambda *a, **k: {"status": "ok", "endpoint": "/crm/hubspot/import"},
        # New quick exec tools
        "connectors.cleanup": tool_connectors_cleanup,
        "connectors.normalize": tool_connectors_normalize,
        "calendar.sync": tool_calendar_sync,
        "calendar.merge": tool_calendar_merge,
        "oauth.refresh": tool_oauth_refresh,
        "square.backfill": tool_square_backfill,
        "integrations.twilio.provision": tool_twilio_provision,
        # db.query.* registered below after definitions
        # registered after definition below
    }
)


# Social automation: draft a 14‑day schedule (placeholder planning tool)
def tool_social_schedule_14days(
    db: Session,
    ctx: UserContext,
    tenant_id: str,
) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    import datetime as _dt
    today = _dt.datetime.utcnow().date()
    entries = []
    for i in range(14):
        d = today + _dt.timedelta(days=i)
        entries.append({"date": d.isoformat(), "channels": ["instagram","facebook"], "status": "planned"})
    return {"status": "ok", "days": entries}


# Register after definition to avoid NameError on import
REGISTRY["social.schedule.14days"] = tool_social_schedule_14days

# Extend dispatcher
async def _dispatch_extended(name: str, params: Dict[str, Any], db: Session, ctx: UserContext) -> Optional[Dict[str, Any]]:
    if name == "contacts.dedupe":
        return tool_contacts_dedupe(db, ctx, tenant_id=str(params.get("tenant_id", ctx.tenant_id)))
    if name == "campaigns.dormant.start":
        return tool_campaigns_dormant_start(
            db,
            ctx,
            tenant_id=str(params.get("tenant_id", ctx.tenant_id)),
            threshold_days=int(params.get("threshold_days", 60)),
        )
    if name == "appointments.schedule_reminders":
        return tool_appointments_schedule_reminders(db, ctx, tenant_id=str(params.get("tenant_id", ctx.tenant_id)))
    if name == "inventory.alerts.get":
        return tool_inventory_alerts_get(
            db,
            ctx,
            tenant_id=str(params.get("tenant_id", ctx.tenant_id)),
            low_stock_threshold=int(params.get("low_stock_threshold", 5)),
        )
    if name == "export.contacts":
        return tool_export_contacts(db, ctx, tenant_id=str(params.get("tenant_id", ctx.tenant_id)))
    if name == "social.schedule.14days":
        return tool_social_schedule_14days(db, ctx, tenant_id=str(params.get("tenant_id", ctx.tenant_id)))
    if name == "campaigns.dormant.preview":
        return tool_segment_dormant_preview(
            db,
            ctx,
            tenant_id=str(params.get("tenant_id", ctx.tenant_id)),
            threshold_days=int(params.get("threshold_days", 60)),
        )
    if name == "connectors.cleanup":
        return await tool_connectors_cleanup(db, ctx, tenant_id=str(params.get("tenant_id", ctx.tenant_id)))
    if name == "connectors.normalize":
        return await tool_connectors_normalize(db, ctx, tenant_id=str(params.get("tenant_id", ctx.tenant_id)))
    if name == "calendar.sync":
        return await tool_calendar_sync(db, ctx, tenant_id=str(params.get("tenant_id", ctx.tenant_id)), provider=params.get("provider"))
    if name == "calendar.merge":
        return await tool_calendar_merge(db, ctx, tenant_id=str(params.get("tenant_id", ctx.tenant_id)))
    if name == "oauth.refresh":
        return await tool_oauth_refresh(db, ctx, tenant_id=str(params.get("tenant_id", ctx.tenant_id)), provider=str(params.get("provider", "")))
    if name == "contacts.import.square":
        return await tool_contacts_import_square(db, ctx, tenant_id=str(params.get("tenant_id", ctx.tenant_id)))
    if name == "square.backfill":
        return await tool_square_backfill(db, ctx, tenant_id=str(params.get("tenant_id", ctx.tenant_id)))
    if name == "integrations.twilio.provision":
        return await tool_twilio_provision(db, ctx, tenant_id=str(params.get("tenant_id", ctx.tenant_id)), area_code=str(params.get("area_code", "")))
    if name == "db.query.sql":
        out = await tool_db_query_sql(
            db,
            ctx,
            tenant_id=str(params.get("tenant_id", ctx.tenant_id)),
            sql=str(params.get("sql", "")),
            limit=int(params.get("limit", 100)),
        )
        try:
            DB_QUERY_TOOL_USED.labels(tenant_id=str(ctx.tenant_id), name="sql").inc()  # type: ignore
        except Exception:
            pass
        return out
    if name == "db.query.named":
        out = await tool_db_query_named(
            db,
            ctx,
            tenant_id=str(params.get("tenant_id", ctx.tenant_id)),
            name=str(params.get("name", "")),
            params=params.get("params") if isinstance(params.get("params"), dict) else None,
        )
        try:
            DB_QUERY_TOOL_USED.labels(tenant_id=str(ctx.tenant_id), name=str(params.get("name",""))).inc()  # type: ignore
        except Exception:
            pass
        return out
    return None


# ---------------------- CRM helpers ----------------------
def tool_contacts_list_top_ltv(
    db: Session,
    ctx: UserContext,
    tenant_id: str,
    limit: int = 10,
) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    rows = (
        db.query(dbm.Contact)
        .filter(dbm.Contact.tenant_id == tenant_id, dbm.Contact.deleted == False)  # type: ignore
        .order_by(dbm.Contact.lifetime_cents.desc())
        .limit(max(1, min(int(limit or 10), 200)))
        .all()
    )
    out = [
        {
            "contact_id": r.contact_id,
            "txn_count": int(getattr(r, "txn_count", 0) or 0),
            "lifetime_cents": int(getattr(r, "lifetime_cents", 0) or 0),
            "last_visit": int(getattr(r, "last_visit", 0) or 0),
        }
        for r in rows
    ]
    return {"status": "ok", "items": out}


async def tool_contacts_import_square(
    db: Session,
    ctx: UserContext,
    tenant_id: str,
) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    base_api = os.getenv("BACKEND_BASE_URL", "http://localhost:8000").rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(f"{base_api}/integrations/booking/square/sync-contacts", json={"tenant_id": tenant_id})
            try:
                body = r.json()
            except Exception:
                body = {"status": r.status_code, "detail": (r.text or "")[:200]}
            return body if isinstance(body, dict) else {"status": "ok", **body}
    except httpx.HTTPError as e:
        return {"status": "error", "detail": str(e)}


# ---------------------- DB query tools (read-only) ----------------------

ALLOWED_TABLES = {
    "contacts",
    "appointments",
    "lead_status",
    "events_ledger",
}

def _is_safe_select(sql: str) -> bool:
    s = sql.strip().lower()
    if not s.startswith("select "):
        return False
    forbidden = [";", "--", "/*", " insert ", " update ", " delete ", " drop ", " alter ", " truncate "]
    if any(tok in s for tok in forbidden):
        return False
    tables = set(_re.findall(r"\bfrom\s+([a-zA-Z_][a-zA-Z0-9_\.]*)|\bjoin\s+([a-zA-Z_][a-zA-Z0-9_\.]*)", s))
    flat = {t for pair in tables for t in pair if t}
    flat = {t.split(".")[-1] for t in flat}
    return all(t in ALLOWED_TABLES for t in flat if t)


async def tool_db_query_sql(
    db: Session,
    ctx: UserContext,
    tenant_id: str,
    sql: str,
    limit: int = 100,
) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    try:
        ok, ttl = check_and_increment(str(ctx.tenant_id), "db.query.sql", max_per_minute=60, burst=30)
        if not ok:
            return {"status": "rate_limited", "retry_s": int(ttl)}
    except Exception:
        pass
    sql = sql.strip()
    if not _is_safe_select(sql):
        return {"status": "rejected", "reason": "unsafe_sql"}
    hard_limit = max(1, min(int(limit or 100), 500))
    try:
        with engine.begin() as conn:
            conn.execute(_sql_text("SET LOCAL app.role = 'owner_admin'"))
            conn.execute(_sql_text("SET LOCAL app.tenant_id = :t"), {"t": tenant_id})
            q = sql
            if " limit " not in sql.lower():
                q = f"{sql} LIMIT {hard_limit}"
            rows = conn.execute(_sql_text(q)).fetchall()
            cols = [c for c in rows[0].keys()] if rows else []
            data = [dict(r._mapping) for r in rows]
            return {"status": "ok", "columns": cols, "rows": data}
    except Exception as e:
        return {"status": "error", "detail": str(e)[:200]}


async def tool_db_query_named(
    db: Session,
    ctx: UserContext,
    tenant_id: str,
    name: str,
    params: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    try:
        ok, ttl = check_and_increment(str(ctx.tenant_id), "db.query.named", max_per_minute=120, burst=60)
        if not ok:
            return {"status": "rate_limited", "retry_s": int(ttl)}
    except Exception:
        pass
    n = (name or "").strip().lower()
    p = params or {}
    try:
        with engine.begin() as conn:
            conn.execute(_sql_text("SET LOCAL app.role = 'owner_admin'"))
            conn.execute(_sql_text("SET LOCAL app.tenant_id = :t"), {"t": tenant_id})
            if n == "contacts.top_ltv":
                q = _sql_text(
                    """
                    SELECT contact_id, lifetime_cents, last_visit, txn_count
                    FROM contacts
                    WHERE tenant_id = CAST(:t AS uuid) AND (deleted IS NULL OR deleted = false)
                    ORDER BY lifetime_cents DESC
                    LIMIT :lim
                    """
                )
                lim = max(1, min(int(p.get("limit", 10)), 200))
                rows = conn.execute(q, {"t": tenant_id, "lim": lim}).fetchall()
                return {"status": "ok", "rows": [dict(r._mapping) for r in rows]}
            if n == "cohort.dormant":
                days = int(p.get("threshold_days", p.get("days", 60)) or 60)
                q = _sql_text(
                    """
                    SELECT contact_id, lifetime_cents, last_visit
                    FROM contacts
                    WHERE tenant_id = CAST(:t AS uuid)
                      AND (last_visit IS NULL OR last_visit < (EXTRACT(epoch FROM now())::bigint - :sec))
                    ORDER BY lifetime_cents DESC
                    LIMIT :lim
                    """
                )
                lim = max(1, min(int(p.get("limit", 25)), 200))
                rows = conn.execute(q, {"t": tenant_id, "sec": int(days)*86400, "lim": lim}).fetchall()
                return {"status": "ok", "rows": [dict(r._mapping) for r in rows]}
            if n == "metric.rebook_rate_30d":
                q = _sql_text(
                    """
                    WITH base AS (
                      SELECT id, contact_id, start_ts
                      FROM appointments
                      WHERE tenant_id = CAST(:t AS uuid)
                        AND status = 'completed'
                        AND start_ts >= (EXTRACT(epoch FROM now())::bigint - 30*86400)
                    ), rebook AS (
                      SELECT b.id
                      FROM base b
                      WHERE EXISTS (
                        SELECT 1 FROM appointments a2
                        WHERE a2.tenant_id = CAST(:t AS uuid)
                          AND a2.contact_id = b.contact_id
                          AND a2.status = 'completed'
                          AND a2.start_ts > b.start_ts AND a2.start_ts <= b.start_ts + 30*86400
                      )
                    )
                    SELECT (SELECT COUNT(*) FROM base) AS total, (SELECT COUNT(*) FROM rebook) AS rebooked,
                           ROUND((CASE WHEN (SELECT COUNT(*) FROM base) = 0 THEN 0 ELSE ((SELECT COUNT(*) FROM rebook)::numeric / NULLIF((SELECT COUNT(*) FROM base),0)) * 100 END), 1) AS pct
                    """
                )
                row = conn.execute(q, {"t": tenant_id}).fetchone()
                out = {"total": 0, "rebooked": 0, "pct": 0.0}
                if row:
                    out = {"total": int(row[0] or 0), "rebooked": int(row[1] or 0), "pct": float(row[2] or 0.0)}
                return {"status": "ok", "rows": [out]}
            if n == "cohort.dormant_90d":
                q = _sql_text(
                    """
                    SELECT contact_id, lifetime_cents, last_visit
                    FROM contacts
                    WHERE tenant_id = CAST(:t AS uuid)
                      AND (last_visit IS NULL OR last_visit < (EXTRACT(epoch FROM now())::bigint - 90*86400))
                    ORDER BY lifetime_cents DESC
                    LIMIT :lim
                    """
                )
                lim = max(1, min(int(p.get("limit", 25)), 100))
                rows = conn.execute(q, {"t": tenant_id, "lim": lim}).fetchall()
                return {"status": "ok", "rows": [dict(r._mapping) for r in rows]}
            if n == "metric.weekly_revenue_last_week":
                # Pull from Square payments API if connected
                token: str = ""
                try:
                    row_v2 = conn.execute(
                        _sql_text(
                            "SELECT access_token_enc FROM connected_accounts_v2 WHERE tenant_id = CAST(:t AS uuid) AND provider='square' ORDER BY id DESC LIMIT 1"
                        ),
                        {"t": tenant_id},
                    ).fetchone()
                    if row_v2 and row_v2[0]:
                        try:
                            token = decrypt_text(str(row_v2[0])) or ""
                        except Exception:
                            token = str(row_v2[0])
                except Exception:
                    token = ""
                if not token:
                    return {"status": "ok", "rows": [{"cents": 0}]}  # no connection
                import datetime as _dt
                today = _dt.datetime.utcnow().date()
                weekday = today.isoweekday()
                this_monday = today - _dt.timedelta(days=weekday-1)
                last_monday = this_monday - _dt.timedelta(days=7)
                next_monday = this_monday
                begin = _dt.datetime.combine(last_monday, _dt.time(0,0,0))
                end = _dt.datetime.combine(next_monday, _dt.time(0,0,0))
                def _rfc3339(dt: _dt.datetime) -> str:
                    return dt.replace(microsecond=0).isoformat() + "Z"
                base = os.getenv("SQUARE_API_BASE", "https://connect.squareup.com")
                if os.getenv("SQUARE_ENV", "prod").lower().startswith("sand"):
                    base = "https://connect.squareupsandbox.com"
                headers = {"Authorization": f"Bearer {token}", "Accept": "application/json", "Square-Version": os.getenv("SQUARE_VERSION", "2023-10-18")}
                total_cents = 0
                try:
                    with httpx.Client(timeout=20, headers=headers) as client:
                        cursor = None
                        while True:
                            params: Dict[str, str] = {
                                "limit": "100",
                                "begin_time": _rfc3339(begin),
                                "end_time": _rfc3339(end),
                            }
                            if cursor:
                                params["cursor"] = cursor
                            r = client.get(f"{base}/v2/payments", params=params)
                            if r.status_code >= 400:
                                break
                            body = r.json() or {}
                            payments = body.get("payments") or []
                            for pay in payments:
                                try:
                                    status = str(pay.get("status") or "").upper()
                                    if status not in {"COMPLETED", "APPROVED", "CAPTURED"}:
                                        continue
                                    amt = int(((pay.get("amount_money") or {}).get("amount") or 0))
                                    tax = int(((pay.get("tax_money") or {}).get("amount") or 0))
                                    refunded = int(((pay.get("refunded_money") or {}).get("amount") or 0))
                                    net = max(0, amt - tax - refunded)
                                    total_cents += net
                                except Exception:
                                    continue
                            cursor = body.get("cursor") or body.get("next_cursor")
                            if not cursor:
                                break
                except Exception:
                    total_cents = 0
                return {"status": "ok", "rows": [{"cents": int(total_cents)}]}
            if n == "metric.rebook_rate_category_fri_after_4pm_90d":
                # Rebook definition: next completed appointment within 30 days of index appointment
                q = _sql_text(
                    """
                    WITH base AS (
                      SELECT id, COALESCE(lower(service),'unknown') AS category, contact_id, start_ts
                      FROM appointments
                      WHERE tenant_id = CAST(:t AS uuid)
                        AND status = 'completed'
                        AND start_ts >= (EXTRACT(epoch FROM now())::bigint - 90*86400)
                        AND EXTRACT(DOW FROM to_timestamp(start_ts)) = 5
                        AND to_timestamp(start_ts)::time >= time '16:00'
                    ),
                    rebooked AS (
                      SELECT a1.id AS id
                      FROM appointments a1
                      WHERE a1.tenant_id = CAST(:t AS uuid)
                        AND a1.status = 'completed'
                        AND a1.start_ts >= (EXTRACT(epoch FROM now())::bigint - 90*86400)
                        AND EXTRACT(DOW FROM to_timestamp(a1.start_ts)) = 5
                        AND to_timestamp(a1.start_ts)::time >= time '16:00'
                        AND EXISTS (
                          SELECT 1 FROM appointments a2
                          WHERE a2.tenant_id = a1.tenant_id
                            AND a2.contact_id = a1.contact_id
                            AND a2.status = 'completed'
                            AND a2.start_ts > a1.start_ts
                            AND a2.start_ts <= a1.start_ts + 30*86400
                        )
                    )
                    SELECT b.category,
                           COUNT(*) AS total,
                           COUNT(*) FILTER (WHERE b.id IN (SELECT id FROM rebooked)) AS rebooked,
                           ROUND((COUNT(*) FILTER (WHERE b.id IN (SELECT id FROM rebooked))::numeric / NULLIF(COUNT(*),0)) * 100, 1) AS pct
                    FROM base b
                    GROUP BY b.category
                    ORDER BY pct DESC, total DESC
                    LIMIT :lim
                    """
                )
                lim = max(1, min(int(p.get("limit", 50)), 200))
                rows = conn.execute(q, {"t": tenant_id, "lim": lim}).fetchall()
                return {"status": "ok", "rows": [dict(r._mapping) for r in rows]}
            if n == "cohort.fragrance_sensitive_cancels_2x_24h_1y":
                # Heuristic: use appointments marked canceled where created_at is within 24h prior to start_ts
                q = _sql_text(
                    """
                    WITH canc AS (
                      SELECT contact_id
                      FROM appointments
                      WHERE tenant_id = CAST(:t AS uuid)
                        AND status ILIKE 'cancel%'
                        AND start_ts >= (EXTRACT(epoch FROM now())::bigint - 365*86400)
                        AND (start_ts - COALESCE(created_at, start_ts)) <= 86400
                    ),
                    cnt AS (
                      SELECT contact_id, COUNT(*) AS cancels_24h
                      FROM canc
                      GROUP BY contact_id
                    )
                    SELECT ct.contact_id, ct.lifetime_cents, ct.last_visit
                    FROM cnt
                    JOIN contacts ct ON ct.tenant_id = CAST(:t AS uuid) AND ct.contact_id = cnt.contact_id
                    WHERE cnt.cancels_24h >= 2
                      AND EXISTS (
                        SELECT 1 FROM lead_status ls
                        WHERE ls.tenant_id = CAST(:t AS uuid)
                          AND ls.contact_id = ct.contact_id
                          AND ls.tag ILIKE '%fragrance%'
                      )
                    ORDER BY ct.lifetime_cents DESC
                    LIMIT :lim
                    """
                )
                lim = max(1, min(int(p.get("limit", 100)), 200))
                rows = conn.execute(q, {"t": tenant_id, "lim": lim}).fetchall()
                return {"status": "ok", "rows": [dict(r._mapping) for r in rows]}
            if n == "cohort.ig_first_timers_500_in_60d":
                # Approximation: creation_source/tag indicates Instagram; lifetime >= $500; last_visit within 60d of first_visit
                q = _sql_text(
                    """
                    SELECT c.contact_id, c.lifetime_cents, c.first_visit, c.last_visit
                    FROM contacts c
                    WHERE c.tenant_id = CAST(:t AS uuid)
                      AND c.lifetime_cents >= 50000
                      AND (
                        lower(COALESCE(c.creation_source,'')) LIKE '%insta%'
                        OR EXISTS (
                          SELECT 1 FROM lead_status ls
                          WHERE ls.tenant_id = c.tenant_id AND ls.contact_id = c.contact_id AND ls.tag ILIKE '%insta%'
                        )
                      )
                      AND c.first_visit IS NOT NULL AND c.last_visit IS NOT NULL
                      AND c.last_visit <= c.first_visit + 60*86400
                    ORDER BY c.lifetime_cents DESC
                    LIMIT :lim
                    """
                )
                lim = max(1, min(int(p.get("limit", 100)), 200))
                rows = conn.execute(q, {"t": tenant_id, "lim": lim}).fetchall()
                return {"status": "ok", "rows": [dict(r._mapping) for r in rows]}
            if n == "cohort.gloss_after_balayage_no_rebook_12w":
                q = _sql_text(
                    """
                    WITH balay AS (
                      SELECT contact_id, start_ts AS balay_ts
                      FROM appointments
                      WHERE tenant_id = CAST(:t AS uuid)
                        AND status = 'completed'
                        AND lower(COALESCE(service,'')) LIKE '%balay%'
                    ),
                    gloss AS (
                      SELECT contact_id, start_ts AS gloss_ts
                      FROM appointments
                      WHERE tenant_id = CAST(:t AS uuid)
                        AND status = 'completed'
                        AND lower(COALESCE(service,'')) LIKE '%gloss%'
                    ),
                    pairs AS (
                      SELECT b.contact_id, b.balay_ts, g.gloss_ts
                      FROM balay b
                      JOIN gloss g ON g.contact_id = b.contact_id
                      WHERE g.gloss_ts >= b.balay_ts AND g.gloss_ts <= b.balay_ts + 42*86400
                    ),
                    no_rebook12 AS (
                      SELECT p.contact_id, p.gloss_ts
                      FROM pairs p
                      WHERE NOT EXISTS (
                        SELECT 1 FROM appointments a3
                        WHERE a3.tenant_id = CAST(:t AS uuid)
                          AND a3.contact_id = p.contact_id
                          AND a3.status = 'completed'
                          AND a3.start_ts > p.gloss_ts
                          AND a3.start_ts <= p.gloss_ts + 84*86400
                      )
                    )
                    SELECT c.contact_id, c.lifetime_cents, c.last_visit
                    FROM no_rebook12 nr
                    JOIN contacts c ON c.tenant_id = CAST(:t AS uuid) AND c.contact_id = nr.contact_id
                    ORDER BY c.lifetime_cents DESC
                    LIMIT :lim
                    """
                )
                lim = max(1, min(int(p.get("top", p.get("limit", 10))), 100))
                rows = conn.execute(q, {"t": tenant_id, "lim": lim}).fetchall()
                return {"status": "ok", "rows": [dict(r._mapping) for r in rows]}
            return {"status": "not_implemented", "name": n}
    except Exception as e:
        return {"status": "error", "detail": str(e)[:200]}


# ---------------------- Report generation (CSV) ----------------------

def _rows_to_csv(rows: list[dict], header_order: Optional[list[str]] = None) -> str:
    buffer = io.StringIO()
    if not rows:
        return ""
    cols = header_order or list(rows[0].keys())
    writer = csv.DictWriter(buffer, fieldnames=cols)
    writer.writeheader()
    for r in rows:
        writer.writerow({k: r.get(k) for k in cols})
    return buffer.getvalue()


async def tool_report_generate_csv(
    db: Session,
    ctx: UserContext,
    tenant_id: str,
    source: str,
    params: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    # For now, support named-query backed CSV
    if source == "db.query.named":
        name = str((params or {}).get("name", ""))
        qparams = (params or {}).get("params") if isinstance((params or {}).get("params"), dict) else {}
        result = await tool_db_query_named(db, ctx, tenant_id, name=name, params=qparams)
        if result.get("status") != "ok":
            return result
        rows = result.get("rows") or []
        if not isinstance(rows, list):
            return {"status": "error", "detail": "rows_not_list"}
        csv_text = _rows_to_csv(rows)
        # Persist a signed download token
        token = _secrets.token_urlsafe(16)
        filename = f"report_{name.replace('.', '_')}.csv"
        try:
            with engine.begin() as conn:
                conn.execute(
                    _sql_text(
                        """
                        CREATE TABLE IF NOT EXISTS share_reports (
                          id BIGSERIAL PRIMARY KEY,
                          tenant_id UUID NOT NULL,
                          token TEXT NOT NULL,
                          mime TEXT NOT NULL,
                          filename TEXT NOT NULL,
                          data_text TEXT NOT NULL,
                          created_at TIMESTAMPTZ DEFAULT NOW()
                        );
                        """
                    )
                )
                conn.execute(
                    _sql_text(
                        "INSERT INTO share_reports (tenant_id, token, mime, filename, data_text) VALUES (CAST(:t AS uuid), :tok, :m, :fn, :dt)"
                    ),
                    {"t": tenant_id, "tok": token, "m": "text/csv", "fn": filename, "dt": csv_text},
                )
        except Exception:
            # Fallback: return inline CSV if persistence failed
            return {"status": "ok", "mime": "text/csv", "filename": filename, "csv": csv_text}
        base_api = os.getenv("BACKEND_BASE_URL", "").rstrip("/")
        url = f"{base_api}/reports/download/{token}" if base_api else f"/reports/download/{token}"
        return {"status": "ok", "mime": "text/csv", "filename": filename, "csv": csv_text, "url": url}
    return {"status": "not_implemented"}
# Extend registry with CRM tools
REGISTRY.update(
    {
        "contacts.list.top_ltv": tool_contacts_list_top_ltv,
        "contacts.import.square": tool_contacts_import_square,  # async
        "db.query.sql": tool_db_query_sql,
        "db.query.named": tool_db_query_named,
        "report.generate.csv": tool_report_generate_csv,
    }
)


# ---------------------- Tool Registry Metadata & Schema ----------------------

TOOL_META: Dict[str, Dict[str, Any]] = {
    "draft_message": {"public": True, "description": "Draft a first outreach message respecting consent and tone.", "params": {"tenant_id": "string", "contact_id": "string", "channel": {"enum": ["sms", "email"]}, "service": "string?"}},
    "pricing_model": {"public": True, "description": "Compute effective hourly and margin from inputs.", "params": {"tenant_id": "string", "price": "number", "product_cost": "number", "service_time_minutes": "number"}},
    "safety_check": {"public": True, "description": "Review text for compliance/PII and suggest safe rewrites.", "params": {"tenant_id": "string", "text": "string"}},
    "propose_next_cadence_step": {"public": True, "description": "Propose the next cadence step for a contact.", "params": {"tenant_id": "string", "contact_id": "string", "cadence_id": "string"}},
    "contacts.dedupe": {"public": True, "description": "Mark duplicate contacts as deleted by matching email/phone.", "params": {"tenant_id": "string"}},
    "contacts.list.top_ltv": {"public": True, "description": "List top contacts by lifetime value.", "params": {"tenant_id": "string", "limit": "number?"}},
    "contacts.import.square": {"public": True, "description": "Import contacts from Square.", "params": {"tenant_id": "string"}},
    "square.backfill": {"public": True, "description": "Backfill Square payments metrics to contacts.", "params": {"tenant_id": "string"}},
    "crm.hubspot.import": {"public": True, "description": "Import sample contacts from HubSpot.", "params": {"tenant_id": "string"}},
    "oauth.refresh": {"public": True, "description": "Refresh an OAuth provider token.", "params": {"tenant_id": "string", "provider": "string"}},
    "connectors.cleanup": {"public": True, "description": "Cleanup blank/invalid connector rows (v2).", "params": {"tenant_id": "string"}},
    "connectors.normalize": {"public": True, "description": "Migrate legacy connectors and dedupe v2.", "params": {"tenant_id": "string"}},
    "calendar.sync": {"public": True, "description": "Sync unified calendar (Google/Apple/bookings).", "params": {"tenant_id": "string", "provider": "string?"}},
    "calendar.merge": {"public": True, "description": "Merge duplicate calendar events by title/time.", "params": {"tenant_id": "string"}},
    "campaigns.dormant.preview": {"public": True, "description": "Preview dormant segment size by threshold.", "params": {"tenant_id": "string", "threshold_days": "number?"}},
    "campaigns.dormant.start": {"public": True, "description": "Start dormant outreach cadence for candidates.", "params": {"tenant_id": "string", "threshold_days": "number?"}},
    "appointments.schedule_reminders": {"public": True, "description": "Schedule reminder triggers (7d/3d/1d/0).", "params": {"tenant_id": "string"}},
    "inventory.alerts.get": {"public": True, "description": "Fetch low-stock items.", "params": {"tenant_id": "string", "low_stock_threshold": "number?"}},
    "export.contacts": {"public": True, "description": "Export contacts CSV.", "params": {"tenant_id": "string"}},
    "social.schedule.14days": {"public": True, "description": "Draft social content plan for 14 days.", "params": {"tenant_id": "string"}},
    "db.query.sql": {"public": True, "description": "Run a read-only SQL select against allow-listed tables.", "params": {"tenant_id": "string", "sql": "string", "limit": "number?"}},
    "db.query.named": {"public": True, "description": "Run a named, read-only query.", "params": {"tenant_id": "string", "name": "string", "params": "object?"}},
    "report.generate.csv": {"public": True, "description": "Generate a CSV for a supported source (named query).", "params": {"tenant_id": "string", "source": "string", "params": "object?"}},
}


def tools_schema() -> Dict[str, Any]:
    out: List[Dict[str, Any]] = []
    for name, meta in TOOL_META.items():
        out.append({
            "name": name,
            "public": bool(meta.get("public", True)),
            "description": meta.get("description", ""),
            "params": meta.get("params", {}),
        })
    return {"version": "v1", "tools": out}
