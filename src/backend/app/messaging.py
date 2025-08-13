from typing import Dict, Any
from .events import emit_event


def send_message(tenant_id: str, contact_id: str, channel: str, template_id: str | None) -> Dict[str, Any]:
    # policy checks (consent should be pre-enforced)
    emit_event(
        "MessageQueued",
        {"tenant_id": tenant_id, "contact_id": contact_id, "channel": channel, "template_id": template_id},
    )
    emit_event(
        "MessageSent",
        {"tenant_id": tenant_id, "contact_id": contact_id, "channel": channel, "template_id": template_id},
    )
    return {"status": "sent"}


