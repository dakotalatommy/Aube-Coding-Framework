from sqlalchemy.orm import Session
from sqlalchemy import text


def recompute_funnel_daily(db: Session, tenant_id: str, days: int = 30) -> int:
    # Placeholder aggregation: ensure table has at least empty rows for the window
    # Real implementation would aggregate events_ledger by day and stage transitions
    q = db.execute(text("SELECT COUNT(*) AS c FROM funnel_daily WHERE tenant_id=:t"), {"t": tenant_id})
    existing = list(q)[0][0]
    if existing == 0:
        db.execute(
            text("INSERT INTO funnel_daily (tenant_id, day, impressions, waitlist, demo, trial, paid, retained) VALUES (:t, :d, 0,0,0,0,0,0)"),
            {"t": tenant_id, "d": "1970-01-01"},
        )
        db.commit()
        return 1
    return 0


def recompute_time_saved(db: Session, tenant_id: str) -> int:
    # Placeholder: roll from metrics into time_saved_rollup (daily)
    q = db.execute(text("SELECT time_saved_minutes FROM metrics WHERE tenant_id=:t"), {"t": tenant_id}).fetchone()
    minutes = (q[0] if q else 0) or 0
    db.execute(
        text("DELETE FROM time_saved_rollup WHERE tenant_id=:t AND period='lifetime'"),
        {"t": tenant_id},
    )
    db.execute(
        text("INSERT INTO time_saved_rollup (tenant_id, period, minutes_saved) VALUES (:t, 'lifetime', :m)"),
        {"t": tenant_id, "m": minutes},
    )
    db.commit()
    return 1


