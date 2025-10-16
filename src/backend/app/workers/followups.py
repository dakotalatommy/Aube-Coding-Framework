"""Background worker for asynchronous BrandVX jobs."""
from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid as _uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import text as _sql_text, func as _sql_func
from sqlalchemy.orm import Session

from ..ai import AIClient
from ..db import SessionLocal, engine
from ..events import emit_event
from ..jobs import get_job_record, update_job_record
from .. import models as dbm
from ..integrations import booking_acuity

try:
    from zoneinfo import ZoneInfo  # type: ignore
except ImportError:  # pragma: no cover
    ZoneInfo = None  # type: ignore

logger = logging.getLogger("workers.jobs")

SUPPORTED_KINDS: Tuple[str, ...] = (
    "followups.draft",
    "onboarding.insights",
    "inventory.sync",
    "calendar.sync",
    "bookings.acuity.import",
)


def _supported_in_clause() -> str:
    return ", ".join(f"'{k}'" for k in SUPPORTED_KINDS)


def _acquire_job_id() -> Optional[Tuple[str, Optional[str]]]:
    kinds_clause = _supported_in_clause()
    with engine.begin() as conn:
        try:
            conn.execute(_sql_text("SELECT set_config('app.role', :role, true)"), {"role": "owner_admin"})
        except Exception:
            pass
        if engine.dialect.name == "postgresql":
            select_sql = _sql_text(
                f"""
                SELECT id::text, tenant_id::text
                FROM jobs
                WHERE kind IN ({kinds_clause})
                  AND status = 'queued'
                  AND (locked_at IS NULL OR locked_at < NOW() - INTERVAL '2 minutes')
                ORDER BY created_at ASC
                LIMIT 1
                FOR UPDATE SKIP LOCKED
                """
            )
            row = conn.execute(select_sql).fetchone()
            if not row:
                return None
            job_id, tenant_id = str(row[0]), (str(row[1]) if row[1] else None)
            if tenant_id:
                try:
                    conn.execute(
                        _sql_text("SELECT set_config('app.tenant_id', :tenant_id, true)"),
                        {"tenant_id": tenant_id},
                    )
                except Exception:
                    pass
            conn.execute(
                _sql_text(
                    "UPDATE jobs SET status = 'running', locked_at = NOW(), updated_at = NOW() WHERE id = :id"
                ),
                {"id": job_id},
            )
            return job_id, tenant_id
        else:
            # SQLite / other dialect fallback without SKIP LOCKED support
            row = conn.execute(
                _sql_text(
                    f"SELECT id, tenant_id FROM jobs WHERE kind IN ({kinds_clause}) AND status = 'queued' ORDER BY created_at ASC LIMIT 1"
                )
            ).fetchone()
            if not row:
                return None
            job_id = str(row[0])
            tenant_id = str(row[1]) if len(row) > 1 and row[1] else None
            if tenant_id:
                try:
                    conn.execute(
                        _sql_text("SELECT set_config('app.tenant_id', :tenant_id, true)"),
                        {"tenant_id": tenant_id},
                    )
                except Exception:
                    pass
            conn.execute(
                _sql_text(
                    "UPDATE jobs SET status = 'running', locked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = :id"
                ),
                {"id": job_id},
            )
            return job_id, tenant_id


def _render_time(dt: datetime) -> str:
    label = dt.strftime("%I:%M %p")
    return label.lstrip("0") or label


def _resolve_timezone(tz_name: Optional[str], offset_minutes: Optional[int]) -> timezone:
    if tz_name and ZoneInfo is not None:
        try:
            return ZoneInfo(tz_name)
        except Exception:
            pass
    if offset_minutes is not None:
        try:
            return timezone(timedelta(minutes=int(offset_minutes)))
        except Exception:
            pass
    return timezone.utc


def _calculate_time_phrases(start_ts: Optional[int], tzinfo: timezone) -> Dict[str, Optional[str]]:
    if not start_ts:
        return {"time_phrase": None, "day_phrase": None, "time_of_day": None, "iso_time": None}
    appt_dt = datetime.fromtimestamp(int(start_ts), tzinfo)
    now_dt = datetime.now(tzinfo)
    delta_days = (appt_dt.date() - now_dt.date()).days
    if delta_days == 0:
        day_phrase = "today"
    elif delta_days == 1:
        day_phrase = "tomorrow"
    else:
        day_phrase = appt_dt.strftime("%A")
    time_of_day = _render_time(appt_dt)
    time_phrase = f"{day_phrase} at {time_of_day}"
    return {
        "time_phrase": time_phrase,
        "day_phrase": day_phrase,
        "time_of_day": time_of_day,
        "iso_time": appt_dt.isoformat(),
    }


