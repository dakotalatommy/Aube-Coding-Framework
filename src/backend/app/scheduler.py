import time
import os
from typing import Optional
from sqlalchemy.orm import Session
from . import models as dbm
from .events import emit_event
from .messaging import send_message
from .cadence import get_cadence_definition


def run_tick(db: Session, tenant_id: Optional[str] = None) -> int:
    now = int(time.time())
    quiet_start = int(os.getenv("QUIET_HOURS_START", "21"))  # 24h clock
    quiet_end = int(os.getenv("QUIET_HOURS_END", "8"))
    tz_offset = int(os.getenv("DEFAULT_TZ_OFFSET", "0"))  # hours offset from UTC
    q = db.query(dbm.CadenceState)
    if tenant_id:
        q = q.filter(dbm.CadenceState.tenant_id == tenant_id)
    q = q.filter(dbm.CadenceState.next_action_epoch != None, dbm.CadenceState.next_action_epoch <= now)
    processed = 0
    for cs in q.limit(50).all():
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
    return processed


