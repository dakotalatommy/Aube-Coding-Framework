from fastapi import FastAPI, Depends, Response, Request
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from prometheus_client import Counter, generate_latest, CONTENT_TYPE_LATEST
from .events import emit_event
from .db import Base, engine, get_db, get_l_db
from . import models as dbm
from .auth import get_user_context, require_role, UserContext
from .cadence import get_cadence_definition, schedule_initial_next_action
from .kpi import compute_time_saved_minutes, ambassador_candidate, admin_kpis
from .messaging import send_message
from .integrations import crm_hubspot, booking_acuity
from .integrations.email_sendgrid import sendgrid_verify_signature
from .utils import normalize_phone
from .rate_limit import check_and_increment
from .scheduler import run_tick
from .ai import AIClient
from .brand_prompts import BRAND_SYSTEM, cadence_intro_prompt, chat_system_prompt
from .tools import execute_tool
from . import models as dbm
from .integrations.sms_twilio import twilio_verify_signature
import json


tags_metadata = [
    {"name": "Health", "description": "Health checks and metrics."},
    {"name": "Contacts", "description": "Contact import and consent."},
    {"name": "Cadences", "description": "Cadence scheduling and messaging."},
    {"name": "AI", "description": "Ask VX chat, tools, embeddings and search."},
    {"name": "Integrations", "description": "External integrations and provider webhooks."},
    {"name": "Approvals", "description": "Human-in-the-loop approvals."},
]

app = FastAPI(title="BrandVX Backend", version="0.2.0", openapi_tags=tags_metadata)
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
    generate: bool = False
    service: Optional[str] = None


STATE: Dict[str, Dict] = {
    "metrics": {"time_saved_minutes": 0, "messages_sent": 0},
    "cadences": {},
}


@app.get("/health", tags=["Health"])
def health() -> Dict[str, str]:
    return {"status": "ok"}

# Serve static web
app.mount("/app", StaticFiles(directory="src/web", html=True), name="app")


# Prometheus metrics (basic request counters)
REQ_COUNTER = Counter("brandvx_requests_total", "Total requests", ["endpoint"]) 


@app.get("/metrics/prometheus", tags=["Health"])
def prometheus_metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.post("/import/contacts", tags=["Contacts"])
def import_contacts(
    req: ImportContactsRequest,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
) -> Dict[str, int]:
    if ctx.tenant_id != req.tenant_id:
        return {"imported": 0}
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


@app.post("/cadences/start", tags=["Cadences"])
def start_cadence(
    req: CadenceStartRequest,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
) -> Dict[str, str]:
    if ctx.tenant_id != req.tenant_id:
        return {"status": "forbidden"}
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
    schedule_initial_next_action(db, req.tenant_id, req.contact_id, req.cadence_id)
    # schedule preview (simulated) — could be returned to UI
    _steps = get_cadence_definition(req.cadence_id)
    emit_event(
        "CadenceStarted",
        {
            "tenant_id": req.tenant_id,
            "contact_id": req.contact_id,
            "cadence_id": req.cadence_id,
            "steps": _steps,
        },
    )
    return {"status": "started"}


@app.post("/messages/simulate", tags=["Cadences"])
async def simulate_message(
    req: MessageSimulateRequest,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
) -> Dict[str, str]:
    if ctx.tenant_id != req.tenant_id:
        return {"status": "forbidden"}
    ok, current = check_and_increment(req.tenant_id, f"msg:{req.channel}", max_per_minute=60)
    if not ok:
        emit_event(
            "MessageFailed",
            {
                "tenant_id": req.tenant_id,
                "contact_id": req.contact_id,
                "channel": req.channel,
                "template_id": req.template_id,
                "failure_code": "rate_limited",
            },
        )
        return {"status": "rate_limited"}
    # Optional AI content
    if req.generate:
        client = AIClient()
        body = await client.generate(
            BRAND_SYSTEM,
            [{"role": "user", "content": cadence_intro_prompt(req.service or "service")}],
            max_tokens=120,
        )
        emit_event("MessageQueued", {"tenant_id": req.tenant_id, "contact_id": req.contact_id, "channel": req.channel, "body": body})
        emit_event("MessageSent", {"tenant_id": req.tenant_id, "contact_id": req.contact_id, "channel": req.channel, "body": body})
    else:
        send_message(db, req.tenant_id, req.contact_id, req.channel, req.template_id)
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


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    tenant_id: str
    messages: List[ChatMessage]
    allow_tools: bool = False


