import hashlib
import time
from typing import Dict, Any, Optional
from ..events import emit_event


def _make_idempotency_key(tenant_id: str, obj_type: str, attrs: Dict[str, Any], provided: Optional[str]) -> str:
    if provided:
        return provided
    base = f"{tenant_id}:{obj_type}:{attrs.get('email') or attrs.get('phone') or attrs.get('id') or ''}"
    return hashlib.sha256(base.encode()).hexdigest()


def upsert(tenant_id: str, obj_type: str, attrs: Dict[str, Any], idempotency_key: Optional[str] = None) -> Dict[str, Any]:
    key = _make_idempotency_key(tenant_id, obj_type, attrs, idempotency_key)
    # Simulated retry/backoff on transient error (placeholder)
    for attempt in range(3):
        try:
            # pretend remote call succeeds
            external_id = hashlib.md5(key.encode()).hexdigest()[:12]
            emit_event(
                "CrmSyncComplete",
                {
                    "tenant_id": tenant_id,
                    "system": "hubspot",
                    "type": obj_type,
                    "external_id": external_id,
                    "idempotency_key": key,
                },
            )
            return {"external_id": external_id, "status": "ok"}
        except Exception:
            # exponential backoff with jitter (placeholder)
            delay = (0.25 * (2 ** attempt)) + (hash(key) % 50) / 1000.0
            time.sleep(delay)
    return {"status": "error", "idempotency_key": key}


