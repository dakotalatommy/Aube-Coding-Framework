from typing import Dict, Any
from sqlalchemy.orm import Session
from .events import emit_event
from . import models as dbm


def _is_suppressed(db: Session, tenant_id: str, contact_id: str, channel: str) -> bool:
    log = (
        db.query(dbm.ConsentLog)
        .filter(
            dbm.ConsentLog.tenant_id == tenant_id,
            dbm.ConsentLog.contact_id == contact_id,
            dbm.ConsentLog.channel == channel,
            dbm.ConsentLog.consent == "revoked",
        )
        .first()
    )
    return log is not None


def send_message(db: Session, tenant_id: str, contact_id: str, channel: str, template_id: str | None) -> Dict[str, Any]:
    if _is_suppressed(db, tenant_id, contact_id, channel):
        emit_event(
            "MessageFailed",
            {
                "tenant_id": tenant_id,
                "contact_id": contact_id,
                "channel": channel,
                "template_id": template_id,
                "failure_code": "suppressed",
            },
        )
        return {"status": "suppressed"}
    emit_event(
        "MessageQueued",
        {"tenant_id": tenant_id, "contact_id": contact_id, "channel": channel, "template_id": template_id},
    )
    emit_event(
        "MessageSent",
        {"tenant_id": tenant_id, "contact_id": contact_id, "channel": channel, "template_id": template_id},
    )
    return {"status": "sent"}


