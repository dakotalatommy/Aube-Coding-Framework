import os
import time
from typing import Tuple

_rl_cache = {}


def check_and_increment(tenant_id: str, key: str, max_per_minute: int = 60) -> Tuple[bool, int]:
    now = int(time.time() // 60)
    bucket = f"{tenant_id}:{key}:{now}"
    count = _rl_cache.get(bucket, 0)
    if count >= max_per_minute:
        return False, count
    _rl_cache[bucket] = count + 1
    return True, count + 1


