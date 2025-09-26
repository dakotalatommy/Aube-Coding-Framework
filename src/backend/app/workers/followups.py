"""Background worker for follow-up drafting jobs."""
from __future__ import annotations

import asyncio
import json
import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import text as _sql_text

from ..ai import AIClient
from ..db import SessionLocal, engine
from ..events import emit_event
from ..jobs import get_job_record, update_job_record
from .. import models as dbm

try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover
    ZoneInfo = None  # type: ignore

logger = logging.getLogger("workers.followups")


def _acquire_job_id() -> Optional[str]:
    with engine.begin() as conn:
        row = conn.execute(
            _sql_text(
                """
                WITH pending AS (
                    SELECT id
                    FROM jobs
                    WHERE kind = 'followups.draft'
                      AND status IN ('queued', 'running')
                      AND (locked_at IS NULL OR locked_at < NOW() - INTERVAL '2 minutes')
                    ORDER BY created_at ASC
                    LIMIT 1
                    FOR UPDATE SKIP LOCKED
                )
                UPDATE jobs
                SET status = 'running', locked_at = NOW(), updated_at = NOW()
                WHERE id = (SELECT id FROM pending)
                RETURNING id::text
                """
            )
        ).fetchone()
    return str(row[0]) if row else None


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


def _load_contacts(session, tenant_id: str, payload: Dict[str, Any], tzinfo: timezone) -> List[Dict[str, Any]]:
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


def _build_prompt(payload: Dict[str, Any], contacts: List[Dict[str, Any]]) -> str:
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


def _update_todo_details(todo_id: int, tenant_id: str, updater: Dict[str, Any]) -> None:
    with engine.begin() as conn:
        try:
            conn.execute(_sql_text("SET LOCAL app.role='owner_admin'"))
            conn.execute(_sql_text("SET LOCAL app.tenant_id=:t"), {"t": tenant_id})
        except Exception:
            pass
        current = conn.execute(
            _sql_text(
                "SELECT details_json FROM todo_items WHERE tenant_id = CAST(:t AS uuid) AND id = :id"
            ),
            {"t": tenant_id, "id": todo_id},
        ).fetchone()
        details = {}
        if current and current[0]:
            try:
                details = json.loads(current[0])
            except Exception:
                details = {}
        details.update(updater)
        conn.execute(
            _sql_text(
                "UPDATE todo_items SET details_json = :details WHERE tenant_id = CAST(:t AS uuid) AND id = :id"
            ),
            {"details": json.dumps(details), "t": tenant_id, "id": todo_id},
        )


def _process_job(job_id: str) -> None:
    record = get_job_record(job_id)
    if not record:
        return
    tenant_id = record.get("tenant_id")
    payload_raw = record.get("input")
    if isinstance(payload_raw, str):
        try:
            payload = json.loads(payload_raw)
        except Exception:
            payload = {}
    else:
        payload = payload_raw or {}

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
    if not tenant_id or not todo_id:
        update_job_record(job_id, status="error", error="missing_payload_fields")
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
        _update_todo_details(todo_id_int, tenant_id, {"draft_status": "error", "error": "no_contacts"})
        return

    _update_todo_details(todo_id_int, tenant_id, {"draft_status": "running", "job_status": "running"})

    prompt = _build_prompt(payload, contacts)
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
            },
        )
        _update_todo_details(
            todo_id_int,
            tenant_id,
            {
                "draft_status": "ready",
                "job_status": "done",
                "draft_markdown": markdown,
                "generated_at": generated_at,
                "contact_ids": [c["contact_id"] for c in contacts],
            },
        )
        try:
            emit_event(
                "FollowupsDraftGenerated",
                {
                    "tenant_id": tenant_id,
                    "todo_id": todo_id_int,
                    "count": len(contacts),
                    "template_id": payload.get("template_id"),
                },
            )
        except Exception:
            pass
    else:
        update_job_record(job_id, status="error", error=error_detail or "draft_failed")
        _update_todo_details(
            todo_id_int,
            tenant_id,
            {
                "draft_status": "error",
                "job_status": "error",
                "error": error_detail or "draft_failed",
            },
        )


def run_once() -> bool:
    job_id = _acquire_job_id()
    if not job_id:
        return False
    try:
        _process_job(job_id)
    except Exception:
        logger.exception("followups_worker_job_failed", extra={"job_id": job_id})
        update_job_record(job_id, status="error", error="worker_exception")
    return True


def run_forever(sleep_seconds: float = 2.0) -> None:
    logger.info("Follow-ups worker started")
    while True:
        processed = False
        try:
            processed = run_once()
        except Exception:
            logger.exception("followups_worker_loop_error")
        if not processed:
            time.sleep(sleep_seconds)


if __name__ == "__main__":  # pragma: no cover
    logging.basicConfig(level=logging.INFO)
    run_forever()
