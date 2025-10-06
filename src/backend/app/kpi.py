from sqlalchemy.orm import Session
from . import models as dbm
from sqlalchemy import text
from contextlib import contextmanager
from .metrics_counters import sum_counter, CACHE_HIT, CACHE_MISS, AI_CHAT_USED, DB_QUERY_TOOL_USED, INSIGHTS_SERVED  # type: ignore
import logging

logger = logging.getLogger(__name__)

# Import engine for RLS queries
from .db import engine as _engine

@contextmanager
def _with_rls_conn(tenant_id: str, role: str = "owner_admin"):
    """
    Short-lived connection helper that sets RLS GUCs before any tenant-scoped query.
    Per backend-db-architecture.md: ALL tenant-scoped reads/writes MUST set GUCs on the connection.
    """
    conn_cm = _engine.begin()
    try:
        conn = conn_cm.__enter__()
        try:
            safe_role = role.replace("'", "''")
            conn.execute(text(f"SET LOCAL app.role = '{safe_role}'"))
        except Exception:
            logger.exception("Failed to set app.role GUC (role=%s)", role)
            raise
        try:
            safe_tenant = tenant_id.replace("'", "''")
            conn.execute(text(f"SET LOCAL app.tenant_id = '{safe_tenant}'"))
        except Exception:
            logger.exception("Failed to set app.tenant_id GUC (tenant_id=%s)", tenant_id)
            raise
        yield conn
    finally:
        conn_cm.__exit__(None, None, None)


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
    """
    Compute KPIs for a tenant using RLS-compliant queries.
    CRITICAL: Uses _with_rls_conn to set app.tenant_id/app.role GUCs before ALL tenant-scoped queries.
    Per backend-db-architecture.md lines 34-51.
    """
    time_saved = compute_time_saved_minutes(db, tenant_id)
    amb = ambassador_candidate(db, tenant_id)
    msgs = usage_index(db, tenant_id)
    
    # Use RLS-compliant connection for all tenant-scoped counts
    with _with_rls_conn(tenant_id) as conn:
        # Count contacts
        result = conn.execute(
            text("SELECT COUNT(*) FROM contacts WHERE tenant_id = CAST(:t AS uuid) AND deleted = false"),
            {"t": tenant_id}
        ).fetchone()
        contacts = int(result[0]) if result else 0
        
        # Count active cadences
        result = conn.execute(
            text("SELECT COUNT(*) FROM cadence_states WHERE tenant_id = CAST(:t AS uuid)"),
            {"t": tenant_id}
        ).fetchone()
        active_cadences = int(result[0]) if result else 0
        
        # Count notify list entries
        result = conn.execute(
            text("SELECT COUNT(*) FROM notify_list WHERE tenant_id = CAST(:t AS uuid)"),
            {"t": tenant_id}
        ).fetchone()
        notify = int(result[0]) if result else 0
        
        # Count share prompts
        result = conn.execute(
            text("SELECT COUNT(*) FROM share_prompts WHERE tenant_id = CAST(:t AS uuid)"),
            {"t": tenant_id}
        ).fetchone()
        shares = int(result[0]) if result else 0
        
        # Calculate current month revenue from transactions table
        # This gives accurate monthly revenue based on transaction_date
        result = conn.execute(
            text("""
                SELECT COALESCE(SUM(amount_cents), 0)
                FROM transactions
                WHERE tenant_id = CAST(:t AS uuid)
                  AND transaction_date >= date_trunc('month', CURRENT_DATE)
                  AND transaction_date < date_trunc('month', CURRENT_DATE) + interval '1 month'
            """),
            {"t": tenant_id}
        ).fetchone()
        current_month_revenue_cents = int(result[0]) if result else 0
        
        # Calculate lifetime revenue from transactions (this is the true "uplift" since using BrandVX)
        # If transactions table is empty, fall back to contacts.lifetime_cents
        result = conn.execute(
            text("SELECT COALESCE(SUM(amount_cents), 0) FROM transactions WHERE tenant_id = CAST(:t AS uuid)"),
            {"t": tenant_id}
        ).fetchone()
        total_transaction_revenue = int(result[0]) if result else 0
        
        # If no transactions exist yet, fall back to contacts.lifetime_cents (for backward compatibility)
        if total_transaction_revenue == 0:
            result = conn.execute(
                text("SELECT COALESCE(SUM(lifetime_cents), 0) FROM contacts WHERE tenant_id = CAST(:t AS uuid) AND deleted = false"),
                {"t": tenant_id}
            ).fetchone()
            lifetime_revenue_cents = int(result[0]) if result else 0
        else:
            lifetime_revenue_cents = total_transaction_revenue
    
    # referrals (placeholder: count of SharePrompt)
    referrals_30d = shares
    
    return {
        "time_saved_minutes": time_saved,
        "usage_index": msgs,
        "ambassador_candidate": amb,
        "current_month_revenue_cents": current_month_revenue_cents,  # NEW: October revenue
        "lifetime_revenue_cents": lifetime_revenue_cents,  # Total revenue tracked in BrandVX
        "revenue_uplift": lifetime_revenue_cents,  # Alias for backward compatibility
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


