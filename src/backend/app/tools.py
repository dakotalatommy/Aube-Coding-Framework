from typing import Any, Dict, Optional
from sqlalchemy.orm import Session
from .auth import UserContext
from . import models as dbm
from .ai import AIClient
from .brand_prompts import BRAND_SYSTEM, cadence_intro_prompt
from .cadence import get_cadence_definition
from .messaging import send_message
from sqlalchemy import text as _sql_text
from .db import engine
import math
import io
import csv
import time
import os
import httpx


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


# Extend registry with CRM tools
REGISTRY.update(
    {
        "contacts.list.top_ltv": tool_contacts_list_top_ltv,
        "contacts.import.square": tool_contacts_import_square,  # async
    }
)