@app.post("/ai/chat", tags=["AI"])
async def ai_chat(
    req: ChatRequest,
    ctx: UserContext = Depends(get_user_context),
) -> Dict[str, str]:
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"text": "forbidden"}
    system_prompt = chat_system_prompt()
    client = AIClient()
    content = await client.generate(
        system_prompt,
        [
            {"role": m.role, "content": m.content}
            for m in req.messages
        ],
        max_tokens=400,
    )
    emit_event(
        "AIChatResponded",
        {"tenant_id": req.tenant_id, "length": len(content)},
    )
    return {"text": content}


class EmbedRequest(BaseModel):
    tenant_id: str
    items: List[Dict[str, str]]  # [{doc_id, kind, text}]


@app.post("/ai/embed", tags=["AI"])
async def ai_embed(
    req: EmbedRequest,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"embedded": 0}
    client = AIClient()
    vectors = await client.embed([x.get("text", "") for x in req.items])
    count = 0
    for i, x in enumerate(req.items):
        if i < len(vectors):
            db.add(
                dbm.Embedding(
                    tenant_id=req.tenant_id,
                    doc_id=x.get("doc_id", ""),
                    kind=x.get("kind", "doc"),
                    text=x.get("text", ""),
                    vector_json=json.dumps(vectors[i]),
                )
            )
            count += 1
    db.commit()
    return {"embedded": count}


class SearchRequest(BaseModel):
    tenant_id: str
    query: str
    top_k: int = 5
    kind: Optional[str] = None


@app.post("/ai/search", tags=["AI"])
async def ai_search(
    req: SearchRequest,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"results": []}
    client = AIClient()
    qv = await client.embed([req.query])
    if not qv:
        return {"results": []}
    q = db.query(dbm.Embedding).filter(dbm.Embedding.tenant_id == req.tenant_id)
    if req.kind:
        q = q.filter(dbm.Embedding.kind == req.kind)
    rows = q.limit(500).all()
    def dot(a, b):
        n = min(len(a), len(b))
        return sum((a[i] * b[i]) for i in range(n))
    qvec = qv[0]
    scored = []
    for r in rows:
        try:
            v = json.loads(r.vector_json)
            score = dot(qvec, v)
            scored.append({"doc_id": r.doc_id, "kind": r.kind, "score": score, "text": r.text[:200]})
        except Exception:
            continue
    scored.sort(key=lambda x: x["score"], reverse=True)
    return {"results": scored[: max(1, min(req.top_k, 20))]}


class ToolExecRequest(BaseModel):
    tenant_id: str
    name: str
    params: Dict[str, object] = {}
    require_approval: bool = False


class ApprovalActionRequest(BaseModel):
    tenant_id: str
    approval_id: int
    action: str  # approve|reject


