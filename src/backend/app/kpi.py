from sqlalchemy.orm import Session
from . import models as dbm
from sqlalchemy import text
from .metrics_counters import sum_counter, CACHE_HIT, CACHE_MISS, AI_CHAT_USED, DB_QUERY_TOOL_USED, INSIGHTS_SERVED  # type: ignore


def compute_time_saved_minutes(db: Session, tenant_id: str) -> int:
    m = db.query(dbm.Metrics).filter(dbm.Metrics.tenant_id == tenant_id).first()
    return m.time_saved_minutes if m else 0


def ambassador_candidate(db: Session, tenant_id: str) -> bool:
    # Placeholder rule: time_saved_minutes >= 600 (10h) and messages_sent >= 100
    m = db.query(dbm.Metrics).filter(dbm.Metrics.tenant_id == tenant_id).first()
    if not m:
        return False
    return (m.time_saved_minutes or 0) >= 600 and (m.messages_sent or 0) >= 100


def usage_index(db: Session, tenant_id: str) -> int:
    m = db.query(dbm.Metrics).filter(dbm.Metrics.tenant_id == tenant_id).first()
    return m.messages_sent if m else 0


def admin_kpis(db: Session, tenant_id: str) -> dict:
    time_saved = compute_time_saved_minutes(db, tenant_id)
    amb = ambassador_candidate(db, tenant_id)
    msgs = usage_index(db, tenant_id)
    contacts = db.query(dbm.Contact).filter(dbm.Contact.tenant_id == tenant_id).count()
    active_cadences = db.query(dbm.CadenceState).filter(dbm.CadenceState.tenant_id == tenant_id).count()
    notify = db.query(dbm.NotifyListEntry).filter(dbm.NotifyListEntry.tenant_id == tenant_id).count()
    shares = db.query(dbm.SharePrompt).filter(dbm.SharePrompt.tenant_id == tenant_id).count()
    # revenue uplift (placeholder: last snapshot) — table may not exist in dev
    revenue_uplift = 0
    try:
        rev = db.execute(text("SELECT amount_cents FROM revenue_snapshot WHERE tenant_id=:t ORDER BY id DESC LIMIT 1"), {"t": tenant_id}).fetchone()
        revenue_uplift = int(rev[0]) if rev else 0
    except Exception:
        revenue_uplift = 0
    # referrals (placeholder: count of SharePrompt)
    referrals_30d = shares
    return {
        "time_saved_minutes": time_saved,
        "usage_index": msgs,
        "ambassador_candidate": amb,
        "revenue_uplift": revenue_uplift,
        "referrals_30d": referrals_30d,
        "contacts": contacts,
        "active_cadences": active_cadences,
        "notify_list_count": notify,
        "share_prompts": shares,
        "cache_hits": sum_counter(CACHE_HIT),
        "cache_misses": sum_counter(CACHE_MISS),
        # AI usage counters (summed across labels)
        "ai_chat_used": sum_counter(AI_CHAT_USED),
        "db_query_tool_used": sum_counter(DB_QUERY_TOOL_USED),
        "insights_served": sum_counter(INSIGHTS_SERVED),
    }


def funnel_daily_series(db: Session, tenant_id: str, days: int = 30) -> dict:
    try:
        q = db.execute(
            text(
                """
                SELECT day, impressions, waitlist, demo, trial, paid, retained
                FROM funnel_daily WHERE tenant_id=:t ORDER BY day DESC LIMIT :n
                """
            ),
            {"t": tenant_id, "n": max(1, min(days, 90))},
        )
        rows = [dict(r._mapping) for r in q]
        rows.reverse()
        return {"days": days, "series": rows}
    except Exception:
        return {"days": days, "series": []}