def _days_since(last_visit_ts: Optional[int], tzinfo: timezone) -> Optional[int]:
    if not last_visit_ts:
        return None
    visit_dt = datetime.fromtimestamp(int(last_visit_ts), tzinfo)
    now_dt = datetime.now(tzinfo)
    return max(0, (now_dt.date() - visit_dt.date()).days)


def _load_contacts(session: Session, tenant_id: str, payload: Dict[str, Any], tzinfo: timezone) -> List[Dict[str, Any]]:
    contacts_payload = payload.get("contacts") or []
    if not contacts_payload:
        return []
    contact_ids = [str(c.get("contact_id")) for c in contacts_payload if c.get("contact_id")]
    if not contact_ids:
        return []
    rows = (
        session.query(dbm.Contact)
        .filter(dbm.Contact.tenant_id == tenant_id, dbm.Contact.contact_id.in_(contact_ids))
        .all()
    )
    refreshed: Dict[str, dbm.Contact] = {str(r.contact_id): r for r in rows}

    contacts: List[Dict[str, Any]] = []
    for entry in contacts_payload:
        cid = str(entry.get("contact_id"))
        contact_row = refreshed.get(cid)
        display_name = (entry.get("display_name") or "").strip()
        if contact_row:
            candidate_name = (contact_row.display_name or "").strip()
            if not candidate_name:
                candidate_name = f"{(contact_row.first_name or '').strip()} {(contact_row.last_name or '').strip()}".strip()
            if candidate_name:
                display_name = candidate_name
        if not display_name:
            display_name = cid
        appointment_ts = entry.get("appointment_ts")
        last_visit_ts = entry.get("last_visit_ts")
        if contact_row and getattr(contact_row, "last_visit", None):
            try:
                last_visit_ts = int(contact_row.last_visit)
            except Exception:
                pass
        time_bits = _calculate_time_phrases(appointment_ts, tzinfo)
        days_since = _days_since(last_visit_ts, tzinfo)
        contacts.append(
            {
                "contact_id": cid,
                "name": display_name,
                "reason": entry.get("reason") or "",
                "appointment_ts": int(appointment_ts) if appointment_ts else None,
                "last_visit_ts": int(last_visit_ts) if last_visit_ts else None,
                "time_phrase": time_bits["time_phrase"],
                "day_phrase": time_bits["day_phrase"],
                "time_of_day": time_bits["time_of_day"],
                "iso_time": time_bits["iso_time"],
                "days_since_visit": days_since,
            }
        )
    return contacts


def _build_followups_prompt(payload: Dict[str, Any], contacts: List[Dict[str, Any]]) -> str:
    scope = payload.get("scope")
    template_label = payload.get("template_label") or scope or "Follow-ups"
    template_prompt = payload.get("template_prompt") or "Draft warm follow-up messages."
    variations = payload.get("template_variations") or []

    lines: List[str] = []
    lines.append("You are BrandVX, helping a beauty professional draft SMS follow-ups that feel personal, warm, and on-brand.")
    lines.append(f"Segment: {template_label} ({scope})")
    lines.append(f"Goal: {template_prompt}")
    if variations:
        lines.append("Style inspiration (do not copy verbatim; adapt naturally):")
        for sample in variations:
            lines.append(f"- {sample}")
    lines.append("\nInstructions:")
    lines.append("- Write 1-2 sentence SMS drafts per client.")
    lines.append("- Use the client's actual name and the visit timing provided.")
    lines.append("- Keep the tone warm, professional, and concise.")
    lines.append("- Do NOT include STOP/HELP or unsubscribe language.")
    lines.append("- Output Markdown with one section per client: '## Name' followed by the message.")

    lines.append("\nClient details:")
    for contact in contacts:
        lines.append(f"Client: {contact['name']}")
        if contact.get("time_phrase"):
            lines.append(f"- Visit: {contact['time_phrase']} ({contact.get('iso_time')})")
        elif contact.get("days_since_visit") is not None:
            lines.append(f"- Days since last visit: {contact['days_since_visit']}")
        if contact.get("reason"):
            lines.append(f"- Context: {contact['reason']}")
        lines.append("- Draft: <fill in>")
    lines.append("\nReturn only the Markdown document.")
    return "\n".join(lines)


