from sqlalchemy.orm import Session
from . import models as dbm


def compute_time_saved_minutes(db: Session, tenant_id: str) -> int:
    m = db.query(dbm.Metrics).filter(dbm.Metrics.tenant_id == tenant_id).first()
    return m.time_saved_minutes if m else 0


def ambassador_candidate(db: Session, tenant_id: str) -> bool:
    # Placeholder rule: time_saved_minutes >= 600 (10h) and messages_sent >= 100
    m = db.query(dbm.Metrics).filter(dbm.Metrics.tenant_id == tenant_id).first()
    if not m:
        return False
    return (m.time_saved_minutes or 0) >= 600 and (m.messages_sent or 0) >= 100


