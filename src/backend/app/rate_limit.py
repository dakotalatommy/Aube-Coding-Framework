import os
import time
from typing import Tuple

_rl_cache = {}

try:
    import redis  # type: ignore
    _redis = redis.Redis.from_url(os.getenv("REDIS_URL", ""), decode_responses=True) if os.getenv("REDIS_URL") else None
except Exception:
    _redis = None


def _get_multiplier(tenant_id: str) -> int:
    try:
        if _redis is not None:
            v = _redis.get(f"tenant:{tenant_id}:rl_multiplier")
            if v:
                return max(1, int(v))
    except Exception:
        pass
    return 1


def set_multiplier_cache(tenant_id: str, value: int) -> None:
    try:
        if _redis is not None:
            _redis.setex(f"tenant:{tenant_id}:rl_multiplier", 3600, max(1, int(value)))
    except Exception:
        pass


def check_and_increment(tenant_id: str, key: str, max_per_minute: int = 60, burst: int = 30) -> Tuple[bool, int]:
    """Sliding-window-ish limiter with a small burst allowance.
    Uses current minute bucket + allows an extra burst count.
    Applies a per-tenant multiplier if configured (creator mode, etc.).
    """
    mult = _get_multiplier(tenant_id)
    eff_limit = max_per_minute * mult
    eff_burst = burst * mult
    now = int(time.time() // 60)
    bucket = f"rl:{tenant_id}:{key}:{now}"
    if _redis is not None:
        try:
            val = _redis.incr(bucket)
            if val == 1:
                _redis.expire(bucket, 65)
            if val > eff_limit + eff_burst:
                return False, val
            return True, val
        except Exception:
            pass
    # Fallback in-memory
    count = _rl_cache.get(bucket, 0)
    if count >= eff_limit + eff_burst:
        return False, count
    _rl_cache[bucket] = count + 1
    return True, count + 1