def _update_todo_details(todo_id: int, tenant_id: str, updater: Dict[str, Any], todo_status: Optional[str] = None) -> None:
    with engine.begin() as conn:
        try:
            conn.execute(_sql_text("SET LOCAL app.role='owner_admin'"))
            conn.execute(_sql_text("SET LOCAL app.tenant_id=:t"), {"t": tenant_id})
        except Exception:
            pass
        row = conn.execute(
            _sql_text("SELECT details_json FROM todo_items WHERE tenant_id = CAST(:t AS uuid) AND id = :id"),
            {"t": tenant_id, "id": todo_id},
        ).fetchone()
        details = {}
        if row and row[0]:
            try:
                details = json.loads(row[0])
            except Exception:
                details = {}
        details.update(updater)
        if todo_status:
            conn.execute(
                _sql_text(
                    "UPDATE todo_items SET details_json = :details, status = :st WHERE tenant_id = CAST(:t AS uuid) AND id = :id"
                ),
                {"details": json.dumps(details), "st": todo_status, "t": tenant_id, "id": todo_id},
            )
        else:
            conn.execute(
                _sql_text(
                    "UPDATE todo_items SET details_json = :details WHERE tenant_id = CAST(:t AS uuid) AND id = :id"
                ),
                {"details": json.dumps(details), "t": tenant_id, "id": todo_id},
            )


