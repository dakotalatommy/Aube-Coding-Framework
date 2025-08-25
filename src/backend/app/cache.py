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


def cache_incr(key: str, by: int = 1, expire_seconds: int = 86400) -> int:
    """Increment an integer counter with TTL. Returns the new value."""
    c = _client()
    if c:
        try:
            v = c.incrby(key, by)
            # Ensure TTL set at least once
            if c.ttl(key) < 0:
                c.expire(key, expire_seconds)
            return int(v)
        except Exception:
            pass
    # Fallback to memory map
    cur = 0
    now = time.time()
    entry = _mem.get(key)
    if entry and entry.get("exp", 0) > now:
        try:
            cur = int(entry.get("val") or 0)
        except Exception:
            cur = 0
    cur += by
    _mem[key] = {"val": cur, "exp": now + expire_seconds}
    return cur


# Simple circuit breaker helpers ------------------------------------------------
def breaker_allow(name: str) -> bool:
    """Return True if the circuit is closed (allowed), False if open."""
    key = f"cb_open:{name}"
    v = cache_get(key)
    return not bool(v)


def breaker_on_result(name: str, ok: bool, fail_threshold: int = 3, cool_seconds: int = 60) -> None:
    """Track success/failure and open the circuit if failures exceed threshold within window."""
    if ok:
        try:
            cache_del(f"cb_fail:{name}")
        except Exception:
            pass
        return
    # failure path
    try:
        fails = cache_incr(f"cb_fail:{name}", 1, expire_seconds=cool_seconds)
        if fails >= fail_threshold:
            cache_set(f"cb_open:{name}", True, ttl=cool_seconds)
    except Exception:
        pass




