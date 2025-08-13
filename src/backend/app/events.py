from datetime import datetime
from typing import Dict, Any
import os

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


