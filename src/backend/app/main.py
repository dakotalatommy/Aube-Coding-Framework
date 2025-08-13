from fastapi import FastAPI
from pydantic import BaseModel, Field
from typing import List, Dict, Optional
from .events import emit_event


app = FastAPI(title="BrandVX Backend", version="0.1.0")


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


@app.post("/import/contacts")
def import_contacts(req: ImportContactsRequest) -> Dict[str, int]:
    imported = 0
    for _ in req.contacts:
        imported += 1
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
def start_cadence(req: CadenceStartRequest) -> Dict[str, str]:
    STATE["cadences"].setdefault(req.tenant_id, {})[req.contact_id] = req.cadence_id
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
def simulate_message(req: MessageSimulateRequest) -> Dict[str, str]:
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
    emit_event(
        "MetricsComputed",
        {
            "tenant_id": req.tenant_id,
            "metrics": STATE["metrics"],
        },
    )
    return {"status": "sent"}


@app.get("/metrics")
def get_metrics() -> Dict[str, int]:
    return STATE["metrics"]


