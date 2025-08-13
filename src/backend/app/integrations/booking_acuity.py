import hashlib
import time
from typing import Dict, Any
from ..events import emit_event


def import_appointments(tenant_id: str, since: str | None = None, until: str | None = None, cursor: str | None = None) -> Dict[str, Any]:
    # Simulated import window
    count = 3
    emit_event(
        "AppointmentIngested",
        {"tenant_id": tenant_id, "external_ref": f"acuity:{hashlib.md5((since or '0').encode()).hexdigest()[:8]}", "dedup_key": cursor or ""},
    )
    # placeholder retry/backoff behavior
    time.sleep(0.1)
    return {"imported": count, "updated": 0, "skipped_duplicates": 0, "next_cursor": None}


