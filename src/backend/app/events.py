from datetime import datetime
from typing import Dict, Any
import os
import json
from sqlalchemy import text as _sa_text

_redis_client = None


def _get_redis():
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    url = os.getenv("REDIS_URL")
    if not url:
        return None
    try:
        import redis  # type: ignore

        _redis_client = redis.Redis.from_url(url, decode_responses=True)
        # ping once
        _redis_client.ping()
    except Exception:
        _redis_client = None
    return _redis_client


def emit_event(name: str, payload: Dict[str, Any]) -> None:
    event = {
        "name": name,
        "ts": datetime.utcnow().isoformat(),
        "payload": payload,
    }
    # stdout
    print(f"EVENT {event['ts']} {name}: {payload}")
    # optional Redis publish
    client = _get_redis()
    if client is not None:
        try:
            client.publish("brandvx.events", str(event))
        except Exception:
            pass
    # optional DB write to events_ledger if available
    try:
        from .db import engine  # local import to avoid circulars at startup
        tenant_id = str(payload.get("tenant_id", ""))
        ts_epoch = int(__import__("time").time())
        with engine.begin() as conn:
            conn.execute(
                _sa_text("INSERT INTO events_ledger (ts, tenant_id, name, payload) VALUES (:ts, :tenant_id, :name, :payload)"),
                {
                    "ts": ts_epoch,
                    "tenant_id": tenant_id,
                    "name": name,
                    "payload": json.dumps(payload),
                },
            )
    except Exception:
        pass