@app.post("/ai/tools/execute", tags=["AI"])
async def ai_tool_execute(
    req: ToolExecRequest,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    if req.require_approval:
        db.add(
            dbm.Approval(
                tenant_id=req.tenant_id,
                tool_name=req.name,
                params_json=str(dict(req.params or {})),
                status="pending",
            )
        )
        db.commit()
        emit_event("AIToolExecuted", {"tenant_id": req.tenant_id, "tool": req.name, "status": "pending"})
        return {"status": "pending"}
    result = await execute_tool(req.name, dict(req.params or {}), db, ctx)
    emit_event("AIToolExecuted", {"tenant_id": req.tenant_id, "tool": req.name, "status": result.get("status")})
    return result


@app.get("/approvals", tags=["Approvals"])
def list_approvals(
    tenant_id: str,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return []
    rows = db.query(dbm.Approval).filter(dbm.Approval.tenant_id == tenant_id).all()
    return [
        {"id": r.id, "tool": r.tool_name, "status": r.status, "params": r.params_json, "result": r.result_json}
        for r in rows
    ]


@app.post("/approvals/action", tags=["Approvals"])
async def action_approval(
    req: ApprovalActionRequest,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    row = db.query(dbm.Approval).filter(dbm.Approval.id == req.approval_id, dbm.Approval.tenant_id == req.tenant_id).first()
    if not row:
        return {"status": "not_found"}
    if req.action == "reject":
        row.status = "rejected"
        db.commit()
        return {"status": "rejected"}
    # approve: execute tool now
    params = {}
    try:
        params = eval(row.params_json)
    except Exception:
        params = {}
    result = await execute_tool(row.tool_name, params, db, ctx)
    row.status = "approved"
    row.result_json = str(result)
    db.commit()
    return {"status": "approved", "result": result}


@app.post("/integrations/crm/hubspot/upsert", tags=["Integrations"])
def crm_upsert(
    tenant_id: str,
    obj_type: str,
    attrs: Dict[str, str],
    idempotency_key: Optional[str] = None,
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != tenant_id:
        return {"status": "forbidden"}
    return crm_hubspot.upsert(tenant_id, obj_type, attrs, idempotency_key)


@app.post("/integrations/booking/acuity/import", tags=["Integrations"])
def booking_import(
    tenant_id: str,
    since: Optional[str] = None,
    until: Optional[str] = None,
    cursor: Optional[str] = None,
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != tenant_id:
        return {"status": "forbidden"}
    return booking_acuity.import_appointments(tenant_id, since, until, cursor)


@app.get("/metrics", tags=["Health"])
def get_metrics(tenant_id: str, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)) -> Dict[str, int]:
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"messages_sent": 0, "time_saved_minutes": 0}
    m = db.query(dbm.Metrics).filter(dbm.Metrics.tenant_id == tenant_id).first()
    if not m:
        return {"messages_sent": 0, "time_saved_minutes": 0, "ambassador_candidate": False}
    return {
        "messages_sent": m.messages_sent,
        "time_saved_minutes": compute_time_saved_minutes(db, tenant_id),
        "ambassador_candidate": ambassador_candidate(db, tenant_id),
    }


@app.get("/admin/kpis", tags=["Health"])
def get_admin_kpis(tenant_id: str, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)) -> Dict[str, int]:
    if ctx.role != "owner_admin" and ctx.tenant_id != tenant_id:
        return {}
    return admin_kpis(db, tenant_id)


@app.post("/scheduler/tick", tags=["Cadences"])
def scheduler_tick(tenant_id: Optional[str] = None, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)):
    if tenant_id and ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"processed": 0}
    return {"processed": run_tick(db, tenant_id)}


class PreferenceRequest(BaseModel):
    tenant_id: str
    contact_id: str
    preference: str = "soonest"  # soonest|anytime


@app.post("/notify-list/set-preference", tags=["Contacts"])
def set_notify_preference(
    req: PreferenceRequest,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
) -> Dict[str, str]:
    if ctx.tenant_id != req.tenant_id:
        return {"status": "forbidden"}
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


@app.post("/share/surface", tags=["Integrations"])
def surface_share_prompt(
    req: SharePromptRequest,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
) -> Dict[str, str]:
    if ctx.tenant_id != req.tenant_id:
        return {"status": "forbidden"}
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


@app.post("/consent/stop", tags=["Contacts"])
def consent_stop(
    req: StopRequest,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
) -> Dict[str, str]:
    if ctx.tenant_id != req.tenant_id:
        return {"status": "forbidden"}
    db.add(
        dbm.ConsentLog(
            tenant_id=req.tenant_id, contact_id=req.contact_id, channel=req.channel, consent="revoked"
        )
    )
    # lightweight audit
    db.add(
        dbm.AuditLog(
            tenant_id=req.tenant_id,
            actor_id=ctx.user_id,
            action="consent.stop",
            entity_ref=f"contact:{req.contact_id}",
            payload="{}",
        )
    )
    db.commit()
    emit_event(
        "SuppressionAdded",
        {"tenant_id": req.tenant_id, "contact_id": req.contact_id, "channel": req.channel, "keyword": "STOP"},
    )
    return {"status": "suppressed"}


