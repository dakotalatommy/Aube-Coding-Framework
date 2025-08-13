from typing import Any, Dict, Optional
from sqlalchemy.orm import Session
from .auth import UserContext
from . import models as dbm
from .ai import AIClient
from .brand_prompts import BRAND_SYSTEM, cadence_intro_prompt
from .cadence import get_cadence_definition


class ToolError(Exception):
    pass


def _require_tenant(ctx: UserContext, tenant_id: str) -> None:
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        raise ToolError("forbidden")


async def tool_draft_message(
    db: Session,
    ctx: UserContext,
    tenant_id: str,
    contact_id: str,
    channel: str = "sms",
    service: Optional[str] = None,
) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    contact = (
        db.query(dbm.Contact)
        .filter(dbm.Contact.tenant_id == tenant_id, dbm.Contact.contact_id == contact_id)
        .first()
    )
    if not contact:
        return {"status": "not_found"}
    if channel == "sms" and contact.consent_sms is False:
        return {"status": "suppressed"}
    client = AIClient()
    body = await client.generate(
        BRAND_SYSTEM,
        [{"role": "user", "content": cadence_intro_prompt(service or "service")}],
        max_tokens=160,
    )
    return {"status": "ok", "draft": body, "channel": channel}


def tool_propose_next_cadence_step(
    db: Session,
    ctx: UserContext,
    tenant_id: str,
    contact_id: str,
    cadence_id: str,
) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    state = (
        db.query(dbm.CadenceState)
        .filter(
            dbm.CadenceState.tenant_id == tenant_id,
            dbm.CadenceState.contact_id == contact_id,
            dbm.CadenceState.cadence_id == cadence_id,
        )
        .first()
    )
    steps = get_cadence_definition(cadence_id)
    if not steps:
        return {"status": "unknown_cadence"}
    next_idx = 0 if not state else state.step_index + 1
    if next_idx >= len(steps):
        return {"status": "complete"}
    return {"status": "ok", "next_step_index": next_idx, "next_step": steps[next_idx]}


REGISTRY = {
    "draft_message": tool_draft_message,  # async
    "propose_next_cadence_step": tool_propose_next_cadence_step,  # sync
}


async def execute_tool(name: str, params: Dict[str, Any], db: Session, ctx: UserContext) -> Dict[str, Any]:
    fn = REGISTRY.get(name)
    if not fn:
        return {"status": "unknown_tool"}
    try:
        if name == "draft_message":
            return await fn(
                db,
                ctx,
                tenant_id=str(params.get("tenant_id", ctx.tenant_id)),
                contact_id=str(params.get("contact_id", "")),
                channel=str(params.get("channel", "sms")),
                service=params.get("service"),
            )
        # sync tools
        if name == "propose_next_cadence_step":
            return fn(
                db,
                ctx,
                tenant_id=str(params.get("tenant_id", ctx.tenant_id)),
                contact_id=str(params.get("contact_id", "")),
                cadence_id=str(params.get("cadence_id", "")),
            )
        return {"status": "not_implemented"}
    except ToolError as te:
        return {"status": str(te)}
    except Exception:
        return {"status": "error"}


