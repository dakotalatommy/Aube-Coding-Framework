from typing import List, Dict
import time
from sqlalchemy.orm import Session
from . import models as dbm


NEVER_ANSWERED_STEPS: List[Dict[str, str | int]] = [
    {"day": 2, "channel": "sms"},
    {"day": 5, "channel": "email"},
    {"day": 9, "channel": "email"},
    {"day": 12, "channel": "email"},
    {"day": 17, "channel": "email"},
    {"day": 20, "channel": "email"},
    {"day": 23, "channel": "email"},
    {"day": 28, "channel": "email"},
]


RETARGETING_NO_ANSWER: List[Dict[str, str | int]] = [
    {"day": 60, "channel": "sms"},
]


def get_cadence_definition(cadence_id: str) -> List[Dict[str, str | int]]:
    if cadence_id == "never_answered":
        return NEVER_ANSWERED_STEPS
    if cadence_id == "retargeting_no_answer":
        return RETARGETING_NO_ANSWER
    return []


def schedule_initial_next_action(db: Session, tenant_id: str, contact_id: str, cadence_id: str) -> None:
    steps = get_cadence_definition(cadence_id)
    if not steps:
        return
    # set next_action_epoch to now + first step day delay
    first = steps[0]
    delay_days = int(first.get("day", 0))
    next_epoch = int(time.time()) + delay_days * 86400
    state = (
        db.query(dbm.CadenceState)
        .filter(
            dbm.CadenceState.tenant_id == tenant_id,
            dbm.CadenceState.contact_id == contact_id,
            dbm.CadenceState.cadence_id == cadence_id,
        )
        .first()
    )
    if state:
        state.next_action_epoch = next_epoch
        db.commit()


