import os
import time
from typing import Tuple

_rl_cache = {}

try:
    import redis  # type: ignore
    _redis = redis.Redis.from_url(os.getenv("REDIS_URL", ""), decode_responses=True) if os.getenv("REDIS_URL") else None
except Exception:
    _redis = None


def check_and_increment(tenant_id: str, key: str, max_per_minute: int = 60) -> Tuple[bool, int]:
    now = int(time.time() // 60)
    bucket = f"rl:{tenant_id}:{key}:{now}"
    if _redis is not None:
        try:
            val = _redis.incr(bucket)
            if val == 1:
                _redis.expire(bucket, 65)
            if val > max_per_minute:
                return False, val
            return True, val
        except Exception:
            pass
    # Fallback in-memory
    count = _rl_cache.get(bucket, 0)
    if count >= max_per_minute:
        return False, count
    _rl_cache[bucket] = count + 1
    return True, count + 1


