from typing import Dict, Any, Optional
import os
import hmac
import hashlib
import json
from sqlalchemy.orm import Session
from .events import emit_event
from . import models as dbm
from .integrations.sms_twilio import twilio_send_sms
from .integrations.email_sendgrid import sendgrid_send_email


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


def _has_opt_in(db: Session, tenant_id: str, contact_id: str, channel: str) -> bool:
    contact = (
        db.query(dbm.Contact)
        .filter(dbm.Contact.tenant_id == tenant_id, dbm.Contact.contact_id == contact_id)
        .first()
    )
    if not contact:
        return False
    if channel == "sms":
        return bool(contact.consent_sms)
    if channel == "email":
        return bool(contact.consent_email)
    return False


def send_message(
    db: Session,
    tenant_id: str,
    contact_id: str,
    channel: str,
    template_id: str | None,
    body: Optional[str] = None,
    subject: Optional[str] = None,
) -> Dict[str, Any]:
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
    if not _has_opt_in(db, tenant_id, contact_id, channel):
        emit_event(
            "MessageFailed",
            {
                "tenant_id": tenant_id,
                "contact_id": contact_id,
                "channel": channel,
                "template_id": template_id,
                "failure_code": "no_consent",
            },
        )
        return {"status": "no_consent"}
    emit_event(
        "MessageQueued",
        {"tenant_id": tenant_id, "contact_id": contact_id, "channel": channel, "template_id": template_id},
    )
    # Resolve destination (demo uses test overrides since we store hashes)
    to_sms = os.getenv("TEST_SMS_TO")
    to_email = os.getenv("TEST_EMAIL_TO")
    result: Dict[str, Any] = {"status": "queued"}
    try:
        if channel == "sms":
            if not to_sms:
                raise RuntimeError("no sms destination configured")
            r = twilio_send_sms(to_sms, body or "Hello from BrandVX")
            result.update(r)
        elif channel == "email":
            if not to_email:
                raise RuntimeError("no email destination configured")
            r = sendgrid_send_email(to_email, subject or "BrandVX Update", body or "<p>Hello from BrandVX</p>")
            result.update(r)
        else:
            raise RuntimeError("unknown channel")
        emit_event(
            "MessageSent",
            {
                "tenant_id": tenant_id,
                "contact_id": contact_id,
                "channel": channel,
                "template_id": template_id,
                "provider_id": result.get("provider_id"),
            },
        )
        return {"status": "sent", **result}
    except Exception as e:
        # Save dead letter for inspection
        db.add(
            dbm.DeadLetter(
                tenant_id=tenant_id,
                provider=channel,
                reason=str(e),
                attempts=1,
                payload=json.dumps({"contact_id": contact_id, "template_id": template_id})
            )
        )
        db.commit()
        emit_event(
            "MessageFailed",
            {
                "tenant_id": tenant_id,
                "contact_id": contact_id,
                "channel": channel,
                "template_id": template_id,
                "failure_code": "provider_error",
            },
        )
        return {"status": "failed"}


def verify_twilio_signature(url: str, payload: Dict[str, Any], signature: str) -> bool:
    auth = os.getenv("TWILIO_AUTH_TOKEN", "")
    if not auth:
        return False
    s = url + "".join([f"{k}{v}" for k, v in sorted(payload.items())])
    mac = hmac.new(auth.encode(), s.encode(), hashlib.sha1).digest()
    expected = mac
    # placeholder: in real impl compare against base64 signature header
    return bool(signature) and bool(expected)


