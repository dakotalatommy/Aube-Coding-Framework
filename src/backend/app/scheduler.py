import time
import os
from typing import Optional
import json
from sqlalchemy.orm import Session
from . import models as dbm
from .events import emit_event
from .metrics_counters import SCHED_TICKS  # type: ignore
from .messaging import send_message
from .cadence import get_cadence_definition
from . import models as dbm


def run_tick(db: Session, tenant_id: Optional[str] = None) -> int:
    now = int(time.time())
    quiet_start = int(os.getenv("QUIET_HOURS_START", "21"))  # 24h clock
    quiet_end = int(os.getenv("QUIET_HOURS_END", "8"))
    tz_offset = int(os.getenv("DEFAULT_TZ_OFFSET", "0"))  # hours offset from UTC
    # Try to use per-tenant timezone offset hint from settings.preferences.user_timezone_offset
    try:
        if tenant_id:
            row = db.query(dbm.Settings).filter(dbm.Settings.tenant_id == tenant_id).first()
            if row and row.data_json:
                data = json.loads(row.data_json)
                prefs = data.get("preferences") or {}
                # Expect frontend to compute offset in hours and save it; fallback to env
                tz_offset = int(prefs.get("user_timezone_offset", tz_offset))
    except Exception:
        pass
    # Configurable batch size per tick
    batch_limit = int(os.getenv("SCHEDULER_TICK_LIMIT", "200"))
    processed = 0
    while processed < batch_limit:
        q = db.query(dbm.CadenceState)
        if tenant_id:
            q = q.filter(dbm.CadenceState.tenant_id == tenant_id)
        q = q.filter(dbm.CadenceState.next_action_epoch != None, dbm.CadenceState.next_action_epoch <= now)
        remaining = batch_limit - processed
        batch = q.limit(max(1, remaining)).all()
        if not batch:
            break
        for cs in batch:
            # quiet hours check (rough per-tenant offset)
            local_hour = int(((now // 3600) + tz_offset) % 24)
            if quiet_start > quiet_end:
                in_quiet = local_hour >= quiet_start or local_hour < quiet_end
            else:
                in_quiet = quiet_start <= local_hour < quiet_end
            if in_quiet:
                # push to next allowed hour
                next_hour = (quiet_end - tz_offset) % 24
                next_epoch = (now // 3600 + ((next_hour - local_hour) % 24)) * 3600
                cs.next_action_epoch = next_epoch
                continue
            # Step-aware progression
            steps = get_cadence_definition(cs.cadence_id)
            if cs.step_index < len(steps):
                step = steps[cs.step_index]
                channel = str(step.get("channel", "sms"))
                send_message(db, cs.tenant_id, cs.contact_id, channel, None)
            cs.step_index += 1
            cs.next_action_epoch = None
            processed += 1
            emit_event(
                "CadenceStepCompleted",
                {"tenant_id": cs.tenant_id, "contact_id": cs.contact_id, "step_index": cs.step_index},
            )
        db.commit()
    try:
        scope = tenant_id or "all"
        SCHED_TICKS.labels(scope=scope).inc()  # type: ignore
    except Exception:
        pass
    return processed


def schedule_appointment_reminders(db: Session, tenant_id: Optional[str] = None) -> int:
    """Schedule sends for upcoming appointments according to 7d/3d/1d/2h with quiet-hours deferral.
    This function marks the related LeadStatus.next_action_at to trigger send on next run_tick.
    """
    now = int(time.time())
    quiet_start = int(os.getenv("QUIET_HOURS_START", "21"))
    quiet_end = int(os.getenv("QUIET_HOURS_END", "8"))
    tz_offset = int(os.getenv("DEFAULT_TZ_OFFSET", "0"))
    try:
        if tenant_id:
            row = db.query(dbm.Settings).filter(dbm.Settings.tenant_id == tenant_id).first()
            if row and row.data_json:
                data = json.loads(row.data_json)
                prefs = data.get("preferences") or {}
                tz_offset = int(prefs.get("user_timezone_offset", tz_offset))
    except Exception:
        pass
    processed = 0
    q = db.query(dbm.Appointment).filter(dbm.Appointment.status == "booked")
    if tenant_id:
        q = q.filter(dbm.Appointment.tenant_id == tenant_id)
    for appt in q.limit(100).all():
        for delta in [7*86400, 3*86400, 86400, 2*3600]:
            trigger = appt.start_ts - delta
            if trigger <= now:
                continue
            # quiet-hours deferral
            local_hour = int(((trigger // 3600) + tz_offset) % 24)
            if quiet_start > quiet_end:
                in_quiet = local_hour >= quiet_start or local_hour < quiet_end
            else:
                in_quiet = quiet_start <= local_hour < quiet_end
            if in_quiet:
                next_hour = (quiet_end - tz_offset) % 24
                trigger = (trigger // 3600 + ((next_hour - local_hour) % 24)) * 3600
            # set or create lead_status
            ls = (
                db.query(dbm.LeadStatus)
                .filter(dbm.LeadStatus.tenant_id == appt.tenant_id, dbm.LeadStatus.contact_id == appt.contact_id)
                .first()
            )
            if not ls:
                ls = dbm.LeadStatus(tenant_id=appt.tenant_id, contact_id=appt.contact_id, bucket=4, tag="reminder")
                db.add(ls)
            # set earliest next_action_at if empty or later than trigger
            if not ls.next_action_at or ls.next_action_at > trigger:
                ls.next_action_at = trigger
                processed += 1
    db.commit()
    return processed