@app.get("/config")
def get_config() -> Dict[str, object]:
    return {
        "version": "v1",
        "features": {
            "cadences": True,
            "notify_list": True,
            "share_prompts": True,
            "ambassador_flags": True,
            "ai_chat": True,
        },
        "branding": {
            "product_name": "BrandVX",
            "primary_color": "#0EA5E9",
            "accent_color": "#22C55E",
        },
    }


@app.get("/ui/contract")
def ui_contract() -> Dict[str, object]:
    return {
        "surfaces": [
            {
                "id": "operator_dashboard",
                "title": "Operator Dashboard",
                "widgets": [
                    {"id": "time_saved", "endpoint": "/metrics?tenant_id={tenant_id}"},
                    {"id": "usage_index", "endpoint": "/metrics?tenant_id={tenant_id}"},
                ],
                "actions": [
                    {"id": "import_contacts", "endpoint": "/import/contacts", "method": "POST"},
                    {"id": "start_cadence", "endpoint": "/cadences/start", "method": "POST"},
                    {"id": "simulate_message", "endpoint": "/messages/simulate", "method": "POST"},
                    {"id": "stop_keyword", "endpoint": "/consent/stop", "method": "POST"},
                ],
            },
            {
                "id": "admin_kpis",
                "title": "Admin KPIs",
                "widgets": [
                    {"id": "tenants_health", "endpoint": "/metrics?tenant_id={tenant_id}"}
                ],
            },
            {
                "id": "integrations",
                "title": "Integrations",
                "actions": [
                    {"id": "set_notify_preference", "endpoint": "/notify-list/set-preference", "method": "POST"}
                ],
            },
            {
                "id": "sharing",
                "title": "Sharing & Milestones",
                "actions": [
                    {"id": "surface_share_prompt", "endpoint": "/share/surface", "method": "POST"}
                ],
            },
            {
                "id": "ask_vx",
                "title": "Ask VX",
                "actions": [
                    {"id": "ai_chat", "endpoint": "/ai/chat", "method": "POST"}
                ],
            },
            {
                "id": "approvals",
                "title": "Approvals",
                "actions": [
                    {"id": "list_approvals", "endpoint": "/approvals?tenant_id={tenant_id}", "method": "GET"},
                    {"id": "action_approval", "endpoint": "/approvals/action", "method": "POST"}
                ],
            },
        ],
        "events": [
            "ContactImported",
            "CadenceStarted",
            "MessageQueued",
            "MessageSent",
            "MetricsComputed",
            "SuppressionAdded",
            "NotifyListCandidateAdded",
            "SharePromptSurfaced",
            "AIChatResponded",
            "AIToolExecuted",
        ],
    }


class ProviderWebhook(BaseModel):
    tenant_id: str
    payload: Dict[str, object] = {}


@app.post("/webhooks/twilio", tags=["Integrations"])
def webhook_twilio(
    req: ProviderWebhook,
    request: Request,
    ctx: UserContext = Depends(get_user_context),
) -> Dict[str, str]:
    sig = request.headers.get("X-Twilio-Signature", "")
    url = str(request.url)
    ok = twilio_verify_signature(url, dict(req.payload or {}), signature=sig)
    if not ok:
        return {"status": "forbidden"}
    emit_event("ProviderWebhookReceived", {"tenant_id": req.tenant_id, "provider": "twilio"})
    return {"status": "ok"}


@app.post("/webhooks/sendgrid", tags=["Integrations"])
async def webhook_sendgrid(
    req: ProviderWebhook,
    request: Request,
    ctx: UserContext = Depends(get_user_context),
):
    raw = await request.body()
    headers = {k: v for k, v in request.headers.items()}
    if not sendgrid_verify_signature(headers, raw):
        return {"status": "forbidden"}
    emit_event("ProviderWebhookReceived", {"tenant_id": req.tenant_id, "provider": "sendgrid"})
    return {"status": "ok"}


