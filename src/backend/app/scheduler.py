import time
from typing import Optional
from sqlalchemy.orm import Session
from . import models as dbm
from .events import emit_event
from .messaging import send_message


def run_tick(db: Session, tenant_id: Optional[str] = None) -> int:
    now = int(time.time())
    q = db.query(dbm.CadenceState)
    if tenant_id:
        q = q.filter(dbm.CadenceState.tenant_id == tenant_id)
    q = q.filter(dbm.CadenceState.next_action_epoch != None, dbm.CadenceState.next_action_epoch <= now)
    processed = 0
    for cs in q.limit(50).all():
        # Simplified step progression
        send_message(db, cs.tenant_id, cs.contact_id, "sms", None)
        cs.step_index += 1
        cs.next_action_epoch = None
        processed += 1
        emit_event(
            "CadenceStepCompleted",
            {"tenant_id": cs.tenant_id, "contact_id": cs.contact_id, "step_index": cs.step_index},
        )
    db.commit()
    return processed