def _sync_followups_chunk(
    todo_id: int,
    tenant_id: str,
    chunk_index: int,
    chunk_total: int,
    *,
    status: Optional[str] = None,
    markdown: Optional[str] = None,
    error: Optional[str] = None,
    generated_at: Optional[int] = None,
    contact_ids: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Merge chunk progress into todo details and return the updated details."""

    ready = False
    with engine.begin() as conn:
        try:
            conn.execute(_sql_text("SET LOCAL app.role='owner_admin'"))
            conn.execute(_sql_text("SET LOCAL app.tenant_id=:t"), {"t": tenant_id})
        except Exception:
            pass

        row = conn.execute(
            _sql_text("SELECT details_json, status FROM todo_items WHERE tenant_id = CAST(:t AS uuid) AND id = :id FOR UPDATE"),
            {"t": tenant_id, "id": todo_id},
        ).fetchone()
        details: Dict[str, Any] = {}
        current_status: Optional[str] = None
        if row:
            current_status = str(row[1]) if row[1] else None
            if row[0]:
                try:
                    details = json.loads(row[0]) or {}
                except Exception:
                    details = {}

        # Normalise chunk containers
        stored_total = int(details.get("chunk_total") or 0)
        chunk_total = max(chunk_total, stored_total, chunk_index + 1)
        chunks = details.get("chunks")
        if not isinstance(chunks, list):
            chunks = []
        if len(chunks) < chunk_total:
            chunks.extend([None] * (chunk_total - len(chunks)))

        chunk_status = details.get("chunk_status")
        if not isinstance(chunk_status, list):
            chunk_status = []
        if len(chunk_status) < chunk_total:
            chunk_status.extend(["queued"] * (chunk_total - len(chunk_status)))

        # Apply updates for this chunk
        if markdown is not None:
            chunks[chunk_index] = markdown.strip()
        if contact_ids is not None:
            chunk_contacts = details.get("chunk_contacts")
            if not isinstance(chunk_contacts, dict):
                chunk_contacts = {}
            chunk_contacts[str(chunk_index)] = list(contact_ids)
            details["chunk_contacts"] = chunk_contacts

        next_status = status
        if not next_status and error:
            next_status = "error"
        if next_status:
            chunk_status[chunk_index] = next_status

        details["chunks"] = chunks
        details["chunk_status"] = chunk_status
        details["chunk_total"] = chunk_total

        done_count = sum(1 for s in chunk_status if s == "done")
        details["chunk_done"] = done_count

        todo_status_override: Optional[str] = None

        if error:
            details["draft_status"] = "error"
            details["job_status"] = "error"
            details["error"] = error
            details["error_chunk"] = chunk_index
        else:
            if done_count >= chunk_total and chunk_total > 0:
                combined_sections = [section.strip() for section in chunks if isinstance(section, str) and section.strip()]
                combined_markdown = "\n\n".join(combined_sections).strip()
                details["draft_markdown"] = combined_markdown
                details["draft_status"] = "ready"
                details["job_status"] = "done"
                if generated_at:
                    details["generated_at"] = generated_at
                ready = True
                todo_status_override = "ready"
            else:
                # Intermediary progress
                details.pop("draft_markdown", None)
                details["draft_status"] = "running"
                details["job_status"] = "running"
                if generated_at:
                    details["generated_at"] = generated_at

        update_payload = {"details": json.dumps(details), "t": tenant_id, "id": todo_id}
        if todo_status_override:
            conn.execute(
                _sql_text(
                    "UPDATE todo_items SET details_json = :details, status = :st WHERE tenant_id = CAST(:t AS uuid) AND id = :id"
                ),
                {**update_payload, "st": todo_status_override},
            )
        else:
            conn.execute(
                _sql_text(
                    "UPDATE todo_items SET details_json = :details WHERE tenant_id = CAST(:t AS uuid) AND id = :id"
                ),
                update_payload,
            )

    if ready:
        details.setdefault("draft_status", "ready")
        details.setdefault("job_status", "done")
    return details


def _process_followups_job(job_id: str, record: Dict[str, Any], payload: Dict[str, Any]) -> None:
    tenant_id = str(record.get("tenant_id") or "")
    if not tenant_id:
        update_job_record(job_id, status="error", error="missing_tenant")
        return

    todo_id = payload.get("todo_id")
    if not todo_id:
        result_raw = record.get("result")
        if isinstance(result_raw, str):
            try:
                result_data = json.loads(result_raw)
            except Exception:
                result_data = {}
        elif isinstance(result_raw, dict):
            result_data = result_raw
        else:
            result_data = {}
        todo_id = result_data.get("todo_id")
    if not todo_id:
        update_job_record(job_id, status="error", error="missing_todo_id")
        return

    try:
        todo_id_int = int(todo_id)
    except Exception:
        update_job_record(job_id, status="error", error="invalid_todo_id")
        return

    tzinfo = _resolve_timezone(payload.get("tenant_timezone"), payload.get("tenant_timezone_offset"))

    session = SessionLocal()
    try:
        contacts = _load_contacts(session, tenant_id, payload, tzinfo)
    finally:
        session.close()

    if not contacts:
        update_job_record(job_id, status="error", error="no_contacts")
        _update_todo_details(todo_id_int, tenant_id, {"draft_status": "error", "job_status": "error", "error": "no_contacts"})
        return

    chunk_index = int(payload.get("chunk_index") or 0)
    chunk_total = int(payload.get("chunk_total") or 1)
    _sync_followups_chunk(
        todo_id_int,
        tenant_id,
        chunk_index,
        chunk_total,
        status="running",
    )

    prompt = _build_followups_prompt(payload, contacts)
    client = AIClient()
    markdown: Optional[str] = None
    error_detail: Optional[str] = None
    try:
        async def _generate() -> str:
            return await client.generate(
                system=(
                    "You are BrandVX writing personable SMS drafts for beauty clients. "
                    "Keep them concise, warm, and free of compliance footers."
                ),
                messages=[{"role": "user", "content": prompt}],
                max_tokens=800,
            )

        markdown = asyncio.run(_generate()).strip()
        if not markdown:
            error_detail = "empty_response"
    except Exception as exc:
        error_detail = str(exc)[:400]

    if markdown and not error_detail:
        generated_at = int(time.time())
        update_job_record(
            job_id,
            status="done",
            result={
                "todo_id": todo_id_int,
                "status": "done",
                "generated_at": generated_at,
                "contact_ids": [c["contact_id"] for c in contacts],
                "chunk_index": chunk_index,
                "chunk_total": chunk_total,
            },
        )
        _sync_followups_chunk(
            todo_id_int,
            tenant_id,
            chunk_index,
            chunk_total,
            status="done",
            markdown=markdown,
            generated_at=generated_at,
            contact_ids=[c["contact_id"] for c in contacts],
        )
        try:
            emit_event(
                "FollowupsDraftGenerated",
                {
                    "tenant_id": tenant_id,
                    "todo_id": todo_id_int,
                    "count": len(contacts),
                    "template_id": payload.get("template_id"),
                    "chunk_index": chunk_index,
                    "chunk_total": chunk_total,
                },
            )
        except Exception:
            pass
        
        # Auto-enroll contacts in cadence if configured (for "both" type workflows)
        # Only enroll on last chunk to avoid duplicates
        if chunk_index + 1 >= chunk_total:
            template_id = payload.get("template_id", "")
            cadence_id = None
            
            # Map template_id to cadence_id (matches WORKFLOW_CONFIGS in main.py)
            if template_id == "check_in_24h":
                cadence_id = "engaged_default"
            elif template_id == "winback_45d":
                cadence_id = "retargeting_no_answer"
            elif template_id == "reminder_week":
                cadence_id = "reminder_schedule"
            
            if cadence_id:
                try:
                    with engine.begin() as conn:
                        conn.execute(_sql_text("SET LOCAL app.role = 'owner_admin'"))
                        conn.execute(_sql_text("SET LOCAL app.tenant_id = :t"), {"t": tenant_id})
                        
                        for contact in contacts:
                            cid = contact.get("contact_id")
                            if cid:
                                # Enroll contact in cadence (3 days from now)
                                next_epoch = int(time.time()) + 3 * 86400
                                conn.execute(_sql_text("""
                                    INSERT INTO cadence_state (tenant_id, contact_id, cadence_id, step_index, next_action_epoch, created_at)
                                    VALUES (CAST(:t AS uuid), :cid, :cadence, 0, :next_epoch, NOW())
                                    ON CONFLICT (tenant_id, contact_id, cadence_id) DO NOTHING
                                """), {
                                    "t": tenant_id, 
                                    "cid": cid, 
                                    "cadence": cadence_id,
                                    "next_epoch": next_epoch
                                })
                except Exception as e:
                    logger.warning(f"Failed to enroll contacts in cadence {cadence_id}: {e}")
                    pass
    else:
        update_job_record(job_id, status="error", error=error_detail or "draft_failed")
        _sync_followups_chunk(
            todo_id_int,
            tenant_id,
            chunk_index,
            chunk_total,
            status="error",
            error=error_detail or "draft_failed",
        )


def _process_onboarding_insights_job(job_id: str, record: Dict[str, Any], payload: Dict[str, Any]) -> None:
    tenant_id = str(record.get("tenant_id") or "")
    if not tenant_id:
        update_job_record(job_id, status="error", error="missing_tenant")
        return
    todo_id_raw = payload.get("todo_id")
    if not todo_id_raw:
        result_raw = record.get("result")
        if isinstance(result_raw, str):
            try:
                result_data = json.loads(result_raw)
            except Exception:
                result_data = {}
        elif isinstance(result_raw, dict):
            result_data = result_raw
        else:
            result_data = {}
        todo_id_raw = result_data.get("todo_id")
    todo_id_int: Optional[int] = None
    if todo_id_raw is not None:
        try:
            todo_id_int = int(todo_id_raw)
        except Exception:
            todo_id_int = None
    horizon = int(payload.get("horizon_days") or 90)
    horizon = max(30, min(180, horizon))
    cutoff = int(time.time()) - horizon * 86400

    session = SessionLocal()
    summary: Dict[str, Any] = {
        "revenue_cents": 0,
        "horizon_days": horizon,
        "clients": [],
    }
    try:
        rows = (
            session.query(dbm.Contact)
            .filter(dbm.Contact.tenant_id == tenant_id, dbm.Contact.deleted == False)
            .order_by(dbm.Contact.lifetime_cents.desc())
            .limit(5)
            .all()
        )
        summary["clients"] = [
            {
                "contact_id": str(getattr(r, "contact_id", "unknown")),
                "display_name": (getattr(r, "display_name", None) or "").strip(),
                "first_name": getattr(r, "first_name", None),
                "last_name": getattr(r, "last_name", None),
                "txn_count": int(getattr(r, "txn_count", 0) or 0),
                "lifetime_cents": int(getattr(r, "lifetime_cents", 0) or 0),
                "last_visit": int(getattr(r, "last_visit", 0) or 0),
            }
            for r in rows
        ]
    except Exception:
        summary["clients"] = []
    try:
        total = session.query(_sql_func.sum(dbm.Contact.lifetime_cents)).filter(
            dbm.Contact.tenant_id == tenant_id,
            dbm.Contact.deleted == False,
            dbm.Contact.last_visit.isnot(None),
            dbm.Contact.last_visit >= cutoff,
        ).scalar()
        summary["revenue_cents"] = int(total or 0)
    except Exception:
        summary["revenue_cents"] = 0
    finally:
        session.close()

    if todo_id_int is not None:
        _update_todo_details(
            todo_id_int,
            tenant_id,
            {
                "job_status": "running",
                "insights_status": "running",
                "horizon_days": horizon,
            },
        )

    context_blob = json.dumps(summary, ensure_ascii=False)
    system = (
        "You are the BrandVX onboarding concierge."
        " Use the JSON context from the user message to produce a concise, upbeat recap."
        " Report revenue for the provided horizon (±$100 tolerance is acceptable)."
        " List the top three clients with visits, total spend, and a warm thank-you draft personalised with their name."
        " Do not ask follow-up questions or request clarification."
        " If data is missing, acknowledge it and suggest one actionable next step."
    )
    messages = [{"role": "user", "content": context_blob}]
    client = AIClient()
    insights_text: Optional[str] = None
    error_detail: Optional[str] = None
    try:
        async def _generate() -> str:
            return await client.generate(system, messages, max_tokens=520)

        insights_text = asyncio.run(_generate()).strip()
        if not insights_text:
            error_detail = "empty_response"
    except Exception as exc:
        error_detail = str(exc)[:400]

    if insights_text and not error_detail:
        generated_at = int(time.time())
        update_job_record(
            job_id,
            status="done",
            result={
                "todo_id": todo_id_int,
                "status": "done",
                "generated_at": generated_at,
                "horizon_days": horizon,
            },
        )
        if todo_id_int is not None:
            _update_todo_details(
                todo_id_int,
                tenant_id,
                {
                    "job_status": "done",
                    "insights_status": "ready",
                    "summary": summary,
                    "text": insights_text,
                    "generated_at": generated_at,
                },
            )
        try:
            emit_event("OnboardingInsightsReady", {"tenant_id": tenant_id, "horizon": horizon})
        except Exception:
            pass
    else:
        update_job_record(job_id, status="error", error=error_detail or "insights_failed")
        if todo_id_int is not None:
            _update_todo_details(
                todo_id_int,
                tenant_id,
                {
                    "job_status": "error",
                    "insights_status": "error",
                    "error": error_detail or "insights_failed",
                },
            )


def _process_inventory_sync_job(job_id: str, record: Dict[str, Any], payload: Dict[str, Any]) -> None:
    tenant_id = str(record.get("tenant_id") or "")
    if not tenant_id:
        update_job_record(job_id, status="error", error="missing_tenant")
        return
    todo_id_raw = payload.get("todo_id")
    if not todo_id_raw:
        result_raw = record.get("result")
        if isinstance(result_raw, str):
            try:
                result_data = json.loads(result_raw)
            except Exception:
                result_data = {}
        elif isinstance(result_raw, dict):
            result_data = result_raw
        else:
            result_data = {}
        todo_id_raw = result_data.get("todo_id")
    todo_id_int: Optional[int] = None
    if todo_id_raw is not None:
        try:
            todo_id_int = int(todo_id_raw)
        except Exception:
            todo_id_int = None

    provider = (payload.get("provider") or "auto").lower()
    providers: List[str]
    if provider in {"auto", "all", ""}:
        providers = ["square", "shopify"]
    else:
        providers = [provider]

    summaries: List[Dict[str, Any]] = []
    items_to_insert: List[Dict[str, Any]] = []
    now_ts = int(time.time())

    for prov in providers:
        try:
            if prov == "square":
                from ..integrations import inventory_square as inv_square  # lazy import

                snap = inv_square.fetch_inventory_snapshot(tenant_id)
            elif prov == "shopify":
                from ..integrations import inventory_shopify as inv_shopify  # type: ignore

                snap = inv_shopify.fetch_inventory_snapshot(tenant_id)
            else:
                snap = {"items": [], "summary": {}, "ts": now_ts}
        except Exception:
            snap = {"items": [], "summary": {}, "ts": now_ts}
        items = snap.get("items") or []
        summary = snap.get("summary") or {}
        summaries.append({"provider": prov, **summary})
        for item in items:
            items_to_insert.append({
                "provider": prov,
                "sku": str(item.get("sku") or ""),
                "name": str(item.get("name") or ""),
                "stock": int(item.get("stock") or 0),
            })

    tenant_uuid = _uuid.UUID(tenant_id)
    session = SessionLocal()
    try:
        with session.begin():
            session.query(dbm.InventoryItem).filter(dbm.InventoryItem.tenant_id == tenant_uuid).delete()
            for item in items_to_insert:
                session.add(
                    dbm.InventoryItem(
                        tenant_id=tenant_uuid,
                        sku=item["sku"] or None,
                        name=item["name"] or None,
                        stock=item["stock"],
                        provider=item["provider"],
                        updated_at=now_ts,
                    )
                )
            summary_row = session.query(dbm.InventorySummary).filter(dbm.InventorySummary.tenant_id == tenant_uuid).first()
            total_products = sum(int(s.get("products") or 0) for s in summaries) or len(items_to_insert)
            low_stock = sum(int(s.get("low_stock") or 0) for s in summaries)
            out_stock = sum(int(s.get("out_of_stock") or 0) for s in summaries)
            top_sku = None
            for s in summaries:
                candidate = s.get("top_sku")
                if candidate:
                    top_sku = str(candidate)
                    break
            if not summary_row:
                summary_row = dbm.InventorySummary(
                    tenant_id=tenant_uuid,
                    products=total_products,
                    low_stock=low_stock,
                    out_of_stock=out_stock,
                    top_sku=top_sku,
                    updated_at=now_ts,
                )
                session.add(summary_row)
            else:
                summary_row.products = total_products
                summary_row.low_stock = low_stock
                summary_row.out_of_stock = out_stock
                summary_row.top_sku = top_sku
                summary_row.updated_at = now_ts
        session.commit()
    except Exception as exc:
        session.rollback()
        update_job_record(job_id, status="error", error=str(exc)[:200] or "inventory_sync_failed")
        if todo_id_int is not None:
            _update_todo_details(
                todo_id_int,
                tenant_id,
                {"job_status": "error", "sync_status": "error", "error": str(exc)[:200]},
            )
        session.close()
        return
    session.close()

    update_job_record(
        job_id,
        status="done",
        result={
            "todo_id": todo_id_int,
            "status": "done",
            "provider": provider,
            "generated_at": now_ts,
        },
    )
    if todo_id_int is not None:
        _update_todo_details(
            todo_id_int,
            tenant_id,
            {
                "job_status": "done",
                "sync_status": "ready",
                "provider": provider,
                "summary": summaries,
                "generated_at": now_ts,
            },
        )
    try:
        emit_event("InventorySynced", {"tenant_id": tenant_id, "provider": provider, "items": len(items_to_insert)})
    except Exception:
        pass


def _process_calendar_sync_job(job_id: str, record: Dict[str, Any], payload: Dict[str, Any]) -> None:
    tenant_id = str(record.get("tenant_id") or "")
    if not tenant_id:
        update_job_record(job_id, status="error", error="missing_tenant")
        return
    todo_id_raw = payload.get("todo_id")
    if not todo_id_raw:
        result_raw = record.get("result")
        if isinstance(result_raw, str):
            try:
                result_data = json.loads(result_raw)
            except Exception:
                result_data = {}
        elif isinstance(result_raw, dict):
            result_data = result_raw
        else:
            result_data = {}
        todo_id_raw = result_data.get("todo_id")
    todo_id_int: Optional[int] = None
    if todo_id_raw is not None:
        try:
            todo_id_int = int(todo_id_raw)
        except Exception:
            todo_id_int = None

    provider = (payload.get("provider") or "auto").lower()
    events: List[Dict[str, Any]] = []
    try:
        if provider in {"auto", "google"}:
            from ..integrations import calendar_google as cal_google  # type: ignore

            events.extend(cal_google.fetch_events(tenant_id))
    except Exception:
        pass
    # scaffold events for other providers
    now_ts = int(time.time())
    if provider in {"auto", "square"}:
        events.append({
            "id": f"sq_{now_ts}",
            "title": "Square Booking",
            "start_ts": now_ts + 3600,
            "end_ts": now_ts + 7200,
            "provider": "square",
            "status": "confirmed",
        })
    if provider in {"auto", "acuity"}:
        events.append({
            "id": f"ac_{now_ts}",
            "title": "Acuity Consultation",
            "start_ts": now_ts + 10800,
            "end_ts": now_ts + 12600,
            "provider": "acuity",
            "status": "confirmed",
        })

    tenant_uuid = _uuid.UUID(tenant_id)
    session = SessionLocal()
    try:
        with session.begin():
            session.query(dbm.CalendarEvent).filter(dbm.CalendarEvent.tenant_id == tenant_uuid).delete()
            for ev in events:
                session.add(
                    dbm.CalendarEvent(
                        tenant_id=tenant_uuid,
                        event_id=str(ev.get("id") or ""),
                        title=str(ev.get("title") or "Event"),
                        start_ts=int(ev.get("start_ts") or now_ts),
                        end_ts=int(ev.get("end_ts") or 0) or None,
                        provider=str(ev.get("provider") or provider or "manual"),
                        status=str(ev.get("status") or ""),
                    )
                )
        session.commit()
    except Exception as exc:
        session.rollback()
        update_job_record(job_id, status="error", error=str(exc)[:200] or "calendar_sync_failed")
        if todo_id_int is not None:
            _update_todo_details(
                todo_id_int,
                tenant_id,
                {"job_status": "error", "sync_status": "error", "error": str(exc)[:200]},
            )
        session.close()
        return
    session.close()

    update_job_record(
        job_id,
        status="done",
        result={
            "todo_id": todo_id_int,
            "status": "done",
            "provider": provider,
            "generated_at": now_ts,
            "events": len(events),
        },
    )
    if todo_id_int is not None:
        _update_todo_details(
            todo_id_int,
            tenant_id,
            {
                "job_status": "done",
                "sync_status": "ready",
                "provider": provider,
                "events": len(events),
                "generated_at": now_ts,
            },
        )
    try:
        emit_event("CalendarSynced", {"tenant_id": tenant_id, "provider": provider, "count": len(events)})
    except Exception:
        pass


def _process_acuity_import_job(job_id: str, record: Dict[str, Any], payload: Dict[str, Any]) -> None:
    """Process Acuity import job in background."""
    tenant_id = str(payload.get("tenant_id") or record.get("tenant_id") or "")
    if not tenant_id:
        update_job_record(job_id, status="error", error="missing_tenant_id", tenant_id=None)
        return
    
    try:
        since = payload.get("since")
        until = payload.get("until")
        cursor = payload.get("cursor")
        page_limit = payload.get("page_limit")
        skip_appt_payments = payload.get("skip_appt_payments", True)
        
        result = booking_acuity.import_appointments(
            tenant_id=tenant_id,
            since=since,
            until=until,
            cursor=cursor,
            page_limit=page_limit,
            skip_appt_payments=skip_appt_payments,
        )
        
        update_job_record(job_id, status="done", result=result, tenant_id=tenant_id)
        logger.info(
            "acuity_import_completed",
            extra={
                "job_id": job_id,
                "tenant_id": tenant_id,
                "imported": result.get("imported", 0),
                "appointments_count": result.get("appointments_count", 0),
            },
        )
    except Exception as e:
        logger.exception("acuity_import_failed", extra={"job_id": job_id, "tenant_id": tenant_id})
        update_job_record(job_id, status="error", error=str(e)[:500], tenant_id=tenant_id)


def _process_job(job_id: str, tenant_id: Optional[str]) -> None:
    record = get_job_record(job_id, tenant_id=tenant_id)
    if not record:
        return
    record_tenant = tenant_id or (str(record.get("tenant_id")) if record.get("tenant_id") else None)
    kind = str(record.get("kind") or "")
    payload_raw = record.get("input")
    if isinstance(payload_raw, str):
        try:
            payload = json.loads(payload_raw)
        except Exception:
            payload = {}
    else:
        payload = payload_raw or {}

    if kind == "followups.draft":
        _process_followups_job(job_id, record, payload)
    elif kind == "onboarding.insights":
        _process_onboarding_insights_job(job_id, record, payload)
    elif kind == "inventory.sync":
        _process_inventory_sync_job(job_id, record, payload)
    elif kind == "calendar.sync":
        _process_calendar_sync_job(job_id, record, payload)
    elif kind == "bookings.acuity.import":
        _process_acuity_import_job(job_id, record, payload)
    else:
        update_job_record(job_id, status="error", error="unsupported_kind", tenant_id=record_tenant)


def run_once() -> bool:
    acquired = _acquire_job_id()
    if not acquired:
        return False
    job_id, tenant_id = acquired
    try:
        _process_job(job_id, tenant_id)
    except Exception:
        logger.exception("job_worker_failure", extra={"job_id": job_id})
        update_job_record(job_id, status="error", error="worker_exception", tenant_id=tenant_id)
    return True


def run_forever(sleep_seconds: float = 2.0) -> None:
    logger.info("Job worker started")
    while True:
        processed = False
        try:
            processed = run_once()
        except Exception:
            logger.exception("job_worker_loop_error")
        if not processed:
            time.sleep(sleep_seconds)


if __name__ == "__main__":  # pragma: no cover
    logging.basicConfig(level=logging.INFO)
    run_forever()
