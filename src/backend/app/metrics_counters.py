from typing import Any
try:
    from prometheus_client import Counter  # type: ignore
except Exception:  # pragma: no cover
    Counter = None  # type: ignore

if Counter is not None:
    try:
        CACHE_HIT = Counter("brandvx_cache_hits_total", "Cache hits", ["endpoint"])  # type: ignore
        CACHE_MISS = Counter("brandvx_cache_misses_total", "Cache misses", ["endpoint"])  # type: ignore
        WEBHOOK_EVENTS = Counter("brandvx_webhook_events_total", "Webhook events processed", ["provider", "status"])  # type: ignore
        SCHED_TICKS = Counter("brandvx_scheduler_ticks_total", "Scheduler ticks processed", ["scope"])  # type: ignore
    except Exception:  # pragma: no cover
        class _Dummy:
            def labels(self, *_, **__):
                return self
            def inc(self, *_a, **_kw):
                pass
            _metrics: dict[str, Any] = {}
        CACHE_HIT = CACHE_MISS = WEBHOOK_EVENTS = SCHED_TICKS = _Dummy()  # type: ignore
else:  # pragma: no cover
    class _Dummy:
        def labels(self, *_, **__):
            return self
        def inc(self, *_a, **_kw):
            pass
        _metrics: dict[str, Any] = {}
    CACHE_HIT = CACHE_MISS = WEBHOOK_EVENTS = SCHED_TICKS = _Dummy()  # type: ignore


def sum_counter(counter: Any) -> int:
    try:
        total = 0.0
        metrics = getattr(counter, "_metrics", {})
        if isinstance(metrics, dict):
            for child in metrics.values():
                try:
                    val = getattr(child, "_value").get()
                    total += float(val)
                except Exception:
                    continue
        return int(total)
    except Exception:
        return 0


# AI request counters
AI_CHAT_USED = Counter("ai_chat_used_total", "AI chat responses served", ["tenant_id"])  # type: ignore
DB_QUERY_TOOL_USED = Counter("db_query_tool_used_total", "DB query tool used", ["tenant_id", "name"])  # type: ignore
INSIGHTS_SERVED = Counter("insights_served_total", "Insights served to AskVX", ["tenant_id", "kind"])  # type: ignore



