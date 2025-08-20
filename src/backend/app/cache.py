import os, json, time
from typing import Optional, Any
try:
    import redis  # type: ignore
except Exception:
    redis = None

_mem: dict[str, dict[str, Any]] = {}
_client_singleton = None

def _client():
    global _client_singleton
    if _client_singleton is not None:
        return _client_singleton
    url = os.getenv("REDIS_URL")
    if not url or redis is None:
        _client_singleton = None
        return None
    try:
        _client_singleton = redis.Redis.from_url(url, decode_responses=True)
    except Exception:
        _client_singleton = None
    return _client_singleton

def cache_get(key: str) -> Optional[Any]:
    c = _client()
    if c:
        try:
            v = c.get(key)
            return json.loads(v) if v else None
        except Exception:
            pass
    v = _mem.get(key)
    if v and v.get("exp", 0) > time.time():
        return v.get("val")
    return None

def cache_set(key: str, val: Any, ttl: int = 60) -> None:
    c = _client()
    s = json.dumps(val)
    if c:
        try:
            c.setex(key, ttl, s)
            return
        except Exception:
            pass
    _mem[key] = {"val": val, "exp": time.time() + ttl}

def cache_del(key: str) -> None:
    c = _client()
    if c:
        try:
            c.delete(key)
            return
        except Exception:
            pass
    _mem.pop(key, None)




