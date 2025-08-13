from fastapi import FastAPI, Depends
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from .events import emit_event
from .db import Base, engine, get_db
from . import models as dbm


app = FastAPI(title="BrandVX Backend", version="0.2.0")
Base.metadata.create_all(bind=engine)


class Contact(BaseModel):
    contact_id: str = Field(..., description="UUID or unique ID")
    email_hash: Optional[str] = Field(None, description="Hashed email for privacy")
    phone_hash: Optional[str] = Field(None, description="Hashed phone for privacy")
    consent_sms: bool = False
    consent_email: bool = False


class ImportContactsRequest(BaseModel):
    tenant_id: str
    contacts: List[Contact]


class CadenceStartRequest(BaseModel):
    tenant_id: str
    contact_id: str
    cadence_id: str = "warm_lead_default"


class MessageSimulateRequest(BaseModel):
    tenant_id: str
    contact_id: str
    channel: str = "sms"
    template_id: Optional[str] = None


STATE: Dict[str, Dict] = {
    "metrics": {"time_saved_minutes": 0, "messages_sent": 0},
    "cadences": {},
}


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}

# Serve static web
app.mount("/app", StaticFiles(directory="src/web", html=True), name="app")


@app.post("/import/contacts")
def import_contacts(req: ImportContactsRequest, db: Session = Depends(get_db)) -> Dict[str, int]:
    imported = 0
    for _ in req.contacts:
        imported += 1
        db.add(
            dbm.Contact(
                tenant_id=req.tenant_id,
                contact_id=_.contact_id,
                email_hash=_.email_hash,
                phone_hash=_.phone_hash,
                consent_sms=_.consent_sms,
                consent_email=_.consent_email,
            )
        )
    db.commit()
    emit_event(
        "ContactImported",
        {
            "tenant_id": req.tenant_id,
            "row_count": len(req.contacts),
            "success_count": imported,
        },
    )
    return {"imported": imported}


@app.post("/cadences/start")
def start_cadence(req: CadenceStartRequest, db: Session = Depends(get_db)) -> Dict[str, str]:
    STATE["cadences"].setdefault(req.tenant_id, {})[req.contact_id] = req.cadence_id
    db.add(
        dbm.CadenceState(
            tenant_id=req.tenant_id,
            contact_id=req.contact_id,
            cadence_id=req.cadence_id,
            step_index=0,
        )
    )
    db.commit()
    emit_event(
        "CadenceStarted",
        {
            "tenant_id": req.tenant_id,
            "contact_id": req.contact_id,
            "cadence_id": req.cadence_id,
        },
    )
    return {"status": "started"}


@app.post("/messages/simulate")
def simulate_message(req: MessageSimulateRequest, db: Session = Depends(get_db)) -> Dict[str, str]:
    emit_event(
        "MessageQueued",
        {
            "tenant_id": req.tenant_id,
            "contact_id": req.contact_id,
            "channel": req.channel,
            "template_id": req.template_id,
        },
    )
    emit_event(
        "MessageSent",
        {
            "tenant_id": req.tenant_id,
            "contact_id": req.contact_id,
            "channel": req.channel,
            "template_id": req.template_id,
        },
    )
    STATE["metrics"]["messages_sent"] += 1
    STATE["metrics"]["time_saved_minutes"] += 2
    # upsert metrics
    m = db.query(dbm.Metrics).filter(dbm.Metrics.tenant_id == req.tenant_id).first()
    if not m:
        m = dbm.Metrics(tenant_id=req.tenant_id, time_saved_minutes=0, messages_sent=0)
        db.add(m)
    m.messages_sent = m.messages_sent + 1
    m.time_saved_minutes = m.time_saved_minutes + 2
    db.commit()
    emit_event(
        "MetricsComputed",
        {
            "tenant_id": req.tenant_id,
            "metrics": {"messages_sent": m.messages_sent, "time_saved_minutes": m.time_saved_minutes},
        },
    )
    return {"status": "sent"}


@app.get("/metrics")
def get_metrics(tenant_id: str, db: Session = Depends(get_db)) -> Dict[str, int]:
    m = db.query(dbm.Metrics).filter(dbm.Metrics.tenant_id == tenant_id).first()
    if not m:
        return {"messages_sent": 0, "time_saved_minutes": 0}
    return {"messages_sent": m.messages_sent, "time_saved_minutes": m.time_saved_minutes}


class PreferenceRequest(BaseModel):
    tenant_id: str
    contact_id: str
    preference: str = "soonest"  # soonest|anytime


@app.post("/notify-list/set-preference")
def set_notify_preference(req: PreferenceRequest, db: Session = Depends(get_db)) -> Dict[str, str]:
    db.add(
        dbm.NotifyListEntry(
            tenant_id=req.tenant_id, contact_id=req.contact_id, preference=req.preference
        )
    )
    db.commit()
    emit_event(
        "NotifyListCandidateAdded",
        {"tenant_id": req.tenant_id, "contact_id": req.contact_id, "preference": req.preference},
    )
    return {"status": "ok"}


class SharePromptRequest(BaseModel):
    tenant_id: str
    kind: str


@app.post("/share/surface")
def surface_share_prompt(req: SharePromptRequest, db: Session = Depends(get_db)) -> Dict[str, str]:
    db.add(dbm.SharePrompt(tenant_id=req.tenant_id, kind=req.kind, surfaced=True))
    db.commit()
    emit_event(
        "SharePromptSurfaced",
        {"tenant_id": req.tenant_id, "kind": req.kind},
    )
    return {"status": "ok"}


class StopRequest(BaseModel):
    tenant_id: str
    contact_id: str
    channel: str = "sms"


@app.post("/consent/stop")
def consent_stop(req: StopRequest, db: Session = Depends(get_db)) -> Dict[str, str]:
    db.add(
        dbm.ConsentLog(
            tenant_id=req.tenant_id, contact_id=req.contact_id, channel=req.channel, consent="revoked"
        )
    )
    db.commit()
    emit_event(
        "SuppressionAdded",
        {"tenant_id": req.tenant_id, "contact_id": req.contact_id, "channel": req.channel, "keyword": "STOP"},
    )
    return {"status": "suppressed"}


