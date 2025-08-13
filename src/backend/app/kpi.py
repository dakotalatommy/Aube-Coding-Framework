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
    return {
        "time_saved_minutes": time_saved,
        "usage_index": msgs,
        "ambassador_candidate": amb,
        "contacts": contacts,
        "active_cadences": active_cadences,
        "notify_list_count": notify,
        "share_prompts": shares,
    }


