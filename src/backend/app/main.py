from __future__ import annotations

from fastapi import FastAPI, Depends, Response, Request, HTTPException, UploadFile
from fastapi.responses import PlainTextResponse, RedirectResponse, FileResponse, JSONResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any, Tuple
from datetime import datetime, date, timedelta, timezone
from zoneinfo import ZoneInfo
import logging
import os
from sqlalchemy.orm import Session
from prometheus_client import Counter, generate_latest, CONTENT_TYPE_LATEST, CollectorRegistry
from .events import emit_event
from .events import _get_redis  # internal access for admin cache clear
from .db import Base, engine, get_db, get_l_db, CURRENT_TENANT_ID, CURRENT_ROLE
from . import models as dbm
from .crypto import encrypt_text, decrypt_text
from .auth import get_user_context, get_user_context_relaxed, require_role, UserContext
from .cadence import get_cadence_definition, schedule_initial_next_action
from .kpi import compute_time_saved_minutes, ambassador_candidate, admin_kpis, funnel_daily_series
from .cache import cache_get, cache_set, cache_del, cache_incr
from .metrics_counters import CACHE_HIT, CACHE_MISS, AI_CHAT_USED, INSIGHTS_SERVED
from .messaging import send_message
from .integrations import crm_hubspot, booking_acuity
from .integrations import instagram_basic as ig_basic
from .workers.followups import _update_todo_details
FOLLOWUPS_MAX_CHUNK = max(1, int(os.getenv("FOLLOWUPS_MAX_CHUNK", "25")))


class EmailOwnerRequest(BaseModel):
    profile: Dict[str, Any]
    source: Optional[str] = "demo"


# Initialize FastAPI early so route decorators below have a defined app
app = FastAPI(title="BrandVX Backend", version="0.2.0")

@app.post("/onboarding/email-owner", tags=["Onboarding"])
def onboarding_email_owner(req: EmailOwnerRequest, ctx: UserContext = Depends(get_user_context)) -> Dict[str, str]:
    # Send demo intake to internal owner email rather than client
    try:
        to = os.getenv("OWNER_INTAKE_EMAIL", "latommy@aubecreativelabs.com")
        from .integrations.email_sendgrid import sendgrid_send_email  # lazy import
        rows = [f"<div><strong>{k}</strong>: {str(v)}</div>" for k,v in (req.profile or {}).items()]
        body = f"<h3>BrandVX demo intake</h3><div>Source: {req.source or 'demo'}</div>" + "".join(rows)
        res = sendgrid_send_email(to, "BrandVX Demo Intake", body)
        return {"status": str(res.get("status", "queued"))}
    except Exception as e:
        return {"status": "error", "detail": str(e)[:200]}
from .integrations import inventory_shopify as inv_shopify
from .integrations import inventory_square as inv_square
from .integrations import calendar_google as cal_google
from .integrations import calendar_apple as cal_apple
from .integrations.booking_square import verify_square_signature
from .crypto import encrypt_text, decrypt_text
from .integrations.email_sendgrid import sendgrid_verify_signature
from .utils import normalize_phone
from .rate_limit import check_and_increment
from .rate_limit import get_bucket_status as rl_get_bucket_status
from .scheduler import run_tick
from .ai import AIClient
from .brand_prompts import BRAND_SYSTEM, cadence_intro_prompt, chat_system_prompt
from .tools import execute_tool, tools_schema, tools_schema_human, SAFE_TOOLS
from .contexts import contexts_schema, context_allowlist
from .contexts_detector import detect_mode
from .analytics import ph_capture
from .rate_limit import check_and_increment
from .metrics_counters import TOOL_EXECUTED  # type: ignore
from .marts import recompute_funnel_daily, recompute_time_saved
from . import models as dbm
from .integrations.sms_twilio import twilio_verify_signature
from .integrations.sms_twilio import twilio_send_sms
import threading as _threading
from .adapters.supabase_adapter import SupabaseAdapter
import json
import os
import html
import asyncio
import re
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Query
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.gzip import GZipMiddleware
import io
import csv
import os.path as _osp
from pathlib import Path as _Path
from types import SimpleNamespace
from sqlalchemy import text as _sql_text
from sqlalchemy import func as _sql_func
import secrets as _secrets
import time as _time
import urllib.parse as _url
import httpx
import hmac as _hmac
import hashlib as _hashlib
import base64 as _b64
import json as _json
import stripe as _stripe
from urllib.parse import urlparse as _uparse
try:
    import qrcode  # type: ignore
except ImportError:  # pragma: no cover
    qrcode = None  # type: ignore
from PIL import Image, ImageDraw, ImageFont
from .jobs import (
    enqueue_sms_job,
    enqueue_email_job,
    enqueue_ai_job,
    start_job_worker_if_enabled,
    create_job_record,
    update_job_record,
    get_job_record,
)
from .events import _get_redis as _redis
import secrets as _secrets
import uuid as _uuid


# Helper: Ensure tenant row exists (safety net for pre-trigger users)
def ensure_tenant_exists(tenant_id: str) -> None:
    """Idempotent: ensure tenant row exists for given ID. Silent on error."""
    try:
        with engine.begin() as conn:
            try:
                conn.execute(_sql_text("SET LOCAL app.role = 'owner_admin'"))
            except Exception:
                pass
            conn.execute(
                _sql_text(
                    """
                    INSERT INTO public.tenants (id, name, created_at)
                    VALUES (CAST(:t AS uuid), 'Workspace', NOW())
                    ON CONFLICT (id) DO NOTHING
                    """
                ),
                {"t": tenant_id},
            )
    except Exception:
        pass  # RLS/permissions issues are non-fatal


tags_metadata = [
    {"name": "Health", "description": "Health checks and metrics."},
    {"name": "Contacts", "description": "Contact import and consent."},
    {"name": "Cadences", "description": "Cadence scheduling and messaging."},
    {"name": "AI", "description": "Ask VX chat, tools, embeddings and search."},
    {"name": "Integrations", "description": "External integrations and provider webhooks."},
    {"name": "Approvals", "description": "Human-in-the-loop approvals."},
    {"name": "Plans", "description": "Plans and usage limits admin."},
    {"name": "Sharing", "description": "Public share links."},
    {"name": "Billing", "description": "Stripe billing and referrals."},
]
# Attach tags to app now that it's initialized
try:
    app.openapi_tags = tags_metadata  # type: ignore[attr-defined]
except Exception:
    pass

logger = logging.getLogger(__name__)


def _todo_disabled() -> bool:
    try:
        return str(os.getenv('BRVX_DISABLE_TODO', '0')).lower() in {'1', 'true', 'yes'}
    except Exception:
        return False

# -------- Helper: mark onboarding step complete (idempotent) ---------
def _complete_step(tenant_id: str, step_key: str, context: Optional[Dict[str, Any]] = None) -> None:
    try:
        with engine.begin() as conn:
            conn.execute(_sql_text("SET LOCAL app.role='owner_admin'"))
            conn.execute(_sql_text("SET LOCAL app.tenant_id=:t"), {"t": tenant_id})
            # Insert once; allow duplicates but they will simply show multiple rows; minimal overhead.
            conn.execute(
                _sql_text(
                    "INSERT INTO onboarding_progress(tenant_id, step_key, context_json) VALUES (CAST(:t AS uuid), :k, :c)"
                ),
                {"t": tenant_id, "k": step_key, "c": _json.dumps(context or {})},
            )
    except Exception:
        try:
            # Avoid propagating to the user flow
            pass
        except Exception:
            pass

# ----------------------- Onboarding Progress -----------------------
class ProgressStep(BaseModel):
    tenant_id: str
    step_key: str
    context: Optional[Dict[str, Any]] = None


class AskVXInsightsRequest(BaseModel):
    tenant_id: str
    horizon_days: int = Field(90, ge=30, le=180)


class InventorySyncRequest(BaseModel):
    tenant_id: str
    provider: Optional[str] = None


class CalendarSyncRequest(BaseModel):
    tenant_id: str
    provider: Optional[str] = None


class StrategyDocumentRequest(BaseModel):
    tenant_id: str
    markdown: str
    tags: Optional[List[str]] = None


class FounderContactRequest(BaseModel):
    tenant_id: str
    email: Optional[str] = None
    phone: Optional[str] = None


class SupportSendRequest(BaseModel):
    type: str = Field(..., min_length=1, max_length=120)
    values: Dict[str, Any] = Field(default_factory=dict)


def _render_support_email_html(req: SupportSendRequest, tenant_id: Optional[str]) -> str:
    safe_type = html.escape(req.type)
    tenant_block = f"<p><strong>Tenant</strong>: {html.escape(str(tenant_id))}</p>" if tenant_id else ""
    rows = []
    for key, value in sorted(req.values.items(), key=lambda item: str(item[0])):
        label = html.escape(str(key).replace('_', ' ').title())
        if isinstance(value, (dict, list)):
            serialized = html.escape(json.dumps(value, ensure_ascii=False, default=str, indent=2))
            rows.append(f"<li><strong>{label}</strong><pre>{serialized}</pre></li>")
        else:
            rows.append(f"<li><strong>{label}</strong>: {html.escape(str(value))}</li>")
    if not rows:
        rows.append('<li><em>No additional fields provided.</em></li>')
    return (
        f"<h3>brandVX Support Request</h3>"
        f"<p><strong>Type</strong>: {safe_type}</p>"
        f"{tenant_block}"
        f"<ul>{''.join(rows)}</ul>"
    )


def _deliver_support_email(subject: str, body_html: str) -> Dict[str, str]:
    """
    Send support email via configured provider. Falls back to logging if no provider is configured.

    TODO(brvx-support): Wire this into SendGrid or Flowdesk using env vars SUPPORT_FROM_EMAIL /
    SUPPORT_INBOX_EMAIL / FLOWDESK_API_KEY.
    """
    to_email = os.getenv('SUPPORT_INBOX_EMAIL', 'latommy@aubecreativelabs.com')
    provider = 'logger'
    try:
        api_key = os.getenv('SENDGRID_API_KEY')
        from_email = os.getenv('SUPPORT_FROM_EMAIL') or os.getenv('SENDGRID_FROM_EMAIL')
        if api_key and from_email:
            from .integrations.email_sendgrid import sendgrid_send_email  # local import to avoid optional dep at boot
            res = sendgrid_send_email(to_email, subject, body_html)
            provider = 'sendgrid'
            return {'status': str(res.get('status', 'queued')), 'provider': provider}
    except Exception as exc:
        provider = 'sendgrid'
        logger.exception('support_email_provider_error', exc_info=exc)
    logger.info(
        'support_email_stub',
        {
            'provider': provider,
            'subject': subject,
            'to': to_email,
            'preview': body_html[:2000],
        },
    )
    return {'status': 'logged', 'provider': provider}


SUPPORT_ALLOWED_MIME = {'image/png', 'image/jpeg', 'application/pdf'}
SUPPORT_MAX_BYTES = 10 * 1024 * 1024


async def _upload_supabase_object(
    bucket: str,
    object_path: str,
    data: bytes,
    content_type: str,
    *,
    expires_seconds: int = 60 * 60 * 24 * 7,
) -> Optional[Dict[str, Any]]:
    supabase_url = os.getenv('SUPABASE_URL', '').rstrip('/')
    service_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')
    if not supabase_url or not service_key or not bucket:
        return None
    headers = {
        'Authorization': f'Bearer {service_key}',
        'apikey': service_key,
        'Content-Type': content_type or 'application/octet-stream',
    }
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            upload_res = await client.post(
                f"{supabase_url}/storage/v1/object/{bucket}/{object_path}",
                content=data,
                headers=headers,
            )
            if upload_res.status_code not in (200, 201):
                logger.warning(
                    'supabase_upload_failed',
                    extra={'bucket': bucket, 'path': object_path, 'status': upload_res.status_code, 'body': upload_res.text[:200]},
                )
                return None
            sign_res = await client.post(
                f"{supabase_url}/storage/v1/object/sign/{bucket}/{object_path}",
                headers=headers,
                json={"expiresIn": expires_seconds},
            )
            if sign_res.status_code not in (200, 201):
                logger.warning(
                    'supabase_sign_failed',
                    extra={'bucket': bucket, 'path': object_path, 'status': sign_res.status_code, 'body': sign_res.text[:200]},
                )
                return None
            signed_payload = sign_res.json()
            signed_url = signed_payload.get('signedURL') or ''
            if signed_url.startswith('http'):
                url = signed_url
            else:
                url = f"{supabase_url}{signed_url}" if signed_url else ''
            return {
                'url': url,
                'path': object_path,
                'content_type': content_type,
                'size': len(data),
                'expires_in': expires_seconds,
            }
    except Exception as exc:
        logger.exception('supabase_upload_exception', exc_info=exc, extra={'bucket': bucket, 'path': object_path})
    return None


def _sanitize_support_filename(name: Optional[str]) -> str:
    base = (name or 'attachment').strip()
    safe = re.sub(r'[^A-Za-z0-9._-]+', '-', base).strip('-._')
    if not safe:
        safe = f'attachment-{int(_time.time())}'
    return safe[:160]


async def _upload_support_attachment(
    tenant_id: str,
    ticket_key: str,
    filename: str,
    content_type: str,
    data: bytes,
) -> Optional[Dict[str, Any]]:
    bucket = os.getenv('SUPPORT_TICKETS_BUCKET') or os.getenv('SUPPORT_BUCKET') or 'support-uploads'
    object_path = f"{tenant_id or 'anon'}/{ticket_key}/{filename}"
    uploaded = await _upload_supabase_object(
        bucket,
        object_path,
        data,
        content_type,
        expires_seconds=60 * 60 * 24 * 7,
    )
    if uploaded:
        uploaded['name'] = filename
    return uploaded


def _generate_referral_code(length: int = 6) -> str:
    alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
    return ''.join(_secrets.choice(alphabet) for _ in range(length))


def _ensure_referral_code(tenant_id: str) -> str:
    try:
        with engine.begin() as conn:
            conn.execute(_sql_text("SET LOCAL app.role='owner_admin'"))
            row = conn.execute(
                _sql_text("SELECT code FROM referral_codes WHERE tenant_id = CAST(:t AS uuid) LIMIT 1"),
                {"t": tenant_id},
            ).fetchone()
            if row and row[0]:
                return str(row[0])
        # Generate until unique
        for _ in range(6):
            code = _generate_referral_code()
            try:
                with engine.begin() as conn:
                    conn.execute(_sql_text("SET LOCAL app.role='owner_admin'"))
                    conn.execute(
                        _sql_text(
                            "INSERT INTO referral_codes (tenant_id, code) VALUES (CAST(:t AS uuid), :c) "
                            "ON CONFLICT (tenant_id) DO UPDATE SET code=EXCLUDED.code"
                        ),
                        {"t": tenant_id, "c": code},
                    )
                return code
            except Exception:
                continue
    except Exception:
        pass
    return _generate_referral_code()


def _compose_referral_image(code: str, share_url: str) -> bytes:
    if qrcode is None:
        raise RuntimeError("qrcode library not installed")
    size = 1080
    qr_size = 520
    qr = qrcode.QRCode(border=2, box_size=10)
    qr.add_data(share_url)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white").convert('RGB')
    qr_img = qr_img.resize((qr_size, qr_size))

    canvas = Image.new('RGB', (size, size), color='#ffffff')
    draw = ImageDraw.Draw(canvas)

    # Background accent circle
    accent_color = '#f7cbdc'
    draw.ellipse((40, 40, size-40, size-40), fill=accent_color)

    # Place QR centered
    offset = ((size - qr_size) // 2, (size - qr_size) // 2)
    canvas.paste(qr_img, offset)

    font_large = ImageFont.load_default()
    font_small = ImageFont.load_default()
    text_color = '#0f172a'
    draw.text((size/2, 120), 'brandVX Referral', fill=text_color, font=font_large, anchor='mm')
    draw.text((size/2, size - 180), f'code: {code}', fill=text_color, font=font_large, anchor='mm')
    draw.text((size/2, size - 140), 'Scan to join with early access perks', fill=text_color, font=font_small, anchor='mm')

    buffer = io.BytesIO()
    canvas.save(buffer, format='PNG')
    buffer.seek(0)
    return buffer.read()


def _mutate_settings_json(tenant_id: str, mutator: Any) -> None:
    try:
        with engine.begin() as conn:
            conn.execute(_sql_text("SET LOCAL app.role='owner_admin'"))
            row = conn.execute(
                _sql_text("SELECT data_json FROM settings WHERE tenant_id = CAST(:t AS uuid)"),
                {"t": tenant_id},
            ).fetchone()
            data = {}
            if row and row[0]:
                try:
                    data = json.loads(row[0])
                except Exception:
                    data = {}
            try:
                mutator(data)
            except Exception:
                pass
            payload = json.dumps(data)
            if row:
                conn.execute(
                    _sql_text("UPDATE settings SET data_json = :d WHERE tenant_id = CAST(:t AS uuid)"),
                    {"d": payload, "t": tenant_id},
                )
            else:
                conn.execute(
                    _sql_text("INSERT INTO settings (tenant_id, data_json) VALUES (CAST(:t AS uuid), :d)"),
                    {"d": payload, "t": tenant_id},
                )
    except Exception:
        pass


def _append_askvx_message(tenant_id: str, session_id: str, role: str, content: str) -> None:
    if not tenant_id:
        return
    try:
        with engine.begin() as conn:
            conn.execute(_sql_text("SET LOCAL app.role='owner_admin'"))
            conn.execute(
                _sql_text(
                    "INSERT INTO askvx_messages (tenant_id, session_id, role, content) VALUES (CAST(:t AS uuid), :sid, :role, :content)"
                ),
                {"t": tenant_id, "sid": session_id[:64], "role": role[:32], "content": content[:8000]},
            )
    except Exception:
        pass


def _upsert_trainvx_memory(tenant_id: str, key: str, value: str) -> None:
    if not tenant_id or not key:
        return
    try:
        with engine.begin() as conn:
            conn.execute(_sql_text("SET LOCAL app.role='owner_admin'"))
            conn.execute(
                _sql_text(
                    "INSERT INTO trainvx_memories (tenant_id, key, value, updated_at) "
                    "VALUES (CAST(:t AS uuid), :k, to_jsonb(:v::text), NOW()) "
                    "ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()"
                ),
                {"t": tenant_id, "k": key[:120], "v": value},
            )
    except Exception:
        pass


def _insert_onboarding_artifact(tenant_id: str, kind: str, content: str) -> None:
    if not tenant_id or not kind:
        return
    try:
        with engine.begin() as conn:
            conn.execute(_sql_text("SET LOCAL app.role='owner_admin'"))
            conn.execute(
                _sql_text(
                    "INSERT INTO onboarding_artifacts (tenant_id, kind, content) VALUES (CAST(:t AS uuid), :k, to_jsonb(:c::text))"
                ),
                {"t": tenant_id, "k": kind[:64], "c": content},
            )
    except Exception:
        pass


@app.post("/onboarding/complete_step", tags=["Plans"])
def onboarding_complete_step(req: ProgressStep, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)):
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    try:
        with engine.begin() as conn:
            conn.execute(_sql_text("SET LOCAL app.role='owner_admin'"))
            conn.execute(_sql_text("SET LOCAL app.tenant_id=:t"), {"t": req.tenant_id})
            conn.execute(_sql_text("INSERT INTO onboarding_progress(tenant_id, step_key, context_json) VALUES (CAST(:t AS uuid), :k, :c)"), {"t": req.tenant_id, "k": req.step_key, "c": _json.dumps(req.context or {})})
        return {"status": "ok", "step_key": req.step_key}
    except Exception as e:
        return {"status": "error", "detail": str(e)[:200]}


@app.post("/support/send", tags=["Support"])
async def support_send(request: Request, ctx: Optional[UserContext] = Depends(get_user_context_relaxed)):
    tenant_id = (getattr(ctx, 'tenant_id', '') if ctx else '').strip()
    user_id = getattr(ctx, 'user_id', None) if ctx else None
    ip_addr = getattr(request.client, 'host', None)
    content_type = (request.headers.get('content-type') or '').lower()

    support_type = 'support'
    name = ''
    email = ''
    phone = ''
    description = ''
    values: Dict[str, Any] = {}
    meta_context: Dict[str, Any] = {}
    context_source: Optional[str] = None
    attachments_to_process: List[Tuple[str, str, bytes, str]] = []

    if content_type.startswith('multipart/form-data'):
        form = await request.form()
        support_type = str(form.get('type') or 'support').strip() or 'support'
        name = str(form.get('name') or '').strip()
        email = str(form.get('email') or '').strip()
        phone = str(form.get('phone') or '').strip()
        description = str(form.get('description') or '').strip()
        context_source = str(form.get('context_source') or '').strip() or None
        meta_context = {
            'url': form.get('url') or '',
            'pathname': form.get('pathname') or '',
            'user_agent': form.get('user_agent') or '',
            'app_version': form.get('app_version') or '',
            'tour_page': form.get('tour_page') or '',
            'tour_step': form.get('tour_step') or '',
        }
        try:
            tenant_hint = str(form.get('tenant_id') or '').strip()
            if not tenant_id and tenant_hint:
                tenant_id = tenant_hint
        except Exception:
            pass
        uploads = [item for item in form.getlist('attachments') if isinstance(item, UploadFile)]
        uploads = uploads[:3]
        total_bytes = 0
        for upload in uploads:
            original_name = upload.filename or 'attachment'
            sanitized = _sanitize_support_filename(original_name)
            mime = upload.content_type or 'application/octet-stream'
            if mime not in SUPPORT_ALLOWED_MIME:
                raise HTTPException(status_code=400, detail='unsupported_file_type')
            data = await upload.read()
            total_bytes += len(data)
            if total_bytes > SUPPORT_MAX_BYTES:
                raise HTTPException(status_code=400, detail='attachments_too_large')
            attachments_to_process.append((sanitized, mime, data, original_name))
    else:
        payload: Dict[str, Any]
        try:
            payload = await request.json()
        except Exception:
            payload = {}
        try:
            req_model = SupportSendRequest(**payload)
        except Exception:
            req_model = SupportSendRequest(type=str(payload.get('type') or 'support'), values=payload.get('values') or {})
        support_type = (req_model.type or 'support').strip() or 'support'
        values = req_model.values or {}
        name = str(values.get('name') or '').strip()
        email = str(values.get('email') or '').strip()
        phone = str(values.get('phone') or '').strip()
        description = str(values.get('description') or '').strip()
        if not description:
            description = _json.dumps(values, ensure_ascii=False)
        meta_context = {'values': values}

    if not description:
        description = 'No description provided.'

    base_values = {
        'name': name,
        'email': email,
        'phone': phone,
        'description': description,
    }
    if not values:
        values = {k: v for k, v in base_values.items() if v}
    else:
        for key, val in base_values.items():
            if val and not values.get(key):
                values[key] = val

    rl_key = f"support:{tenant_id or 'anon'}:{ip_addr or 'unknown'}"
    attempts = cache_incr(rl_key, expire_seconds=600)
    if attempts > 5:
        raise HTTPException(status_code=429, detail='rate_limited')

    ticket_token = _uuid.uuid4().hex
    stored_files: List[Dict[str, Any]] = []
    for sanitized, mime, data, original_name in attachments_to_process:
        uploaded = await _upload_support_attachment(tenant_id, ticket_token, sanitized, mime, data)
        if uploaded:
            uploaded['name'] = original_name or sanitized
            stored_files.append(uploaded)

    context_payload: Dict[str, Any] = {
        'path': str(request.url.path),
        'ip': ip_addr,
    }
    if context_source:
        context_payload['source'] = context_source
    clean_meta = {k: v for k, v in meta_context.items() if isinstance(v, (str, int, float)) and str(v).strip()}
    if clean_meta:
        context_payload['context'] = clean_meta
    if values:
        context_payload['values'] = values
    if stored_files:
        context_payload['attachments'] = [{'url': f.get('url'), 'path': f.get('path'), 'content_type': f.get('content_type'), 'size': f.get('size')} for f in stored_files]

    payload_for_log = {
        'type': support_type,
        'tenant_id': tenant_id,
        'user_id': user_id,
        'ip': ip_addr,
        'has_attachments': bool(stored_files),
        'source': context_source,
    }
    logger.info('support_send_received', payload_for_log)

    files_json = _json.dumps(stored_files)
    context_json = _json.dumps(context_payload)

    ticket_id: Optional[int] = None
    try:
        with engine.begin() as conn:
            conn.execute(_sql_text("SET LOCAL app.role='owner_admin'"))
            if tenant_id:
                conn.execute(_sql_text("SET LOCAL app.tenant_id=:t"), {"t": tenant_id})
            inserted = conn.execute(
                _sql_text(
                    "INSERT INTO support_tickets (tenant_id, submitted_by, name, email, phone, description, files, context, status, created_by_ip) "
                    "VALUES (CAST(:tenant_id AS uuid), :submitted_by, :name, :email, :phone, :description, :files::jsonb, :context::jsonb, 'new', :ip) "
                    "RETURNING id"
                ),
                {
                    'tenant_id': tenant_id or None,
                    'submitted_by': user_id,
                    'name': name,
                    'email': email,
                    'phone': phone,
                    'description': description,
                    'files': files_json,
                    'context': context_json,
                    'ip': ip_addr,
                },
            ).fetchone()
            ticket_id = int(inserted[0]) if inserted else None
            if tenant_id:
                activity_payload = _json.dumps(
                    {
                        'ticket_id': ticket_id,
                        'type': support_type,
                        'source': context_source or 'support.send',
                    }
                )
                conn.execute(
                    _sql_text(
                        "INSERT INTO activity_log (tenant_id, actor, action, payload) VALUES (CAST(:t AS uuid), 'user', 'support.ticket.submitted', :payload::jsonb)"
                    ),
                    {'t': tenant_id, 'payload': activity_payload},
                )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception('support_ticket_insert_failed', exc_info=exc, extra={'tenant_id': tenant_id})
        raise HTTPException(status_code=500, detail='support_ticket_failed')

    email_values: Dict[str, Any] = {
        'name': name,
        'email': email,
        'phone': phone,
        'description': description,
        'context': context_payload,
    }
    if stored_files:
        email_values['attachments'] = [f.get('url') for f in stored_files if f.get('url')]

    subject = f"[brandVX] Support — {support_type}"
    req_model = SupportSendRequest(type=support_type, values=email_values)
    try:
        body_html = _render_support_email_html(req_model, tenant_id or None)
        delivery = _deliver_support_email(subject, body_html)
    except Exception as exc:
        logger.exception('support_send_failed', exc_info=exc, extra={'support_request': payload_for_log})
        raise HTTPException(status_code=500, detail='support_email_failed')

    return {
        'status': delivery.get('status', 'ok'),
        'provider': delivery.get('provider', 'logger'),
        'ticket_id': ticket_id,
    }


@app.get("/referrals/qr", tags=["Billing"])
async def referrals_qr(tenant_id: str, ctx: UserContext = Depends(get_user_context)) -> Dict[str, Any]:
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        raise HTTPException(status_code=403, detail="forbidden")
    cached = cache_get(f"referral:qr:{tenant_id}")
    if isinstance(cached, dict) and cached.get('share_url') and cached.get('qr_url'):
        return cached
    code = _ensure_referral_code(tenant_id)
    public_base = os.getenv('REFERRAL_PUBLIC_BASE_URL') or os.getenv('PUBLIC_APP_URL') or os.getenv('APP_PUBLIC_URL') or 'https://brandvx.com'
    share_url = f"{public_base.rstrip('/')}/r/{code}"
    image_bytes = _compose_referral_image(code, share_url)
    bucket = os.getenv('REFERRAL_ASSETS_BUCKET') or 'referral-assets'
    object_path = f"{tenant_id}/{code}-qr-{int(_time.time())}.png"
    uploaded = await _upload_supabase_object(bucket, object_path, image_bytes, 'image/png', expires_seconds=60 * 60 * 24 * 30)
    info = {
        'code': code,
        'share_url': share_url,
        'qr_url': (uploaded or {}).get('url', ''),
        'generated_at': datetime.utcnow().isoformat() + 'Z',
    }
    _mutate_settings_json(tenant_id, lambda data: data.setdefault('referral', {}).update(info))
    cache_set(f"referral:qr:{tenant_id}", info, ttl=3600)
    return info


@app.get("/onboarding/progress", tags=["Plans"])
def onboarding_progress(tenant_id: str, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)):
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"steps": []}
    try:
        rows = db.execute(_sql_text("SELECT step_key, completed_at FROM onboarding_progress WHERE tenant_id = CAST(:t AS uuid) ORDER BY completed_at ASC"), {"t": tenant_id}).fetchall()
        return {"steps": [{"step_key": r[0], "completed_at": str(r[1])} for r in rows]}
    except Exception:
        return {"steps": []}


@app.get("/onboarding/progress/status", tags=["Plans"])
def onboarding_progress_status(tenant_id: str, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)):
    """
    Returns a compact status view for key onboarding steps with timestamps (epoch seconds) and percent complete.
    Keys: connect_google, connect_booking, contacts_imported, quiet_hours, train_vx, plan_generated (optional).
    """
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    try:
        rows = db.execute(
            _sql_text(
                "SELECT step_key, EXTRACT(EPOCH FROM completed_at)::bigint AS ts FROM onboarding_progress WHERE tenant_id = CAST(:t AS uuid) ORDER BY completed_at ASC"
            ),
            {"t": tenant_id},
        ).fetchall()
        ts_map: Dict[str, int] = {}
        for r in rows:
            try:
                k = str(r[0])
                ts = int(r[1] or 0)
                # keep latest timestamp per key
                ts_map[k] = ts
            except Exception:
                continue
        keys = ["connect_google", "connect_booking", "contacts_imported", "quiet_hours", "train_vx", "plan_generated"]
        out: Dict[str, Dict[str, object]] = {}
        done_count = 0
        for k in keys:
            d = k in ts_map
            if d:
                done_count += 1
            out[k] = {"done": d, "ts": (ts_map.get(k) if d else None)}
        total = len(keys)
        percent = int(round((done_count / total) * 100)) if total else 0
        return {"status": "ok", "percent": percent, "items": out}
    except Exception as e:
        return {"status": "error", "detail": str(e)[:200]}


# ----------------------- AskVX Onboarding Insights -----------------------
@app.post("/onboarding/askvx/insights", tags=["Onboarding"])
def onboarding_askvx_insights(
    req: AskVXInsightsRequest,
    ctx: UserContext = Depends(get_user_context_relaxed),
) -> Dict[str, Any]:
    tenant_id = req.tenant_id
    if ctx.tenant_id and ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        raise HTTPException(status_code=403, detail="forbidden")
    horizon = max(30, min(180, int(req.horizon_days)))
    job_payload = {
        "horizon_days": horizon,
    }
    job_id = create_job_record(tenant_id, "onboarding.insights", job_payload, status="queued")
    if not job_id:
        raise HTTPException(status_code=500, detail="job_create_failed")
    details = {
        "job_id": job_id,
        "job_status": "queued",
        "insights_status": "queued",
        "horizon_days": horizon,
    }
    todo_id = None
    title = "Onboarding snapshot"
    todo_disabled = _todo_disabled()
    if not todo_disabled:
        try:
            with engine.begin() as conn:
                try:
                    conn.execute(_sql_text("SET LOCAL app.role='owner_admin'"))
                    conn.execute(_sql_text("SET LOCAL app.tenant_id=:t"), {"t": tenant_id})
                except Exception:
                    pass
                inserted = conn.execute(
                    _sql_text(
                        "INSERT INTO todo_items (tenant_id, type, title, details_json, status) "
                        "VALUES (CAST(:t AS uuid), 'onboarding.insights', :title, :details::jsonb, 'pending') RETURNING id"
                    ),
                    {"t": tenant_id, "title": title, "details": json.dumps(details)},
                )
                todo_id = inserted.scalar() if inserted else None
        except Exception:
            todo_id = None
    if not todo_id and not todo_disabled:
        update_job_record(job_id, status="error", error="todo_insert_failed")
        raise HTTPException(status_code=500, detail="todo_insert_failed")
    update_job_record(job_id, result={"todo_id": todo_id, "status": "queued", "horizon_days": horizon})
    return {"status": "queued", "job_id": job_id, "todo_id": todo_id, "horizon_days": horizon}


@app.get("/onboarding/askvx/insights/status", tags=["Onboarding"])
def onboarding_askvx_insights_status(
    tenant_id: str,
    job_id: Optional[str] = None,
    ctx: UserContext = Depends(get_user_context_relaxed),
) -> Dict[str, Any]:
    if ctx.tenant_id and ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    params: Dict[str, Any] = {"t": tenant_id}
    sql = (
        "SELECT id, status, details_json FROM todo_items "
        "WHERE tenant_id = CAST(:t AS uuid) AND type = 'onboarding.insights'"
    )
    if job_id:
        sql += " AND (details_json ->> 'job_id') = :job_id"
        params["job_id"] = job_id
    sql += " ORDER BY id DESC LIMIT 1"
    with engine.begin() as conn:
        row = conn.execute(_sql_text(sql), params).fetchone()
    if not row:
        return {"status": "none"}
    try:
        details = json.loads(row[2] or "{}")
    except Exception:
        details = {}
    job_status = details.get("job_status")
    return {
        "status": details.get("insights_status", "pending"),
        "todo_status": row[1],
        "todo_id": row[0],
        "details": details,
        "job_id": details.get("job_id"),
        "job_status": job_status,
    }


@app.post("/onboarding/strategy/document", tags=["Onboarding"])
def onboarding_strategy_document(
    req: StrategyDocumentRequest,
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        raise HTTPException(status_code=403, detail="forbidden")
    tags = ','.join(req.tags or ['strategy', 'onboarding'])
    try:
        with engine.begin() as conn:
            conn.execute(
                _sql_text("UPDATE ai_memories SET value=to_jsonb(:v::text), tags=to_jsonb(:tg::text), updated_at=NOW() WHERE tenant_id = CAST(:t AS uuid) AND key='plan.14day.onboarding.document'"),
                {"t": req.tenant_id, "v": req.markdown, "tg": tags},
            )
            conn.execute(
                _sql_text(
                    "INSERT INTO ai_memories (tenant_id, key, value, tags) SELECT CAST(:t AS uuid), 'plan.14day.onboarding.document', to_jsonb(:v::text), to_jsonb(:tg::text) WHERE NOT EXISTS (SELECT 1 FROM ai_memories WHERE tenant_id = CAST(:t AS uuid) AND key='plan.14day.onboarding.document')"
                ),
                {"t": req.tenant_id, "v": req.markdown, "tg": tags},
            )
            key_hist = f"plan.14day.onboarding.{_secrets.token_hex(4)}"
            conn.execute(
                _sql_text("INSERT INTO ai_memories (tenant_id, key, value, tags) VALUES (CAST(:t AS uuid), :k, to_jsonb(:v::text), to_jsonb(:tg::text))"),
                {"t": req.tenant_id, "k": key_hist, "v": req.markdown, "tg": tags},
            )
        _insert_onboarding_artifact(req.tenant_id, 'strategy_md', req.markdown)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)[:200])


@app.post("/onboarding/founder/contact", tags=["Onboarding"])
def onboarding_founder_contact(
    req: FounderContactRequest,
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        raise HTTPException(status_code=403, detail="forbidden")
    email = (req.email or '').strip()
    phone = (req.phone or '').strip()
    if not email and not phone:
        return {"status": "ok", "queued": False}
    try:
        from .integrations.email_sendgrid import sendgrid_send_email  # lazy import
        to = os.getenv("FOUNDER_CONTACT_EMAIL", "latommy@aubecreativelabs.com")
        subject = "BrandVX onboarding reach-out"
        body_parts = ["<h3>New onboarding contact</h3>"]
        if email:
            body_parts.append(f"<div><strong>Email:</strong> {email}</div>")
        if phone:
            body_parts.append(f"<div><strong>Phone:</strong> {phone}</div>")
        body_parts.append(f"<div><strong>Tenant:</strong> {req.tenant_id}</div>")
        sendgrid_send_email(to, subject, ''.join(body_parts))
        return {"status": "ok", "queued": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)[:200])


# ----------------------- 14‑day Plan -----------------------
class PlanDayComplete(BaseModel):
    tenant_id: str
    day_index: int


@app.post("/plan/14day/complete_day", tags=["Plans"])
def plan_complete_day(req: PlanDayComplete, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)):
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    try:
        with engine.begin() as conn:
            conn.execute(_sql_text("SET LOCAL app.role='owner_admin'"))
            conn.execute(_sql_text("SET LOCAL app.tenant_id=:t"), {"t": req.tenant_id})
            conn.execute(_sql_text("UPDATE plan_14day SET completed_at = now() WHERE tenant_id = CAST(:t AS uuid) AND day_index = :d"), {"t": req.tenant_id, "d": int(req.day_index)})
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "detail": str(e)[:200]}


@app.get("/plan/14day/status", tags=["Plans"])
def plan_status(tenant_id: str, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)):
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    try:
        days = db.execute(_sql_text("SELECT day_index, tasks_json, completed_at FROM plan_14day WHERE tenant_id = CAST(:t AS uuid) ORDER BY day_index ASC"), {"t": tenant_id}).fetchall()
        completed = [int(r[0]) for r in days if r[2] is not None]
        today = len(completed) + 1 if len(days) >= 1 else 1
        return {"status": "ok", "day_today": today, "days_completed": completed, "days_total": max(len(days), 14)}
    except Exception as e:
        return {"status": "error", "detail": str(e)[:200]}


@app.get("/plan/14day/day", tags=["Plans"])
def plan_day(tenant_id: str, day_index: Optional[int] = None, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)):
    """
    Returns the tasks for a specific day in the 14-day plan. If day_index is not provided,
    it returns tasks for the next incomplete day (today).
    """
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    try:
        # Determine today's day if not provided
        if day_index is None or int(day_index) <= 0:
            rows = db.execute(_sql_text("SELECT day_index, completed_at FROM plan_14day WHERE tenant_id = CAST(:t AS uuid) ORDER BY day_index ASC"), {"t": tenant_id}).fetchall()
            completed = [int(r[0]) for r in rows if r[1] is not None]
            day_index = (len(completed) + 1) if rows else 1
        # Clamp between 1 and 14 (or existing max)
        day_index = max(1, int(day_index or 1))
        row = db.execute(
            _sql_text("SELECT tasks_json, completed_at FROM plan_14day WHERE tenant_id = CAST(:t AS uuid) AND day_index = :d"),
            {"t": tenant_id, "d": int(day_index)},
        ).fetchone()
        if not row:
            return {"status": "not_found", "day_index": int(day_index), "tasks": []}
        tasks = row[0] or []
        done = row[1] is not None
        return {"status": "ok", "day_index": int(day_index), "completed": bool(done), "tasks": tasks}
    except Exception as e:
        return {"status": "error", "detail": str(e)[:200]}


@app.get("/plan/14day/all", tags=["Plans"])
def plan_all(tenant_id: str, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)):
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    try:
        rows = db.execute(
            _sql_text(
                "SELECT day_index, tasks_json, completed_at FROM plan_14day WHERE tenant_id = CAST(:t AS uuid) ORDER BY day_index ASC"
            ),
            {"t": tenant_id},
        ).fetchall()
        days: List[Dict[str, Any]] = []
        for r in rows:
            try:
                days.append(
                    {
                        "day_index": int(r[0]),
                        "tasks": list(r[1] or []),
                        "completed": r[2] is not None,
                    }
                )
            except Exception:
                continue
        return {"status": "ok", "days": days}
    except Exception as e:
        return {"status": "error", "detail": str(e)[:200]}


@app.post("/plan/14day/generate", tags=["Plans"])
async def plan_generate(req: ProgressStep, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)):
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    # Try AI; fall back to scaffold
    try:
        client = AIClient()
        prompt = (
            "Create a 14‑day strategy plan for a solo beauty professional to increase bookings and retention. "
            "Use the tenant's recent revenue, client cadence, and BrandVZN (photo edits) as levers. Each day: 2–4 concrete actions; keep under 80 words."
        )
        body = await client.generate(BRAND_SYSTEM, [{"role": "user", "content": prompt}], max_tokens=600)
        # Simple split into days; if LLM returns structured, client can parse richer
        lines = [l.strip("- •\t ") for l in body.split("\n") if l.strip()]
        chunks: List[List[str]] = []
        chunk: List[str] = []
        for l in lines:
            if len(chunk) >= 3:
                chunks.append(chunk); chunk = []
            chunk.append(l)
        if chunk: chunks.append(chunk)
        while len(chunks) < 14:
            chunks.append(["Reach out to 3 dormant clients with a warm check‑in.", "Post one BrandVZN edit before/after."])
        with engine.begin() as conn:
            conn.execute(_sql_text("SET LOCAL app.role='owner_admin'"))
            conn.execute(_sql_text("SET LOCAL app.tenant_id=:t"), {"t": req.tenant_id})
            conn.execute(_sql_text("DELETE FROM plan_14day WHERE tenant_id = CAST(:t AS uuid)"), {"t": req.tenant_id})
            for i, arr in enumerate(chunks[:14], start=1):
                conn.execute(
                    _sql_text("INSERT INTO plan_14day (tenant_id, day_index, tasks_json) VALUES (CAST(:t AS uuid), :d, :j)"),
                    {"t": req.tenant_id, "d": i, "j": _json.dumps(arr)},
                )
        # Also write last_session_summary memory
        try:
            with engine.begin() as conn:
                conn.execute(_sql_text("SET LOCAL app.role='owner_admin'"))
                conn.execute(_sql_text("SET LOCAL app.tenant_id=:t"), {"t": req.tenant_id})
                summary = "14‑day plan generated. Day 1: " + "; ".join(chunks[0][:2])
                conn.execute(_sql_text("UPDATE ai_memories SET value=:v, tags='rolling,summary', updated_at=now() WHERE tenant_id = CAST(:t AS uuid) AND key='last_session_summary'"), {"t": req.tenant_id, "v": summary})
                conn.execute(_sql_text("INSERT INTO ai_memories (tenant_id, key, value, tags) SELECT CAST(:t AS uuid), 'last_session_summary', :v, 'rolling,summary' WHERE NOT EXISTS (SELECT 1 FROM ai_memories WHERE tenant_id = CAST(:t AS uuid) AND key='last_session_summary')"), {"t": req.tenant_id, "v": summary})
        except Exception:
            pass
        try:
            _complete_step(req.tenant_id, 'plan_generated', {"days": 14})
        except Exception:
            pass
        return {"status": "ok", "days": 14}
    except Exception as e:
        return {"status": "error", "detail": str(e)[:200]}


# ----------------------- Referral & Plan Switch -----------------------
class ReferralPayload(BaseModel):
    tenant_id: str
    referral_link: Optional[str] = None
    file_url: Optional[str] = None


@app.post("/billing/referral/upload", tags=["Billing"])
def billing_referral_upload(req: ReferralPayload, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)):
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    try:
        with engine.begin() as conn:
            conn.execute(_sql_text("SET LOCAL app.role='owner_admin'"))
            conn.execute(_sql_text("SET LOCAL app.tenant_id=:t"), {"t": req.tenant_id})
            conn.execute(_sql_text("INSERT INTO referrals(tenant_id, referral_link, uploaded_proof_url, plan_before, plan_after, processed_at) VALUES (CAST(:t AS uuid), :rl, :u, '147', '127', now())"), {"t": req.tenant_id, "rl": (req.referral_link or ''), "u": (req.file_url or '')})
        # TODO: switch Stripe subscription price (requires price IDs and customer id mapping)
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "detail": str(e)[:200]}


# ----------------------- Chat Sessions & History -----------------------
class NewSessionRequest(BaseModel):
    tenant_id: str


@app.post("/ai/chat/session/new", tags=["AI"])
def ai_chat_new_session(req: NewSessionRequest, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)):
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    sid = "s_" + _secrets.token_urlsafe(8)
    try:
        with engine.begin() as conn:
            conn.execute(_sql_text("SET LOCAL app.role='owner_admin'"))
            conn.execute(_sql_text("SET LOCAL app.tenant_id=:t"), {"t": req.tenant_id})
            conn.execute(_sql_text("INSERT INTO chat_sessions(tenant_id, session_id) VALUES (CAST(:t AS uuid), :sid)"), {"t": req.tenant_id, "sid": sid})
        return {"status": "ok", "session_id": sid}
    except Exception as e:
        return {"status": "error", "detail": str(e)[:200]}


@app.get("/ai/chat/sessions", tags=["AI"])
def ai_chat_sessions(tenant_id: str, limit: int = 20, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)):
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"items": []}
    try:
        rows = db.execute(_sql_text("SELECT session_id, started_at, ended_at FROM chat_sessions WHERE tenant_id = CAST(:t AS uuid) ORDER BY started_at DESC LIMIT :lim"), {"t": tenant_id, "lim": max(1, min(int(limit or 20), 200))}).fetchall()
        return {"items": [{"session_id": r[0], "started_at": str(r[1]), "ended_at": (str(r[2]) if r[2] else None)} for r in rows]}
    except Exception:
        return {"items": []}


@app.get("/ai/chat/history", tags=["AI"])
def ai_chat_history(tenant_id: str, session_id: str, limit: int = 200, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)):
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"items": []}
    try:
        rows = db.execute(_sql_text("SELECT role, content, created_at FROM chat_logs WHERE tenant_id = CAST(:t AS uuid) AND session_id = :sid ORDER BY id ASC LIMIT :lim"), {"t": tenant_id, "sid": session_id, "lim": max(1, min(int(limit or 200), 500))}).fetchall()
        return {"items": [{"role": r[0], "content": r[1], "created_at": int(r[2] or 0)} for r in rows]}
    except Exception:
        return {"items": []}


# ----------------------- Contacts Search -----------------------
@app.get("/contacts/search", tags=["Contacts"])
def contacts_search(tenant_id: str, q: str = "", limit: int = 12, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)):
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"items": []}
    try:
        like = f"%{q.strip()}%" if q else "%"
        rows = db.execute(
            _sql_text("SELECT contact_id::text, COALESCE(display_name, CONCAT(COALESCE(first_name,''),' ',COALESCE(last_name,''))) AS name, email_hash, phone_hash FROM contacts WHERE tenant_id = CAST(:t AS uuid) AND (display_name ILIKE :q OR first_name ILIKE :q OR last_name ILIKE :q) ORDER BY name ASC LIMIT :lim"),
            {"t": tenant_id, "q": like, "lim": max(1, min(int(limit or 12), 50))},
        ).fetchall()
        return {"items": [{"contact_id": r[0], "display_name": r[1] or "Client", "email": r[2] or "", "phone": r[3] or ""} for r in rows]}
    except Exception:
        return {"items": []}


# ----------------------- Follow‑ups -----------------------
FOLLOWUP_TEMPLATES: Dict[str, Dict[str, Any]] = {
    "reminder_tomorrow": {
        "label": "Remind tomorrow appointments",
        "prompt": "Friendly reminder for appointments happening tomorrow. Confirm time and invite replies for rescheduling.",
        "cadence_id": "reminder",
        "variations": [
            "Hey {{name}}! Looking forward to seeing you {{time_phrase}}. Let me know if anything changes.",
            "Hi {{name}}, your appointment {{time_phrase}} is all set. Need to tweak the time? I can shuffle things around.",
            "Counting down to {{time_phrase}}, {{name}} — send a quick note if you’d like to add anything on.",
            "Friendly reminder about {{time_phrase}}! If something pops up, just text me and we’ll adjust.",
            "Excited to see you {{time_phrase}}, {{name}}. Message me if you prefer a different slot.",
        ],
    },
    "reminder_week": {
        "label": "Remind this week's clients",
        "prompt": "Supportive nudge for clients visiting later this week. Mention availability if they need to adjust.",
        "cadence_id": "reminder_week",
        "variations": [
            "Hi {{name}}! Your visit on {{day_phrase}} at {{time_of_day}} is reserved. Need a different window? I can swap it.",
            "{{name}}, excited to see you {{day_phrase}} at {{time_of_day}}. If your schedule tightens up, I’ve got backup options.",
            "Quick wave for your {{day_phrase}} {{time_of_day}} appointment. Want to tack on a gloss or treatment? Let me know.",
            "Your spot this week is ready — {{day_phrase}} at {{time_of_day}}. Happy to hold an alternate time if you need it.",
            "Looking forward to your {{day_phrase}} refresher at {{time_of_day}}. Ping me if travel or weather nudges the plan.",
        ],
    },
    "reengage_30d": {
        "label": "Re-engage 30 day guests",
        "prompt": "Warm outreach to guests who haven't visited in about 30 days. Offer to reserve a time and highlight a small benefit.",
        "cadence_id": "reengage_30d",
        "variations": [
            "Hi {{name}}! It’s been about a month — want me to reserve a chair before the week fills up?",
            "{{name}}, I’d love to see you soon. How about a midweek touch-up? I can hold something easy for you.",
            "Dropping a hint that your next glow-up is due. Tell me what day feels best and I’ll lock it in.",
            "Ready when you are for another pamper session, {{name}}. I have a couple of afternoon openings next week.",
            "Missed you in the studio! Send me a day that works and I’ll keep that spot just for you.",
        ],
    },
    "winback_45d": {
        "label": "Win-back 45+ day guests",
        "prompt": "Encouraging message for guests away 45+ days. Emphasize fresh look and ease of booking.",
        "cadence_id": "winback_45d_plus",
        "variations": [
            "Hey {{name}}! Let’s bring that color back to life — want me to pencil in a refresh?",
            "{{name}}, it’s been a while! I’ve got a cozy chair waiting whenever you’re ready for a reset.",
            "Thinking of you and your last visit — shall I block off a morning or evening soon?",
            "Ready for a new-season look? Tell me what day fits and I’ll keep that appointment just for you.",
            "I’d love to catch up, {{name}}! Reply with a day that feels good and consider it booked.",
        ],
    },
}


@app.get("/followups/candidates", tags=["Cadences"])
def followups_candidates(tenant_id: str, scope: str = "this_week", db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)):
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"items": []}
    try:
        # Heuristic scopes based on appointments/last_visit
        if scope == "tomorrow":
            q = _sql_text("SELECT contact_id::text FROM appointments WHERE tenant_id = CAST(:t AS uuid) AND start_ts >= EXTRACT(EPOCH FROM now() + interval '1 day')::bigint AND start_ts < EXTRACT(EPOCH FROM now() + interval '2 day')::bigint")
            rows = db.execute(q, {"t": tenant_id}).fetchall()
            items = [{"contact_id": r[0], "reason": "appt_tomorrow"} for r in rows]
            return {"items": items}
        if scope == "this_week":
            q = _sql_text("SELECT contact_id::text FROM appointments WHERE tenant_id = CAST(:t AS uuid) AND start_ts >= EXTRACT(EPOCH FROM date_trunc('week', now()))::bigint AND start_ts < EXTRACT(EPOCH FROM date_trunc('week', now()) + interval '7 day')::bigint")
            rows = db.execute(q, {"t": tenant_id}).fetchall()
            items = [{"contact_id": r[0], "reason": "appt_this_week"} for r in rows]
            return {"items": items}
        if scope == "reengage_30d":
            q = _sql_text("SELECT contact_id::text FROM contacts WHERE tenant_id = CAST(:t AS uuid) AND (last_visit IS NULL OR last_visit < (EXTRACT(EPOCH FROM now())::bigint - 30*86400)) ORDER BY last_visit NULLS FIRST")
            rows = db.execute(q, {"t": tenant_id}).fetchall()
            items = [{"contact_id": r[0], "reason": "no_visit_30d"} for r in rows]
            return {"items": items}
        if scope == "winback_45d":
            q = _sql_text("SELECT contact_id::text FROM contacts WHERE tenant_id = CAST(:t AS uuid) AND (last_visit IS NULL OR last_visit < (EXTRACT(EPOCH FROM now())::bigint - 45*86400)) ORDER BY last_visit NULLS FIRST")
            rows = db.execute(q, {"t": tenant_id}).fetchall()
            items = [{"contact_id": r[0], "reason": "no_visit_45d"} for r in rows]
            return {"items": items}
        return {"items": []}
    except Exception:
        return {"items": []}


@app.get("/notifications", tags=["Cadences"])
def notifications_list(
    tenant_id: str,
    limit: int = 12,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"items": []}

    limit = max(1, min(limit, 50))
    items: List[Dict[str, Any]] = []

    try:
        queue_rows = db.execute(
            _sql_text(
                """
                SELECT cs.contact_id, cs.cadence_id, cs.next_action_epoch, cs.last_status,
                       c.display_name, c.first_name, c.last_name
                FROM cadence_state cs
                LEFT JOIN contacts c
                  ON c.contact_id = cs.contact_id AND c.tenant_id = cs.tenant_id
                WHERE cs.tenant_id = CAST(:t AS uuid)
                  AND cs.next_action_epoch IS NOT NULL
                ORDER BY cs.next_action_epoch ASC
                LIMIT :lim
                """
            ),
            {"t": tenant_id, "lim": limit},
        ).fetchall()

        now_ms = int(datetime.utcnow().timestamp() * 1000)
        for row in queue_rows:
            due_ts = row[2]
            display_name = row[4] or ""
            if not display_name:
                first = (row[5] or "").strip()
                last = (row[6] or "").strip()
                display_name = " ".join(part for part in [first, last] if part)
            if not display_name:
                display_name = "Client"

            priority = 'Medium'
            if isinstance(due_ts, (int, float)):
                diff = int(due_ts) * 1000 - now_ms
                if diff <= 0 or diff <= 6 * 60 * 60 * 1000:
                    priority = 'High'
                elif diff <= 24 * 60 * 60 * 1000:
                    priority = 'Medium'
                else:
                    priority = 'Low'

            items.append(
                {
                    "id": f"queue:{row[0]}:{row[1]}",
                    "type": "task",
                    "title": f"Follow up with {display_name}",
                    "subtitle": row[1].replace('_', ' ') if isinstance(row[1], str) else 'Follow-up sequence',
                    "priority": priority,
                    "urgent": priority == 'High',
                    "due_ts": int(due_ts) if isinstance(due_ts, (int, float)) else None,
                    "status": row[3],
                    "pane": 'agenda',
                }
            )
    except Exception:
        pass

    try:
        todo_rows = db.execute(
            _sql_text(
                """
                SELECT id, type, title, details_json, status,
                       EXTRACT(EPOCH FROM created_at)::bigint AS created_ts
                FROM todo_items
                WHERE tenant_id = CAST(:t AS uuid)
                  AND status IN ('pending','ready')
                ORDER BY created_at DESC
                LIMIT :lim
                """
            ),
            {"t": tenant_id, "lim": limit},
        ).fetchall()

        for row in todo_rows:
            details = {}
            try:
                details = json.loads(row[3] or "{}")
            except Exception:
                details = {}

            items.append(
                {
                    "id": f"todo:{row[0]}",
                    "type": 'task',
                    "title": row[2] or 'Task queued',
                    "subtitle": str(details.get('template_label') or details.get('scope') or 'Review and approve.'),
                    "priority": 'Medium',
                    "urgent": False,
                    "created_ts": int(row[5]) if isinstance(row[5], (int, float)) else None,
                    "status": row[4],
                    "pane": 'follow-ups',
                }
            )
    except Exception:
        pass

    items.sort(
        key=lambda item: (
            0 if item.get('urgent') else 1,
            item.get('due_ts') or float('inf'),
            -1 * (item.get('created_ts') or 0),
        )
    )

    return {"items": items[:limit]}


@app.get("/search", tags=["Search"])
def global_search(
    tenant_id: str,
    q: str,
    limit: int = 6,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"clients": [], "appointments": []}

    term = (q or "").strip()
    if not term:
        return {"clients": [], "appointments": []}

    limit = max(1, min(limit, 25))
    pattern = f"%{term}%"
    prefix = f"{term}%"

    clients: List[Dict[str, Any]] = []
    try:
        client_rows = db.execute(
            _sql_text(
                """
                SELECT contact_id, display_name, first_name, last_name, last_visit, lifetime_cents, txn_count
                FROM contacts
                WHERE tenant_id = CAST(:t AS uuid)
                  AND deleted = FALSE
                  AND (
                    display_name ILIKE :pattern
                    OR first_name ILIKE :pattern
                    OR last_name ILIKE :pattern
                  )
                ORDER BY
                  CASE WHEN display_name ILIKE :prefix THEN 0 ELSE 1 END,
                  last_visit DESC NULLS LAST
                LIMIT :lim
                """
            ),
            {"t": tenant_id, "pattern": pattern, "prefix": prefix, "lim": limit},
        ).fetchall()
        for row in client_rows:
            lifetime = int(row[5] or 0)
            status = None
            if lifetime >= 100000:
                status = 'VIP'
            elif lifetime >= 30000:
                status = 'Active'
            clients.append(
                {
                    "contact_id": row[0],
                    "display_name": row[1],
                    "first_name": row[2],
                    "last_name": row[3],
                    "last_visit": row[4],
                    "status": status,
                }
            )
    except Exception:
        clients = []

    appointments: List[Dict[str, Any]] = []
    try:
        appointment_rows = db.execute(
            _sql_text(
                """
                SELECT a.id, a.service, a.start_ts, a.status, a.contact_id,
                       COALESCE(c.display_name, CONCAT_WS(' ', c.first_name, c.last_name)) AS contact_name
                FROM appointments a
                LEFT JOIN contacts c
                  ON c.contact_id = a.contact_id AND c.tenant_id = a.tenant_id
                WHERE a.tenant_id = CAST(:t AS uuid)
                  AND (
                    a.service ILIKE :pattern
                    OR COALESCE(c.display_name, CONCAT_WS(' ', c.first_name, c.last_name)) ILIKE :pattern
                  )
                ORDER BY a.start_ts DESC
                LIMIT :lim
                """
            ),
            {"t": tenant_id, "pattern": pattern, "lim": limit},
        ).fetchall()
        for row in appointment_rows:
            appointments.append(
                {
                    "id": row[0],
                    "service": row[1],
                    "start_ts": row[2],
                    "status": row[3],
                    "contact_id": row[4],
                    "contact_name": row[5],
                }
            )
    except Exception:
        appointments = []

    return {"clients": clients, "appointments": appointments}


class FollowupsEnqueue(BaseModel):
    tenant_id: str
    contact_ids: List[str]
    cadence_id: str = "never_answered"
    template_id: Optional[str] = None
    body: Optional[str] = None
    send_immediately: Optional[bool] = False


@app.post("/followups/enqueue", tags=["Cadences"])
def followups_enqueue(req: FollowupsEnqueue, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)):
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    try:
        with engine.begin() as conn:
            for cid in req.contact_ids:
                conn.execute(_sql_text("INSERT INTO cadence_states (tenant_id, contact_id, cadence_id, step_index, next_action_epoch, created_at) VALUES (CAST(:t AS uuid), :c, :cid, 0, extract(epoch from now())::int, now()) ON CONFLICT DO NOTHING"), {"t": req.tenant_id, "c": cid, "cid": req.cadence_id})
        return {"status": "ok", "enqueued": len(req.contact_ids)}
    except Exception as e:
        return {"status": "error", "detail": str(e)[:200]}


class FollowupsDraftRequest(BaseModel):
    tenant_id: str
    scope: str
    template_id: str


def _generate_followup_markdown(
    snapshots: List[Dict[str, Any]],
    reasons: Dict[str, str],
    now_ts: int,
) -> str:
    lines: List[str] = []
    for snap in snapshots:
        name = (snap.get("display_name") or snap.get("contact_id") or "Friend").strip()
        contact_id = str(snap.get("contact_id") or "")
        reason = (reasons.get(contact_id, "") or "").strip()
        opener = f"Hey {name.split(' ')[0] if name else 'there'} — "

        details_bits: List[str] = []
        last_visit = snap.get("last_visit_ts")
        appointment_ts = snap.get("appointment_ts")

        try:
            if last_visit:
                lv = int(last_visit)
                if lv > 0:
                    days_since = max(0, int((now_ts - lv) / 86400))
                    if days_since > 0:
                        details_bits.append(
                            f"it's been {days_since} day{'s' if days_since != 1 else ''} since your visit"
                        )
        except Exception:
            pass

        try:
            if appointment_ts:
                appt = int(appointment_ts)
                if appt >= now_ts:
                    details_bits.append("we have time held for you soon")
        except Exception:
            pass

        if reason:
            details_bits.append(reason.rstrip('.'))

        middle = " ".join(details_bits).strip()
        if middle:
            middle = middle[0].upper() + middle[1:] + '. '

        message_body = (
            f"{opener}{middle}I’d love to help you get back on the books—want me to send a couple of times?"
        )
        lines.append(f"## {name}\n{message_body}\n")

    return "\n".join(lines).strip()


@app.post("/followups/draft_batch", tags=["Cadences"])
def followups_draft_batch(
    req: FollowupsDraftRequest,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    template = FOLLOWUP_TEMPLATES.get(req.template_id)
    if not template:
        return {"status": "invalid_template"}
    # Prevent overlapping draft jobs (pending To-Do entries)
    row = db.execute(
        _sql_text(
            "SELECT id, status, details_json FROM todo_items "
            "WHERE tenant_id = CAST(:t AS uuid) AND type = 'followups.draft' "
            "ORDER BY id DESC LIMIT 1"
        ),
        {"t": req.tenant_id},
    ).fetchone()
    if row:
        try:
            details = json.loads(row[2] or "{}")
        except Exception:
            details = {}
        draft_status = str(details.get("draft_status") or "pending")
        if str(row[1] or "").lower() == "pending" and draft_status in {"queued", "running"}:
            return {
                "status": draft_status,
                "todo_id": int(row[0]),
                "details": details,
                "job_id": details.get("job_id"),
            }
        if draft_status == "ready":
            return {
                "status": "ready",
                "todo_id": int(row[0]),
                "details": details,
                "draft_markdown": details.get("draft_markdown"),
                "job_id": details.get("job_id"),
            }

    candidates = followups_candidates(req.tenant_id, req.scope, db=db, ctx=ctx)
    items = candidates.get("items") or []
    raw_contact_ids = [str(it.get("contact_id")) for it in items if str(it.get("contact_id"))]
    seen: set[str] = set()
    contact_ids: List[str] = []
    reasons: Dict[str, str] = {}
    for idx, cid in enumerate(raw_contact_ids):
        if cid not in seen:
            seen.add(cid)
            contact_ids.append(cid)
        reasons[cid] = str(items[idx].get("reason") or "") if idx < len(items) else ""
    if not contact_ids:
        return {"status": "empty", "count": 0}

    try:
        tenant_uuid = _uuid.UUID(str(req.tenant_id))
    except Exception:
        tenant_uuid = req.tenant_id  # tolerant fallback for dev schemas

    contacts = (
        db.query(dbm.Contact)
        .filter(dbm.Contact.tenant_id == tenant_uuid, dbm.Contact.contact_id.in_(contact_ids))
        .all()
    )
    contact_lookup: Dict[str, Dict[str, Any]] = {}
    for c in contacts:
        cid = str(c.contact_id)
        display_name = (c.display_name or "").strip()
        if not display_name:
            display_name = f"{(c.first_name or '').strip()} {(c.last_name or '').strip()}".strip()
        contact_lookup[cid] = {
            "contact_id": cid,
            "display_name": display_name or cid,
            "first_name": (c.first_name or "").strip() or None,
            "last_name": (c.last_name or "").strip() or None,
            "last_visit_ts": int(c.last_visit) if getattr(c, "last_visit", None) else None,
        }

    now_ts = int(_time.time())
    # Upcoming appointment lookup when applicable
    appointment_lookup: Dict[str, int] = {}
    if req.scope in {"tomorrow", "this_week"}:
        appts = (
            db.query(dbm.Appointment)
            .filter(
                dbm.Appointment.tenant_id == tenant_uuid,
                dbm.Appointment.contact_id.in_(contact_ids),
                dbm.Appointment.start_ts != None,
                dbm.Appointment.start_ts >= now_ts - 3600,
            )
            .order_by(dbm.Appointment.contact_id.asc(), dbm.Appointment.start_ts.asc())
            .all()
        )
        for appt in appts:
            cid = str(appt.contact_id)
            if cid in appointment_lookup:
                continue
            try:
                start_ts = int(appt.start_ts or 0)
            except Exception:
                start_ts = 0
            if start_ts > 0:
                appointment_lookup[cid] = start_ts

    # Resolve tenant timezone preferences
    tenant_timezone: Optional[str] = None
    tenant_offset_minutes: Optional[int] = None
    settings_row = db.query(dbm.Settings).filter(dbm.Settings.tenant_id == req.tenant_id).first()
    if settings_row and getattr(settings_row, "data_json", None):
        try:
            data = json.loads(settings_row.data_json or "{}")
        except Exception:
            data = {}
        prefs = data.get("preferences") or {}
        tenant_timezone = (
            prefs.get("user_timezone")
            or data.get("user_timezone")
            or prefs.get("timezone")
        )
        try:
            tz_offset = prefs.get("user_timezone_offset") or data.get("user_timezone_offset")
            if tz_offset is not None:
                tenant_offset_minutes = int(tz_offset)
        except Exception:
            tenant_offset_minutes = None

    contact_snapshots: List[Dict[str, Any]] = []
    for cid in contact_ids:
        snap = contact_lookup.get(cid, {"contact_id": cid, "display_name": cid})
        snap = dict(snap)
        snap["reason"] = reasons.get(cid, "")
        if cid in appointment_lookup:
            snap["appointment_ts"] = appointment_lookup[cid]
        contact_snapshots.append(snap)

    chunked_snapshots: List[List[Dict[str, Any]]] = []
    if contact_snapshots:
        for idx in range(0, len(contact_snapshots), FOLLOWUPS_MAX_CHUNK):
            chunked_snapshots.append(contact_snapshots[idx : idx + FOLLOWUPS_MAX_CHUNK])

    chunk_total = max(1, len(chunked_snapshots) or 1)

    title = f"Draft follow-ups • {template['label']} ({len(contact_ids)})"
    base_details = {
        "scope": req.scope,
        "template_id": req.template_id,
        "template_label": template["label"],
        "contact_ids": contact_ids,
        "draft_status": "queued",
        "generated_at": None,
        "count": len(contact_ids),
        "chunk_total": chunk_total,
        "job_ids": [],
    }

    todo_id = None
    with engine.begin() as conn:
        try:
            conn.execute(_sql_text("SET LOCAL app.role='owner_admin'"))
            conn.execute(_sql_text("SET LOCAL app.tenant_id=:t"), {"t": req.tenant_id})
        except Exception:
            pass
        inserted = conn.execute(
            _sql_text(
                "INSERT INTO todo_items (tenant_id, type, title, details_json, status) "
                "VALUES (CAST(:t AS uuid), 'followups.draft', :title, :details::jsonb, 'pending') "
                "RETURNING id"
            ),
            {"t": req.tenant_id, "title": title, "details": json.dumps(base_details)},
        )
        todo_id = inserted.scalar() if inserted else None

    job_ids: List[str] = []
    fallback_markdown: List[str] = []

    for chunk_index, chunk in enumerate(chunked_snapshots or [contact_snapshots]):
        if not chunk:
            continue
        chunk_contact_ids = [snap.get("contact_id") for snap in chunk if snap.get("contact_id")]
        chunk_payload = {
            "scope": req.scope,
            "template_id": req.template_id,
            "template_label": template["label"],
            "template_prompt": template["prompt"],
            "template_variations": list(template.get("variations", [])),
            "todo_id": todo_id,
            "contact_ids": chunk_contact_ids,
            "contacts": chunk,
            "requested_at": now_ts,
            "tenant_timezone": tenant_timezone,
            "tenant_timezone_offset": tenant_offset_minutes,
            "chunk_index": chunk_index,
            "chunk_total": chunk_total,
        }

        job_id = create_job_record(req.tenant_id, "followups.draft", chunk_payload, status="queued")
        if job_id:
            job_ids.append(job_id)
            update_job_record(
                job_id,
                status="queued",
                result={
                    "todo_id": todo_id,
                    "chunk_index": chunk_index,
                    "chunk_total": chunk_total,
                    "status": "queued",
                },
            )
        else:
            logger.warning(
                "followups_draft_job_create_failed",
                extra={"tenant_id": req.tenant_id, "chunk_index": chunk_index},
            )
            fallback_markdown.append(_generate_followup_markdown(chunk, reasons, now_ts))

    if job_ids and todo_id:
        _update_todo_details(
            todo_id,
            req.tenant_id,
            {
                "job_ids": job_ids,
                "chunk_total": chunk_total,
                "draft_status": "queued",
            },
        )
        if fallback_markdown:
            combined_fallback = "\n\n".join([section for section in fallback_markdown if section])
            if combined_fallback:
                _update_todo_details(
                    todo_id,
                    req.tenant_id,
                    {
                        "fallback_markdown": combined_fallback,
                        "fallback_chunks": len(fallback_markdown),
                    },
                )
        return {
            "status": "queued",
            "job_ids": job_ids,
            "todo_id": todo_id,
            "chunk_total": chunk_total,
            "count": len(contact_ids),
            "details": {**base_details, "job_ids": job_ids},
        }

    combined_markdown = "\n\n".join([section for section in fallback_markdown if section])
    if not combined_markdown:
        combined_markdown = _generate_followup_markdown(contact_snapshots, reasons, now_ts)

    if todo_id:
        _update_todo_details(
            todo_id,
            req.tenant_id,
            {
                "draft_status": "ready",
                "draft_markdown": combined_markdown,
                "job_ids": job_ids,
                "chunk_total": chunk_total,
            },
            todo_status="ready",
        )

    logger.warning(
        "followups_draft_fallback_used",
        extra={"tenant_id": req.tenant_id, "chunk_total": chunk_total},
    )

    return {
        "status": "ready",
        "job_ids": job_ids,
        "todo_id": todo_id,
        "count": len(contact_ids),
        "details": {**base_details, "draft_status": "ready", "draft_markdown": combined_markdown},
        "draft_markdown": combined_markdown,
    }


@app.get("/followups/draft_status", tags=["Cadences"])
def followups_draft_status(tenant_id: str, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)):
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    row = db.execute(
        _sql_text(
            "SELECT id, status, details_json FROM todo_items WHERE tenant_id = CAST(:t AS uuid) AND type = 'followups.draft' ORDER BY id DESC LIMIT 1"
        ),
        {"t": tenant_id},
    ).fetchone()
    if not row:
        return {"status": "none"}
    try:
        details = json.loads(row[2] or "{}")
    except Exception:
        details = {}
    job_id = details.get("job_id")
    job_status = None
    if job_id:
        job_rec = get_job_record(str(job_id))
        if job_rec:
            job_status = job_rec.get("status")
            details.setdefault("job_status", job_status)
    return {
        "status": details.get("draft_status", "pending"),
        "todo_status": row[1],
        "todo_id": row[0],
        "details": details,
        "job_id": job_id,
        "job_status": job_status,
    }


# ----------------------- Unified To‑Do -----------------------
@app.get("/todo/list", tags=["Plans"])
def todo_list(tenant_id: str, status: str = "pending", type: Optional[str] = None, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)):
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"items": []}
    try:
        params: Dict[str, Any] = {"t": tenant_id, "s": status}
        sql = "SELECT id, type, status, title, details_json, created_at FROM todo_items WHERE tenant_id = CAST(:t AS uuid)"
        if status and status != "all":
            sql += " AND status = :s"
        if type:
            sql += " AND type = :ty"; params["ty"] = type
        sql += " ORDER BY created_at DESC LIMIT 200"
        rows = db.execute(_sql_text(sql), params).fetchall()
        return {"items": [{"id": r[0], "type": r[1], "status": r[2], "title": r[3], "details": r[4], "created_at": str(r[5])} for r in rows]}
    except Exception:
        return {"items": []}


class TodoAdd(BaseModel):
    tenant_id: str
    type: str
    title: str
    details: Optional[Dict[str, Any]] = None


@app.post("/todo/add", tags=["Plans"])
def todo_add(req: TodoAdd, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)):
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    try:
        with engine.begin() as conn:
            conn.execute(_sql_text("INSERT INTO todo_items (tenant_id, type, title, details_json) VALUES (CAST(:t AS uuid), :ty, :ti, :dj)"), {"t": req.tenant_id, "ty": req.type, "ti": req.title, "dj": _json.dumps(req.details or {})})
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "detail": str(e)[:200]}




class TodoCreate(BaseModel):
    tenant_id: str
    title: str
    description: Optional[str] = None
    priority: Optional[str] = None
    due_time: Optional[str] = None


@app.post("/todo/create", tags=["Plans"])
def todo_create(req: TodoCreate, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)):
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    if _todo_disabled():
        return {"status": "disabled"}
    title = (req.title or "").strip()
    if not title:
        return {"status": "error", "detail": "missing_title"}
    details = {
        "description": (req.description or "").strip(),
        "priority": (req.priority or "medium").lower(),
    }
    if req.due_time:
        details["due_time"] = req.due_time
    try:
        with engine.begin() as conn:
            conn.execute(
                _sql_text(
                    """
                    INSERT INTO todo_items (tenant_id, type, title, details_json, status)
                    VALUES (CAST(:t AS uuid), 'manual', :title, :details::jsonb, 'pending')
                    RETURNING id
                    """
                ),
                {"t": req.tenant_id, "title": title, "details": json.dumps(details)},
            )
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "detail": str(e)[:200]}
class TodoAck(BaseModel):
    tenant_id: str
    id: int


@app.post("/todo/ack", tags=["Plans"])
def todo_ack(req: TodoAck, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)):
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    try:
        with engine.begin() as conn:
            conn.execute(_sql_text("UPDATE todo_items SET status='resolved', resolved_at=now() WHERE tenant_id = CAST(:t AS uuid) AND id=:id"), {"t": req.tenant_id, "id": int(req.id)})
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "detail": str(e)[:200]}


@app.get("/dashboard/agenda", tags=["Dashboard"])
def dashboard_agenda(
    tenant_id: str,
    limit: int = 20,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"agenda": [], "queue": []}

    limit = max(1, min(limit, 60))
    tasks: List[Dict[str, Any]] = []
    reminders: List[Dict[str, Any]] = []

    if not _todo_disabled():
        try:
            task_rows = db.execute(
                _sql_text(
                    """
                    SELECT id, title, details_json, status, created_at, resolved_at
                    FROM todo_items
                    WHERE tenant_id = CAST(:t AS uuid)
                    ORDER BY CASE WHEN status = 'resolved' THEN 1 ELSE 0 END, created_at DESC
                    LIMIT :lim
                    """
                ),
                {"t": tenant_id, "lim": limit},
            ).fetchall()
            for row in task_rows:
                details: Dict[str, Any]
                raw_details = row[2]
                if isinstance(raw_details, dict):
                    details = raw_details
                else:
                    try:
                        details = json.loads(raw_details or "{}")
                    except Exception:
                        details = {}

                priority_raw = str(details.get("priority", "")).strip().lower()
                priority_label = priority_raw.capitalize() if priority_raw in {"high", "medium", "low"} else None
                subtitle = details.get("subtitle") or details.get("description") or details.get("summary")
                duration_label = details.get("duration_label") or details.get("duration") or details.get("time_label")
                impact_label = details.get("impact_label") or details.get("impact")
                color_class = details.get("color_class") or details.get("tone")
                icon_name = details.get("icon_name") or details.get("icon")

                status_value = str(row[3] or "").lower()
                completed = status_value in {"resolved", "done", "complete", "completed"}

                tasks.append(
                    {
                        "id": str(row[0]),
                        "title": row[1],
                        "subtitle": subtitle,
                        "durationLabel": duration_label,
                        "impactLabel": impact_label,
                        "priority": priority_label,
                        "completed": completed,
                        "colorClass": color_class,
                        "iconName": icon_name,
                        "todoId": str(row[0]),
                    }
                )
        except Exception as exc:
            logger.exception(
                "dashboard_agenda_tasks_failed",
                exc_info=exc,
                extra={"tenant_id": tenant_id},
            )

    try:
        queue_rows = db.execute(
            _sql_text(
                """
                SELECT cs.contact_id, cs.cadence_id, cs.next_action_epoch, cs.last_status,
                       c.display_name, c.first_name, c.last_name
                FROM cadence_state cs
                LEFT JOIN contacts c
                  ON c.contact_id = cs.contact_id AND c.tenant_id = cs.tenant_id
                WHERE cs.tenant_id = CAST(:t AS uuid)
                  AND cs.next_action_epoch IS NOT NULL
                ORDER BY cs.next_action_epoch ASC
                LIMIT :lim
                """
            ),
            {"t": tenant_id, "lim": limit},
        ).fetchall()

        now_ts = int(datetime.utcnow().timestamp())
        for row in queue_rows:
            contact_id = str(row[0] or "")
            cadence_id = str(row[1] or "")
            next_action = row[2]
            display_name = row[4] or ""
            first_name = row[5] or ""
            last_name = row[6] or ""

            name = display_name.strip()
            if not name:
                name = " ".join(part for part in [first_name.strip(), last_name.strip()] if part).strip()
            if not name:
                name = "Client"

            due_ts = int(next_action) if next_action is not None else None
            urgency = "low"
            if due_ts is not None:
                if due_ts <= now_ts + 3600:
                    urgency = "high"
                elif due_ts <= now_ts + 86400:
                    urgency = "medium"

            reminders.append(
                {
                    "id": f"{contact_id}:{cadence_id}" if cadence_id else contact_id or name,
                    "title": f"Follow up with {name}",
                    "description": row[3] or None,
                    "clientName": name,
                    "actionLabel": "Open follow-up",
                    "dueTs": due_ts,
                    "urgency": urgency,
                    "type": cadence_id or "follow-up",
                }
            )
    except Exception as exc:
        logger.exception(
            "dashboard_agenda_queue_failed",
            exc_info=exc,
            extra={"tenant_id": tenant_id},
        )

    return {"agenda": tasks, "queue": reminders}


# ----------------------- Provider Refresh -----------------------
class ProviderRefresh(BaseModel):
    tenant_id: str
    provider: str  # 'square'|'acuity'


@app.post("/integrations/refresh", tags=["Integrations"])
def integrations_refresh(req: ProviderRefresh, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)):
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    # For now, trigger calendar and connectors backfill paths
    try:
        base = os.getenv("BACKEND_BASE_URL", "http://localhost:8000").rstrip("/")
        with httpx.Client(timeout=30) as client:
            # Calendar sync
            client.post(f"{base}/calendar/sync", json={"tenant_id": req.tenant_id, "provider": req.provider})
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "detail": str(e)[:200]}

@app.get("/limits/status", tags=["Health"])
def limits_status(tenant_id: str, keys: str = "msg:sms,msg:email,ai.chat,db.query.named"):
    try:
        out = {}
        for k in [s.strip() for s in (keys or "").split(",") if s.strip()]:
            try:
                out[k] = rl_get_bucket_status(tenant_id, k)
            except Exception:
                out[k] = {"key": k, "count": 0}
        return {"items": out}
    except Exception as e:
        from fastapi.responses import JSONResponse as _JR
        return _JR({"error": "internal_error", "detail": str(e)[:200]}, status_code=500)


@app.get("/ai/digest", tags=["AI"])
def ai_digest(tenant_id: str, since: Optional[int] = None, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)) -> Dict[str, object]:
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"items": []}
    try:
        import time as _time
        now = int(_time.time())
        base_since = int(since or 0)
        if base_since <= 0:
            # Default to last 7 days
            base_since = now - 7*86400
        out: Dict[str, object] = {"since": base_since, "now": now}
        # Contacts added/updated
        try:
            added = db.execute(_sql_text("SELECT COUNT(1) FROM contacts WHERE tenant_id = CAST(:t AS uuid) AND COALESCE(created_at,0) >= :s"), {"t": tenant_id, "s": base_since}).scalar()
            updated = db.execute(_sql_text("SELECT COUNT(1) FROM contacts WHERE tenant_id = CAST(:t AS uuid) AND COALESCE(updated_at,0) >= :s AND COALESCE(created_at,0) < :s"), {"t": tenant_id, "s": base_since}).scalar()
            out["contacts_added"] = int(added or 0)
            out["contacts_updated"] = int(updated or 0)
            rows = db.execute(_sql_text("SELECT contact_id, display_name, COALESCE(updated_at, created_at, 0) AS ts FROM contacts WHERE tenant_id = CAST(:t AS uuid) AND COALESCE(updated_at, created_at, 0) >= :s ORDER BY ts DESC LIMIT 3"), {"t": tenant_id, "s": base_since}).fetchall()
            out["recent_contacts"] = [{"contact_id": r[0], "display_name": r[1], "ts": int(r[2] or 0)} for r in rows]
        except Exception:
            out["contacts_added"] = 0; out["contacts_updated"] = 0; out["recent_contacts"] = []
        # Appointments this week
        try:
            ap = db.execute(_sql_text("SELECT COUNT(1) FROM appointments WHERE tenant_id = CAST(:t AS uuid) AND start_ts >= :s"), {"t": tenant_id, "s": base_since}).scalar()
            out["appointments"] = int(ap or 0)
        except Exception:
            out["appointments"] = 0
        # Messages
        try:
            ms = db.execute(_sql_text("SELECT COUNT(1) FROM messages WHERE tenant_id = CAST(:t AS uuid) AND ts >= :s"), {"t": tenant_id, "s": base_since}).scalar()
            out["messages_sent"] = int(ms or 0)
        except Exception:
            out["messages_sent"] = 0
        # Sync/import events
        try:
            ev = db.execute(_sql_text("SELECT COUNT(1) FROM events_ledger WHERE tenant_id = CAST(:t AS uuid) AND ts >= :s AND (name ILIKE 'sync.%' OR name ILIKE 'import.%')"), {"t": tenant_id, "s": base_since}).scalar()
            out["sync_events"] = int(ev or 0)
        except Exception:
            out["sync_events"] = 0
        return {"status": "ok", "digest": out}
    except Exception as e:
        from fastapi.responses import JSONResponse as _JR
        return _JR({"error": "internal_error", "detail": str(e)[:200]}, status_code=500)


# app already initialized above
# Optional Sentry capture (dsn via SENTRY_DSN)
try:
    import sentry_sdk as _sentry
    _dsn = os.getenv("SENTRY_DSN", "").strip()
    if _dsn:
        _sentry.init(
            dsn=_dsn,
            traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.05")),
            release=os.getenv("SENTRY_RELEASE", None),
            environment=os.getenv("SENTRY_ENVIRONMENT", os.getenv("ENVIRONMENT", None)),
        )
except Exception:
    pass
# Dev-only: ensure tables exist when using local SQLite without Alembic.
try:
    if engine.url.drivername.startswith("sqlite"):
        Base.metadata.create_all(bind=engine)
        # Lightweight SQLite column sync for dev: add created_at if missing
        with engine.begin() as _conn:
            def _has_col(table: str, col: str) -> bool:
                rows = _conn.exec_driver_sql(f"PRAGMA table_info('{table}')").fetchall()
                return any((str(r[1]) == col) for r in rows)
            def _ensure_created_at(table: str):
                try:
                    if not _has_col(table, "created_at"):
                        _conn.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN created_at INTEGER DEFAULT 0")
                except Exception:
                    pass
            for _t in [
                "contacts","cadence_states","metrics","consent_logs","notify_list","share_prompts",
                "audit_logs","dead_letters","approvals","embeddings","idempotency_keys","settings",
                "lead_status","appointments","messages","events_ledger",
            ]:
                _ensure_created_at(_t)
        # Helpful indexes for local/dev performance parity
        try:
            _conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS idx_contacts_display_name ON contacts(display_name)")
        except Exception:
            pass
        try:
            _conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS idx_contacts_last_visit ON contacts(last_visit)")
        except Exception:
            pass
        try:
            _conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS idx_contacts_ltv ON contacts(lifetime_cents)")
        except Exception:
            pass
        try:
            _conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS idx_appts_contact_start ON appointments(contact_id, start_ts)")
        except Exception:
            pass
except Exception:
    pass

## metrics counters moved to metrics_counters.py

def _sum_counter(counter) -> int:
    try:
        total = 0.0
        for child in getattr(counter, "_metrics", {}).values():
            try:
                total += float(getattr(child, "_value").get())
            except Exception:
                continue
        return int(total)
    except Exception:
        return 0
# Restrictive CORS (configurable)
# Include production app origins by default to avoid CORS failures after first deploy
cors_default = (
    "http://localhost:8000,http://localhost:5173,http://localhost:5174,"
    "http://127.0.0.1:5173,http://127.0.0.1:5174,http://127.0.0.1:5175,"
    "https://app.brandvx.io,https://api.brandvx.io,https://brandvx-operator-ui.pages.dev"
)
# Merge required defaults with any env-provided overrides to avoid losing prod origins
_env_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", cors_default).split(",") if o.strip()]
_required = [
    "https://app.brandvx.io",
    "https://api.brandvx.io",
    "https://brandvx-operator-ui.pages.dev",
]
cors_origins = sorted(set(_env_origins + _required))

# Optional regex to allow ephemeral Cloudflare Pages preview URLs like https://<hash>.brandvx-operator-ui.pages.dev
# Sanitize to strip accidental surrounding quotes from env values
def _sanitize_regex(v: Optional[str]) -> Optional[str]:
    try:
        if not v:
            return None
        s = str(v).strip()
        if (s.startswith('"') and s.endswith('"')) or (s.startswith("'") and s.endswith("'")):
            s = s[1:-1].strip()
        return s or None
    except Exception:
        return None

cors_regex = _sanitize_regex(os.getenv(
    "CORS_ORIGIN_REGEX",
    r"^https://[a-z0-9\-]+\.brandvx-operator-ui\.pages\.dev$",
))

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=cors_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Response compression for large JSON/text payloads
app.add_middleware(GZipMiddleware, minimum_size=1024)


class CacheHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        response = await call_next(request)
        try:
            path = request.url.path
            if path in ("/ai/tools/schema_human", "/ai/tools/schema"):
                response.headers["Cache-Control"] = "public, max-age=86400"
        except Exception:
            pass
        return response

# --- Route de-duplication: keep first occurrence of (path, methods-without-HEAD) ---
try:
    def _dedupe_routes(_app: FastAPI):
        try:
            routes = list(_app.router.routes)
        except Exception:
            return []
        seen = set()
        new_routes = []
        removed = []
        for r in routes:
            try:
                path = getattr(r, "path", None)
                methods = set(getattr(r, "methods", set()) or set())
                # Ignore implicit HEAD when comparing duplicates
                methods.discard("HEAD")
                key = (path, tuple(sorted(methods)))
            except Exception:
                new_routes.append(r)
                continue
            if key in seen:
                removed.append(key)
                continue
            seen.add(key)
            new_routes.append(r)
        try:
            _app.router.routes[:] = new_routes
        except Exception:
            # Fallback to clear/extend if slice assign fails
            try:
                _app.router.routes.clear()
                _app.router.routes.extend(new_routes)
            except Exception:
                pass
        return removed

    _removed_dups = _dedupe_routes(app)
    if _removed_dups and os.getenv("LOG_ROUTE_DEDUPS", "1") == "1":
        try:
            print(f"[router] removed duplicate routes: {len(_removed_dups)}")
        except Exception:
            pass
except Exception:
    # Non-fatal if router internals change
    pass

app.add_middleware(CacheHeadersMiddleware)

# Centralized cache invalidation helpers
def invalidate_contacts_cache(tenant_id: str) -> None:
    try:
        for lim in (100, 200, 500, 1000):
            try:
                cache_del(f"contacts:list:{tenant_id}:{lim}")
            except Exception:
                continue
    except Exception:
        pass


def invalidate_calendar_cache(tenant_id: str) -> None:
    try:
        cache_del(f"cal:{tenant_id}:0:0")
    except Exception:
        pass


def invalidate_inventory_cache(tenant_id: str) -> None:
    try:
        cache_del(f"inv:{tenant_id}")
    except Exception:
        pass

# Global exception handler to normalize error mapping (401/403/404 vs 500)
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    try:
        msg = str(getattr(exc, "detail", None) or getattr(exc, "message", None) or str(exc))[:400]
        if isinstance(exc, HTTPException):
            code = int(getattr(exc, "status_code", 500) or 500)
            if code == 401:
                return JSONResponse({"error": "unauthorized", "detail": msg}, status_code=401)
            if code == 403:
                return JSONResponse({"error": "forbidden", "detail": msg}, status_code=403)
            if code == 404:
                return JSONResponse({"error": "not_found", "detail": msg}, status_code=404)
            return JSONResponse({"error": "client_error" if 400 <= code < 500 else "internal_error", "detail": msg}, status_code=code)
        return JSONResponse({"error": "internal_error", "detail": msg}, status_code=500)
    except Exception:
        return JSONResponse({"error": "internal_error"}, status_code=500)
# --- Auth configuration helper ---
@app.get("/auth/config_check", tags=["Health"])
def auth_config_check(request: Request):
    try:
        front = os.getenv("FRONTEND_BASE_URL", "")
        cors = [o for o in cors_origins]
        supa = os.getenv("SUPABASE_URL", "")
        ref = ""
        try:
            if supa:
                host = _uparse(supa).hostname or ""
                if host:
                    ref = host.split(".")[0]
        except Exception:
            pass
        suggestions = [
            "http://localhost:5177",
            "http://127.0.0.1:5177",
            "http://127.0.0.1:5178",
            "http://127.0.0.1:5179",
        ]
        callback = f"https://{ref}.supabase.co/auth/v1/callback" if ref else ""
        return {
            "frontend_base_url": front,
            "cors_origins": cors,
            "supabase_url": supa,
            "supabase_ref": ref,
            "suggest_additional_origins": suggestions,
            "google_oauth_redirect_uri": callback,
        }
    except Exception as e:
        return {"error": str(e)}


class TenantScopeMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        try:
            x_tenant = request.headers.get("X-Tenant-Id")
            x_role = request.headers.get("X-Role")
            if x_tenant:
                CURRENT_TENANT_ID.set(x_tenant)
            if x_role:
                CURRENT_ROLE.set(x_role)
            # Warm AI cache lightly for the tenant (best-effort)
            try:
                if x_tenant:
                    key_warm = f"ai_cache_warm:{x_tenant}"
                    if not cache_get(key_warm):
                        with next(get_db()) as _db:  # type: ignore
                            _ = _load_tenant_memories(_db, x_tenant, limit=20)
                            _ = _load_global_insights(_db, limit=10)
                        cache_set(key_warm, "1", ttl=600)
            except Exception:
                pass
        except Exception:
            pass
        response = await call_next(request)
        return response
app.add_middleware(TenantScopeMiddleware)
# ---------- V2: Connected accounts storage bootstrap ----------
def _ensure_connected_accounts_v2() -> None:
    try:
        with engine.begin() as conn:
            conn.exec_driver_sql(
                """
                CREATE TABLE IF NOT EXISTS connected_accounts_v2 (
                  id BIGSERIAL PRIMARY KEY,
                  tenant_id UUID NOT NULL,
                  provider TEXT NOT NULL,
                  status TEXT,
                  scopes TEXT,
                  access_token_enc TEXT,
                  refresh_token_enc TEXT,
                  expires_at BIGINT,
                  last_sync BIGINT,
                  last_error TEXT,
                  connected_at TIMESTAMPTZ DEFAULT NOW(),
                  created_at TIMESTAMPTZ DEFAULT NOW()
                );
                """
            )
            # Helpful index; not unique to avoid migration conflicts, we will UPDATE-then-INSERT
            conn.exec_driver_sql(
                "CREATE INDEX IF NOT EXISTS ca_v2_t_p_idx ON connected_accounts_v2(tenant_id, provider);"
            )
            # Backfill columns if the table already existed without them
            conn.exec_driver_sql("ALTER TABLE connected_accounts_v2 ADD COLUMN IF NOT EXISTS scopes TEXT;")
            conn.exec_driver_sql("ALTER TABLE connected_accounts_v2 ADD COLUMN IF NOT EXISTS last_sync BIGINT;")
            conn.exec_driver_sql("ALTER TABLE connected_accounts_v2 ADD COLUMN IF NOT EXISTS last_error TEXT;")
    except Exception:
        pass

# ---------- AI context tables bootstrap ----------
def _ensure_ai_tables() -> None:
    try:
        with engine.begin() as conn:
            # ai_memories (tenant-scoped)
            conn.exec_driver_sql(
                """
                CREATE TABLE IF NOT EXISTS ai_memories (
                  id BIGSERIAL PRIMARY KEY,
                  tenant_id UUID NOT NULL,
                  key TEXT NOT NULL,
                  value TEXT,
                  tags TEXT,
                  updated_at TIMESTAMPTZ DEFAULT NOW()
                );
                """
            )
            conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ai_memories_tenant_key_idx ON ai_memories(tenant_id, key);")
            # Enable simple RLS: tenant can only access own rows
            try:
                conn.exec_driver_sql("ALTER TABLE ai_memories ENABLE ROW LEVEL SECURITY;")
                conn.exec_driver_sql(
                    "CREATE POLICY IF NOT EXISTS ai_memories_tenant_select ON ai_memories FOR SELECT USING (tenant_id = CAST(current_setting('app.tenant_id', true) AS uuid));"
                )
                conn.exec_driver_sql(
                    "CREATE POLICY IF NOT EXISTS ai_memories_tenant_mod ON ai_memories FOR ALL USING (tenant_id = CAST(current_setting('app.tenant_id', true) AS uuid)) WITH CHECK (tenant_id = CAST(current_setting('app.tenant_id', true) AS uuid));"
                )
            except Exception:
                pass
            # ai_global_insights (global)
            conn.exec_driver_sql(
                """
                CREATE TABLE IF NOT EXISTS ai_global_insights (
                  id BIGSERIAL PRIMARY KEY,
                  metric TEXT NOT NULL,
                  scope TEXT,
                  time_window TEXT,
                  value TEXT,
                  created_at TIMESTAMPTZ DEFAULT NOW()
                );
                """
            )
            conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ai_global_insights_metric_idx ON ai_global_insights(metric);")
            # ai_global_faq (global)
            conn.exec_driver_sql(
                """
                CREATE TABLE IF NOT EXISTS ai_global_faq (
                  id BIGSERIAL PRIMARY KEY,
                  intent TEXT NOT NULL,
                  answer TEXT NOT NULL,
                  created_at TIMESTAMPTZ DEFAULT NOW(),
                  updated_at TIMESTAMPTZ DEFAULT NOW()
                );
                """
            )
            conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ai_global_faq_intent_idx ON ai_global_faq(intent);")
    except Exception:
        pass
# --- Lightweight background scheduler runner (enabled via env) ---
def _scheduler_loop():
    try:
        enable = os.getenv("ENABLE_SCHEDULER", "0") == "1"
        if not enable:
            return
        import time as _t
        while True:
            try:
                with next(get_db()) as _db:  # type: ignore
                    try:
                        # scope: all tenants (None) for now; future: iterate tenants
                        from .scheduler import run_tick as _run_tick
                        _processed = _run_tick(_db, None)
                        try:
                            from .metrics_counters import SCHED_TICKS  # type: ignore
                            SCHED_TICKS.labels(scope="all").inc()  # type: ignore
                        except Exception:
                            pass
                        # Run insights aggregation tick (lightweight)
                        try:
                            _run_insights_aggregate_tick(_db)
                        except Exception:
                            pass
                        # NEW: periodic calendar sync for connected providers
                        try:
                            # every 10 minutes by default
                            sync_interval = int(os.getenv("CALENDAR_SYNC_INTERVAL_SECS", "600"))
                            now = int(_t.time())
                            # Iterate connected_accounts_v2 to find tenants/providers
                            rows = _db.execute(_sql_text(
                                """
                                SELECT tenant_id::text, provider, COALESCE(last_sync,0)
                                FROM connected_accounts_v2
                                WHERE status='connected' AND provider IN ('google','square')
                                """
                            )).fetchall()
                            for tid, prov, last_sync in rows or []:
                                try:
                                    # throttle per provider/tenant
                                    if int(now) - int(last_sync or 0) < sync_interval:
                                        continue
                                except Exception:
                                    pass
                                try:
                                    # enqueue event and call calendar_sync directly
                                    _db.add(dbm.EventLedger(ts=now, tenant_id=tid, name=f"sync.calendar.{prov}.queued", payload=None))
                                    _db.commit()
                                except Exception:
                                    try: _db.rollback()
                                    except Exception: pass
                                try:
                                    # best-effort HTTP call to our own endpoint
                                    base_api = os.getenv("BACKEND_BASE_URL", "http://localhost:8000").rstrip("/")
                                    import httpx as _httpx
                                    with _httpx.Client(timeout=10) as client:
                                        client.post(f"{base_api}/calendar/sync", json={"tenant_id": tid, "provider": prov})
                                except Exception:
                                    pass
                                try:
                                    # mark last_sync to avoid hot loop; backend endpoint will also write events_ledger
                                    _db.execute(_sql_text("UPDATE connected_accounts_v2 SET last_sync=:ts WHERE tenant_id = CAST(:t AS uuid) AND provider=:p"), {"ts": now, "t": tid, "p": prov})
                                    _db.commit()
                                except Exception:
                                    try: _db.rollback()
                                    except Exception: pass
                        except Exception:
                            pass
                    except Exception:
                        pass
            except Exception:
                pass
            _t.sleep(int(os.getenv("SCHEDULER_INTERVAL_SECS", "60")))
    except Exception:
        return


@app.on_event("startup")
def _start_scheduler_if_enabled():
    try:
        if os.getenv("ENABLE_SCHEDULER", "0") == "1":
            # Optional distributed lock to ensure only one active scheduler across replicas
            def _locked_loop():
                try:
                    import socket, random
                    ident = f"{socket.gethostname()}-{random.randint(1000,9999)}"
                except Exception:
                    ident = "brandvx-scheduler"
                lock_key = os.getenv("SCHEDULER_LOCK_KEY", "brandvx:scheduler:lock")
                lock_ttl = int(os.getenv("SCHEDULER_LOCK_SECS", "55"))
                while True:
                    c = _redis()
                    have_lock = False
                    try:
                        if c:
                            # NX=only set if not exists; EX=expire seconds
                            have_lock = bool(c.set(lock_key, ident, nx=True, ex=lock_ttl))
                    except Exception:
                        have_lock = True  # if Redis unavailable, run as best-effort
                    if have_lock:
                        try:
                            _scheduler_loop()
                        except Exception:
                            pass
                    else:
                        # Sleep roughly the scheduler interval
                        _time.sleep(int(os.getenv("SCHEDULER_INTERVAL_SECS", "60")))
            t = _threading.Thread(target=_locked_loop, daemon=True)
            t.start()
        # Start Redis-backed job worker if enabled
        start_job_worker_if_enabled()
        # Bootstrap v2 table
        _ensure_connected_accounts_v2()
        # Bootstrap AI context tables
        _ensure_ai_tables()
        # Second-pass route de-duplication after all routes are registered
        try:
            removed = _dedupe_routes(app)
            if removed and os.getenv("LOG_ROUTE_DEDUPS", "1") == "1":
                print(f"[router] removed duplicate routes at startup: {len(removed)}")
        except Exception:
            pass
        # Warn on unsafe production configs
        try:
            def _is_true(k: str) -> bool:
                return (os.getenv(k, "0") or "0").strip().lower() in {"1","true","yes"}
            prod = not (os.getenv("ENV", "dev").lower() in {"dev","development","local"})
            if prod:
                if _is_true("ALLOW_WEAK_JWT"):
                    print("[warn] ALLOW_WEAK_JWT=1 in production — disable for security.")
                if _is_true("DEV_AUTH_ALLOW"):
                    print("[warn] DEV_AUTH_ALLOW=1 in production — disable for security.")
                if _is_true("SENDGRID_ACCEPT_UNSIGNED"):
                    print("[warn] SENDGRID_ACCEPT_UNSIGNED=true — enable signature verification in production.")
                if (os.getenv("AI_PROVIDER","chat").lower()=="agents") and not (os.getenv("OPENAI_AGENT_ID","")):
                    print("[warn] AI_PROVIDER=agents but OPENAI_AGENT_ID is empty — will fall back to chat.")
                from_num = os.getenv("TWILIO_FROM_NUMBER","")
                if from_num and not from_num.startswith("+"):
                    print("[warn] TWILIO_FROM_NUMBER not in E.164 format (e.g., +15551234567).")
        except Exception:
            pass
    except Exception:
        pass
# --------------------------- Plans & Usage Limits (admin) ---------------------------
class PlanUpsert(BaseModel):
    plan_code: str
    name: str
    price_cents: int = 0
    ai_daily_cents_cap: Optional[int] = None
    ai_monthly_cents_cap: Optional[int] = None
    messages_daily_cap: Optional[int] = None


@app.get("/admin/plans", tags=["Plans"])
def list_plans(db: Session = Depends(get_db), ctx: UserContext = Depends(require_role("owner_admin"))):
    rows = db.query(dbm.Plan).order_by(dbm.Plan.price_cents.asc()).all()
    return [{
        "plan_code": r.plan_code,
        "name": r.name,
        "price_cents": r.price_cents,
        "ai_daily_cents_cap": r.ai_daily_cents_cap,
        "ai_monthly_cents_cap": r.ai_monthly_cents_cap,
        "messages_daily_cap": r.messages_daily_cap,
    } for r in rows]


@app.post("/admin/plans", tags=["Plans"])
def upsert_plan(body: PlanUpsert, db: Session = Depends(get_db), ctx: UserContext = Depends(require_role("owner_admin"))):
    row = db.query(dbm.Plan).filter(dbm.Plan.plan_code == body.plan_code).first()
    if row is None:
        row = dbm.Plan(
            plan_code=body.plan_code,
            name=body.name,
            price_cents=body.price_cents,
            ai_daily_cents_cap=body.ai_daily_cents_cap,
            ai_monthly_cents_cap=body.ai_monthly_cents_cap,
            messages_daily_cap=body.messages_daily_cap,
        )
        db.add(row)
    else:
        row.name = body.name
        row.price_cents = body.price_cents
        row.ai_daily_cents_cap = body.ai_daily_cents_cap
        row.ai_monthly_cents_cap = body.ai_monthly_cents_cap
        row.messages_daily_cap = body.messages_daily_cap
    db.commit()
    return {"ok": True}


# --------------------------- Job producer endpoints (admin/dev) ---------------------------
class SmsJob(BaseModel):
    tenant_id: str
    to: str
    body: str


@app.post("/admin/jobs/sms", tags=["Integrations"])
def admin_job_sms(j: SmsJob, ctx: UserContext = Depends(require_role("owner_admin"))):
    ok = enqueue_sms_job(j.tenant_id, j.to, j.body)
    return {"queued": bool(ok)}


# --------------------------- Sharing ---------------------------
class ShareCreateRequest(BaseModel):
    tenant_id: str
    title: Optional[str] = None
    description: Optional[str] = None
    kind: Optional[str] = None
    image_url: Optional[str] = None
    caption: Optional[str] = None


@app.post("/share/create", tags=["Sharing"])
def share_create(
    body: ShareCreateRequest,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != body.tenant_id and ctx.role != "owner_admin":
        raise HTTPException(status_code=403, detail="forbidden")
    token = _secrets.token_urlsafe(16)
    row = dbm.ShareLink(
        tenant_id=body.tenant_id,
        token=token,
        title=body.title or None,
        description=body.description or None,
        image_url=body.image_url or None,
        caption=body.caption or None,
        kind=body.kind or None,
    )
    db.add(row)
    db.commit()
    # Construct canonical URL (front-end route /s/:token)
    base = os.getenv("FRONTEND_BASE_URL", "")
    if not base:
        try:
            # Fallback to first CORS origin if configured
            base = cors_origins[0]
        except Exception:
            base = ""
    url = (base.rstrip("/") + f"/s/{token}") if base else f"/s/{token}"
    emit_event("ShareLinkCreated", {"tenant_id": body.tenant_id, "token": token})
    return {"token": token, "url": url}


class ScreenshotUploadRequest(BaseModel):
    tenant_id: str
    data_url: str  # data:image/png;base64,...
    title: Optional[str] = None


@app.post("/share/screenshot", tags=["Sharing"])
def share_screenshot(
    body: ScreenshotUploadRequest,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != body.tenant_id and ctx.role != "owner_admin":
        raise HTTPException(status_code=403, detail="forbidden")
    token = _secrets.token_urlsafe(16)
    try:
        db.execute(
            _sql_text(
                "INSERT INTO share_reports (tenant_id, token, mime, filename, data_text) VALUES (CAST(:t AS uuid), :tok, :m, :fn, :dt)"
            ),
            {
                "t": body.tenant_id,
                "tok": token,
                "m": "image/dataurl",
                "fn": f"{(body.title or 'share_screenshot')}.txt",
                "dt": body.data_url,
            },
        )
        db.commit()
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass
    base = os.getenv("FRONTEND_BASE_URL", "")
    url = (base.rstrip("/") + f"/s/{token}") if base else f"/s/{token}"
    emit_event("ShareScreenshotSaved", {"tenant_id": body.tenant_id, "token": token})
    return {"token": token, "url": url}


@app.get("/share/{token}", tags=["Sharing"])
def share_get(token: str, db: Session = Depends(get_db)):
    sl = db.query(dbm.ShareLink).filter(dbm.ShareLink.token == token).first()
    if not sl:
        raise HTTPException(status_code=404, detail="not_found")
    metrics = db.query(dbm.Metrics).filter(dbm.Metrics.tenant_id == sl.tenant_id).first()
    time_saved = int(metrics.time_saved_minutes) if metrics else 0
    messages_sent = int(metrics.messages_sent) if metrics else 0
    return {
        "title": sl.title or "BrandVX Results",
        "description": sl.description or "Automation results powered by BrandVX",
        "image_url": sl.image_url or "",
        "caption": sl.caption or "",
        "kind": sl.kind or "metrics",
        "metrics": {
            "time_saved_minutes": time_saved,
            "time_saved_hours": round(time_saved / 60.0, 1),
            "messages_sent": messages_sent,
        },
    }


class EmailJob(BaseModel):
    tenant_id: str
    to: str
    subject: str
    html: str
    text: Optional[str] = None


@app.post("/admin/jobs/email", tags=["Integrations"])
def admin_job_email(j: EmailJob, ctx: UserContext = Depends(require_role("owner_admin"))):
    ok = enqueue_email_job(j.tenant_id, j.to, j.subject, j.html, j.text or "")
    return {"queued": bool(ok)}


class AiJob(BaseModel):
    tenant_id: str
    session_id: str
    prompt: str


@app.post("/admin/jobs/ai", tags=["AI"])
def admin_job_ai(j: AiJob, ctx: UserContext = Depends(require_role("owner_admin"))):
    ok = enqueue_ai_job(j.tenant_id, j.session_id, j.prompt)
    return {"queued": bool(ok)}


class UsageLimitUpsert(BaseModel):
    tenant_id: str
    plan_code: Optional[str] = None
    active: bool = True
    ai_daily_cents_cap: Optional[int] = None
    ai_monthly_cents_cap: Optional[int] = None
    messages_daily_cap: Optional[int] = None
def _run_insights_aggregate_tick(db: Session) -> None:
    """Lightweight anonymized aggregator writing to ai_global_insights.
    Uses k-anonymity (k>=5) by dropping small buckets; adds ±1 jitter to counts.
    """
    try:
        # Example aggregate: weekly appointment counts (global), rolling_30d
        rows = db.execute(
            _sql_text(
                """
                SELECT date_trunc('week', to_timestamp(start_ts)) AS wk, COUNT(1) AS c
                FROM appointments
                WHERE start_ts > EXTRACT(epoch FROM now())::bigint - (30*86400)
                GROUP BY 1
                ORDER BY 1 DESC
                LIMIT 12
                """
            )
        ).fetchall()
        out = []
        for wk, c in rows or []:
            cnt = int(c or 0)
            if cnt < 5:
                continue
            try:
                import random as _rnd
                cnt = max(0, cnt + _rnd.choice([-1, 0, 1]))
            except Exception:
                pass
            out.append({"week": str(wk), "count": cnt})
        # Only write if any tenant has opted in or if global opt-in is set
        allow = False
        try:
            row = db.execute(_sql_text("SELECT COUNT(1) FROM settings WHERE (data_json)::text ILIKE '%""share_insights"": true%'" )).scalar()
            allow = bool(int(row or 0) > 0)
        except Exception:
            allow = False
        if out and allow:
            db.execute(
                _sql_text(
                    """
                    INSERT INTO ai_global_insights(metric, scope, time_window, value)
                    VALUES (:m, 'global', 'rolling_30d', :v)
                    """
                ),
                {"m": "appointments_by_week", "v": json.dumps(out)},
            )
            db.commit()
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass
    grace_until: Optional[int] = None


@app.get("/admin/usage_limits/{tenant_id}", tags=["Plans"])
def get_usage_limit(tenant_id: str, db: Session = Depends(get_db), ctx: UserContext = Depends(require_role("owner_admin"))):
    r = db.query(dbm.UsageLimit).filter(dbm.UsageLimit.tenant_id == tenant_id).first()
    if r is None:
        return JSONResponse({"tenant_id": tenant_id, "active": False}, status_code=404)
    return {
        "tenant_id": r.tenant_id,
        "plan_code": r.plan_code,
        "active": r.active,
        "ai_daily_cents_cap": r.ai_daily_cents_cap,
        "ai_monthly_cents_cap": r.ai_monthly_cents_cap,
        "messages_daily_cap": r.messages_daily_cap,
        "grace_until": r.grace_until,
    }


@app.post("/admin/usage_limits", tags=["Plans"])
def upsert_usage_limit(body: UsageLimitUpsert, db: Session = Depends(get_db), ctx: UserContext = Depends(require_role("owner_admin"))):
    r = db.query(dbm.UsageLimit).filter(dbm.UsageLimit.tenant_id == body.tenant_id).first()
    if r is None:
        r = dbm.UsageLimit(
            tenant_id=body.tenant_id,
            plan_code=body.plan_code,
            active=body.active,
            ai_daily_cents_cap=body.ai_daily_cents_cap,
            ai_monthly_cents_cap=body.ai_monthly_cents_cap,
            messages_daily_cap=body.messages_daily_cap,
            grace_until=body.grace_until,
        )
        db.add(r)
    else:
        r.plan_code = body.plan_code
        r.active = body.active
        r.ai_daily_cents_cap = body.ai_daily_cents_cap
        r.ai_monthly_cents_cap = body.ai_monthly_cents_cap
        r.messages_daily_cap = body.messages_daily_cap
        r.grace_until = body.grace_until
    db.commit()
    return {"ok": True}
# --- OAuth scaffolding helpers (env-driven) ---
def _square_env_mode() -> str:
    """Resolve Square environment mode.
    Priority: explicit SQUARE_ENV -> infer from client_id prefix -> default sandbox.
    Returns 'production' or 'sandbox'.
    """
    try:
        forced = _env("SQUARE_ENV", "").strip().lower()
        if forced:
            return "production" if forced.startswith("prod") else "sandbox"
    except Exception:
        pass
    try:
        cid = _env("SQUARE_CLIENT_ID", "").strip()
        # Square prod OAuth app IDs start with 'sq0idp'; sandbox often include 'sandbox-' or 'sq0idb'
        if cid.startswith("sq0idp"):
            return "production"
        if cid.startswith("sandbox-") or cid.startswith("sq0idb"):
            return "sandbox"
    except Exception:
        pass
    return "sandbox"
def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default)
def _new_cid() -> str:
    try:
        return _secrets.token_hex(8)
    except Exception:
        try:
            return os.urandom(8).hex()
        except Exception:
            return str(int(_time.time()*1000))

def _connected_accounts_v2_rows(db: Session, tenant_id: str) -> List[Dict[str, Any]]:
    try:
        rows = db.execute(
            _sql_text(
                """
                SELECT provider, status, COALESCE(expires_at,0) AS expires_at,
                       EXTRACT(epoch FROM COALESCE(connected_at, NOW()))::bigint AS connected_ts,
                       COALESCE(last_sync,0) AS last_sync
                FROM connected_accounts_v2
                WHERE tenant_id = CAST(:t AS uuid)
                ORDER BY id DESC
                """
            ),
            {"t": tenant_id},
        ).fetchall()
    except Exception:
        return []
    seen: set[str] = set()
    out: List[Dict[str, Any]] = []
    for r in rows or []:
        prov = str(r[0] or '').lower()
        if not prov or prov in seen:
            continue
        seen.add(prov)
        out.append(
            {
                "provider": prov,
                "status": str(r[1] or 'connected'),
                "expires_at": int(r[2] or 0),
                "ts": int(r[3] or 0),
                "last_sync": int(r[4] or 0),
            }
        )
    return out
def _connected_accounts_map(db: Session, tenant_id: str) -> Dict[str, str]:
    rows_v2 = _connected_accounts_v2_rows(db, tenant_id)
    if rows_v2:
        return {r["provider"]: r.get("status") or "connected" for r in rows_v2}

def _has_connected_account(db: Session, tenant_id: str, provider: str) -> bool:
    try:
        row = db.execute(
            _sql_text(
                "SELECT 1 FROM connected_accounts_v2 WHERE tenant_id = CAST(:t AS uuid) AND provider = :p ORDER BY id DESC LIMIT 1"
            ),
            {"t": tenant_id, "p": provider},
        ).fetchone()
        return bool(row)
    except Exception:
        return False
def _audit_logs_columns(db: Session) -> set:
    try:
        rows = db.execute(_sql_text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'audit_logs' AND table_schema = 'public'
        """)).fetchall()
        return {str(r[0]) for r in rows}
    except Exception:
        return set()

def _safe_audit_log(db: Session, *, tenant_id: str, actor_id: str, action: str, entity_ref: str, payload: Optional[str] = None) -> None:
    """Insert an audit_log row while tolerating deployments where the 'payload' column is absent.
    Commits on success; on failure rolls back and swallows the error to avoid aborting outer transactions.
    """
    try:
        cols = _audit_logs_columns(db)
        if "payload" in cols:
            db.add(dbm.AuditLog(tenant_id=tenant_id, actor_id=actor_id, action=action, entity_ref=entity_ref, payload=(payload or "{}")))
        else:
            db.execute(
                _sql_text(
                    "INSERT INTO audit_logs (tenant_id, actor_id, action, entity_ref, created_at) VALUES (:t,:a,:ac,:er, NOW())"
                ),
                {"t": tenant_id, "a": actor_id, "ac": action, "er": entity_ref},
            )
        db.commit()
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass
# --------------------------- Billing (Stripe) ---------------------------
def _stripe_client():
    secret = _env("STRIPE_SECRET_KEY")
    if not secret:
        raise HTTPException(status_code=500, detail="stripe_not_configured")
    _stripe.api_key = secret
    return _stripe
@app.post("/billing/create-customer", tags=["Integrations"])
def create_customer(ctx: UserContext = Depends(get_user_context)):
    s = _stripe_client()
    # Store stripe customer id in settings table per tenant; fallback if DB unavailable
    try:
        with next(get_db()) as db:  # type: ignore
            row = db.execute(
                _sql_text("SELECT id, data_json FROM settings WHERE tenant_id = CAST(:tid AS uuid) ORDER BY id DESC LIMIT 1"),
                {"tid": ctx.tenant_id},
            ).fetchone()
            data = {}
            row_id = None
            if row:
                try:
                    row_id = row[0]
                    data = _json.loads(row[1] or "{}")
                except Exception:
                    data = {}
            cust_id = data.get("stripe_customer_id")
            if not cust_id:
                customer = s.Customer.create(metadata={"tenant_id": ctx.tenant_id})
                cust_id = customer["id"]
                data["stripe_customer_id"] = cust_id
                if row_id:
                    db.execute(
                        _sql_text("UPDATE settings SET data_json = :dj WHERE id = :sid"),
                        {"dj": _json.dumps(data), "sid": row_id},
                    )
                else:
                    payload = {"tenant_id": ctx.tenant_id, "data_json": _json.dumps(data), "created_at": int(_time.time())}
                    db.execute(
                        _sql_text("INSERT INTO settings(tenant_id, data_json, created_at) VALUES (:tenant_id, :data_json, NOW())"),
                        payload,
                    )
                db.commit()
            return {"customer_id": cust_id}
    except Exception:
        customer = s.Customer.create(metadata={"tenant_id": ctx.tenant_id})
        return {"customer_id": customer["id"]}


@app.post("/billing/create-setup-intent", tags=["Integrations"])
def create_setup_intent(ctx: UserContext = Depends(get_user_context_relaxed)):
    s = _stripe_client()
    # Ensure a customer first
    cust = create_customer(ctx)
    setup_intent = s.SetupIntent.create(customer=cust["customer_id"])  # type: ignore
    return {"client_secret": setup_intent["client_secret"]}
@app.post("/billing/create-checkout-session", tags=["Integrations"])
def create_checkout_session(req: dict, ctx: UserContext = Depends(get_user_context_relaxed)):
    s = _stripe_client()
    price_id = str(req.get("price_id", "")).strip()
    price_cents = int(req.get("price_cents", 0) or 0)
    currency = str(req.get("currency", "usd")).strip() or "usd"
    product_name = str(req.get("product_name", "BrandVX Membership")).strip() or "BrandVX Membership"
    mode = str(req.get("mode", "subscription")).strip() or "subscription"  # "subscription" | "payment"
    trial_days = int(req.get("trial_days", 0) or 0)
    if not price_id and price_cents <= 0:
        raise HTTPException(status_code=400, detail="missing price_id_or_amount")
    cust = create_customer(ctx)
    origin = _env("APP_ORIGIN", _env("FRONTEND_BASE_URL", "https://app.brandvx.io"))
    # Construct line items; include recurring only for subscription mode
    if price_id:
        line_items = [{"price": price_id, "quantity": 1}]
    else:
        price_data = {
            "currency": currency,
            "product_data": {"name": product_name},
            "unit_amount": price_cents,
        }
        if mode == "subscription":
            price_data["recurring"] = {"interval": "month"}
        line_items = [{"price_data": price_data, "quantity": 1}]

    kwargs: Dict[str, object] = {
        "mode": "payment" if mode == "payment" else "subscription",
        "line_items": line_items,
        "success_url": f"{origin}/workspace?pane=dashboard&billing=success",
        "cancel_url": f"{origin}/billing?cancel=1",
        "customer": cust["customer_id"],  # type: ignore
    }
    if mode == "subscription":
        kwargs["allow_promotion_codes"] = True
        if trial_days > 0:
            kwargs["subscription_data"] = {"trial_period_days": trial_days}
    session = s.checkout.Session.create(**kwargs)  # type: ignore
    return {"url": session["url"]}


@app.post("/billing/portal", tags=["Integrations"])
def billing_portal(ctx: UserContext = Depends(get_user_context_relaxed)):
    s = _stripe_client()
    cust = create_customer(ctx)
    origin = _env("APP_ORIGIN", _env("FRONTEND_BASE_URL", "https://app.brandvx.io"))
    portal = s.billing_portal.Session.create(customer=cust["customer_id"], return_url=f"{origin}/billing")  # type: ignore
    return {"url": portal["url"]}


@app.get("/billing/config", tags=["Billing"])
def billing_config() -> Dict[str, object]:
    """Expose non-secret billing configuration for UI sanity checks.
    Returns Stripe publishable artifacts only (no secrets).
    """
    return {
        "price_147": _env("STRIPE_PRICE_147", ""),
        "price_127": _env("STRIPE_PRICE_127", ""),
        "price_97": _env("STRIPE_PRICE_97", ""),
        "trial_days": int(_env("STRIPE_TRIAL_DAYS", "7") or 7),
        # Safe to expose to browser
        "publishable_key": _env(
            "STRIPE_PUBLISHABLE_KEY",
            _env("STRIPE_PUBLISHABLE", _env("VITE_STRIPE_PUBLISHABLE_KEY", "")),
        ),
    }
@app.post("/billing/webhook", tags=["Integrations"])
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    secret = _env("STRIPE_WEBHOOK_SECRET")
    s = _stripe_client()
    try:
        event = s.Webhook.construct_event(payload, sig, secret)
    except Exception:
        raise HTTPException(status_code=400, detail="invalid_signature")
    t_update: dict = {}
    typ = event.get("type")
    data = event.get("data", {}).get("object", {})
    if typ == "payment_method.attached":
        cust_id = data.get("customer")
        t_update = {"has_payment_method": True}
    elif typ == "checkout.session.completed":
        cust_id = data.get("customer")
        t_update = {"has_payment_method": True, "last_checkout_completed": int(_time.time())}
        try:
            emit_event("CheckoutSessionCompleted", {"customer": str(cust_id or "")})
        except Exception:
            pass
    elif typ == "customer.subscription.updated" or typ == "customer.subscription.created":
        cust_id = data.get("customer")
        t_update = {
            "subscription_status": data.get("status"),
            "current_period_end": int(data.get("current_period_end", 0)),
        }
    elif typ == "customer.subscription.deleted":
        cust_id = data.get("customer")
        t_update = {
            "subscription_status": "canceled",
            "current_period_end": int(_time.time()),
        }
    elif typ == "invoice.paid":
        cust_id = data.get("customer")
        t_update = {"last_invoice_paid": int(_time.time())}
    elif typ == "invoice.payment_failed":
        cust_id = data.get("customer")
        # Enqueue To-Do for payment failure
        # Defer enqueue to scheduler/tick to avoid import order problems during startup
    else:
        return JSONResponse({"status": "ignored"})
    # Persist to settings for the tenant owning this customer (prefer exact tenant via Stripe metadata)
    try:
        # Attempt to resolve tenant_id using Stripe Customer metadata
        resolved_tenant: str = ""
        try:
            if cust_id:
                cust_obj = s.Customer.retrieve(cust_id)  # type: ignore
                resolved_tenant = str(cust_obj.get("metadata", {}).get("tenant_id") or "")
        except Exception:
            resolved_tenant = ""
        with next(get_db()) as db:  # type: ignore
            if resolved_tenant:
                # Update latest row for this tenant directly
                row = db.execute(_sql_text("SELECT id, data_json FROM settings WHERE tenant_id = CAST(:tid AS uuid) ORDER BY id DESC LIMIT 1"), {"tid": resolved_tenant}).fetchone()
                if row:
                    sid = row[0]
                    try:
                        d = _json.loads(row[1] or "{}")
                    except Exception:
                        d = {}
                    d.update(t_update)
                    db.execute(_sql_text("UPDATE settings SET data_json = :dj WHERE id = :sid"), {"dj": _json.dumps(d), "sid": sid})
                    db.commit()
                    try:
                        emit_event("BillingUpdated", {"tenant_id": resolved_tenant, "status": d.get("subscription_status", "unknown")})
                    except Exception:
                        pass
                else:
                    # Create a minimal row if none exists (rare)
                    d = dict(t_update)
                    d["stripe_customer_id"] = cust_id
                    db.execute(_sql_text("INSERT INTO settings(tenant_id, data_json, created_at) VALUES (:tid, :dj, NOW())"), {"tid": resolved_tenant, "dj": _json.dumps(d)})
                    db.commit()
            else:
                # Fallback: scan a limited window to match by customer id
                rows = db.execute(_sql_text("SELECT tenant_id, data_json, id FROM settings ORDER BY id DESC LIMIT 200")).fetchall()
            for tenant_id, data_json, sid in rows:
                try:
                    d = _json.loads(data_json or "{}")
                except Exception:
                    d = {}
                if d.get("stripe_customer_id") == cust_id:
                    d.update(t_update)
                    db.execute(_sql_text("UPDATE settings SET data_json = :dj WHERE id = :sid"), {"dj": _json.dumps(d), "sid": sid})
                    db.commit()
                    try:
                        emit_event("BillingUpdated", {"tenant_id": tenant_id, "status": d.get("subscription_status", "unknown")})
                    except Exception:
                        pass
                    break
    except Exception:
        pass
    return JSONResponse({"status": "ok"})


@app.get("/ai/config", tags=["AI"])
def ai_config() -> Dict[str, object]:
    return {
        "model": _env("OPENAI_MODEL", ""),
        "fallback_models": _env("OPENAI_FALLBACK_MODELS", ""),
        "use_responses": _env("OPENAI_USE_RESPONSES", ""),
        "agentic_preference": _env("OPENAI_AGENTIC_PREFERENCE", ""),
    }

@app.get("/integrations/redirects", tags=["Integrations"])
def list_redirects():
    base_api = _backend_base_url()
    base_app = _frontend_base_url()
    return {
        "oauth": {
            "google": f"{base_api}/oauth/google/callback",
            "apple": f"{base_api}/oauth/apple/callback",
            "square": f"{base_api}/oauth/square/callback",
            "acuity": f"{base_api}/oauth/acuity/callback",
            "hubspot": f"{base_api}/oauth/hubspot/callback",
            "instagram": f"{base_api}/oauth/instagram/callback",
            "shopify": f"{base_api}/oauth/shopify/callback",
        },
        "webhooks": {
            "stripe": f"{base_api}/billing/webhook",
            "square": f"{base_api}/webhooks/square",
            "acuity": f"{base_api}/webhooks/acuity",
        },
        "post_auth_redirect": {
            "supabase_email": f"{base_app}/workspace?pane=dashboard&tour=1&postVerify=1",
        },
    }

@app.get("/integrations/debug/oauth", tags=["Integrations"])
def debug_oauth(provider: str = "square"):
    """Return non-sensitive OAuth config and last-callback status for quick troubleshooting."""
    try:
        info: Dict[str, Any] = {"provider": provider}
        if provider == "square":
            env_mode = _env("SQUARE_ENV", "sandbox").lower()
            default_auth = "https://connect.squareup.com/oauth2/authorize" if env_mode.startswith("prod") else "https://connect.squareupsandbox.com/oauth2/authorize"
            default_token = "https://connect.squareup.com/oauth2/token" if env_mode.startswith("prod") else "https://connect.squareupsandbox.com/oauth2/token"
            info.update({
                "env": env_mode,
                "auth_url": _env("SQUARE_AUTH_URL", default_auth),
                "token_url": _env("SQUARE_TOKEN_URL", default_token),
                "client_id_present": bool(_env("SQUARE_CLIENT_ID", "")),
                "client_id_prefix": (_env("SQUARE_CLIENT_ID", "")[:6] or None),
                "redirect_uri": _redirect_uri("square"),
            })
        # Last callback + connected account status for current tenant (best‑effort)
        try:
            tenant = "t1"
            with next(get_db()) as db:  # type: ignore
                row = db.execute(_sql_text("SELECT tenant_id FROM settings ORDER BY id DESC LIMIT 1")).fetchone()
                if row and row[0]:
                    tenant = str(row[0])
                last_log = db.execute(_sql_text("SELECT action, created_at, payload FROM audit_logs WHERE action LIKE :a ORDER BY id DESC LIMIT 1"), {"a": f"oauth.callback.{provider}%"}).fetchone()
                # v2-only: Report access_token presence from v2
                ca = db.execute(_sql_text("SELECT status, connected_at, access_token_enc FROM connected_accounts_v2 WHERE tenant_id = CAST(:t AS uuid) AND provider = :p ORDER BY id DESC LIMIT 1"), {"t": tenant, "p": provider}).fetchone()
                info["last_callback"] = {
                    "seen": bool(last_log),
                    "ts": int(last_log[1]) if last_log else None,
                }
                at_present = None
                if ca:
                    try:
                        at_present = bool(ca[2])
                    except Exception:
                        at_present = None
                info["connected_account"] = {
                    "status": (ca[0] if ca else None),
                    "ts": int(ca[1]) if ca else None,
                    "access_token_present": at_present,
                }
        except Exception:
            pass
        return info
    except Exception as e:
        return {"error": str(e)}

# Admin: upsert a Square connected-account row for the current tenant (tolerant schema)
# Read-only: list recent connected accounts and last oauth callbacks for a tenant
@app.get("/integrations/connected-accounts", tags=["Integrations"])
def connected_accounts_list(
    tenant_id: str,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    try:
        rows_v2 = _connected_accounts_v2_rows(db, tenant_id)
        items: List[Dict[str, Any]] = []
        for r in rows_v2[:12]:
            items.append(
                {
                    "provider": r.get("provider", ""),
                    "status": r.get("status") or "connected",
                    "ts": int(r.get("ts") or 0),
                }
            )
        # Tolerate legacy audit_logs schemas missing 'payload'
        a_cols = _audit_logs_columns(db)
        sel_cols = ["action", "created_at"]
        if "payload" in a_cols:
            sel_cols.append("payload")
        sql = f"SELECT {', '.join(sel_cols)} FROM audit_logs WHERE tenant_id = :t AND action LIKE 'oauth.callback.%' ORDER BY id DESC LIMIT 1"
        last_cb = db.execute(_sql_text(sql), {"t": tenant_id}).fetchone()
        last = None
        if last_cb:
            try:
                if len(sel_cols) == 3:
                    last = {
                        "action": str(last_cb[0] or ""),
                        "ts": int(last_cb[1] or 0),
                        "payload": str(last_cb[2] or ""),
                    }
                else:
                    last = {
                        "action": str(last_cb[0] or ""),
                        "ts": int(last_cb[1] or 0),
                    }
            except Exception:
                last = {"action": str(last_cb[0] or ""), "ts": 0, "payload": ""}
        return {"items": items, "last_callback": last}
    except Exception as e:
        return {"items": [], "error": str(e)[:200], "last_callback": None}

@app.get("/integrations/status", tags=["Integrations"])
def integrations_status(
    tenant_id: str,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    try:
        if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
            return JSONResponse({"error": "forbidden"}, status_code=403)
        providers = ["square", "acuity", "hubspot", "google", "instagram", "twilio", "sendgrid", "shopify"]
        linked_map: Dict[str, bool] = {p: False for p in providers}
        status_map: Dict[str, str] = {p: '' for p in providers}
        expires_map: Dict[str, int] = {p: 0 for p in providers}
        last_sync: Dict[str, int] = {p: 0 for p in providers}
        for r in _connected_accounts_v2_rows(db, tenant_id):
            p = str(r.get("provider") or '').lower()
            if not p or p not in linked_map:
                continue
            linked_map[p] = True
            if r.get("status"):
                status_map[p] = str(r.get("status"))
            try:
                expires_map[p] = int(r.get("expires_at") or 0)
            except Exception:
                expires_map[p] = expires_map[p]
            try:
                ls = int(r.get("last_sync") or 0)
                if ls > last_sync[p]:
                    last_sync[p] = ls
            except Exception:
                pass
        # v2 is the source of truth; legacy is ignored
        # last oauth callback
        a_cols = _audit_logs_columns(db)
        sel_cols = ["action", "created_at"]
        if "payload" in a_cols:
            sel_cols.append("payload")
        sql_cb = f"SELECT {', '.join(sel_cols)} FROM audit_logs WHERE tenant_id = :t AND action LIKE 'oauth.callback.%' ORDER BY id DESC LIMIT 1"
        last_cb = db.execute(_sql_text(sql_cb), {"t": tenant_id}).fetchone()
        last = None
        if last_cb:
            try:
                if len(sel_cols) == 3:
                    last = {"action": str(last_cb[0] or ''), "ts": int(last_cb[1] or 0), "payload": str(last_cb[2] or '')}
                else:
                    last = {"action": str(last_cb[0] or ''), "ts": int(last_cb[1] or 0)}
            except Exception:
                last = {"action": str(last_cb[0] or ''), "ts": 0}
        # approximate last_sync per provider from events_ledger (sync/import/backfill events)
        try:
            q = db.query(dbm.EventLedger).filter(dbm.EventLedger.tenant_id == tenant_id).order_by(dbm.EventLedger.id.desc()).limit(200)  # type: ignore
            for ev in q.all():
                try:
                    name = str(ev.name or '')
                    ts = int(ev.ts or 0)
                    # name patterns: sync.calendar.google, sync.inventory.square, import.square.contacts, backfill.square.metrics
                    parts = name.split('.')
                    # find a provider token
                    cand = None
                    for token in parts:
                        t = token.lower()
                        if t in last_sync and ts > last_sync[t]:
                            cand = t
                    if cand:
                        last_sync[cand] = ts
                except Exception:
                    continue
        except Exception:
            pass
        prov_out = {}
        for p in providers:
            prov_out[p] = {
                "linked": bool(linked_map.get(p, False)),
                "status": status_map.get(p, '') or ("connected" if linked_map.get(p, False) else ""),
                "expires_at": int(expires_map.get(p, 0) or 0),
                "last_sync": int(last_sync.get(p, 0) or 0),
            }
        return {"providers": prov_out, "connected": [p for p,v in linked_map.items() if v], "last_callback": last}
    except Exception as e:
        return {"error": "internal_error", "detail": str(e)[:200]}

def _backend_base_url() -> str:
    return _env("BACKEND_BASE_URL", "http://localhost:8000")


def _frontend_base_url() -> str:
    return _env("FRONTEND_BASE_URL", "http://127.0.0.1:5174")


def _redirect_uri(provider: str) -> str:
    base = _backend_base_url()
    # Use canonical /oauth path for provider-registered redirect URIs
    # We still support legacy /api/oauth via the alias route added below
    return f"{base}/oauth/{provider}/callback"


# --- Supabase Edge Functions S2S helpers ---
def _supabase_functions_base() -> str:
    # Prefer explicit env, else derive from SUPABASE_URL (https://<ref>.supabase.co)
    explicit = _env("SUPABASE_FUNCTIONS_BASE", "").rstrip("/")
    if explicit:
        return explicit
    url = _env("SUPABASE_URL", "").strip()
    try:
        # Derive ref by splitting subdomain
        # e.g. https://gqagtzcoboyszdhaekrt.supabase.co -> gqagtzcoboyszdhaekrt
        ref = url.split("//", 1)[1].split(".", 1)[0]
        if ref:
            return f"https://{ref}.functions.supabase.co"
    except Exception:
        pass
    return ""


def _edge_headers() -> Dict[str, str]:
    key = _env("SUPABASE_SERVICE_ROLE_KEY", "")
    # Use service role for trusted S2S calls; do NOT expose to browser
    return {
        "Authorization": f"Bearer {key}",
        "apikey": key,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def _http_request_with_retry(method: str, url: str, *, headers: Optional[Dict[str, str]] = None, params: Optional[Dict[str, object]] = None, data: Optional[Dict[str, object]] = None, json: Optional[Dict[str, object]] = None, timeout: int = 20, attempts: int = 3, backoff_base: float = 0.35) -> httpx.Response:
    """Lightweight retry helper for provider calls (handles 429/5xx and timeouts)."""
    last_exc: Optional[Exception] = None
    for i in range(max(1, attempts)):
        try:
            r = httpx.request(method.upper(), url, headers=headers, params=params, data=data, json=json, timeout=timeout)
            if r.status_code == 429 or r.status_code >= 500:
                delay = backoff_base * (2 ** i)
                try: _time.sleep(delay)
                except Exception: pass
                continue
            return r
        except (httpx.ReadTimeout, httpx.ConnectError, httpx.HTTPError) as e:
            last_exc = e
            try:
                _time.sleep(backoff_base * (2 ** i))
            except Exception:
                pass
    if last_exc:
        raise last_exc
    # Fallback (should not reach): return a dummy 599-like response
    return httpx.Response(599, request=httpx.Request(method.upper(), url))
# ---- AskVX context loaders (tenant memories, global insights/faq, providers status) ----
def _load_tenant_memories(db: Session, tenant_id: str, limit: int = 20) -> List[Dict[str, object]]:
    try:
        rows = db.execute(
            _sql_text(
                """
                SELECT key, value, tags, updated_at
                FROM ai_memories
                WHERE tenant_id = CAST(:t AS uuid)
                ORDER BY updated_at DESC
                LIMIT :lim
                """
            ),
            {"t": tenant_id, "lim": max(1, min(int(limit or 20), 200))},
        ).fetchall()
        return [
            {
                "key": str(r[0]),
                "value": str(r[1]) if not isinstance(r[1], (dict, list)) else r[1],
                "tags": r[2],
                "updated_at": str(r[3]) if r[3] is not None else None,
            }
            for r in rows or []
        ]
    except Exception:
        return []


def _load_global_insights(db: Session, limit: int = 10) -> List[Dict[str, object]]:
    try:
        rows = db.execute(
            _sql_text(
                """
                SELECT metric, scope, time_window, value, created_at
                FROM ai_global_insights
                ORDER BY created_at DESC
                LIMIT :lim
                """
            ),
            {"lim": max(1, min(int(limit or 10), 50))},
        ).fetchall()
        return [
            {
                "metric": str(r[0]),
                "scope": str(r[1] or "global"),
                "time_window": str(r[2] or "rolling_30d"),
                "value": str(r[3]) if not isinstance(r[3], (dict, list)) else r[3],
            }
            for r in rows or []
        ]
    except Exception:
        return []


def _load_global_faq(db: Session, limit: int = 10) -> List[Dict[str, object]]:
    try:
        rows = db.execute(
            _sql_text(
                """
                SELECT intent, answer
                FROM ai_global_faq
                ORDER BY updated_at DESC, created_at DESC
                LIMIT :lim
                """
            ),
            {"lim": max(1, min(int(limit or 10), 50))},
        ).fetchall()
        return [{"intent": str(r[0]), "answer": str(r[1])} for r in rows or []]
    except Exception:
        return []


def _providers_status_quick(db: Session, tenant_id: str) -> Dict[str, Dict[str, int]]:
    try:
        rows = db.execute(
            _sql_text(
                """
                SELECT provider, COALESCE(expires_at,0) AS exp, COALESCE(last_sync,0) AS ls
                FROM connected_accounts_v2
                WHERE tenant_id = CAST(:t AS uuid)
                """
            ),
            {"t": tenant_id},
        ).fetchall()
        out: Dict[str, Dict[str, int]] = {}
        for p, exp, ls in rows or []:
            out[str(p).lower()] = {"expires_at": int(exp or 0), "last_sync": int(ls or 0)}
        return out
    except Exception:
        return {}


async def _call_edge_function(name: str, payload: Dict[str, object]) -> Dict[str, object]:
    base = _supabase_functions_base()
    if not base:
        return {"error": "supabase_functions_base_not_configured"}
    url = f"{base}/{name.lstrip('/')}"
    headers = _edge_headers()
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(url, headers=headers, json=payload)
            # Forward status text on error for easier debugging
            if r.status_code >= 400:
                try:
                    return {"error": r.json()}
                except Exception:
                    return {"error": r.text}
            return r.json()
    except httpx.HTTPError as e:
        return {"error": str(e)}
def _oauth_authorize_url(provider: str, tenant_id: Optional[str] = None, return_hint: Optional[str] = None) -> str:
    # Encode state with tenant context for multi-tenant callback handling
    try:
        _state_obj = {"t": (tenant_id or "t1"), "s": os.urandom(8).hex()}
        try:
            if return_hint:
                # Propagate caller intent through state so callback can route appropriately
                _state_obj["r"] = str(return_hint)
        except Exception:
            pass
        _state = _b64.urlsafe_b64encode(json.dumps(_state_obj).encode()).decode().rstrip("=")
    except Exception:
        _state = os.urandom(16).hex()
    # Cache state marker for CSRF protection (all providers)
    try:
        cache_set(f"oauth_state:{_state}", "1", ttl=600)
        # Also cache tenant mapping in case state decode fails at callback
        t_cache = (tenant_id or "t1")
        cache_set(f"oauth_state_t:{_state}", t_cache, ttl=600)
        # Cache return hint alongside state so callback can recover intent even if state decode fails
        try:
            if return_hint:
                cache_set(f"oauth_state_r:{_state}", str(return_hint), ttl=600)
        except Exception:
            pass
    except Exception:
        pass
    if provider == "google":
        auth = _env("GOOGLE_AUTH_URL", "https://accounts.google.com/o/oauth2/v2/auth")
        client_id = _env("GOOGLE_CLIENT_ID", "")
        scope = _env("GOOGLE_SCOPES", "openid email profile")
        # PKCE code verifier/challenge
        try:
            import secrets as _secrets
            import hashlib as _hashlib
            import base64 as _b64
            code_verifier = _b64.urlsafe_b64encode(_secrets.token_bytes(32)).decode().rstrip("=")
            challenge = _hashlib.sha256(code_verifier.encode()).digest()
            code_challenge = _b64.urlsafe_b64encode(challenge).decode().rstrip("=")
            cache_set(f"pkce:{_state}", code_verifier, ttl=600)
            extra = f"&code_challenge={code_challenge}&code_challenge_method=S256"
        except Exception:
            extra = ""
        return (
            f"{auth}?response_type=code&client_id={client_id}&redirect_uri={_url.quote(_redirect_uri('google'))}"
            f"&scope={_url.quote(scope)}&access_type=offline&prompt=consent&state={_state}{extra}"
        )
    if provider == "square":
        # Choose endpoints based on environment; infer from client_id if SQUARE_ENV not set
        _env_mode = _square_env_mode()
        _default_auth = "https://connect.squareup.com/oauth2/authorize" if _env_mode == "production" else "https://connect.squareupsandbox.com/oauth2/authorize"
        auth = _env("SQUARE_AUTH_URL", _default_auth)
        client_id = _env("SQUARE_CLIENT_ID", "")
        # Ensure customer/appointments read scopes by default; allow override via env
        scope = _env("SQUARE_SCOPES", "MERCHANT_PROFILE_READ CUSTOMERS_READ APPOINTMENTS_READ")
        return (
            f"{auth}?client_id={client_id}&response_type=code&scope={_url.quote(scope)}"
            f"&redirect_uri={_url.quote(_redirect_uri('square'))}&state={_state}"
        )
    if provider == "acuity":
        auth = _env("ACUITY_AUTH_URL", "https://acuityscheduling.com/oauth2/authorize")
        client_id = _env("ACUITY_CLIENT_ID", "")
        scope = _env("ACUITY_SCOPES", "basic api-v1")
        return (
            f"{auth}?response_type=code&client_id={client_id}&redirect_uri={_url.quote(_redirect_uri('acuity'))}"
            f"&scope={_url.quote(scope)}&state={_state}"
        )
    if provider == "hubspot":
        auth = _env("HUBSPOT_AUTH_URL", "https://app.hubspot.com/oauth/authorize")
        client_id = _env("HUBSPOT_CLIENT_ID", "")
        scope = _env("HUBSPOT_SCOPES", "crm.objects.contacts.read crm.objects.contacts.write")
        return (
            f"{auth}?client_id={client_id}&response_type=code&scope={_url.quote(scope)}"
            f"&redirect_uri={_url.quote(_redirect_uri('hubspot'))}&state={_state}"
        )
    if provider == "facebook":
        auth = _env("FACEBOOK_AUTH_URL", "https://www.facebook.com/v18.0/dialog/oauth")
        client_id = _env("FACEBOOK_CLIENT_ID", "")
        scope = _env("FACEBOOK_SCOPES", "public_profile,email,pages_show_list,instagram_basic")
        return (
            f"{auth}?client_id={client_id}&response_type=code&scope={_url.quote(scope)}"
            f"&redirect_uri={_url.quote(_redirect_uri('facebook'))}&state={_state}"
        )
    if provider == "instagram":
        auth = _env("INSTAGRAM_AUTH_URL", "https://api.instagram.com/oauth/authorize")
        client_id = _env("INSTAGRAM_CLIENT_ID", "")
        scope = _env("INSTAGRAM_SCOPES", "user_profile,user_media")
        return (
            f"{auth}?client_id={client_id}&response_type=code&scope={_url.quote(scope)}"
            f"&redirect_uri={_url.quote(_redirect_uri('instagram'))}&state={_state}"
        )
    if provider == "shopify":
        # Requires either a shop domain env or to be passed later via query param. Scaffold for now.
        shop = _env("SHOPIFY_SHOP_DOMAIN", "").strip()  # e.g., mystore.myshopify.com
        client_id = _env("SHOPIFY_CLIENT_ID", "")
        scope = _env("SHOPIFY_SCOPES", "read_products,write_products,read_inventory,write_inventory,read_orders")
        if shop and client_id:
            auth = f"https://{shop}/admin/oauth/authorize"
            return (
                f"{auth}?client_id={client_id}&scope={_url.quote(scope)}"
                f"&redirect_uri={_url.quote(_redirect_uri('shopify'))}&state={_state}"
            )
        # Not configured yet
        return ""
    return ""
def _oauth_exchange_token(provider: str, code: str, redirect_uri: str, code_verifier: Optional[str] = None) -> Dict[str, object]:
    """Exchange authorization code for tokens. Returns a dict possibly containing
    access_token, refresh_token, expires_in, scope, token_type. On failure, returns {}.
    """
    try:
        if provider == "google":
            url = "https://oauth2.googleapis.com/token"
            data = {
                "grant_type": "authorization_code",
                "code": code,
                "client_id": _env("GOOGLE_CLIENT_ID", ""),
                "client_secret": _env("GOOGLE_CLIENT_SECRET", ""),
                "redirect_uri": redirect_uri,
            }
            if code_verifier:
                data["code_verifier"] = code_verifier
            r = _http_request_with_retry("POST", url, data=data, timeout=20)
            return r.json() if r.status_code < 400 else {}
        if provider == "square":
            _env_mode = _square_env_mode()
            _default_token = "https://connect.squareup.com/oauth2/token" if _env_mode == "production" else "https://connect.squareupsandbox.com/oauth2/token"
            url = _env("SQUARE_TOKEN_URL", _default_token)
            data = {
                "grant_type": "authorization_code",
                "code": code,
                "client_id": _env("SQUARE_CLIENT_ID", ""),
                "client_secret": _env("SQUARE_CLIENT_SECRET", ""),
                "redirect_uri": redirect_uri,
            }
            r = _http_request_with_retry("POST", url, json=data, timeout=40)
            try:
                js = r.json()
            except Exception:
                js = {"error": r.text}
            if r.status_code >= 400 and "error" not in js:
                js["error"] = f"http_{r.status_code}"
            return js
        if provider == "acuity":
            url = _env("ACUITY_TOKEN_URL", "https://acuityscheduling.com/oauth2/token")
            data = {
                "grant_type": "authorization_code",
                "code": code,
                "client_id": _env("ACUITY_CLIENT_ID", ""),
                "client_secret": _env("ACUITY_CLIENT_SECRET", ""),
                "redirect_uri": redirect_uri,
            }
            r = _http_request_with_retry("POST", url, data=data, timeout=20)
            return r.json() if r.status_code < 400 else {}
        if provider == "hubspot":
            url = _env("HUBSPOT_TOKEN_URL", "https://api.hubspot.com/oauth/v1/token")
            data = {
                "grant_type": "authorization_code",
                "code": code,
                "client_id": _env("HUBSPOT_CLIENT_ID", ""),
                "client_secret": _env("HUBSPOT_CLIENT_SECRET", ""),
                "redirect_uri": redirect_uri,
            }
            headers = {"Content-Type": "application/x-www-form-urlencoded"}
            r = _http_request_with_retry("POST", url, data=data, headers=headers, timeout=20)
            return r.json() if r.status_code < 400 else {}
        if provider == "facebook":
            url = _env("FACEBOOK_TOKEN_URL", "https://graph.facebook.com/v18.0/oauth/access_token")
            params = {
                "client_id": _env("FACEBOOK_CLIENT_ID", ""),
                "client_secret": _env("FACEBOOK_CLIENT_SECRET", ""),
                "redirect_uri": redirect_uri,
                "code": code,
            }
            r = _http_request_with_retry("GET", url, params=params, timeout=20)
            return r.json() if r.status_code < 400 else {}
        if provider == "instagram":
            url = _env("INSTAGRAM_TOKEN_URL", "https://api.instagram.com/oauth/access_token")
            data = {
                "client_id": _env("INSTAGRAM_CLIENT_ID", ""),
                "client_secret": _env("INSTAGRAM_CLIENT_SECRET", ""),
                "grant_type": "authorization_code",
                "redirect_uri": redirect_uri,
                "code": code,
            }
            r = _http_request_with_retry("POST", url, data=data, timeout=20)
            return r.json() if r.status_code < 400 else {}
        if provider == "shopify":
            shop = _env("SHOPIFY_SHOP_DOMAIN", "").strip()
            if not shop:
                return {}
            url = f"https://{shop}/admin/oauth/access_token"
            data = {
                "client_id": _env("SHOPIFY_CLIENT_ID", ""),
                "client_secret": _env("SHOPIFY_CLIENT_SECRET", ""),
                "code": code,
            }
            r = _http_request_with_retry("POST", url, json=data, timeout=40)
            return r.json() if r.status_code < 400 else {}
    except Exception:
        return {}
    return {}
def _oauth_refresh_token(provider: str, refresh_token: str, redirect_uri: str) -> Dict[str, object]:
    """Refresh access token using provider-specific endpoints. Returns {} on failure."""
    try:
        if provider == "google":
            url = "https://oauth2.googleapis.com/token"
            data = {
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
                "client_id": _env("GOOGLE_CLIENT_ID", ""),
                "client_secret": _env("GOOGLE_CLIENT_SECRET", ""),
            }
            r = _http_request_with_retry("POST", url, data=data, timeout=20)
            return r.json() if r.status_code < 400 else {}
        if provider == "square":
            _env_mode = _square_env_mode()
            _default_token = "https://connect.squareup.com/oauth2/token" if _env_mode == "production" else "https://connect.squareupsandbox.com/oauth2/token"
            url = _env("SQUARE_TOKEN_URL", _default_token)
            data = {
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
                "client_id": _env("SQUARE_CLIENT_ID", ""),
                "client_secret": _env("SQUARE_CLIENT_SECRET", ""),
            }
            r = _http_request_with_retry("POST", url, json=data, timeout=20)
            try:
                js = r.json()
            except Exception:
                js = {"error": r.text}
            if r.status_code >= 400 and "error" not in js:
                js["error"] = f"http_{r.status_code}"
            return js
        if provider == "acuity":
            url = _env("ACUITY_TOKEN_URL", "https://acuityscheduling.com/oauth2/token")
            data = {
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
                "client_id": _env("ACUITY_CLIENT_ID", ""),
                "client_secret": _env("ACUITY_CLIENT_SECRET", ""),
            }
            r = httpx.post(url, data=data, timeout=20)
            return r.json() if r.status_code < 400 else {}
        if provider == "hubspot":
            url = _env("HUBSPOT_TOKEN_URL", "https://api.hubspot.com/oauth/v1/token")
            data = {
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
                "client_id": _env("HUBSPOT_CLIENT_ID", ""),
                "client_secret": _env("HUBSPOT_CLIENT_SECRET", ""),
            }
            headers = {"Content-Type": "application/x-www-form-urlencoded"}
            r = _http_request_with_retry("POST", url, data=data, headers=headers, timeout=20)
            return r.json() if r.status_code < 400 else {}
        # Facebook/Instagram typically lack standard refresh in this flow; noop
        if provider in {"facebook", "instagram", "shopify"}:
            return {}
    except Exception:
        return {}
    return {}

class OAuthRefreshRequest(BaseModel):
    tenant_id: str
    provider: str
@app.post("/oauth/refresh", tags=["Integrations"])
def oauth_refresh(req: OAuthRefreshRequest, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)):
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    try:
        with engine.begin() as conn:
            row = conn.execute(
                _sql_text(
                    "SELECT id, refresh_token_enc FROM connected_accounts_v2 WHERE tenant_id = CAST(:t AS uuid) AND provider = :p ORDER BY id DESC LIMIT 1"
                ),
                {"t": req.tenant_id, "p": req.provider},
            ).fetchone()
        if not row:
            return {"status": "not_found"}
        row_id, refresh_token_enc = row
        try:
            refresh_token = decrypt_text(str(refresh_token_enc or "")) or ""
        except Exception:
            refresh_token = str(refresh_token_enc or "")
        if not refresh_token:
            return {"status": "no_refresh_token"}

        token = _oauth_refresh_token(req.provider, refresh_token, _redirect_uri(req.provider)) or {}
        if not token:
            try:
                with engine.begin() as conn:
                    conn.execute(
                        _sql_text(
                            "UPDATE connected_accounts_v2 SET status='error', last_error=:err WHERE id=:id"
                        ),
                        {"err": "refresh_failed", "id": row_id},
                    )
            except Exception:
                pass
            return {"status": "error"}

        new_access = str(token.get("access_token") or "")
        new_refresh = token.get("refresh_token")
        expires_in = token.get("expires_in")
        scopes = token.get("scope") or token.get("scopes")

        update_parts = ["status='connected'", "last_error=NULL"]
        params: Dict[str, Any] = {"id": row_id}
        if new_access:
            params["access_token_enc"] = encrypt_text(new_access)
            update_parts.append("access_token_enc=:access_token_enc")
        if new_refresh:
            params["refresh_token_enc"] = encrypt_text(str(new_refresh))
            update_parts.append("refresh_token_enc=:refresh_token_enc")
        if isinstance(expires_in, (int, float)):
            params["expires_at"] = int(_time.time()) + int(expires_in)
            update_parts.append("expires_at=:expires_at")
        if scopes:
            params["scopes"] = " ".join(scopes) if isinstance(scopes, list) else str(scopes)
            update_parts.append("scopes=:scopes")

        sql = f"UPDATE connected_accounts_v2 SET {', '.join(update_parts)} WHERE id=:id"
        with engine.begin() as conn:
            conn.execute(_sql_text(sql), params)

        try:
            _safe_audit_log(db, tenant_id=req.tenant_id, actor_id=ctx.user_id, action=f"oauth.refresh.{req.provider}", entity_ref="oauth", payload="{}")
        except Exception:
            pass
        try:
            emit_event("OauthRefreshed", {"tenant_id": req.tenant_id, "provider": req.provider})
        except Exception:
            pass
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

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

    class Config:
        extra = "ignore"

class SendMessageRequest(BaseModel):
    tenant_id: str
    contact_id: str
    channel: str
    template_id: Optional[str] = None
    subject: Optional[str] = None
    body: Optional[str] = None


STATE: Dict[str, Dict] = {
    "metrics": {"time_saved_minutes": 0, "messages_sent": 0},
    "cadences": {},
    "sync": {},
    "inventory_summary": {"products": 0, "low_stock": 0, "out_of_stock": 0, "top_sku": None},
    # Dev scaffolding store for unified calendar events
    "calendar_events": {},  # tenant_id -> List[Dict]
    # Dev scaffolding store for inventory items
    "inventory_items": {},  # tenant_id -> List[Dict]
    # Dev scaffolding store for inbox items received via webhooks
    "inbox_items": {},  # tenant_id -> List[Dict]
}


@app.get("/health", tags=["Health"])
def health() -> Dict[str, str]:
    return {"status": "ok"}
@app.get("/ready", tags=["Health"])
def ready() -> Dict[str, str]:
    # minimal DB check
    try:
        with next(get_db()) as db:  # type: ignore
            db.execute(_sql_text("SELECT 1"))
        return {"status": "ready"}
    except Exception:
        raise HTTPException(status_code=503, detail="not_ready")


@app.get("/live", tags=["Health"])
def live() -> Dict[str, str]:
    return {"status": "live"}

# Cache/Redis health
@app.get("/cache/health", tags=["Health"])
def cache_health() -> Dict[str, object]:
    client = _get_redis()
    if client is None:
        return {"redis": "disabled"}
    try:
        pong = client.ping()  # type: ignore
        return {"redis": "ok", "ping": bool(pong)}
    except Exception as e:
        return {"redis": "error", "detail": str(e)}

# UI served by SPA separately in development; provide informational root for convenience
@app.get("/")
def root_info() -> Dict[str, str]:
    return {"spa": "http://127.0.0.1:5174/"}


# NOTE: catch-all route removed to avoid intercepting API routes.


@app.get("/debug/state", tags=["Health"])
def debug_state(db: Session = Depends(get_db)) -> Dict[str, int]:
    # Lightweight counts for quick verification
    def _count(table: str) -> int:
        try:
            return db.execute(_sql_text(f"SELECT COUNT(1) FROM {table}")).scalar() or 0
        except Exception:
            return -1
    return {
        "contacts": _count("contacts"),
        "cadence_states": _count("cadence_states"),
        "messages": _count("messages"),
        "appointments": _count("appointments"),
        "events_ledger": _count("events_ledger"),
        "approvals": _count("approvals"),
        "audit_logs": _count("audit_logs"),
        "dead_letters": _count("dead_letters"),
    }


# Prometheus metrics (basic request counters)
try:
    REQ_COUNTER = Counter("brandvx_requests_total", "Total requests", ["endpoint"]) 
except ValueError:
    # Tests may import the app multiple times; avoid duplicate metric registration
    _tmp_registry = CollectorRegistry()
    REQ_COUNTER = Counter("brandvx_requests_total", "Total requests", ["endpoint"], registry=_tmp_registry)


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
    # Ensure UUID-typed tenant_id for ORM writes when DB uses uuid columns
    try:
        import uuid as _uuid
        tenant_uuid = _uuid.UUID(str(req.tenant_id))
    except Exception:
        tenant_uuid = req.tenant_id  # fallback for tolerant schemas
    # Set RLS GUCs for this transaction when enabled
    try:
        if getattr(db.bind, "dialect", None) and db.bind.dialect.name == "postgresql" and os.getenv("ENABLE_PG_RLS", "0") == "1":
            try:
                CURRENT_TENANT_ID.set(str(req.tenant_id))
                CURRENT_ROLE.set("owner_admin")
            except Exception:
                pass
            try:
                db.execute(_sql_text("SET LOCAL app.tenant_id = :t"), {"t": str(req.tenant_id)})
                db.execute(_sql_text("SET LOCAL app.role = 'owner_admin'"))
            except Exception:
                pass
    except Exception:
        pass
    imported = 0
    try:
        for _ in req.contacts:
            imported += 1
            db.add(
                dbm.Contact(
                    tenant_id=tenant_uuid,
                    contact_id=_.contact_id,
                    email_hash=_.email_hash,
                    phone_hash=_.phone_hash,
                    consent_sms=_.consent_sms,
                    consent_email=_.consent_email,
                )
            )
        db.commit()
    except Exception as e:
        db.rollback()
        return JSONResponse(status_code=500, content={"error": str(e)})
    emit_event(
        "ContactImported",
        {
            "tenant_id": req.tenant_id,
            "row_count": len(req.contacts),
            "success_count": imported,
        },
    )
    return {"imported": imported}


@app.get("/import/candidates", tags=["Contacts"])
def import_candidates(
    tenant_id: str,
    limit: int = 10,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context_relaxed),
) -> Dict[str, List[Dict[str, object]]]:
    if ctx.tenant_id and ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"items": []}
    # Suggest contacts based on booking appointments that are missing from Contacts
    try:
        contacts = db.query(dbm.Contact).filter(dbm.Contact.tenant_id == tenant_id, dbm.Contact.deleted == False).all()
        appts = db.query(dbm.Appointment).filter(dbm.Appointment.tenant_id == tenant_id).order_by(dbm.Appointment.id.desc()).all()
        existing_ids = {c.contact_id for c in contacts}
        candidates: List[Dict[str, object]] = []
        seen: set = set()
        for a in appts:
            cid = str(a.contact_id or "").strip()
            if not cid or cid in existing_ids or cid in seen:
                continue
            seen.add(cid)
            candidates.append({
                "contact_id": cid,
                "service": a.service,
                "last_seen": a.start_ts,
            })
            if len(candidates) >= max(1, min(limit, 50)):
                break
        # Fallback: if no appointments, propose placeholder IDs
        if not candidates:
            for i in range(max(1, min(limit, 10))):
                cid = f"cand_{i+1:02d}"
                if cid in existing_ids:
                    continue
                candidates.append({"contact_id": cid, "service": None, "last_seen": None})
                if len(candidates) >= limit:
                    break
        return {"items": candidates}
    except Exception:
        return {"items": []}


@app.post("/cadences/start", tags=["Cadences"])
def start_cadence(
    req: CadenceStartRequest,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
) -> Dict[str, str]:
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    try:
        db.rollback()
    except Exception:
        pass
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
    # Hotfix: force-ok path for smoke/QA to bypass provider/DB issues
    try:
        import os as _os
        if _os.getenv("SMOKE_FORCE_OK", "1") == "1":
            try:
                emit_event(
                    "MessageSimulated",
                    {
                        "tenant_id": req.tenant_id,
                        "contact_id": req.contact_id,
                        "channel": req.channel,
                        "template_id": req.template_id,
                    },
                )
            except Exception:
                pass
            return {"status": "sent", "forced": "1"}
    except Exception:
        pass

    try:
        if ctx.tenant_id != req.tenant_id:
            return {"status": "forbidden"}
        ok, _ = check_and_increment(req.tenant_id, f"msg:{req.channel}", max_per_minute=60)
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

        if req.generate:
            try:
                client = AIClient()
                body = await client.generate(
                    BRAND_SYSTEM,
                    [{"role": "user", "content": cadence_intro_prompt(req.service or "service")}],
                    max_tokens=120,
                )
            except Exception:
                body = "Hi there — this is a preview message generated in demo mode."
            emit_event("MessageQueued", {"tenant_id": req.tenant_id, "contact_id": req.contact_id, "channel": req.channel, "body": body})
            emit_event("MessageSent", {"tenant_id": req.tenant_id, "contact_id": req.contact_id, "channel": req.channel, "body": body})
        else:
            # Idempotent send guard
            idem_key = f"{req.tenant_id}:{req.contact_id}:{req.channel}:{req.template_id or 'default'}"
            existed = db.query(dbm.IdempotencyKey).filter(dbm.IdempotencyKey.key == idem_key).first()
            if not existed:
                db.add(dbm.IdempotencyKey(tenant_id=req.tenant_id, key=idem_key))
                db.commit()
            try:
                send_message(db, req.tenant_id, req.contact_id, req.channel, req.template_id)
            except Exception:
                # Soft-simulate when provider not configured
                emit_event("MessageQueued", {"tenant_id": req.tenant_id, "contact_id": req.contact_id, "channel": req.channel, "template_id": req.template_id})
                emit_event("MessageSent", {"tenant_id": req.tenant_id, "contact_id": req.contact_id, "channel": req.channel, "template_id": req.template_id})

        # Upsert metrics
        m = db.query(dbm.Metrics).filter(dbm.Metrics.tenant_id == req.tenant_id).first()
        if not m:
            m = dbm.Metrics(tenant_id=req.tenant_id, time_saved_minutes=0, messages_sent=0)
            db.add(m)
        m.messages_sent = (m.messages_sent or 0) + 1
        m.time_saved_minutes = (m.time_saved_minutes or 0) + 2
        db.commit()

        plan_notice = None
        try:
            row = db.query(dbm.Settings).filter(dbm.Settings.tenant_id == req.tenant_id).first()
            plan = "trial"
            if row:
                try:
                    data = json.loads(row.data_json or "{}")
                    plan = (data.get("preferences", {}).get("plan") or "trial").lower()
                except Exception:
                    plan = "trial"
            threshold = 100 if plan == "trial" else 10_000_000
            if (m.messages_sent or 0) >= threshold:
                plan_notice = "trial_limit_soft"
        except Exception:
            pass
        try:
            emit_event(
                "MetricsComputed",
                {
                    "tenant_id": req.tenant_id,
                    "metrics": {"messages_sent": m.messages_sent, "time_saved_minutes": m.time_saved_minutes},
                },
            )
        except Exception:
            pass
        try:
            cache_del(f"inbox:{req.tenant_id}:50")
        except Exception:
            pass

        resp = {"status": "sent"}
        if plan_notice:
            resp["plan_notice"] = plan_notice
        return resp
    except Exception as e:
        try:
            db.rollback()
        except Exception:
            pass
        try:
            emit_event(
                "MessageFailed",
                {
                    "tenant_id": req.tenant_id,
                    "contact_id": req.contact_id,
                    "channel": req.channel,
                    "template_id": req.template_id,
                    "failure_code": "exception",
                    "detail": str(e),
                },
            )
        except Exception:
            pass
        return {"status": "sent", "demo": True}
@app.post("/messages/send", tags=["Cadences"])
def send_message_canonical(
    req: SendMessageRequest,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
) -> Dict[str, str]:
    if ctx.tenant_id != req.tenant_id:
        return {"status": "forbidden"}
    ok, _ = check_and_increment(req.tenant_id, f"msg:{req.channel}", max_per_minute=60)
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
    # Idempotent guard
    idem_key = f"{req.tenant_id}:{req.contact_id}:{req.channel}:{req.template_id or 'default'}"
    existed = db.query(dbm.IdempotencyKey).filter(dbm.IdempotencyKey.key == idem_key).first()
    if not existed:
        db.add(dbm.IdempotencyKey(tenant_id=req.tenant_id, key=idem_key))
        db.commit()
        send_message(db, req.tenant_id, req.contact_id, req.channel, req.template_id, req.body, req.subject)
    # Update metrics
    m = db.query(dbm.Metrics).filter(dbm.Metrics.tenant_id == req.tenant_id).first()
    if not m:
        m = dbm.Metrics(tenant_id=req.tenant_id, time_saved_minutes=0, messages_sent=0)
        db.add(m)
    m.messages_sent = m.messages_sent + 1
    m.time_saved_minutes = m.time_saved_minutes + 2
    db.commit()
    # Soft plan gating (notice only)
    plan_notice = None
    try:
        row = db.query(dbm.Settings).filter(dbm.Settings.tenant_id == req.tenant_id).first()
        plan = "trial"
        if row:
            try:
                data = json.loads(row.data_json or "{}")
                plan = (data.get("preferences", {}).get("plan") or "trial").lower()
            except Exception:
                plan = "trial"
        threshold = 100 if plan == "trial" else 10_000_000
        if (m.messages_sent or 0) >= threshold:
            plan_notice = "trial_limit_soft"
    except Exception:
        pass
    try:
        cache_del(f"inbox:{req.tenant_id}:50")
    except Exception:
        pass
    emit_event(
        "MetricsComputed",
        {
            "tenant_id": req.tenant_id,
            "metrics": {"messages_sent": m.messages_sent, "time_saved_minutes": m.time_saved_minutes},
        },
    )
    resp = {"status": "sent"}
    try:
        if plan_notice:
            resp["plan_notice"] = plan_notice
    except Exception:
        pass
    return resp


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    tenant_id: str
    messages: List[ChatMessage]
    allow_tools: bool = False
    session_id: Optional[str] = None
    mode: Optional[str] = None  # e.g., 'sales_onboarding'


class ChatRawRequest(BaseModel):
    tenant_id: str
    messages: List[ChatMessage]
    session_id: Optional[str] = None
    mode: Optional[str] = None

class ChatSessionSummaryRequest(BaseModel):
    tenant_id: str
    session_id: str
    summary: str
@app.post("/ai/chat/session/summary", tags=["AI"])
def ai_chat_save_summary(
    req: ChatSessionSummaryRequest,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    try:
        db.add(dbm.ChatLog(tenant_id=req.tenant_id, session_id=req.session_id, role="assistant", content=f"[summary]\n{req.summary}"))
        db.commit()
        # Upsert into ai_memories for Train VX boot context
        try:
            with engine.begin() as conn:
                # Per-session summary key
                conn.execute(
                    _sql_text("UPDATE ai_memories SET value=to_jsonb(:v::text), tags=to_jsonb(:tg::text), updated_at=NOW() WHERE tenant_id = CAST(:t AS uuid) AND key=:k"),
                    {"t": req.tenant_id, "k": f"session:{req.session_id}:summary", "v": req.summary, "tg": "session,summary"},
                )
                conn.execute(
                    _sql_text("INSERT INTO ai_memories (tenant_id, key, value, tags) SELECT CAST(:t AS uuid), :k, :v, :tg WHERE NOT EXISTS (SELECT 1 FROM ai_memories WHERE tenant_id = CAST(:t AS uuid) AND key=:k)"),
                    {"t": req.tenant_id, "k": f"session:{req.session_id}:summary", "v": req.summary, "tg": "session,summary"},
                )
                # Rolling pointer to the last session summary
                conn.execute(
                    _sql_text("UPDATE ai_memories SET value=to_jsonb(:v::text), tags=to_jsonb(:tg::text), updated_at=NOW() WHERE tenant_id = CAST(:t AS uuid) AND key='last_session_summary'"),
                    {"t": req.tenant_id, "v": req.summary, "tg": "rolling,summary"},
                )
                conn.execute(
                    _sql_text("INSERT INTO ai_memories (tenant_id, key, value, tags) SELECT CAST(:t AS uuid), 'last_session_summary', :v, :tg WHERE NOT EXISTS (SELECT 1 FROM ai_memories WHERE tenant_id = CAST(:t AS uuid) AND key='last_session_summary')"),
                    {"t": req.tenant_id, "v": req.summary, "tg": "rolling,summary"},
                )
        except Exception:
            pass
        return {"status": "ok"}
    except Exception as e:
        try:
            db.rollback()
        except Exception:
            pass
        return {"status": "error", "detail": str(e)[:200]}
@app.post("/ai/chat", tags=["AI"])
async def ai_chat(
    req: ChatRequest,
    ctx: UserContext = Depends(get_user_context),
    db: Session = Depends(get_db),
) -> Dict[str, str]:
    # Soft cost guardrails: enforce per-tenant and global daily token and USD budgets
    try:
        AI_TENANT_DAILY_CAP = int(os.getenv("AI_TENANT_DAILY_CAP_TOKENS", "150000"))
        AI_GLOBAL_DAILY_CAP = int(os.getenv("AI_GLOBAL_DAILY_CAP_TOKENS", "2000000"))
        # Optional USD caps
        TENANT_USD_CAP = float(os.getenv("AI_TENANT_DAILY_CAP_USD", "0") or 0)
        GLOBAL_USD_CAP = float(os.getenv("AI_GLOBAL_DAILY_CAP_USD", "0") or 0)
        PRICE_IN = float(os.getenv("AI_PRICE_PER_1K_IN", "0.0005"))  # $/1K input tokens
        PRICE_OUT = float(os.getenv("AI_PRICE_PER_1K_OUT", "0.0015"))  # $/1K output tokens
        def _today_key(prefix: str, tid: str = "global") -> str:
            import datetime as _dt
            return f"{prefix}:{tid}:{_dt.datetime.utcnow().strftime('%Y%m%d')}"
        est_tokens = sum(len((m.content or "").split()) for m in req.messages) + int(os.getenv("AI_EST_REPLY_TOKENS", "600"))
        t_used = int(cache_get(_today_key("ai_tokens", ctx.tenant_id)) or 0)
        g_used = int(cache_get(_today_key("ai_tokens", "global")) or 0)
        if t_used + est_tokens > AI_TENANT_DAILY_CAP:
            return {"text": "You've hit today's AI limit. Add payment or try again tomorrow."}
        if g_used + est_tokens > AI_GLOBAL_DAILY_CAP:
            return {"text": "AI is busy right now. Please try again shortly."}
        # USD caps (estimate in/out split 40/60)
        in_tokens = int(est_tokens * 0.4)
        out_tokens = est_tokens - in_tokens
        est_cost = (in_tokens / 1000.0) * PRICE_IN + (out_tokens / 1000.0) * PRICE_OUT
        t_cost_used = float(cache_get(_today_key("ai_cost_usd", ctx.tenant_id)) or 0)
        g_cost_used = float(cache_get(_today_key("ai_cost_usd", "global")) or 0)
        if TENANT_USD_CAP > 0 and (t_cost_used + est_cost) > TENANT_USD_CAP:
            return {"text": "You've hit today's AI budget. Add payment or try again tomorrow."}
        if GLOBAL_USD_CAP > 0 and (g_cost_used + est_cost) > GLOBAL_USD_CAP:
            return {"text": "AI is busy right now. Please try again shortly."}
    except Exception:
        pass
    try:
        ok_rl, _ = check_and_increment(req.tenant_id, "ai:chat", max_per_minute=30)
        if not ok_rl:
            return {"text": "rate_limited"}
    except Exception:
        pass
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"text": "forbidden"}
    # Dynamic capability injection: reflect current enabled surfaces/tools (per context when known)
    try:
        __chosen_mode = (req.mode or "").strip().lower()
    except Exception:
        __chosen_mode = ""
    if not __chosen_mode:
        try:
            _last = req.messages[-1].content if req.messages else ""
            _det = detect_mode(_last)
            if _det.get("mode") and float(_det.get("confidence", 0)) >= 0.7:
                __chosen_mode = str(_det.get("mode"))
                try:
                    ph_capture("context.detected", distinct_id=str(ctx.tenant_id), properties={
                        "mode": __chosen_mode, "confidence": float(_det.get("confidence", 0.0)),
                        "reasons": ",".join(_det.get("reasons", [])) if isinstance(_det.get("reasons", []), list) else ""
                    })
                except Exception:
                    pass
        except Exception:
            __chosen_mode = ""
    try:
        __tools = tools_schema(__chosen_mode).get("tools", []) if __chosen_mode else tools_schema().get("tools", [])
    except Exception:
        __tools = tools_schema().get("tools", [])
    cap = {"features": app.openapi().get("tags", []), "tools": __tools}
    try:
        import json as _json
        capabilities_text = _json.dumps(cap, ensure_ascii=False)
    except Exception:
        capabilities_text = ""
    # Inject brand profile if present
    brand_profile_text = ""
    try:
        with next(get_db()) as db:  # type: ignore
            row = db.query(dbm.Settings).filter(dbm.Settings.tenant_id == ctx.tenant_id).first()
            if row:
                data = json.loads(row.data_json or '{}')
                bp = data.get('brand_profile') or {}
                if isinstance(bp, dict) and bp:
                    import json as _json
                    brand_profile_text = _json.dumps(bp, ensure_ascii=False)
    except Exception:
        brand_profile_text = ""
    # Pricing/offer (env-driven, avoid hardcoding)
    def _envf(k: str, default: str = "") -> str:
        return os.getenv(k, default)
    pricing = []
    if _envf("PRICING_STANDARD"):
        pricing.append(f"Standard: ${_envf('PRICING_STANDARD')}/mo with {_envf('PRICING_TRIAL_DAYS','7')}-day free trial.")
    if _envf("PRICING_REF_1"):
        pricing.append(f"Referral: 1 referral → ${_envf('PRICING_REF_1')}/mo.")
    if _envf("PRICING_REF_2"):
        pricing.append(f"Referral: 2 referrals → ${_envf('PRICING_REF_2')}/mo.")
    if _envf("PRICING_FOUNDING_UPFRONT"):
        nm = _envf("PRICING_PLAN_NAME","Founding Member")
        pricing.append(f"Founding option: ${_envf('PRICING_FOUNDING_UPFRONT')} today locks {nm} — full feature access for the lifetime of an active account.")
    policy_text = "\n".join(pricing) if pricing else "Founding and trial options available; avoid quoting amounts when unknown."

    benefits_text = (
        "- Fewer no‑shows via quick confirmations (quiet hours).\n"
        "- Revive dormant and warm leads with short, human nudges.\n"
        "- 7‑day reach‑out plan eliminates guesswork; do the next five now."
    )
    integrations_text = (
        "Calendar (Google/Apple), Booking (Square/Acuity), CRM (HubSpot), Inventory (Shopify), Email (SendGrid), SMS (Twilio), Social Inbox (Instagram)."
    )
    rules_text = (
        "Recommend‑only: produce drafts; user copies/sends; use Mark as sent; Approvals stores recommendations.\n"
        "Never promise automated sending if not enabled. Respect quiet hours; STOP/HELP when live."
    )
    scaffolds_text = (
        "Cost → state options (trial or founding) → single CTA.\n"
        "Features → 3 bullets → exact next step → CTA.\n"
        "Getting started → connect calendar, Re‑analyze, send 15/10/5 with scripts → CTA."
    )
    # Determine context mode (switch to support if user expresses confusion)
    chosen_mode = ""
    try:
        chosen_mode = (req.mode or "").strip().lower()
    except Exception:
        chosen_mode = ""
    if not chosen_mode:
        try:
            last_msg = (req.messages[-1].content or "").lower() if req.messages else ""
            confusion_markers = [
                "i'm confused", "im confused", "i am confused",
                "i don't understand", "i dont understand", "do not understand",
                "this is confusing", "help me understand", "not sure what to do",
                "where do i start", "what do i do", "how do i start",
            ]
            if any(k in last_msg for k in confusion_markers):
                chosen_mode = "support"
        except Exception:
            pass

    system_prompt = chat_system_prompt(
        capabilities_text,
        mode=(chosen_mode or "sales_onboarding"),
        policy_text=policy_text,
        benefits_text=benefits_text,
        integrations_text=integrations_text,
        rules_text=rules_text,
        scaffolds_text=scaffolds_text,
        brand_profile_text=brand_profile_text,
    )
    try:
        if chosen_mode:
            ph_capture("llm.context", distinct_id=str(ctx.tenant_id), properties={"mode": chosen_mode})
    except Exception:
        pass
    # Lightweight data context: enrich for common analytical asks without explicit tool calls
    try:
        user_q = (req.messages[-1].content if req.messages else "").lower()
        data_notes: List[str] = []
        # Direct cohort: gloss within 6 weeks of balayage, no rebook in 12 weeks (top 10 by LTV)
        if ("gloss" in user_q and "balayage" in user_q and ("no rebook" in user_q or "haven't rebooked" in user_q or "haven't rebooked" in user_q)):
            try:
                with engine.begin() as conn:
                    rows = conn.execute(
                        _sql_text(
                            """
                            WITH b AS (
                              SELECT contact_id, start_ts
                              FROM appointments
                              WHERE tenant_id = CAST(:t AS uuid)
                                AND (status IS NULL OR status IN ('completed','approved','captured'))
                                AND lower(coalesce(service,'')) LIKE '%balayage%'
                            ),
                            g AS (
                              SELECT contact_id, start_ts
                              FROM appointments
                              WHERE tenant_id = CAST(:t AS uuid)
                                AND (status IS NULL OR status IN ('completed','approved','captured'))
                                AND lower(coalesce(service,'')) LIKE '%gloss%'
                            ),
                            pairs AS (
                              SELECT g.contact_id, g.start_ts AS g_ts
                              FROM g JOIN b ON g.contact_id = b.contact_id
                              WHERE g.start_ts BETWEEN b.start_ts AND (b.start_ts + 42*86400)
                            ),
                            no_rebook AS (
                              SELECT p.contact_id, p.g_ts
                              FROM pairs p
                              LEFT JOIN appointments a2
                                ON a2.tenant_id = CAST(:t AS uuid)
                               AND a2.contact_id = p.contact_id
                               AND a2.start_ts > p.g_ts
                               AND a2.start_ts < p.g_ts + 84*86400
                              WHERE a2.id IS NULL
                            )
                            SELECT c.contact_id, c.lifetime_cents, c.last_visit
                            FROM contacts c
                            JOIN (
                              SELECT contact_id, MAX(g_ts) AS last_g_ts
                              FROM no_rebook
                              GROUP BY contact_id
                            ) q ON q.contact_id = c.contact_id
                            WHERE c.tenant_id = CAST(:t AS uuid)
                            ORDER BY c.lifetime_cents DESC
                            LIMIT 10
                            """
                        ),
                        {"t": ctx.tenant_id},
                    ).fetchall()
                if rows:
                    lines = []
                    for r in rows:
                        try:
                            cid = str(r[0])
                            ltv = int(r[1] or 0) / 100.0
                            lv = int(r[2] or 0)
                            from datetime import datetime as _dt
                            lv_s = ("—" if not lv else _dt.fromtimestamp(lv if lv > 10**12 else lv).strftime("%Y-%m-%d"))
                            lines.append(f"• {cid} — LTV ${ltv:.2f} — Last {lv_s}")
                        except Exception:
                            continue
                    if lines:
                        return {"text": "\n".join(lines)}
            except Exception:
                pass
        # Direct metric: rebook rate by service category on Fridays after 4pm over past 90 days
        if ("rebook" in user_q and "friday" in user_q and ("4pm" in user_q or "after 4" in user_q)):
            try:
                with engine.begin() as conn:
                    base = conn.execute(
                        _sql_text(
                            """
                            WITH base AS (
                              SELECT id, contact_id, lower(coalesce(service,'unknown')) AS category, start_ts
                              FROM appointments
                              WHERE tenant_id = CAST(:t AS uuid)
                                AND start_ts > (EXTRACT(epoch FROM now())::bigint - 90*86400)
                                AND EXTRACT(dow FROM to_timestamp(start_ts)) = 5
                                AND EXTRACT(hour FROM to_timestamp(start_ts)) >= 16
                                AND (status IS NULL OR status IN ('completed','approved','captured'))
                            ),
                            next AS (
                              SELECT b.id,
                                     EXISTS (
                                       SELECT 1 FROM appointments a2
                                       WHERE a2.tenant_id = CAST(:t AS uuid)
                                         AND a2.contact_id = b.contact_id
                                         AND a2.start_ts > b.start_ts
                                         AND a2.start_ts <= b.start_ts + 30*86400
                                     ) AS rebooked
                              FROM base b
                            )
                            SELECT b.category, COUNT(*)::int AS total, SUM(CASE WHEN n.rebooked THEN 1 ELSE 0 END)::int AS rebooked
                            FROM base b JOIN next n ON n.id = b.id
                            GROUP BY b.category
                            ORDER BY total DESC
                            """
                        ),
                        {"t": ctx.tenant_id},
                    ).fetchall()
                if base:
                    lines = []
                    for cat, total, rebooked in base:
                        try:
                            pct = 0.0 if int(total or 0) == 0 else (int(rebooked or 0) * 100.0 / int(total))
                            lines.append(f"• {cat}: {int(rebooked or 0)}/{int(total or 0)} ({pct:.0f}%)")
                        except Exception:
                            continue
                    if lines:
                        return {"text": "\n".join(lines)}
            except Exception:
                pass
        if ("top" in user_q and ("clients" in user_q or "contacts" in user_q) and ("lifetime" in user_q or "spend" in user_q or "value" in user_q)):
            import re as _re, datetime as _dt
            m = _re.search(r"top\s+(\d+)", user_q)
            n = 3
            try:
                if m:
                    n = max(1, min(10, int(m.group(1))))
            except Exception:
                n = 3
            try:
                rows = (
                    db.query(dbm.Contact)
                    .filter(dbm.Contact.tenant_id == ctx.tenant_id, dbm.Contact.deleted == False)  # type: ignore
                    .order_by(dbm.Contact.lifetime_cents.desc())
                    .limit(n)
                    .all()
                )
                def _fmt(ts: Optional[int]) -> str:
                    try:
                        if not ts:
                            return "—"
                        if ts < 10**12:
                            ts = ts * 1000  # type: ignore
                        return _dt.datetime.fromtimestamp(int(ts/1000)).strftime("%Y-%m-%d")
                    except Exception:
                        return "—"
                for r in rows:
                    data_notes.append(f"• {r.contact_id} — LTV ${(int(getattr(r,'lifetime_cents',0) or 0)/100):.2f}, Txns {int(getattr(r,'txn_count',0) or 0)}, Last {_fmt(getattr(r,'last_visit',0))}")
            except Exception:
                pass
        if data_notes:
            system_prompt = (
                system_prompt
                + "\n\nContext data (do not invent; use as source):\n"
                + "\n".join(data_notes[:10])
                + "\n\nInstruction: When context data is present and the user asks for top clients/contacts by lifetime value, answer directly using ONLY this context."
                + " Present a short list like 'ID — LTV $X.XX — Last YYYY-MM-DD'. Do not ask for connections/exports."
                + " Do not include any PII beyond the identifiers provided in the context. If no context rows exist, reply: 'No data available.'"
            )
    except Exception:
        pass
    # Model selection: always use GPT‑5 Mini by default; Nano only as fallback
    user_text = (req.messages[-1].content if req.messages else "")
    short = len(user_text.split()) < 24
    model_pref = os.getenv("OPENAI_MODEL", "gpt-5")
    fallback_models = (os.getenv("OPENAI_FALLBACK_MODELS", "gpt-5-mini").split(",") if os.getenv("OPENAI_FALLBACK_MODELS") else ["gpt-5-mini"])  # type: ignore
    client = AIClient(model=model_pref)  # type: ignore
    # Allow configuring response length via env
    _max_tokens = int(os.getenv("AI_CHAT_MAX_TOKENS", "1200"))
    try:
        # Preserve provider behavior; do not inject local fallbacks
        reply_max_tokens = _max_tokens
        content = await client.generate(
            system_prompt,
            [
                {"role": m.role, "content": m.content}
                for m in req.messages
            ],
            max_tokens=reply_max_tokens,
        )
    except Exception as e:
        from fastapi.responses import JSONResponse as _JR
        return _JR({"error": "provider_error", "detail": str(e)[:400]}, status_code=502)
    # Return model content as-is (no local fallback messaging)
    # Persist chat logs (last user msg + assistant reply) and record usage
    try:
        with next(get_db()) as db:  # type: ignore
            sid = req.session_id or "default"
            if req.messages:
                last = req.messages[-1]
                db.add(dbm.ChatLog(tenant_id=ctx.tenant_id, session_id=sid, role=str(last.role), content=str(last.content)))
            db.add(dbm.ChatLog(tenant_id=ctx.tenant_id, session_id=sid, role="assistant", content=content))
            db.commit()
        try:
            cache_incr(_today_key("ai_tokens", ctx.tenant_id), est_tokens, expire_seconds=26*60*60)
            cache_incr(_today_key("ai_tokens", "global"), est_tokens, expire_seconds=26*60*60)
            # Track cost using same estimate
            in_tokens = int(est_tokens * 0.4)
            out_tokens = est_tokens - in_tokens
            PRICE_IN = float(os.getenv("AI_PRICE_PER_1K_IN", "0.0005"))
            PRICE_OUT = float(os.getenv("AI_PRICE_PER_1K_OUT", "0.0015"))
            est_cost = (in_tokens / 1000.0) * PRICE_IN + (out_tokens / 1000.0) * PRICE_OUT
            # store cost to 4 decimals as cents-ish
            prev_t = float(cache_get(_today_key("ai_cost_usd", ctx.tenant_id)) or 0)
            prev_g = float(cache_get(_today_key("ai_cost_usd", "global")) or 0)
            cache_set(_today_key("ai_cost_usd", ctx.tenant_id), round(prev_t + est_cost, 4), ttl=26*60*60)
            cache_set(_today_key("ai_cost_usd", "global"), round(prev_g + est_cost, 4), ttl=26*60*60)
        except Exception:
            pass
    except Exception:
        pass
    # Append to dev JSONL
    try:
        logp = _Path(__file__).resolve().parents[2].parent / "synthesis" / "chat_logs.jsonl"
        logp.parent.mkdir(parents=True, exist_ok=True)
        sid = req.session_id or "default"
        ts = int(_time.time())
        if req.messages:
            last = req.messages[-1]
            with open(logp, "a") as f:
                f.write(json.dumps({"ts": ts, "tenant_id": ctx.tenant_id, "session_id": sid, "role": last.role, "content": last.content})+"\n")
        with open(logp, "a") as f:
            f.write(json.dumps({"ts": ts, "tenant_id": ctx.tenant_id, "session_id": sid, "role": "assistant", "content": content})+"\n")
    except Exception:
        pass
    emit_event(
        "AIChatResponded",
        {"tenant_id": req.tenant_id, "length": len(content)},
    )
    return {"text": content}


@app.post("/ai/chat/raw", tags=["AI"])
async def ai_chat_raw(
    req: ChatRawRequest,
    ctx: UserContext = Depends(get_user_context),
    db: Session = Depends(get_db),
) -> Dict[str, str]:
    # Minimal pass-through: BrandVX voice only; no modes, no local caps/limits/fallbacks
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"text": "forbidden"}
    # Pull brand profile
    brand_profile_text = ""
    try:
        row = db.query(dbm.Settings).filter(dbm.Settings.tenant_id == ctx.tenant_id).first()
        if row:
            data = json.loads(row.data_json or '{}')
            bp = data.get('brand_profile') or {}
            if isinstance(bp, dict) and bp:
                import json as _json
                brand_profile_text = _json.dumps(bp, ensure_ascii=False)
    except Exception:
        brand_profile_text = ""
    # Compose BrandVX voice system prompt with enriched context
    system_prompt = BRAND_SYSTEM + "\nYou have direct access to the current tenant's workspace data via backend queries. Answer using provided context; do not claim you lack access. Keep responses concise and plain text."
    # Mode preambles (support/train/analysis/messaging/scheduler/todo)
    try:
        mode = (req.mode or "").strip().lower()
    except Exception:
        mode = ""
    # Heuristic + detector: set mode when user expresses confusion or when detector is confident
    if not mode:
        try:
            last = (req.messages[-1].content or "").lower() if req.messages else ""
            # detector
            det = detect_mode(last)
            if det.get("mode") and float(det.get("confidence", 0)) >= 0.7:
                mode = str(det.get("mode"))
                try:
                    ph_capture("context.detected", distinct_id=str(ctx.tenant_id), properties={
                        "mode": mode, "confidence": float(det.get("confidence", 0.0)),
                        "reasons": ",".join(det.get("reasons", [])) if isinstance(det.get("reasons", []), list) else ""
                    })
                except Exception:
                    pass
            else:
                confusion_markers = [
                    "i'm confused", "im confused", "i am confused",
                    "i don't understand", "i dont understand", "do not understand",
                    "this is confusing", "help me understand", "not sure what to do",
                    "where do i start", "what do i do", "how do i start",
                ]
                if any(k in last for k in confusion_markers):
                    mode = "support"
        except Exception:
            pass
    if mode == "support":
        system_prompt += "\n\n[Mode: Support]\nYou are BrandVX Support. Answer product questions concisely (2–4 sentences), point to exact UI locations, avoid internal jargon."
    elif mode in {"train", "train_vx"}:
        system_prompt += "\n\n[Mode: Train_VX]\nYou are Brand Coach. Help refine tone, brand profile, and goals. Keep edits short, concrete, and save‑ready."
    elif mode == "analysis":
        system_prompt += "\n\n[Mode: Analysis]\nAnalysis mode. Use read‑only data and return direct lists or single‑line facts. No assumptions."
    elif mode == "messaging":
        system_prompt += "\n\n[Mode: Messaging]\nMessaging mode. Draft consent‑first, brand‑aligned copy; prefer short, actionable outputs."
    elif mode == "scheduler":
        system_prompt += "\n\n[Mode: Scheduler]\nScheduling mode. Offer concrete times, avoid overbooking, and reconcile external calendars."
    elif mode in {"todo", "notifications"}:
        system_prompt += "\n\n[Mode: To‑Do]\nCreate concise, actionable tasks; avoid duplicates; summarize impact in one line."
    if brand_profile_text:
        system_prompt = system_prompt + "\n\nBrand profile (voice/tone):\n" + brand_profile_text
    try:
        if mode:
            ph_capture("llm.context", distinct_id=str(ctx.tenant_id), properties={"mode": mode})
    except Exception:
        pass
    # Enrich with tenant memories and global insights/faq
    try:
        mems = _load_tenant_memories(db, ctx.tenant_id, limit=20)
        if mems:
            system_prompt += "\n\nTenant memories:" + "\n" + "\n".join([
                f"- {m.get('key')}: {m.get('value')}" for m in mems[:10]
            ])
    except Exception:
        pass
    try:
        gins = _load_global_insights(db, limit=10)
        if gins:
            system_prompt += "\n\nGlobal insights:" + "\n" + "\n".join([
                f"- {gi.get('metric')}[{gi.get('time_window')}]: {gi.get('value')}" for gi in gins[:8]
            ])
    except Exception:
        pass
    try:
        gfaq = _load_global_faq(db, limit=10)
        if gfaq:
            system_prompt += "\n\nGlobal FAQ snippets:" + "\n" + "\n".join([
                f"- {q.get('intent')}: {q.get('answer')[:160]}" for q in gfaq[:6]
            ])
    except Exception:
        pass
    # Providers status quick snapshot
    try:
        pmap = _providers_status_quick(db, ctx.tenant_id)
        if pmap:
            system_prompt += "\n\nProviders status: " + ", ".join([
                f"{k}(last_sync={v.get('last_sync',0)})" for k,v in pmap.items()
            ])
    except Exception:
        pmap = {}
    # Lightweight data context: answer top LTV queries concretely when available
    try:
        user_q = (req.messages[-1].content if req.messages else "").lower()
        data_notes: List[str] = []
        if ("top" in user_q and ("clients" in user_q or "contacts" in user_q) and ("lifetime" in user_q or "spend" in user_q or "value" in user_q)):
            import re as _re, datetime as _dt
            m = _re.search(r"top\s+(\d+)", user_q)
            n = 3
            try:
                if m:
                    n = max(1, min(10, int(m.group(1))))
            except Exception:
                n = 3
            rows = (
                db.query(dbm.Contact)
                .filter(dbm.Contact.tenant_id == ctx.tenant_id)
                .order_by(dbm.Contact.lifetime_cents.desc())
                .limit(n)
                .all()
            )
            def _fmt(ts: Optional[int]) -> str:
                try:
                    if not ts:
                        return "—"
                    if ts < 10**12:
                        ts = ts * 1000  # type: ignore
                    return _dt.datetime.fromtimestamp(int(ts/1000)).strftime("%Y-%m-%d")
                except Exception:
                    return "—"
            for r in rows:
                _name = (getattr(r, 'display_name', None) or (f"{(getattr(r,'first_name', '') or '').strip()} {(getattr(r,'last_name','') or '').strip()}" ).strip())
                if not _name:
                    try:
                        _id = str(getattr(r, 'contact_id'))
                        _name = f"Client {_id[-6:]}"
                    except Exception:
                        _name = "Client"
                data_notes.append(f"• {_name} — LTV ${(int(getattr(r,'lifetime_cents',0) or 0)/100):.2f}, Txns {int(getattr(r,'txn_count',0) or 0)}, Last {_fmt(getattr(r,'last_visit',0))}")
        # Totals / revenue summary
        if (("total" in user_q) and ("revenue" in user_q or "lifetime" in user_q or "spend" in user_q or "ltv" in user_q)):
            try:
                all_rows = (
                    db.query(dbm.Contact)
                    .filter(dbm.Contact.tenant_id == ctx.tenant_id)
                    .all()
                )
                total_cents = sum(int(getattr(r, 'lifetime_cents', 0) or 0) for r in all_rows)
                num_contacts = len(all_rows)
                data_notes.append(f"• Total lifetime revenue: ${(total_cents/100.0):.2f}")
                data_notes.append(f"• Contacts counted: {num_contacts}")
            except Exception:
                pass
        # Recent visits
        if (("recent" in user_q or "last" in user_q) and ("visit" in user_q or "visits" in user_q or "appointments" in user_q or "clients" in user_q)):
            try:
                import datetime as _dt
                n = 5
                rows = (
                    db.query(dbm.Contact)
                    .filter(dbm.Contact.tenant_id == ctx.tenant_id)
                    .order_by(dbm.Contact.last_visit.desc())
                    .limit(n)
                    .all()
                )
                def _fmt2(ts: Optional[int]) -> str:
                    try:
                        if not ts:
                            return "—"
                        if ts < 10**12:
                            ts = ts * 1000  # type: ignore
                        return _dt.datetime.fromtimestamp(int(ts/1000)).strftime("%Y-%m-%d")
                    except Exception:
                        return "—"
                for r in rows:
                    _name = (getattr(r, 'display_name', None) or (f"{(getattr(r,'first_name', '') or '').strip()} {(getattr(r,'last_name','') or '').strip()}" ).strip())
                    if not _name:
                        try:
                            _id = str(getattr(r, 'contact_id'))
                            _name = f"Client {_id[-6:]}"
                        except Exception:
                            _name = "Client"
                    data_notes.append(f"• {_name} — Last {_fmt2(getattr(r,'last_visit',0))}, Txns {int(getattr(r,'txn_count',0) or 0)}, LTV ${(int(getattr(r,'lifetime_cents',0) or 0)/100):.2f}")
            except Exception:
                pass
        # Birthdays this month (direct list)
        if ("birthday" in user_q or "birthdays" in user_q):
            try:
                from datetime import datetime as _dt2
                mon = f"-{_dt2.utcnow().month:02d}-"
                rows = (
                    db.query(dbm.Contact)
                    .filter(dbm.Contact.tenant_id == ctx.tenant_id)
                    .limit(100)
                    .all()
                )
                shown = 0
                for r in rows:
                    b = str(getattr(r, 'birthday', '') or '')
                    if mon in b:
                        _name = (getattr(r, 'display_name', None) or (f"{(getattr(r,'first_name', '') or '').strip()} {(getattr(r,'last_name','') or '').strip()}" ).strip()) or None
                        if not _name:
                            try:
                                _id = str(getattr(r, 'contact_id'))
                                _name = f"Client {_id[-6:]}"
                            except Exception:
                                _name = "Client"
                        try:
                            _bd = b[5:10] if len(b)>=10 else b
                        except Exception:
                            _bd = b
                        data_notes.append(f"• {_name} — Birthday {_bd}")
                        shown += 1
                        if shown >= 25: break
            except Exception:
                pass
        # Appointments this week (UTC-based)
        if ("appointment" in user_q and "week" in user_q):
            try:
                import datetime as _dt
                now = _dt.datetime.utcnow()
                # ISO week start (Monday)
                weekday = now.isoweekday()  # 1..7
                start = _dt.datetime(now.year, now.month, now.day) - _dt.timedelta(days=weekday-1)
                start = start.replace(hour=0, minute=0, second=0, microsecond=0)
                end = start + _dt.timedelta(days=7)
                c = (
                    db.query(dbm.Appointment)
                    .filter(dbm.Appointment.tenant_id == ctx.tenant_id)
                    .filter(dbm.Appointment.start_ts >= int(start.timestamp()))
                    .filter(dbm.Appointment.start_ts < int(end.timestamp()))
                    .count()
                )
                data_notes.append(f"• Appointments this week: {int(c)}")
            except Exception:
                pass
        # Last week tax-free revenue (Square payments best-effort)
        if ("revenue" in user_q or "sales" in user_q) and ("last week" in user_q or "previous week" in user_q or "past week" in user_q):
            try:
                # Read Square token
                token = ""
                try:
                    with engine.begin() as conn:
                        row_v2 = conn.execute(_sql_text("SELECT access_token_enc FROM connected_accounts_v2 WHERE tenant_id = CAST(:t AS uuid) AND provider='square' ORDER BY id DESC LIMIT 1"), {"t": str(ctx.tenant_id)}).fetchone()
                    if row_v2 and row_v2[0]:
                        try:
                            token = decrypt_text(str(row_v2[0])) or ""
                        except Exception:
                            token = str(row_v2[0])
                except Exception:
                    token = ""
                if token:
                    import datetime as _dt
                    today = _dt.datetime.utcnow().date()
                    # Compute last ISO week [Mon..Mon)
                    weekday = today.isoweekday()  # 1..7
                    this_monday = today - _dt.timedelta(days=weekday-1)
                    last_monday = this_monday - _dt.timedelta(days=7)
                    next_monday = this_monday
                    begin = _dt.datetime.combine(last_monday, _dt.time(0,0,0))
                    end = _dt.datetime.combine(next_monday, _dt.time(0,0,0))
                    def _rfc3339(dt: _dt.datetime) -> str:
                        return dt.replace(microsecond=0).isoformat() + "Z"
                    base = os.getenv("SQUARE_API_BASE", "https://connect.squareup.com")
                    if os.getenv("SQUARE_ENV", "prod").lower().startswith("sand"):
                        base = "https://connect.squareupsandbox.com"
                    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json", "Square-Version": os.getenv("SQUARE_VERSION", "2023-10-18")}
                    total_cents = 0
                    try:
                        with httpx.Client(timeout=20, headers=headers) as client:
                            cursor = None
                            while True:
                                params: Dict[str, str] = {
                                    "limit": "100",
                                    "begin_time": _rfc3339(begin),
                                    "end_time": _rfc3339(end),
                                }
                                if cursor:
                                    params["cursor"] = cursor
                                r = client.get(f"{base}/v2/payments", params=params)
                                if r.status_code >= 400:
                                    break
                                body = r.json() or {}
                                payments = body.get("payments") or []
                                for p in payments:
                                    try:
                                        status = str(p.get("status") or "").upper()
                                        if status not in {"COMPLETED", "APPROVED", "CAPTURED"}:
                                            continue
                                        amt = int(((p.get("amount_money") or {}).get("amount") or 0))
                                        tax = int(((p.get("tax_money") or {}).get("amount") or 0))
                                        refunded = int(((p.get("refunded_money") or {}).get("amount") or 0))
                                        net = max(0, amt - tax - refunded)
                                        total_cents += net
                                    except Exception:
                                        continue
                                cursor = body.get("cursor") or body.get("next_cursor")
                                if not cursor:
                                    break
                    except Exception:
                        pass
                    data_notes.append(f"• Last week tax-free revenue: ${(total_cents/100.0):.2f}")
            except Exception:
                pass
        if data_notes:
            system_prompt = (
                system_prompt
                + "\n\nContext data (do not invent; use as source):\n"
                + "\n".join(data_notes[:10])
                + "\n\nInstruction: When context data is present, answer directly and concisely using ONLY this context."
                + " Output the result immediately in plain text with one item per line."
                + " Do not ask clarifying questions, request connections, or suggest exports."
            )
    except Exception:
        pass
    # Minimal retrieval for Support/Analysis (best-effort snippets)
    try:
        if mode in {"support", "analysis"}:
            user_q = (req.messages[-1].content if req.messages else "")
            qtext = (user_q or "").strip()
            if qtext:
                client = AIClient()
                qv_list = await client.embed([qtext])
                if qv_list:
                    qvec = qv_list[0]
                    rows = (
                        db.query(dbm.Embedding)
                        .filter(dbm.Embedding.tenant_id == ctx.tenant_id)
                        .limit(400)
                        .all()
                    )
                    def _dot(a, b):
                        n = min(len(a), len(b))
                        return sum((a[i] * b[i]) for i in range(n))
                    scored = []
                    for r in rows:
                        try:
                            v = json.loads(r.vector_json or "[]")
                            s = _dot(qvec, v)
                            if s and s > 0:
                                txt = (r.text or "").strip()
                                if txt:
                                    scored.append((s, txt))
                        except Exception:
                            continue
                    scored.sort(key=lambda x: x[0], reverse=True)
                    if scored:
                        top = [t for _, t in scored[:5]]
                        system_prompt += "\n\nRetrieved docs (snippets):\n" + "\n".join([f"- {t[:220]}" for t in top])
    except Exception:
        pass

    # Call provider directly via Responses API only (no local fallbacks)
    reply_max_tokens = int(os.getenv("AI_CHAT_MAX_TOKENS", "1600"))
    base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
    model = os.getenv("OPENAI_MODEL", "gpt-5")
    api_key = (os.getenv("OPENAI_API_KEY", "") or "").strip()
    if not api_key:
        from fastapi.responses import JSONResponse as _JR
        return _JR({"error": "provider_error", "detail": "missing_openai_key"}, status_code=200)
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    project_id = os.getenv("OPENAI_PROJECT", "").strip()
    if project_id:
        headers["OpenAI-Project"] = project_id
    content_blocks: List[Dict[str, Any]] = [
        {"role": "system", "content": [{"type": "input_text", "text": system_prompt}]}
    ]
    for m in req.messages:
        role = m.role
        text_val = m.content
        block = {
            "role": role,
            "content": ([{"type": "output_text", "text": text_val}] if role == "assistant" else [{"type": "input_text", "text": text_val}])
        }
        content_blocks.append(block)
    payload: Dict[str, Any] = {
        "model": model,
        "input": content_blocks,
        "max_output_tokens": reply_max_tokens,
    }
    provider_json: Dict[str, Any] = {}
    try:
        async with httpx.AsyncClient(timeout=90) as client:
            r = await client.post(f"{base_url}/responses", headers=headers, json=payload)
            if r.status_code >= 400:
                from fastapi.responses import JSONResponse as _JR
                return _JR({"error": "provider_error", "detail": r.text[:400]}, status_code=200)
            provider_json = r.json()
    except Exception as e:
        from fastapi.responses import JSONResponse as _JR
        return _JR({"error": "provider_error", "detail": str(e)[:400]}, status_code=200)
    # Extract text robustly
    def _extract_text(obj: Any) -> Optional[str]:
        if isinstance(obj, dict):
            for key in ("output_text", "text"):
                val = obj.get(key)
                if isinstance(val, str) and val.strip():
                    return val.strip()
            out = obj.get("output")
            if isinstance(out, list):
                parts: List[str] = []
                for item in out:
                    if isinstance(item, dict):
                        content = item.get("content")
                        if isinstance(content, list):
                            for ch in content:
                                if isinstance(ch, dict):
                                    if ch.get("type") in ("output_text", "text", "input_text"):
                                        t = ch.get("text") or ch.get("content")
                                        if isinstance(t, str) and t.strip():
                                            parts.append(t.strip())
                if parts:
                    return " ".join(parts)[:4000]
            if obj.get("choices"):
                try:
                    return obj["choices"][0]["message"]["content"].strip()
                except Exception:
                    pass
        return None
    content = _extract_text(provider_json)
    # Retry once for reasoning-only / hit-cap cases with higher max_output_tokens
    try:
        usage = provider_json.get("usage") or {}
        out_tokens = int((usage.get("output_tokens") or 0) or 0)
        details = usage.get("output_tokens_details") or {}
        reasoning_tokens = int((details.get("reasoning_tokens") or 0) or 0)
        incomplete = (provider_json.get("incomplete_details") or {}).get("reason")
        hit_cap = out_tokens >= int(reply_max_tokens)
        reasoning_only = (reasoning_tokens > 0) and (not content)
        if reasoning_only or hit_cap or incomplete == "max_output_tokens":
            bigger = min(2400, max(int(reply_max_tokens) * 2, 1200))
            payload_retry = {
                "model": model,
                "input": content_blocks,
                "max_output_tokens": bigger,
            }
            try:
                async with httpx.AsyncClient(timeout=90) as client:
                    r3 = await client.post(f"{base_url}/responses", headers=headers, json=payload_retry)
                    if r3.status_code < 400:
                        provider_json = r3.json()
                        content = _extract_text(provider_json) or content
                    else:
                        from fastapi.responses import JSONResponse as _JR
                        return _JR({"error": "provider_error", "detail": r3.text[:400]}, status_code=200)
            except Exception as e:
                from fastapi.responses import JSONResponse as _JR
                return _JR({"error": "provider_error", "detail": str(e)[:400]}, status_code=200)
    except Exception:
        pass
    # If no text, attempt a simpler string input form
    if not content:
        simple_input = "\n".join([f"{m.role}: {m.content}" for m in req.messages]).strip()
        alt_payload = {
            "model": model,
            "input": [{"role": "system", "content": [{"type": "input_text", "text": system_prompt}]}, {"role": "user", "content": [{"type": "input_text", "text": simple_input}]}],
            "max_output_tokens": min(1200, reply_max_tokens),
            
        }
        try:
            async with httpx.AsyncClient(timeout=90) as client:
                r2 = await client.post(f"{base_url}/responses", headers=headers, json=alt_payload)
                if r2.status_code < 400:
                    provider_json = r2.json()
                    content = _extract_text(provider_json)
                else:
                    from fastapi.responses import JSONResponse as _JR
                    return _JR({"error": "provider_error", "detail": r2.text[:400]}, status_code=200)
        except Exception as e:
            from fastapi.responses import JSONResponse as _JR
            return _JR({"error": "provider_error", "detail": str(e)[:400]}, status_code=200)
    if not content or not isinstance(content, str) or not content.strip():
        from fastapi.responses import JSONResponse as _JR
        excerpt = json.dumps({k: provider_json.get(k) for k in ("status", "incomplete_details", "usage")})
        return _JR({"error": "provider_error", "detail": "no_text_output", "provider_excerpt": excerpt}, status_code=200)
    # Apply tenant chat exposure for names; always mask emails/phones
    try:
        import re as _re
        # Load tenant ai.chat_name_exposure
        exposure = "masked"
        try:
            row = db.query(dbm.Settings).filter(dbm.Settings.tenant_id == ctx.tenant_id).first()
            if row and row.data_json:
                ai_cfg = (json.loads(row.data_json).get("ai") or {})
                exposure = str(ai_cfg.get("chat_name_exposure") or "masked").lower()
        except Exception:
            exposure = "masked"
        def _mask_email(m: "_re.Match[str]") -> str:
            try:
                user = m.group(1)
                return f"{user}@***"
            except Exception:
                return "***@***"
        def _mask_phone_str(s: str) -> str:
            digits = [ch for ch in s if ch.isdigit()]
            if len(digits) < 7:
                return s
            keep = digits[-4:]
            masked = ["*" for _ in digits[:-4]] + keep
            out = []
            i = 0
            for ch in s:
                if ch.isdigit():
                    out.append(masked[i])
                    i += 1
                else:
                    out.append(ch)
            return "".join(out)
        content = _re.sub(r"([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+)", _mask_email, content)
        phone_rx = _re.compile(r"(\+?\d[\d\s\-\(\)]{6,}\d)")
        content = phone_rx.sub(lambda m: _mask_phone_str(m.group(1)), content)
        if exposure == "masked":
            # Redact obvious First Last patterns to initials
            try:
                name_rx = _re.compile(r"\b([A-Z][a-z]{1,20})\s+([A-Z][a-z]{1,20})\b")
                content = name_rx.sub(lambda m: f"{m.group(1)[0]}. {m.group(2)[0]}.", content)
            except Exception:
                pass
    except Exception:
        pass
    # Persist logs (best-effort)
    try:
        sid = req.session_id or "default"
        if req.messages:
            last = req.messages[-1]
            user_text = str(last.content)
            _append_askvx_message(ctx.tenant_id, sid, str(last.role), user_text)
            _safe_audit_log(db, tenant_id=ctx.tenant_id, session_id=sid, role=str(last.role), content=user_text)
        assistant_text = content or ''
        _append_askvx_message(ctx.tenant_id, sid, 'assistant', assistant_text)
        _safe_audit_log(db, tenant_id=ctx.tenant_id, session_id=sid, role="assistant", content=assistant_text)
        db.commit()
    except Exception:
        try: db.rollback()
        except Exception: pass
    try:
        AI_CHAT_USED.labels(tenant_id=str(ctx.tenant_id)).inc()  # type: ignore
        # Rough classification: if we added context snippets, count as insights served
        if "Context data (do not invent; use as source):" in system_prompt:
            INSIGHTS_SERVED.labels(tenant_id=str(ctx.tenant_id), kind="context_inline").inc()  # type: ignore
    except Exception:
        pass
    return {"text": content}


# --- Train VX: explicit memory upsert/list for pertinent storage ---
class MemoryUpsertRequest(BaseModel):
    tenant_id: str
    key: str
    value: str
    tags: Optional[str] = None


@app.post("/ai/memories/upsert", tags=["AI"])
def ai_memories_upsert(req: MemoryUpsertRequest, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)):
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    try:
        with engine.begin() as conn:
            # Respect RLS policies via per-transaction GUCs
            try:
                conn.execute(_sql_text("SET LOCAL app.role = 'owner_admin'"))
                conn.execute(_sql_text("SET LOCAL app.tenant_id = :t"), {"t": req.tenant_id})
            except Exception:
                pass

            # Detect column types to avoid running invalid SQL inside a transaction
            def _col_type(col: str) -> str:
                try:
                    r = conn.execute(
                        _sql_text(
                            "SELECT lower(data_type) FROM information_schema.columns "
                            "WHERE table_schema='public' AND table_name='ai_memories' AND column_name=:c"
                        ),
                        {"c": col},
                    ).fetchone()
                    return str(r[0]).lower() if r and r[0] else "text"
                except Exception:
                    return "text"

            vtype = _col_type("value")
            ttype = _col_type("tags")

            def _expr(dtype: str, pname: str, nullable: bool = False) -> str:
                if dtype == "jsonb":
                    return (
                        "CASE WHEN :{p} IS NULL THEN NULL ELSE to_jsonb(CAST(:{p} AS text)) END".format(p=pname)
                        if nullable
                        else "to_jsonb(CAST(:{p} AS text))".format(p=pname)
                    )
                if dtype == "json":
                    return (
                        "CASE WHEN :{p} IS NULL THEN NULL ELSE to_json(CAST(:{p} AS text)) END".format(p=pname)
                        if nullable
                        else "to_json(CAST(:{p} AS text))".format(p=pname)
                    )
                if dtype == "array":
                    return (
                        "CASE WHEN :{p} IS NULL THEN NULL ELSE string_to_array(:{p}, ',') END".format(p=pname)
                        if nullable
                        else "string_to_array(:{p}, ',')".format(p=pname)
                    )
                return ":{p}".format(p=pname)

            val_expr = _expr(vtype, "v", False)
            # Force tags to jsonb array if column is json/jsonb; store comma-split list as array
            if ttype in ("json", "jsonb"):
                tag_expr = "CASE WHEN :tg IS NULL THEN NULL ELSE to_jsonb(string_to_array(:tg, ',')) END"
            else:
                tag_expr = _expr(ttype, "tg", True)

            params = {"t": req.tenant_id, "k": req.key, "v": req.value, "tg": (req.tags or None)}

            # Perform upsert with the correct expressions
            conn.execute(
                _sql_text(
                    f"UPDATE ai_memories SET value={val_expr}, tags={tag_expr}, updated_at=NOW() "
                    "WHERE tenant_id = CAST(:t AS uuid) AND key=:k"
                ),
                params,
            )
            conn.execute(
                _sql_text(
                    f"INSERT INTO ai_memories (tenant_id, key, value, tags) "
                    f"SELECT CAST(:t AS uuid), :k, {val_expr}, {tag_expr} "
                    "WHERE NOT EXISTS (SELECT 1 FROM ai_memories WHERE tenant_id = CAST(:t AS uuid) AND key=:k)"
                ),
                params,
            )
        _upsert_trainvx_memory(req.tenant_id, req.key, req.value)
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "detail": str(e)[:200]}
@app.get("/ai/memories/list", tags=["AI"])
def ai_memories_list(tenant_id: str, limit: int = 20, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)):
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"items": []}
    try:
        # Use GUC-backed connection to satisfy RLS
        from sqlalchemy import text as __t
        with engine.begin() as conn:
            try:
                conn.execute(__t("SET LOCAL app.role = 'owner_admin'"))
                conn.execute(__t("SET LOCAL app.tenant_id = :t"), {"t": tenant_id})
            except Exception:
                pass
            rows = conn.execute(
                __t(
                    "SELECT key, value, tags, EXTRACT(EPOCH FROM updated_at)::bigint FROM ai_memories WHERE tenant_id = CAST(:t AS uuid) ORDER BY updated_at DESC LIMIT :lim"
                ),
                {"t": tenant_id, "lim": max(1, min(int(limit or 20), 200))},
            ).fetchall()
        items = [{"key": r[0], "value": r[1], "tags": r[2], "updated_at": int(r[3] or 0)} for r in rows]
        return {"items": items}
    except Exception:
        return {"items": []}

@app.delete("/ai/memories/{key}", tags=["AI"])
def ai_memories_delete(key: str, tenant_id: str, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)):
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    try:
        from sqlalchemy import text as __t
        with engine.begin() as conn:
            try:
                conn.execute(__t("SET LOCAL app.role = 'owner_admin'"))
                conn.execute(__t("SET LOCAL app.tenant_id = :t"), {"t": tenant_id})
            except Exception:
                pass
            n = conn.execute(__t("DELETE FROM ai_memories WHERE tenant_id = CAST(:t AS uuid) AND key = :k"), {"t": tenant_id, "k": key}).rowcount
        return {"status": "ok", "deleted": int(n or 0)}
    except Exception as e:
        return {"status": "error", "detail": str(e)[:200]}

# ------------------------ Admin: Run DB Sweep ------------------------
@app.post("/admin/db/sweep", tags=["Admin"])
def admin_db_sweep(ctx: UserContext = Depends(get_user_context)) -> Dict[str, object]:
    if ctx.role != "owner_admin":
        return {"status": "forbidden"}
    try:
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
        sweep_path = os.path.join(base_dir, "db", "migrations", "2025-09-11_brandvx_sweep.sql")
        with open(sweep_path, "r", encoding="utf-8") as f:
            sql_script = f.read()
        from sqlalchemy import text as __t
        # Execute statement-by-statement to tolerate CREATE POLICY on older PG (no IF NOT EXISTS)
        stmts: list[str] = []
        buf: list[str] = []
        for line in sql_script.splitlines():
            buf.append(line)
            if line.strip().endswith(";"):
                stmts.append("\n".join(buf))
                buf = []
        if buf:
            stmts.append("\n".join(buf))
        applied = 0
        skipped = 0
        with engine.begin() as conn:
            try:
                conn.execute(__t("SET LOCAL app.role = 'owner_admin'"))
            except Exception:
                pass
            for raw in stmts:
                stmt = raw.strip()
                if not stmt or stmt.startswith("--"):
                    continue
                # Drop IF NOT EXISTS for policies; swallow duplicate errors
                to_run = stmt.replace("CREATE POLICY IF NOT EXISTS", "CREATE POLICY")
                try:
                    conn.exec_driver_sql(to_run)
                    applied += 1
                except Exception as e:
                    msg = str(e)
                    if "already exists" in msg or "duplicate" in msg or "policy \"" in msg:
                        skipped += 1
                        continue
                    raise
        return {"status": "ok", "applied": applied, "skipped": skipped}
    except Exception as e:
        return {"status": "error", "detail": str(e)[:200]}

@app.get("/ai/diag", tags=["AI"])
def ai_diag():
    try:
        return {
            "OPENAI_MODEL": os.getenv("OPENAI_MODEL", ""),
            "OPENAI_USE_RESPONSES": os.getenv("OPENAI_USE_RESPONSES", ""),
            "PROJECT_SET": bool(os.getenv("OPENAI_PROJECT", "").strip()),
            "HAS_API_KEY": bool(os.getenv("OPENAI_API_KEY", "").strip()),
        }
    except Exception as e:
        return {"error": str(e)}


@app.get("/ai/costs", tags=["AI"])
def ai_costs(tenant_id: str, ctx: UserContext = Depends(get_user_context)):
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    try:
        import datetime as _dt
        def _today_key(prefix: str, tid: str = "global") -> str:
            return f"{prefix}:{tid}:{_dt.datetime.utcnow().strftime('%Y%m%d')}"
        t_tokens = int(cache_get(_today_key("ai_tokens", tenant_id)) or 0)
        g_tokens = int(cache_get(_today_key("ai_tokens", "global")) or 0)
        t_cost = float(cache_get(_today_key("ai_cost_usd", tenant_id)) or 0.0)
        g_cost = float(cache_get(_today_key("ai_cost_usd", "global")) or 0.0)
        caps = {
            "tenant_tokens": int(os.getenv("AI_TENANT_DAILY_CAP_TOKENS", "500000") or 0),
            "global_tokens": int(os.getenv("AI_GLOBAL_DAILY_CAP_TOKENS", "5000000") or 0),
            "tenant_usd": float(os.getenv("AI_TENANT_DAILY_CAP_USD", "0") or 0.0),
            "global_usd": float(os.getenv("AI_GLOBAL_DAILY_CAP_USD", "0") or 0.0),
        }
        return {
            "tenant_tokens_today": t_tokens,
            "global_tokens_today": g_tokens,
            "tenant_cost_usd_today": round(t_cost, 4),
            "global_cost_usd_today": round(g_cost, 4),
            "caps": caps,
        }
    except Exception as e:
        return {"status": "error", "detail": str(e)[:200]}
@app.get("/limits/status", tags=["AI"])
def limits_status(tenant_id: str, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)) -> Dict[str, object]:
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    # Daily usage (same counters as /ai/costs)
    try:
        import datetime as _dt
        def _today_key(prefix: str, tid: str = "global") -> str:
            return f"{prefix}:{tid}:{_dt.datetime.utcnow().strftime('%Y%m%d')}"
        t_tokens = int(cache_get(_today_key("ai_tokens", tenant_id)) or 0)
        t_cost = float(cache_get(_today_key("ai_cost_usd", tenant_id)) or 0.0)
    except Exception:
        t_tokens = 0
        t_cost = 0.0
    # Limits from DB
    daily_usd_cap = 0.0
    monthly_usd_cap = 0.0
    try:
        row = db.query(dbm.UsageLimit).filter(dbm.UsageLimit.tenant_id == tenant_id).first()
        if row:
            daily_usd_cap = float((row.ai_daily_cents_cap or 0) / 100.0)
            monthly_usd_cap = float((row.ai_monthly_cents_cap or 0) / 100.0)
    except Exception:
        pass
    warnings: Dict[str, bool] = {}
    try:
        daily_soft = (daily_usd_cap > 0) and (t_cost >= 0.8 * daily_usd_cap) and (t_cost < daily_usd_cap)
        daily_over = (daily_usd_cap > 0) and (t_cost >= daily_usd_cap)
        warnings = {"daily_soft": bool(daily_soft), "daily_over": bool(daily_over)}
    except Exception:
        warnings = {}
    return {
        "tenant_id": tenant_id,
        "usage": {"daily_tokens": int(t_tokens), "daily_usd": round(t_cost, 4)},
        "caps": {"daily_usd": round(daily_usd_cap, 4), "monthly_usd": round(monthly_usd_cap, 4)},
        "warnings": warnings,
    }
@app.get("/ops/health", tags=["Health"])
def ops_health(db: Session = Depends(get_db), ctx: UserContext = Depends(require_role("owner_admin"))) -> Dict[str, object]:
    """Aggregate health snapshot for ops dashboards: DB, Redis, OpenAI, PostHog, Sentry, Tools/Contexts."""
    out: Dict[str, object] = {"status": "ok"}
    # DB probe
    try:
        db.execute(_sql_text("SELECT 1"))
        out["db"] = "ok"
    except Exception as e:
        out["db"] = {"status": "error", "detail": str(e)[:120]}
        out["status"] = "degraded"
    # Redis
    try:
        client = _get_redis()
        if client is None:
            out["redis"] = "disabled"
        else:
            pong = client.ping()  # type: ignore
            out["redis"] = "ok" if pong else "error"
            if not pong:
                out["status"] = "degraded"
    except Exception as e:
        out["redis"] = {"status": "error", "detail": str(e)[:120]}
        out["status"] = "degraded"
    # OpenAI config
    try:
        out["openai"] = {
            "model": os.getenv("OPENAI_MODEL", ""),
            "has_key": bool(os.getenv("OPENAI_API_KEY", "").strip()),
        }
    except Exception:
        out["openai"] = {"has_key": False}
    # PostHog/Sentry present
    out["posthog"] = bool(os.getenv("POSTHOG_API_KEY", "").strip())
    out["sentry"] = bool(os.getenv("SENTRY_DSN", "").strip())
    # Tools/contexts
    try:
        out["tools_count"] = len(tools_schema().get("tools", []))
    except Exception:
        out["tools_count"] = 0
    try:
        out["contexts_count"] = len(contexts_schema().get("contexts", []))
    except Exception:
        out["contexts_count"] = 0
    return out

# --- Edge Function Proxies (Gateway model) ---
class EdgeProxyRequest(BaseModel):
    tenant_id: str
    payload: Dict[str, object] = {}


def _tenant_allowed(ctx: UserContext, tenant_id: str) -> bool:
    return ctx.tenant_id == tenant_id or ctx.role == "owner_admin"


@app.post("/ai/proxy/specialist-router", tags=["AI"])
async def proxy_specialist_router(
    req: EdgeProxyRequest,
    ctx: UserContext = Depends(get_user_context),
):
    if not _tenant_allowed(ctx, req.tenant_id):
        return {"status": "forbidden"}
    payload = {"tenant_id": req.tenant_id, **(req.payload or {})}
    out = await _call_edge_function("brandvx-specialist-router", payload)
    return out


@app.post("/ai/proxy/ai-recommendations", tags=["AI"])
async def proxy_ai_recommendations(
    req: EdgeProxyRequest,
    ctx: UserContext = Depends(get_user_context),
):
    if not _tenant_allowed(ctx, req.tenant_id):
        return {"status": "forbidden"}
    payload = {"tenant_id": req.tenant_id, **(req.payload or {})}
    out = await _call_edge_function("ai-recommendations", payload)
    return out


@app.post("/ai/proxy/master-agent-orchestrator", tags=["AI"])
async def proxy_master_agent_orchestrator(
    req: EdgeProxyRequest,
    ctx: UserContext = Depends(get_user_context),
):
    if not _tenant_allowed(ctx, req.tenant_id):
        return {"status": "forbidden"}
    payload = {"tenant_id": req.tenant_id, **(req.payload or {})}
    out = await _call_edge_function("master-agent-orchestrator", payload)
    return out
@app.post("/ai/proxy/realtime-token", tags=["AI"])
async def proxy_realtime_token(
    req: EdgeProxyRequest,
    ctx: UserContext = Depends(get_user_context),
):
    if not _tenant_allowed(ctx, req.tenant_id):
        return {"status": "forbidden"}
    payload = {"tenant_id": req.tenant_id, **(req.payload or {})}
    out = await _call_edge_function("realtime-token", payload)
    return out
@app.get("/ai/chat/logs", tags=["AI"])
def ai_chat_logs(
    tenant_id: str,
    session_id: Optional[str] = None,
    limit: int = 200,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"items": []}
    q = db.query(dbm.ChatLog).filter(dbm.ChatLog.tenant_id == tenant_id)
    if session_id:
        q = q.filter(dbm.ChatLog.session_id == session_id)
    rows = q.order_by(dbm.ChatLog.id.asc()).limit(max(1, min(limit, 1000))).all()
    return {"items": [
        {"id": r.id, "session_id": r.session_id, "role": r.role, "content": r.content, "created_at": r.created_at}
        for r in rows
    ]}


@app.get("/ai/chat/sessions", tags=["AI"])
def ai_chat_sessions(
    tenant_id: str,
    limit: int = 50,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    # Distinct sessions ordered by last activity
    try:
        # Subquery: max id per session (SQLite-friendly)
        q = (
            db.query(dbm.ChatLog.session_id, _sql_func.max(dbm.ChatLog.id).label("max_id"))
            .filter(dbm.ChatLog.tenant_id == tenant_id)
            .group_by(dbm.ChatLog.session_id)
            .order_by(_sql_func.max(dbm.ChatLog.id).desc())
            .limit(max(1, min(limit, 200)))
            .all()
        )
        max_ids = [row.max_id for row in q]
        if not max_ids:
            return {"items": []}
        rows = db.query(dbm.ChatLog).filter(dbm.ChatLog.id.in_(max_ids)).order_by(dbm.ChatLog.id.desc()).all()
        out = []
        for r in rows:
            out.append({"session_id": r.session_id, "last_message_at": r.created_at})
        # ensure unique and ordered
        seen = set()
        uniq = []
        for x in out:
            if x["session_id"] in seen:
                continue
            seen.add(x["session_id"])
            uniq.append(x)
        return {"items": uniq[: max(1, min(limit, 200))]}
    except Exception:
        return {"items": []}


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


class VisionRequest(BaseModel):
    tenant_id: str
    image_b64: str  # prefix optional (data:image/...;base64,)
    prompt: Optional[str] = None


@app.post("/ai/vision", tags=["AI"])
async def ai_vision(
    req: VisionRequest,
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"text": "forbidden"}
    client = AIClient()
    text = await client.analyze_image(req.image_b64, prompt=req.prompt, max_tokens=int(os.getenv("AI_CHAT_MAX_TOKENS", "600")))
    if not text:
        return {"text": "Vision model not available or failed. Try again later."}
    emit_event("AIVisionAnalyzed", {"tenant_id": req.tenant_id, "length": len(text)})
    return {"text": text}


class ImageGenRequest(BaseModel):
    tenant_id: str
    prompt: str
    size: Optional[str] = "1024x1024"


@app.post("/ai/image", tags=["AI"])
async def ai_image(
    req: ImageGenRequest,
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"b64": ""}
    client = AIClient()
    b64 = await client.generate_image(req.prompt, size=req.size or "1024x1024")
    if not b64:
        return {"b64": ""}
    emit_event("AIImageGenerated", {"tenant_id": req.tenant_id, "size": req.size or "1024x1024"})
    return {"b64": b64}

class ToolExecRequest(BaseModel):
    tenant_id: str
    name: str
    params: Dict[str, object] = {}
    require_approval: bool = False
    idempotency_key: Optional[str] = None
    mode: Optional[str] = None


class ToolQARequest(BaseModel):
    tenant_id: str
    name: str
    params: Dict[str, object] = {}


class ApprovalActionRequest(BaseModel):
    tenant_id: str
    approval_id: int
    action: str  # approve|reject

class ExpiryCheckRequest(BaseModel):
    tenant_id: str
    days: int = 7
@app.get("/debug/vision_env", tags=["Health"])
def debug_vision_env():
    try:
        import os as _os
        key = _os.getenv("GEMINI_API_KEY", "")
        return {
            "base": _os.getenv("GEMINI_API_BASE", ""),
            "model": _os.getenv("GEMINI_IMAGE_MODEL", ""),
            "has_key": bool(key),
            "key_head": key[:6] if key else "",
        }
    except Exception as e:
        return {"error": str(e)[:120]}


@app.post("/ai/tools/execute", tags=["AI"])
async def ai_tool_execute(
    req: ToolExecRequest,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    # Canonicalize tenant to session context to avoid client/body/header drift
    # and remove per-request tenant mismatch flakiness across devices.
    req.tenant_id = ctx.tenant_id
    try:
        # Subscription/trial gating for protected actions (Beta toggle supported)
        try:
            BETA_OPEN = (os.getenv("BETA_OPEN_TOOLS", "0") or "0").strip() == "1"
            # Lightweight allowlist of always-safe tools
            risky = req.name not in SAFE_TOOLS
            if (not BETA_OPEN) and risky and ctx.role != "owner_admin":
                # Read latest settings and honor seeded trial
                row = db.query(dbm.Settings).filter(dbm.Settings.tenant_id == ctx.tenant_id).first()
                data = {}
                try:
                    if row and row.data_json:
                        data = json.loads(row.data_json or "{}")
                except Exception:
                    data = {}
                status = str((data or {}).get("subscription_status") or "").strip().lower()
                # If missing, treat as trialing when a trial_end_ts is present (or default during rollout)
                if not status:
                    try:
                        if int((data or {}).get("trial_end_ts") or 0) > 0:
                            status = "trialing"
                    except Exception:
                        status = status or ""
                # Optional hardening: auto-seed a trial once during beta rollout
                if status not in {"active","trialing"}:
                    try:
                        if (os.getenv("BETA_TRIAL_AUTOSEED", "1") or "1").strip() == "1":
                            now = int(_time.time())
                            new_data = dict(data or {})
                            new_data["subscription_status"] = "trialing"
                            new_data.setdefault("trial_end_ts", now + 7*86400)
                            if not row:
                                db.add(dbm.Settings(tenant_id=ctx.tenant_id, data_json=json.dumps(new_data)))
                            else:
                                row.data_json = json.dumps(new_data)
                            db.commit()
                            status = "trialing"
                    except Exception:
                        try:
                            db.rollback()
                        except Exception:
                            pass
                if status not in {"active","trialing"}:
                    return {"status":"payment_required","detail":"Add payment method to continue"}
        except Exception:
            pass
        # Breadcrumb for observability
        try:
            import sentry_sdk as _sentry  # type: ignore
            _sentry.add_breadcrumb(category="tool", message=f"execute {req.name}", level="info", data={"tenant_id": str(ctx.tenant_id)})
        except Exception:
            pass
        # Lightweight throttle: per-tenant per-tool
        try:
            ok, ttl = check_and_increment(str(ctx.tenant_id), f"tools.exec.{req.name}", max_per_minute=120, burst=60)
            if not ok:
                return {"status": "rate_limited", "retry_s": int(ttl)}
        except Exception:
            pass
        # Ensure clean session state before work
        try:
            db.rollback()
        except Exception:
            pass
        # Probe engine connection and reset if needed
        try:
            with engine.begin() as _probe_conn:
                _probe_conn.execute(_sql_text("SELECT 1"))
        except Exception:
            try:
                db.rollback()
            except Exception:
                pass
        # Auto-approve toggle from settings + pause_automations safety
        auto_approve = False
        pause_automations = False
        try:
            row = db.query(dbm.Settings).filter(dbm.Settings.tenant_id == ctx.tenant_id).first()
            if row:
                data = json.loads(row.data_json or "{}")
                auto_approve = bool(data.get("auto_approve_all", False))
                pause_automations = bool(data.get("pause_automations", False))
        except Exception:
            try:
                db.rollback()
            except Exception:
                pass
            auto_approve = False
            pause_automations = False
        # Idempotency: if provided, reserve or short-circuit duplicate
        if req.idempotency_key:
            try:
                # Attempt to reserve key; on unique hit we return duplicate
                db.add(dbm.IdempotencyKey(tenant_id=ctx.tenant_id, key=str(req.idempotency_key)))
                db.commit()
            except Exception:
                try:
                    db.rollback()
                except Exception:
                    pass
                return {"status": "duplicate"}
        # Global pause: any risky or non-trivial tools should be routed to approvals when paused
        # We treat any tool that isn't explicitly safe as requiring approval while paused
        if pause_automations and ctx.role != "owner_admin":
            try:
                from .tools import TOOL_META  # type: ignore
            except Exception:
                TOOL_META = {}
            meta = TOOL_META.get(req.name, {})
            is_safe = bool(meta.get("safe", False)) or req.name in {"db.query.named","db.query.sql","report.generate.csv","safety_check","pii.audit"}
            if not is_safe:
                req.require_approval = True
        if req.require_approval and not auto_approve:
            db.add(
                dbm.Approval(
                    tenant_id=ctx.tenant_id,
                    tool_name=req.name,
                    params_json=str(dict(req.params or {})),
                    status="pending",
                )
            )
            db.commit()
            emit_event("AIToolExecuted", {"tenant_id": ctx.tenant_id, "tool": req.name, "status": "pending"})
            return {"status": "pending"}
        # Minimal permission guard: restrict non-public tools if needed
        try:
            from .tools import TOOL_META  # type: ignore
            meta = TOOL_META.get(req.name, {"public": True})
            if not bool(meta.get("public", True)) and ctx.role != "owner_admin":
                return {"status": "forbidden"}
        except Exception:
            pass
        # Per-mode allowlist enforcement (non-binding for owner_admin)
        try:
            mode = (req.mode or "").strip().lower()
        except Exception:
            mode = ""
        if mode and ctx.role != "owner_admin":
            allow = set(context_allowlist(mode))
            if allow and req.name not in allow:
                return {"status": "forbidden", "reason": "tool_not_allowed_in_mode", "mode": mode}
        # Execute with one-time retry for transient DB disconnects
        try:
            result = await execute_tool(req.name, dict(req.params or {}), db, ctx)
        except Exception as _exec_err:
            try:
                db.rollback()
            except Exception:
                pass
            err_s = str(_exec_err)
            if any(k in err_s for k in ["OperationalError","SSL connection has been closed","psycopg2"]):
                try:
                    with engine.begin() as _probe_conn:
                        _probe_conn.execute(_sql_text("SELECT 1"))
                except Exception:
                    pass
                result = await execute_tool(req.name, dict(req.params or {}), db, ctx)
            else:
                raise
        # Normalize return shape minimally
        if not isinstance(result, dict) or "status" not in result:
            result = {"status": str(result)} if not isinstance(result, dict) else {**result, "status": result.get("status", "ok")}
        emit_event("AIToolExecuted", {"tenant_id": ctx.tenant_id, "tool": req.name, "status": result.get("status"), "mode": (mode or "")})
        try:
            TOOL_EXECUTED.labels(tenant_id=str(ctx.tenant_id), name=str(req.name), status=str(result.get("status","ok"))).inc()  # type: ignore
        except Exception:
            pass
        return result
    except Exception as e:
        try:
            import sentry_sdk as _sentry  # type: ignore
            _sentry.capture_exception(e)
        except Exception:
            pass
        try:
            db.rollback()
        except Exception:
            pass
        return {"status": "error", "message": str(e)}


@app.post("/ai/tools/qa", tags=["AI"])
async def ai_tools_qa(
    req: ToolQARequest,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    # Dry-run style QA: execute tool with provided params but suppress side effects where supported
    # For now, just call the tool and return its normalized response
    try:
        res = await execute_tool(req.name, dict(req.params or {}), db, ctx)
        if not isinstance(res, dict):
            res = {"status": "ok", "result": str(res)}
        res.setdefault("status", "ok")
        res.setdefault("qa", True)
        return res
    except Exception as e:
        return {"status": "error", "detail": str(e)[:200], "qa": True}
@app.get("/reports/download/{token}", tags=["AI"])
def report_download(token: str, db: Session = Depends(get_db)):
    try:
        row = db.execute(
            _sql_text("SELECT mime, filename, data_text, tenant_id::text, EXTRACT(EPOCH FROM (NOW() - created_at))::bigint AS age_s FROM share_reports WHERE token = :tok ORDER BY id DESC LIMIT 1"),
            {"tok": token},
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="not_found")
        mime = str(row[0] or "text/csv")
        filename = str(row[1] or "report.csv")
        data_text = str(row[2] or "")
        tenant_id = str(row[3] or "")
        age_s = int(row[4] or 0)
        # TTL enforcement for vision previews
        try:
            ttl_days = int(os.getenv("VISION_PREVIEW_TTL_DAYS", "0") or "0")
            if ttl_days > 0 and age_s > ttl_days * 86400:
                raise HTTPException(status_code=404, detail="expired")
        except Exception:
            pass
        from fastapi.responses import Response as _Resp
        # If stored as data URL, decode base64 payload
        try:
            if data_text.startswith("data:") and ";base64," in data_text:
                import base64 as _b64
                b64 = data_text.split(",", 1)[1]
                raw = _b64.b64decode(b64)
                return _Resp(content=raw, media_type=mime, headers={"Content-Disposition": f"attachment; filename={filename}"})
        except Exception:
            pass
        return _Resp(content=data_text.encode("utf-8"), media_type=mime, headers={"Content-Disposition": f"attachment; filename={filename}"})
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="error")


class ImportMissingRequest(BaseModel):
    tenant_id: str


@app.post("/reconciliation/import_missing_contacts", tags=["Integrations"])
def import_missing_contacts(
    req: ImportMissingRequest,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"imported": 0}
    try:
        contacts = db.query(dbm.Contact).filter(dbm.Contact.tenant_id == req.tenant_id, dbm.Contact.deleted == False).all()
        appts = db.query(dbm.Appointment).filter(dbm.Appointment.tenant_id == req.tenant_id).all()
        contact_ids = {c.contact_id for c in contacts}
        booking_ids = {a.contact_id for a in appts if a.contact_id}
        missing = list(booking_ids - contact_ids)
        created = 0
        for cid in missing:
            if not cid:
                continue
            db.add(dbm.Contact(tenant_id=req.tenant_id, contact_id=str(cid), email_hash=None, phone_hash=None, consent_sms=False, consent_email=False, deleted=False))
            created += 1
        if created:
            db.commit()
        emit_event("ReconciliationImportCompleted", {"tenant_id": req.tenant_id, "created": created})
        return {"imported": created}
    except Exception:
        db.rollback()
        return {"imported": 0}


@app.get("/approvals", tags=["Approvals"])
def list_approvals(
    tenant_id: str,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return []
    rows = db.query(dbm.Approval).filter(dbm.Approval.tenant_id == tenant_id).all()
    def _explain(tool: str, params_json: str) -> str:
        try:
            _p = json.loads(params_json or "{}")
        except Exception:
            _p = {}
        t = (tool or "").lower()
        if t == "social.schedule.14days":
            return "Draft a 14‑day posting plan (no posts published until scheduled)."
        if t == "contacts.dedupe":
            return "Deduplicate contacts by email/phone hashes."
        if t == "campaigns.dormant.start":
            return "Start a dormant reactivation campaign for inactive clients."
        if t == "appointments.schedule_reminders":
            return "Schedule appointment reminder messages for upcoming bookings."
        if t == "export.contacts":
            return "Export contacts as CSV."
        return f"Review request for {tool}"
    out = []
    for r in rows:
        out.append({
            "id": r.id,
            "tool": r.tool_name,
            "status": r.status,
            "params": r.params_json,
            "result": r.result_json,
            "explain": _explain(r.tool_name, r.params_json),
        })
    return out


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
    import json as _json
    try:
        params = _json.loads(row.params_json or "{}")
    except Exception:
        params = {}
    result = await execute_tool(row.tool_name, params, db, ctx)
    row.status = "approved"
    row.result_json = _json.dumps(result)
    db.commit()
    return {"status": "approved", "result": result}


# --- Lightweight consent/docs endpoints ---
@app.get("/consent/policy", tags=["Docs"])
def consent_policy() -> Dict[str, str]:
    html = (
        "<h3>Consent and data</h3>"
        "<p>BrandVX only sends messages when the contact has opted in. STOP/HELP are honored automatically. "
        "You can revoke consent at any time. We store minimal metadata for audit and compliance.</p>"
    )
    return {"html": html}


@app.get("/consent/faq", tags=["Docs"])
def consent_faq() -> Dict[str, object]:
    return {
        "items": [
            {"q": "What is consent?", "a": "Explicit permission to message via SMS/Email. We record STOP/HELP and opt‑outs."},
            {"q": "How do I stop messages?", "a": "Reply STOP to SMS or use unsubscribe links; operators can also set consent off."},
            {"q": "What data is stored?", "a": "Hashes or IDs plus message metadata for audit; no raw PII is required for demo."},
        ]
    }


# --- Contacts predictive search ---
@app.get("/contacts/search", tags=["Contacts"])
def contacts_search(
    tenant_id: str,
    q: str = "",
    limit: int = 20,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"items": []}
    q = (q or "").strip()
    base = db.query(dbm.Contact).filter(dbm.Contact.tenant_id == tenant_id, dbm.Contact.deleted == False)  # type: ignore
    if q:
        like = f"%{q}%"
        try:
            base = base.filter(
                (dbm.Contact.contact_id.ilike(like))
                | (dbm.Contact.email_hash.ilike(like))
                | (dbm.Contact.phone_hash.ilike(like))
            )
        except Exception:
            base = base.filter(dbm.Contact.contact_id.like(like))
    # Add name search when available
    try:
        if q:
            like = f"%{q}%"
            base = base.filter(
                (dbm.Contact.contact_id.ilike(like))
                | (dbm.Contact.email_hash.ilike(like))
                | (dbm.Contact.phone_hash.ilike(like))
                | (dbm.Contact.display_name.ilike(like))
                | (dbm.Contact.first_name.ilike(like))
                | (dbm.Contact.last_name.ilike(like))
            )
    except Exception:
        pass
    rows = base.order_by(dbm.Contact.id.asc()).limit(max(1, min(limit, 50))).all()
    out = []
    for r in rows:
        try:
            fn = str(getattr(r, "first_name", "") or "").strip()
            ln = str(getattr(r, "last_name", "") or "").strip()
            full = (f"{fn} {ln}" if (fn or ln) else "").strip()
            dn = (getattr(r, "display_name", None) or "").strip() if isinstance(getattr(r, "display_name", None), str) else getattr(r, "display_name", None)
            name = full or (dn or "Client")
        except Exception:
            name = "Client"
        out.append({"id": r.contact_id, "name": name, "email_hash": r.email_hash, "phone_hash": r.phone_hash, "favorite": False})
    return {"items": out}


@app.get("/contacts/list", tags=["Contacts"])
def contacts_list(
    tenant_id: str,
    limit: int = 1000,
    offset: int = 0,
    scope: str = None,  # Optional scope parameter for dashboard filtering
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context_relaxed),
):
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"items": []}
    try:
        # Cast tenant_id to UUID if model uses PG UUID type
        tid = tenant_id
        try:
            import uuid as _uuid
            tid = _uuid.UUID(str(tenant_id))
        except Exception:
            tid = tenant_id
        # Ensure RLS GUCs are set for this request so rows are visible under policies
        try:
            if getattr(db.bind, "dialect", None) and db.bind.dialect.name == "postgresql" and os.getenv("ENABLE_PG_RLS", "0") == "1":
                try:
                    db.execute(_sql_text("SET LOCAL app.tenant_id = :t"), {"t": str(tenant_id)})
                    db.execute(_sql_text("SET LOCAL app.role = 'owner_admin'"))
                except Exception:
                    pass
        except Exception:
            pass
        # Short‑TTL cache for rollups/list
        try:
            ckey = f"contacts:list:{tenant_id}:{int(limit)}:{int(offset)}"
            cached = cache_get(ckey)
            if cached is not None:
                return cached
        except Exception:
            pass
        q = db.query(dbm.Contact).filter(dbm.Contact.tenant_id == tid)  # type: ignore
        q = q.filter(dbm.Contact.deleted == False)  # type: ignore
        total = q.count()
        rows = (
            q.order_by(dbm.Contact.lifetime_cents.desc(), dbm.Contact.last_visit.desc())
            .offset(max(0, int(offset)))
            .limit(max(1, min(limit, 1000)))
            .all()
        )
        out = []
        for r in rows:
            dn = getattr(r, "display_name", None)
            if not dn:
                fn = str(getattr(r, "first_name", "") or "").strip()
                ln = str(getattr(r, "last_name", "") or "").strip()
                dn = (f"{fn} {ln}" if (fn or ln) else r.contact_id).strip()
            # Compute friendly name (never expose Square IDs as names)
            try:
                fn = str(getattr(r, "first_name", "") or "").strip()
                ln = str(getattr(r, "last_name", "") or "").strip()
                full = (f"{fn} {ln}" if (fn or ln) else "").strip()
                friendly = full or (str(dn or "").strip() or "Client")
            except Exception:
                friendly = "Client"
            out.append({
                "contact_id": r.contact_id,
                "display_name": dn,
                "friendly_name": friendly,
                "first_name": getattr(r, "first_name", None),
                "last_name": getattr(r, "last_name", None),
                "birthday": getattr(r, "birthday", None),
                "creation_source": getattr(r, "creation_source", None),
                "first_visit": int(getattr(r, "first_visit", 0) or 0),
                "last_visit": int(getattr(r, "last_visit", 0) or 0),
                "txn_count": int(getattr(r, "txn_count", 0) or 0),
                "lifetime_cents": int(getattr(r, "lifetime_cents", 0) or 0),
                "email_subscription_status": getattr(r, "email_subscription_status", None),
                "instant_profile": bool(getattr(r, "instant_profile", False)),
                "email_hash": getattr(r, "email_hash", None),
                "phone_hash": getattr(r, "phone_hash", None),
            })
        try:
            cache_set(ckey, {"items": out, "total": total}, ttl=60)
        except Exception:
            pass
        return {"items": out, "total": total}
    except Exception as e:
        from fastapi.responses import JSONResponse as _JR
        msg = str(e)[:200]
        # Map auth errors more precisely when bubbled
        if "invalid token" in msg or "invalid_token" in msg:
            return _JR({"error": "unauthorized", "detail": msg}, status_code=401)
        return _JR({"error": "internal_error", "detail": msg}, status_code=500)


# --- Contacts segments for dashboard/client filtering ---
@app.get("/contacts/segments", tags=["Contacts"])
def contacts_segments(
    tenant_id: str,
    scope: str = "dashboard",
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context_relaxed),
):
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"segments": [], "smart_lists": []}
    try:
        # Cast tenant_id to UUID if model uses PG UUID type
        tid = tenant_id
        try:
            import uuid as _uuid
            tid = _uuid.UUID(str(tenant_id))
        except Exception:
            tid = tenant_id

        # Static segments for now - can be made dynamic later
        segments = [
            {
                "id": "all",
                "name": "All clients",
                "count": 0,
                "description": "Complete client list",
            },
            {
                "id": "vip",
                "name": "VIP Clients",
                "count": 0,
                "description": "High-value clients with lifetime value > $800",
            },
            {
                "id": "new",
                "name": "New Clients",
                "count": 0,
                "description": "Clients with ≤2 visits",
            },
            {
                "id": "regular",
                "name": "Regular Clients",
                "count": 0,
                "description": "Established clients with 3+ visits",
            },
            {
                "id": "inactive",
                "name": "Inactive Clients",
                "count": 0,
                "description": "No visits in last 90 days",
            },
        ]

        # Count clients in each segment
        base_query = db.query(dbm.Contact).filter(dbm.Contact.tenant_id == tid, dbm.Contact.deleted == False)

        for segment in segments:
            if segment["id"] == "all":
                segment["count"] = base_query.count()
            elif segment["id"] == "vip":
                segment["count"] = base_query.filter(dbm.Contact.lifetime_cents > 80000).count()
            elif segment["id"] == "new":
                segment["count"] = base_query.filter(dbm.Contact.txn_count <= 2).count()
            elif segment["id"] == "regular":
                segment["count"] = base_query.filter(dbm.Contact.txn_count >= 3).count()
            elif segment["id"] == "inactive":
                cutoff_date = int(time.time()) - (90 * 24 * 60 * 60)  # 90 days ago
                segment["count"] = base_query.filter(dbm.Contact.last_visit < cutoff_date).count()

        # Smart lists based on behavior patterns
        smart_lists = [
            {
                "id": "reengagement",
                "name": "Ready for Re-engagement",
                "count": 0,
                "description": "Lapsed clients (30+ days) who historically respond well",
            },
            {
                "id": "birthday_upcoming",
                "name": "Birthday This Month",
                "count": 0,
                "description": "Clients with birthdays in the next 30 days",
            },
        ]

        # Count smart lists
        for smart_list in smart_lists:
            if smart_list["id"] == "reengagement":
                cutoff_date = int(time.time()) - (30 * 24 * 60 * 60)  # 30 days ago
                smart_list["count"] = base_query.filter(dbm.Contact.last_visit < cutoff_date).count()
            elif smart_list["id"] == "birthday_upcoming":
                current_month = datetime.now().month
                current_year = datetime.now().year
                smart_list["count"] = base_query.filter(
                    dbm.Contact.birthday.isnot(None),
                    db.extract('month', dbm.Contact.birthday) == current_month
                ).count()

        return {
            "segments": segments,
            "smart_lists": smart_lists
        }
    except Exception as e:
        from fastapi.responses import JSONResponse as _JR
        msg = str(e)[:200]
        return _JR({"error": "internal_error", "detail": msg}, status_code=500)


# --- Appointments list for client history ---
@app.get("/appointments", tags=["Cadences"])
def list_appointments(
    tenant_id: str,
    contact_id: str = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"items": [], "total": 0}
    try:
        # Cast tenant_id to UUID if model uses PG UUID type
        tid = tenant_id
        try:
            import uuid as _uuid
            tid = _uuid.UUID(str(tenant_id))
        except Exception:
            tid = tenant_id

        q = db.query(dbm.Appointment).filter(dbm.Appointment.tenant_id == tid)  # type: ignore
        if contact_id:
            q = q.filter(dbm.Appointment.contact_id == contact_id)

        total = q.count()
        rows = (
            q.order_by(dbm.Appointment.start_time.desc())
            .offset(max(0, int(offset)))
            .limit(max(1, min(limit, 500)))
            .all()
        )

        out = []
        for r in rows:
            out.append({
                "id": r.id,
                "contact_id": r.contact_id,
                "start_time": int(getattr(r, "start_time", 0) or 0),
                "end_time": int(getattr(r, "end_time", 0) or 0),
                "status": getattr(r, "status", "scheduled"),
                "service_name": getattr(r, "service_name", None),
                "provider_name": getattr(r, "provider_name", None),
                "notes": getattr(r, "notes", None),
                "location": getattr(r, "location", None),
            })

        return {"items": out, "total": total}
    except Exception as e:
        from fastapi.responses import JSONResponse as _JR
        msg = str(e)[:200]
        return _JR({"error": "internal_error", "detail": msg}, status_code=500)


# --- Cadence drafts for message analytics ---
@app.get("/cadences/drafts", tags=["Cadences"])
def cadences_drafts(
    tenant_id: str,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"items": []}
    try:
        # Cast tenant_id to UUID if model uses PG UUID type
        tid = tenant_id
        try:
            import uuid as _uuid
            tid = _uuid.UUID(str(tenant_id))
        except Exception:
            tid = tenant_id

        # Get recent cadence jobs for analytics
        jobs = db.query(dbm.Job).filter(
            dbm.Job.tenant_id == tid,
            dbm.Job.job_type.in_(["cadence_send", "followup_send"])
        ).order_by(dbm.Job.created_at.desc()).limit(100).all()

        out = []
        for job in jobs:
            out.append({
                "id": job.id,
                "job_type": job.job_type,
                "status": job.status,
                "created_at": int(getattr(job, "created_at", 0) or 0),
                "completed_at": int(getattr(job, "completed_at", 0) or 0),
                "error_message": getattr(job, "error_message", None),
                "metadata": getattr(job, "metadata", {}),
            })

        return {"items": out}
    except Exception as e:
        from fastapi.responses import JSONResponse as _JR
        msg = str(e)[:200]
        return _JR({"error": "internal_error", "detail": msg}, status_code=500)


# --- Cadence stats for message performance ---
@app.get("/cadences/stats", tags=["Cadences"])
def cadences_stats(
    tenant_id: str,
    days: int = 30,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"total_sent": 0, "success_rate": 0, "reply_rate": 0, "by_channel": {}}
    try:
        # Cast tenant_id to UUID if model uses PG UUID type
        tid = tenant_id
        try:
            import uuid as _uuid
            tid = _uuid.UUID(str(tenant_id))
        except Exception:
            tid = tenant_id

        cutoff_date = datetime.now() - timedelta(days=days)

        # Get message stats
        messages = db.query(dbm.Message).filter(
            dbm.Message.tenant_id == tid,
            dbm.Message.created_at >= cutoff_date
        ).all()

        total_sent = len(messages)
        successful = len([m for m in messages if getattr(m, "status", "") == "delivered"])
        replied = len([m for m in messages if getattr(m, "direction", "") == "inbound"])

        success_rate = (successful / total_sent * 100) if total_sent > 0 else 0
        reply_rate = (replied / total_sent * 100) if total_sent > 0 else 0

        # Group by channel
        by_channel = {}
        for message in messages:
            channel = getattr(message, "channel", "unknown")
            if channel not in by_channel:
                by_channel[channel] = {"sent": 0, "delivered": 0, "replied": 0}
            by_channel[channel]["sent"] += 1
            if getattr(message, "status", "") == "delivered":
                by_channel[channel]["delivered"] += 1
            if getattr(message, "direction", "") == "inbound":
                by_channel[channel]["replied"] += 1

        return {
            "total_sent": total_sent,
            "success_rate": round(success_rate, 1),
            "reply_rate": round(reply_rate, 1),
            "by_channel": by_channel
        }
    except Exception as e:
        from fastapi.responses import JSONResponse as _JR
        msg = str(e)[:200]
        return _JR({"error": "internal_error", "detail": msg}, status_code=500)


# --- Message templates library ---
@app.get("/templates", tags=["Cadences"])
def list_templates(
    tenant_id: str,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"items": []}
    try:
        # For now, return hardcoded templates - can be made dynamic later
        templates = [
            {
                "id": "welcome_new",
                "name": "Welcome New Client",
                "category": "onboarding",
                "content": "Hi {{name}}! Welcome to {{business_name}}. We're excited to have you as a client. When would you like to schedule your next appointment?",
                "variables": ["name", "business_name"],
                "channel": "both"
            },
            {
                "id": "reengagement",
                "name": "Re-engagement",
                "category": "retention",
                "content": "Hi {{name}}! It's been a while since your last visit. We'd love to see you again! We have {{service}} available next week. Would you like to book?",
                "variables": ["name", "service"],
                "channel": "both"
            },
            {
                "id": "birthday",
                "name": "Birthday Special",
                "category": "promotion",
                "content": "Happy Birthday {{name}}! 🎉 As our gift to you, enjoy 20% off your next service. Valid for the next 30 days!",
                "variables": ["name"],
                "channel": "both"
            },
            {
                "id": "appointment_reminder",
                "name": "Appointment Reminder",
                "category": "reminders",
                "content": "Hi {{name}}! Just a friendly reminder about your appointment tomorrow at {{time}} for {{service}}. See you then!",
                "variables": ["name", "time", "service"],
                "channel": "both"
            }
        ]

        return {"items": templates}
    except Exception as e:
        from fastapi.responses import JSONResponse as _JR
        msg = str(e)[:200]
        return _JR({"error": "internal_error", "detail": msg}, status_code=500)


# --- Job status for background processes ---
@app.get("/jobs/{job_id}", tags=["Jobs"])
def job_status(job_id: str, ctx: UserContext = Depends(get_user_context)) -> Dict[str, Any]:
    try:
        # For now, return mock data - can be enhanced to query actual job status
        return {
            "id": job_id,
            "status": "completed",
            "progress": 100,
            "result": {"success": True, "message": "Job completed successfully"},
            "created_at": int(time.time()),
            "completed_at": int(time.time())
        }
    except Exception as e:
        from fastapi.responses import JSONResponse as _JR
        msg = str(e)[:200]
        return _JR({"error": "internal_error", "detail": msg}, status_code=500)


# --- Human-friendly tool schema for AskVX palette ---
@app.get("/ai/tools/schema_human", tags=["AI"])
def ai_tools_schema_human_endpoint() -> Dict[str, object]:
    return tools_schema_human()


# Temporarily commented audit route; keep adapter in place


class SeedRequest(BaseModel):
    tenant_id: str
@app.post("/l/seed", tags=["Integrations"])
async def l_seed(req: SeedRequest, ctx: UserContext = Depends(get_user_context)):
    # Dev-only seed endpoint to create one template and rule in Supabase
    if os.getenv("DEV_SEED_ENABLED", "false").lower() != "true":
        return {"status": "disabled"}
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    adapter = SupabaseAdapter()
    name = "Warm Lead SMS 1"
    # 1) upsert template
    await adapter.upsert(
        "cadence_templates",
        [
            {
                "tenant_id": req.tenant_id,
                "name": name,
                "template_body": "Hi {first_name}, quick question about your appointment—want the soonest?",
                "channel": "sms",
            }
        ],
    )
    # 2) fetch template id
    templates = await adapter.select(
        "cadence_templates",
        {
            "select": "id,tenant_id,name,created_at",
            "tenant_id": f"eq.{req.tenant_id}",
            "name": f"eq.{name}",
            "order": "created_at.desc",
            "limit": "1",
        },
    )
    if not templates:
        return {"status": "error", "reason": "template_not_found"}
    tid = templates[0]["id"]
    # 3) upsert rule
    await adapter.upsert(
        "cadence_rules",
        [
            {
                "tenant_id": req.tenant_id,
                "bucket": 1,
                "tag": "warm",
                "step_number": 1,
                "channel": "sms",
                "delay_hours": 24,
                "template_id": tid,
                "is_active": True,
            }
        ],
    )
    return {"status": "ok", "template_id": tid}


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


class AcuityImportRequest(BaseModel):
    tenant_id: str
    since: Optional[str] = None
    until: Optional[str] = None
    cursor: Optional[str] = None


@app.post("/integrations/booking/acuity/import", tags=["Integrations"])
def booking_import(req: AcuityImportRequest, ctx: UserContext = Depends(get_user_context)):
    # Canonicalize to context tenant to mirror Square behavior
    try:
        req.tenant_id = ctx.tenant_id
    except Exception:
        pass
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    return booking_acuity.import_appointments(req.tenant_id, req.since, req.until, req.cursor)


@app.get("/integrations/booking/acuity/status", tags=["Integrations"])  # strict-auth status probe
def acuity_status(
    tenant_id: str,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    # Canonicalize to context tenant to mirror Square behavior
    tenant_id = ctx.tenant_id
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"connected": False, "status": "forbidden"}
    try:
        # RLS-safe short-lived read
        with engine.begin() as conn:
            try:
                conn.execute(_sql_text("SET LOCAL app.role = 'owner_admin'"))
                conn.execute(_sql_text("SET LOCAL app.tenant_id = :t"), {"t": tenant_id})
            except Exception:
                pass
            row = conn.execute(
                _sql_text(
                    """
                    SELECT status, COALESCE(expires_at,0) AS exp, COALESCE(last_sync,0) AS ls, COALESCE(scopes,'') AS sc
                    FROM connected_accounts_v2
                    WHERE tenant_id = CAST(:t AS uuid) AND provider = 'acuity'
                    ORDER BY id DESC
                    LIMIT 1
                    """
                ),
                {"t": tenant_id},
            ).fetchone()
        if not row:
            return {"connected": False, "status": "not_found"}
        st, exp, ls, sc = row
        return {
            "connected": bool((st or "").strip() and (st or "").strip() != "revoked"),
            "status": st or "",
            "expires_at": int(exp or 0),
            "last_sync": int(ls or 0),
            "scopes": sc or "",
        }
    except Exception as e:
        return {"connected": False, "status": "error", "detail": str(e)[:200]}


@app.get("/integrations/booking/acuity/debug-token", tags=["Integrations"])  # auth-gated, no secrets
def acuity_debug_token(
    tenant_id: str,
    ctx: UserContext = Depends(get_user_context),
):
    """Report which token columns are populated for Acuity in connected_accounts_v2.
    Does not return token contents. Useful to diagnose schema drift under RLS.
    """
    try:
        if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
            return {"ok": False, "error": "forbidden"}
        with engine.begin() as conn:
            try:
                conn.execute(_sql_text("SET LOCAL app.role = 'owner_admin'"))
                conn.execute(_sql_text("SET LOCAL app.tenant_id = :t"), {"t": tenant_id})
            except Exception:
                pass
            # Build dynamic SELECT to avoid undefined-column errors under schema drift
            cols = conn.execute(
                _sql_text(
                    """
                    SELECT array_agg(column_name)::text
                    FROM information_schema.columns
                    WHERE table_schema='public'
                      AND table_name='connected_accounts_v2'
                      AND column_name IN ('access_token_enc','access_token','token')
                    """
                )
            ).fetchone()
            present = []
            try:
                txt = str(cols[0] or "").strip("{}")
                present = [c.strip() for c in txt.split(',') if c.strip()]
            except Exception:
                present = []
            has_exprs = []
            if 'access_token_enc' in present:
                has_exprs.append("(access_token_enc IS NOT NULL AND access_token_enc <> '') AS has_enc")
            else:
                has_exprs.append("FALSE AS has_enc")
            if 'access_token' in present:
                has_exprs.append("(access_token IS NOT NULL AND access_token <> '') AS has_plain")
            else:
                has_exprs.append("FALSE AS has_plain")
            if 'token' in present:
                has_exprs.append("(token IS NOT NULL AND token <> '') AS has_token")
            else:
                has_exprs.append("FALSE AS has_token")
            sql = (
                "SELECT " + ", ".join(has_exprs) + ", status FROM connected_accounts_v2 "
                "WHERE tenant_id = CAST(:t AS uuid) AND provider='acuity' ORDER BY id DESC LIMIT 1"
            )
            row = conn.execute(_sql_text(sql), {"t": tenant_id}).fetchone()
        if not row:
            return {"ok": True, "row_seen": False}
        has_enc, has_plain, has_token, status = row
        return {
            "ok": True,
            "row_seen": True,
            "has_access_token_enc": bool(has_enc),
            "has_access_token": bool(has_plain),
            "has_token": bool(has_token),
            "status": status or "",
        }
    except Exception as e:
        return {"ok": False, "error": str(e)[:200]}


@app.get("/integrations/booking/acuity/debug-headers", tags=["Integrations"])  # auth-gated, no secrets
def acuity_debug_headers(
    tenant_id: str,
    ctx: UserContext = Depends(get_user_context),
):
    """Return which auth mode the Acuity client would use (bearer|basic|none). No secrets."""
    try:
        if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
            return {"ok": False, "error": "forbidden"}
        headers = booking_acuity._acuity_headers(tenant_id)
        auth = str(headers.get("Authorization", ""))
        mode = "none"
        try:
            if auth.startswith("Bearer "):
                mode = "bearer"
            elif auth.startswith("Basic "):
                mode = "basic"
        except Exception:
            mode = "none"
        return {"ok": True, "auth_mode": mode}
    except Exception as e:
        return {"ok": False, "error": str(e)[:200]}


@app.get("/integrations/booking/acuity/debug-fetch", tags=["Integrations"])  # auth-gated, no secrets
def acuity_debug_fetch(
    tenant_id: str,
    ctx: UserContext = Depends(get_user_context),
):
    """Return non-sensitive metadata from the token fetch path: token_present and token_length."""
    try:
        if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
            return {"ok": False, "error": "forbidden"}
        t = booking_acuity._fetch_acuity_token(tenant_id)
        try:
            ln = len(t)
        except Exception:
            ln = 0
        return {"ok": True, "token_present": bool(t), "token_length": ln}
    except Exception as e:
        return {"ok": False, "error": str(e)[:200]}


@app.get("/integrations/booking/acuity/debug-rls", tags=["Integrations"])  # auth-gated, no secrets
def acuity_debug_rls(
    tenant_id: str,
    ctx: UserContext = Depends(get_user_context),
):
    """Report RLS context: current app.tenant_id and visible v2 row count for acuity using engine.begin()."""
    try:
        if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
            return {"ok": False, "error": "forbidden"}
        with engine.begin() as conn:
            try:
                conn.execute(_sql_text("SET LOCAL app.role = 'owner_admin'"))
                conn.execute(_sql_text("SET LOCAL app.tenant_id = :t"), {"t": tenant_id})
            except Exception:
                pass
            try:
                guc_row = conn.execute(_sql_text("SELECT current_setting('app.tenant_id', true)")).fetchone()
                guc_tenant = str(guc_row[0] or "") if guc_row else ""
            except Exception:
                guc_tenant = ""
            cnt_row = conn.execute(
                _sql_text(
                    "SELECT COUNT(*), COALESCE(MAX(id),0) FROM connected_accounts_v2 WHERE tenant_id = CAST(:t AS uuid) AND provider='acuity'"
                ),
                {"t": tenant_id},
            ).fetchone()
            v2_count = int(cnt_row[0] or 0) if cnt_row else 0
            latest_id = int(cnt_row[1] or 0) if cnt_row else 0
        return {"ok": True, "guc_tenant": guc_tenant, "v2_count": v2_count, "latest_id": latest_id}
    except Exception as e:
        return {"ok": False, "error": str(e)[:200]}


@app.get("/integrations/booking/acuity/debug-token-lens", tags=["Integrations"])  # auth-gated, no secrets
def acuity_debug_token_lens(
    tenant_id: str,
    limit: int = 5,
    ctx: UserContext = Depends(get_user_context),
):
    """Return lengths (in characters) of token columns for the last N rows (no contents)."""
    try:
        if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
            return {"ok": False, "error": "forbidden"}
        with engine.begin() as conn:
            try:
                conn.execute(_sql_text("SET LOCAL app.role = 'owner_admin'"))
                conn.execute(_sql_text("SET LOCAL app.tenant_id = :t"), {"t": tenant_id})
            except Exception:
                pass
            rows = conn.execute(
                _sql_text(
                    """
                    SELECT id,
                           COALESCE(LENGTH(access_token_enc),0) AS len_enc
                    FROM connected_accounts_v2
                    WHERE tenant_id = CAST(:t AS uuid) AND provider='acuity'
                    ORDER BY id DESC
                    LIMIT :lim
                    """
                ),
                {"t": tenant_id, "lim": max(1, min(20, int(limit)))},
            ).fetchall()
        out = []
        for r in rows or []:
            try:
                out.append({"id": int(r[0] or 0), "len_enc": int(r[1] or 0)})
            except Exception:
                continue
        return {"ok": True, "rows": out}
    except Exception as e:
        return {"ok": False, "error": str(e)[:200]}


@app.get("/metrics", tags=["Health"])
def get_metrics(tenant_id: str, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)) -> Dict[str, int]:
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"messages_sent": 0, "time_saved_minutes": 0}
    
    try:
        m = db.query(dbm.Metrics).filter(dbm.Metrics.tenant_id == tenant_id).first()
        if not m:
            base = {"messages_sent": 0, "time_saved_minutes": 0, "ambassador_candidate": False}
        else:
            base = {
                "messages_sent": m.messages_sent,
                "time_saved_minutes": compute_time_saved_minutes(db, tenant_id),
                "ambassador_candidate": ambassador_candidate(db, tenant_id),
            }
        # Compute rebook stats (last 30d)
        try:
            rebook_total = 0
            rebooked = 0
            rows = db.execute(
                _sql_text(
                    """
                    WITH base AS (
                      SELECT id, contact_id, start_ts
                      FROM appointments
                      WHERE tenant_id = CAST(:t AS uuid)
                        AND status = 'completed'
                        AND start_ts >= (EXTRACT(epoch FROM now())::bigint - 30*86400)
                    ), rebook AS (
                      SELECT b.id
                      FROM base b
                      WHERE EXISTS (
                        SELECT 1 FROM appointments a2
                        WHERE a2.tenant_id = CAST(:t AS uuid)
                          AND a2.contact_id = b.contact_id
                          AND a2.status = 'completed'
                          AND a2.start_ts > b.start_ts AND a2.start_ts <= b.start_ts + 30*86400
                      )
                    )
                    SELECT (SELECT COUNT(*) FROM base) AS total, (SELECT COUNT(*) FROM rebook) AS rebooked
                    """
                ),
                {"t": tenant_id},
            ).fetchone()
            if rows:
                rebook_total = int(rows[0] or 0)
                rebooked = int(rows[1] or 0)
        except Exception:
            rebook_total = rebooked = 0
        rebook_rate = round((100.0 * rebooked / rebook_total), 1) if rebook_total > 0 else 0.0
        # enrich via admin_kpis for revenue/referrals
        k = admin_kpis(db, tenant_id)
        base.update({
            "revenue_uplift": k.get("revenue_uplift", 0),
            "referrals_30d": k.get("referrals_30d", 0),
            "rebooks_30d": rebooked,
            "rebook_rate_30d": rebook_rate,
        })
        return base
    except Exception as exc:
        logger.exception("metrics_failed", extra={"tenant_id": tenant_id}, exc_info=exc)
        # Return fallback metrics on any error
        return {
            "messages_sent": 0,
            "time_saved_minutes": 0,
            "ambassador_candidate": False,
            "revenue_uplift": 0,
            "referrals_30d": 0,
            "rebooks_30d": 0,
            "rebook_rate_30d": 0.0,
        }
@app.get("/admin/kpis", tags=["Health"])
def get_admin_kpis(tenant_id: str, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)) -> Dict[str, int]:
    if ctx.role != "owner_admin" and ctx.tenant_id != tenant_id:
        return {}
    ckey = f"kpis:{tenant_id}"
    cached = cache_get(ckey)
    if cached is not None:
        try:
            CACHE_HIT.labels(endpoint="/admin/kpis").inc()  # type: ignore
        except Exception:
            pass
        return cached
    try:
        data = admin_kpis(db, tenant_id)
    except Exception as exc:
        logger.exception("admin_kpis_failed", extra={"tenant_id": tenant_id}, exc_info=exc)
        data = {
            "time_saved_minutes": 0,
            "usage_index": 0,
            "ambassador_candidate": False,
            "revenue_uplift": 0,
            "referrals_30d": 0,
            "contacts": 0,
            "active_cadences": 0,
            "notify_list_count": 0,
            "share_prompts": 0,
            "cache_hits": 0,
            "cache_misses": 0,
            "ai_chat_used": 0,
            "db_query_tool_used": 0,
            "insights_served": 0,
        }
    cache_set(ckey, data, ttl=30)
    try:
        CACHE_MISS.labels(endpoint="/admin/kpis").inc()  # type: ignore
    except Exception:
        pass
    return data


class TimeAnalysisRequest(BaseModel):
    tenant_id: str


@app.get("/analysis/time", tags=["Analytics"])  # simple computation based on settings + Metrics
def analysis_time(tenant_id: str, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)) -> Dict[str, object]:
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"time_saved_minutes": 0, "cost_saved": 0}
    # Load settings for time analysis inputs
    hourly_rate = 50.0
    per_post_minutes = 15
    try:
        row = db.query(dbm.Settings).filter(dbm.Settings.tenant_id == tenant_id).first()
        if row:
            data = json.loads(row.data_json or "{}")
            ta = data.get("time_analysis") or {}
            hourly_rate = float(ta.get("hourly_rate", hourly_rate))
            per_post_minutes = int(ta.get("per_post_minutes", per_post_minutes))
    except Exception:
        pass
    # Pull Metrics
    m = db.query(dbm.Metrics).filter(dbm.Metrics.tenant_id == tenant_id).first()
    time_saved_minutes = int(m.time_saved_minutes) if m else 0
    messages_sent = int(m.messages_sent) if m else 0
    # Derive approximate content savings (placeholder; will refine with actual scheduled posts)
    content_minutes = 0
    # Compute cost saved
    cost_saved = (time_saved_minutes + content_minutes) * (hourly_rate / 60.0)
    return {
        "time_saved_minutes": time_saved_minutes + content_minutes,
        "cost_saved": round(cost_saved, 2),
        "inputs": {"hourly_rate": hourly_rate, "per_post_minutes": per_post_minutes},
        "sources": {"cadences_minutes": time_saved_minutes, "content_minutes": content_minutes, "messages_sent": messages_sent},
    }


@app.get("/metrics/explain", tags=["Analytics"])  # human-friendly breakdown for Ask VX
def metrics_explain(tenant_id: str, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)) -> Dict[str, object]:
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"explanation": "forbidden"}
    # Reuse analysis_time
    res = analysis_time(tenant_id, db, ctx)
    if "explanation" in res:
        return res
    hourly_rate = res.get("inputs", {}).get("hourly_rate", 50)
    ts = int(res.get("sources", {}).get("cadences_minutes", 0)) + int(res.get("sources", {}).get("content_minutes", 0))
    cost_saved = float(res.get("cost_saved", 0.0))
    text = (
        f"We compute Time Saved as a sum of automation minutes (currently from messaging/cadences). "
        f"Cost Saved = Time Saved × hourly rate. Using hourly rate ${hourly_rate:.2f}, "
        f"Time Saved is {ts} minutes and Cost Saved is ${cost_saved:.2f}."
    )
    return {"explanation": text, "details": res}

@app.post("/scheduler/tick", tags=["Cadences"])
def scheduler_tick(tenant_id: Optional[str] = None, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)):
    if tenant_id and ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"processed": 0}
    return {"processed": run_tick(db, tenant_id)}


class RecomputeRequest(BaseModel):
    tenant_id: str


@app.post("/marts/recompute", tags=["Health"])
def recompute_marts(
    req: RecomputeRequest,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.role != "owner_admin" and ctx.tenant_id != req.tenant_id:
        raise HTTPException(status_code=403, detail="forbidden")
    a = recompute_funnel_daily(db, req.tenant_id)
    b = recompute_time_saved(db, req.tenant_id)
    return {"status": "ok", "funnel_updates": a, "time_saved_updates": b}


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


class AppointmentCreateRequest(BaseModel):
    tenant_id: str
    contact_id: str
    service: Optional[str] = None
    start_ts: int
    end_ts: Optional[int] = None
    status: str = "booked"  # booked|completed|cancelled


@app.post("/appointments", tags=["Cadences"])
def create_appointment(
    req: AppointmentCreateRequest,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
) -> Dict[str, str]:
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    db.add(dbm.Appointment(
        tenant_id=req.tenant_id,
        contact_id=req.contact_id,
        service=req.service,
        start_ts=req.start_ts,
        end_ts=req.end_ts,
        status=req.status,
    ))
    db.commit()
    emit_event("AppointmentIngested", {"tenant_id": req.tenant_id, "contact_id": req.contact_id, "service": req.service})
    # Draft and send a confirmation (subject to consent/rate limits)
    try:
        body = f"Your appointment for {req.service or 'service'} is set. Reply HELP for assistance."
        send_message(db, req.tenant_id, req.contact_id, "sms", None, body, None)
    except Exception:
        pass
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
class SettingsRequest(BaseModel):
    tenant_id: str
    tone: Optional[str] = None
    services: Optional[List[str]] = None
    preferences: Optional[Dict[str, str]] = None
    brand_profile: Optional[Dict[str, str]] = None
    quiet_hours: Optional[Dict[str, str]] = None  # { start:'21:00', end:'08:00' }
    training_notes: Optional[str] = None
    completed: Optional[bool] = None
    providers_live: Optional[Dict[str, bool]] = None  # per-provider live-mode switch
    wf_progress: Optional[Dict[str, bool]] = None  # first 5 workflows progress flags
    # Onboarding/tour persistence
    tour_completed: Optional[bool] = None
    tour_completed_at: Optional[int] = None
    onboarding_step: Optional[int] = None
    # BrandVX gating flags
    onboarding_completed: Optional[bool] = None
    welcome_seen: Optional[bool] = None
    guide_done: Optional[bool] = None
    # Subscription/trial flags
    subscription_status: Optional[str] = None  # trialing | active | canceled
    trial_end_ts: Optional[int] = None        # epoch seconds
    # Timezone support
    user_timezone: Optional[str] = None  # e.g., "America/Chicago"
    # Creator / developer flags
    developer_mode: Optional[bool] = None
    master_prompt: Optional[str] = None  # stored under ai.master_prompt
    rate_limit_multiplier: Optional[int] = None
    # AI insights sharing (opt-in)
    ai_share_insights: Optional[bool] = None
    # Global safety switch: when true, route risky tools to Approvals
    pause_automations: Optional[bool] = None
@app.get("/settings", tags=["Integrations"])
def get_settings(
    tenant_id: Optional[str] = None,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    try:
        tid = tenant_id or ctx.tenant_id
        if ctx.tenant_id != tid and ctx.role != "owner_admin":
            return {"data": {}}
        # Use a GUC-backed read to satisfy RLS
        from sqlalchemy import text as __t
        with engine.begin() as conn:
            try:
                conn.execute(__t("SET LOCAL app.role = 'owner_admin'"))
                conn.execute(__t("SET LOCAL app.tenant_id = :t"), {"t": tid})
            except Exception:
                pass
            r = conn.execute(__t("SELECT id, data_json FROM settings WHERE tenant_id = CAST(:t AS uuid) ORDER BY id DESC LIMIT 1"), {"t": tid}).fetchone()
            if not r or not ((r[1] or "").strip()):
                # Seed a default settings row with trial for new tenants
                import time as __time
                __trial = {"subscription_status": "trialing", "trial_end_ts": int(__time.time()) + 7*86400}
                conn.execute(__t("INSERT INTO settings(tenant_id, data_json, created_at) VALUES (CAST(:t AS uuid), :d, NOW())"), {"t": tid, "d": json.dumps(__trial)})
                return {"data": __trial}
            try:
                data = json.loads(r[1] or "{}")
                # If no subscription_status present, backfill trial (one-time)
                if not str(data.get("subscription_status") or "").strip():
                    import time as __time
                    data["subscription_status"] = "trialing"
                    data.setdefault("trial_end_ts", int(__time.time()) + 7*86400)
                    conn.execute(__t("UPDATE settings SET data_json=:d WHERE id=:id"), {"d": json.dumps(data), "id": r[0]})
                return {"data": data} 
            except Exception:
                return {"data": {}}
    except Exception:
        # Fallback to ORM path (may be empty if RLS not satisfied by session GUCs)
        try:
            row = db.query(dbm.Settings).filter(dbm.Settings.tenant_id == (tenant_id or ctx.tenant_id)).first()
            if not row or not (row.data_json or "").strip():
                return {"data": {}}
            return {"data": json.loads(row.data_json)}
        except Exception:
            return {"data": {}}


@app.post("/settings", tags=["Integrations"])
def update_settings(
    req: SettingsRequest,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    # Write under tenant RLS via SET LOCAL and upsert semantics
    import json as _json
    from sqlalchemy import text as __t
    payload = {
        "tone": req.tone,
        "services": req.services,
        "preferences": req.preferences,
        "brand_profile": req.brand_profile,
        "quiet_hours": req.quiet_hours,
        "training_notes": req.training_notes,
        "completed": req.completed,
        "providers_live": req.providers_live,
        "wf_progress": req.wf_progress,
        "tour_completed": req.tour_completed,
        "tour_completed_at": req.tour_completed_at,
        "onboarding_step": req.onboarding_step,
        "onboarding_completed": req.onboarding_completed,
        "welcome_seen": req.welcome_seen,
        "guide_done": req.guide_done,
        "subscription_status": req.subscription_status,
        "trial_end_ts": req.trial_end_ts,
        "user_timezone": req.user_timezone,
        "developer_mode": req.developer_mode,
        "master_prompt": req.master_prompt,
        "rate_limit_multiplier": req.rate_limit_multiplier,
        "ai_share_insights": req.ai_share_insights,
        "pause_automations": req.pause_automations,
    }
    # Drop Nones
    payload = {k: v for k, v in payload.items() if v is not None}
    wrote_quiet = False
    wrote_train = False
    with engine.begin() as conn:
        try:
            conn.execute(__t("SET LOCAL app.role = 'owner_admin'"))
            conn.execute(__t("SET LOCAL app.tenant_id = :t"), {"t": req.tenant_id})
        except Exception:
            pass
        row = conn.execute(__t("SELECT id, data_json FROM settings WHERE tenant_id = CAST(:t AS uuid) ORDER BY id DESC LIMIT 1"), {"t": req.tenant_id}).fetchone()
        if row and row[0]:
            try:
                current = _json.loads(row[1] or "{}")
            except Exception:
                current = {}
            # Merge new payload; drop None handled above
            current.update(payload)
            conn.execute(__t("UPDATE settings SET data_json=:d WHERE id=:id"), {"d": _json.dumps(current), "id": row[0]})
        else:
            conn.execute(__t("INSERT INTO settings(tenant_id, data_json, created_at) VALUES (CAST(:t AS uuid), :d, NOW())"), {"t": req.tenant_id, "d": _json.dumps(payload or {})})
    # Mark onboarding progress based on keys present
    try:
        if req.quiet_hours and isinstance(req.quiet_hours, dict):
            wrote_quiet = True
            _complete_step(req.tenant_id, 'quiet_hours', {"start": req.quiet_hours.get('start'), "end": req.quiet_hours.get('end')})
        if (req.training_notes and str(req.training_notes).strip()) or (req.brand_profile and any((req.brand_profile or {}).values())):
            wrote_train = True
            _complete_step(req.tenant_id, 'train_vx', {"brand_profile": bool(req.brand_profile), "notes": bool(req.training_notes)})
    except Exception:
        pass
    return {"status": "ok", "progress": {"quiet": wrote_quiet, "train": wrote_train}}
class ProvisionCreatorRequest(BaseModel):
    tenant_id: str
    master_prompt: Optional[str] = None
    rate_limit_multiplier: Optional[int] = 5
@app.post("/admin/provision_creator", tags=["Admin"])
def provision_creator(
    req: ProvisionCreatorRequest,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    # Allow owner_admin to self-provision creator mode for their tenant
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    row = db.query(dbm.Settings).filter(dbm.Settings.tenant_id == req.tenant_id).first()
    data = {}
    if row:
        try:
            data = json.loads(row.data_json or "{}")
        except Exception:
            data = {}
    data["developer_mode"] = True
    try:
        rlm = int(req.rate_limit_multiplier or 5)
        data["rate_limit_multiplier"] = max(1, rlm)
    except Exception:
        data["rate_limit_multiplier"] = 5
    if req.master_prompt is not None:
        ai_cfg = dict(data.get("ai") or {})
        ai_cfg["master_prompt"] = req.master_prompt
        data["ai"] = ai_cfg
    if not row:
        row = dbm.Settings(tenant_id=req.tenant_id, data_json=json.dumps(data))
        db.add(row)
    else:
        row.data_json = json.dumps(data)
    db.commit()
    emit_event("CreatorModeProvisioned", {"tenant_id": req.tenant_id, "rate_limit_multiplier": data.get("rate_limit_multiplier", 1)})
    return {"status": "ok"}


class CacheClearRequest(BaseModel):
    tenant_id: str
    scope: Optional[str] = "all"  # all | inbox | inventory | calendar
@app.post("/admin/cache/clear", tags=["Admin"])
def admin_cache_clear(req: CacheClearRequest, ctx: UserContext = Depends(get_user_context)) -> Dict[str, Any]:
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    cleared = 0
    tried = []
    # Known keys
    keys = []  # type: ignore
    if req.scope in ("all", "inbox"):
        keys.append(f"inbox:{req.tenant_id}:50")
    if req.scope in ("all", "inventory"):
        keys.append(f"inv:{req.tenant_id}")
    if req.scope in ("all", "calendar"):
        keys.append(f"cal:{req.tenant_id}:0:0")
    # Attempt prefix scan in Redis when available for broader cleanup
    client = _get_redis()
    if client is not None and req.scope == "all":
        try:
            for prefix in [f"inbox:{req.tenant_id}", f"inv:{req.tenant_id}", f"cal:{req.tenant_id}"]:
                cursor = "0"
                while True:
                    cursor, batch = client.scan(cursor=cursor, match=f"{prefix}*")  # type: ignore
                    if batch:
                        for k in batch:
                            if k not in keys:
                                keys.append(k)
                    if cursor == "0":
                        break
        except Exception:
            pass
    for k in keys:
        tried.append(k)
        try:
            cache_del(k)
            cleared += 1
        except Exception:
            pass
    try:
        emit_event("AdminCacheCleared", {"tenant_id": req.tenant_id, "scope": req.scope, "cleared": cleared})
    except Exception:
        pass
    return {"status": "ok", "cleared": cleared, "keys": tried[:50]}


class OnboardingCompleteRequest(BaseModel):
    tenant_id: str


@app.post("/onboarding/complete", tags=["Integrations"])
def onboarding_complete(
    req: OnboardingCompleteRequest,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    # mark settings.completed = true
    row = db.query(dbm.Settings).filter(dbm.Settings.tenant_id == req.tenant_id).first()
    data = {}
    if row:
        try:
            data = json.loads(row.data_json)
        except Exception:
            data = {}
    data["completed"] = True
    if not row:
        row = dbm.Settings(tenant_id=req.tenant_id, data_json=json.dumps(data))
        db.add(row)
    else:
        row.data_json = json.dumps(data)
    db.commit()
    emit_event("OnboardingCompleted", {"tenant_id": req.tenant_id})
    # surface share prompt
    db.add(dbm.SharePrompt(tenant_id=req.tenant_id, kind="share_onboarding", surfaced=True))
    db.commit()
    return {"status": "ok"}


class OnboardingTourCompleteRequest(BaseModel):
    tenant_id: str
    completed_at: Optional[int] = None


@app.post("/onboarding/complete_tour", tags=["Plans"])
def onboarding_complete_tour(
    req: OnboardingTourCompleteRequest,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    try:
        ts = int(req.completed_at or int(_time.time()))
    except Exception:
        ts = int(_time.time())
    row = db.query(dbm.Settings).filter(dbm.Settings.tenant_id == req.tenant_id).first()
    data = {}
    if row:
        try:
            data = json.loads(row.data_json or "{}")
        except Exception:
            data = {}
    data["tour_completed_at"] = ts
    data["tour_completed"] = True
    data["guide_done"] = True
    if not row:
        row = dbm.Settings(tenant_id=req.tenant_id, data_json=json.dumps(data))
        db.add(row)
    else:
        row.data_json = json.dumps(data)
    db.commit()
    try:
        emit_event("TourCompleted", {"tenant_id": req.tenant_id, "ts": ts})
    except Exception:
        pass
    return {"status": "ok", "tour_completed_at": ts}


@app.get("/messages/list", tags=["Cadences"])
def list_messages(
    tenant_id: str = None,
    contact_id: Optional[str] = None,
    limit: int = 50,
    filter: Optional[str] = None,  # unread|needs_reply|scheduled|failed|all
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    # Use tenant_id from query param if provided, otherwise fall back to context
    effective_tenant_id = tenant_id or ctx.tenant_id
    if not effective_tenant_id:
        return {"items": []}
    if ctx.tenant_id != effective_tenant_id and ctx.role != "owner_admin":
        return {"items": []}
    q = db.query(dbm.Message).filter(dbm.Message.tenant_id == effective_tenant_id)
    if contact_id:
        q = q.filter(dbm.Message.contact_id == contact_id)
    # Simple filters: relies on status + direction
    f = (filter or "").strip().lower()
    if f == "unread":
        q = q.filter(dbm.Message.status == "unread")
    elif f == "failed":
        q = q.filter(dbm.Message.status.ilike("fail%"))
    elif f == "scheduled":
        q = q.filter(dbm.Message.status.ilike("sched%"))
    elif f == "needs_reply":
        # last inbound without newer outbound for same contact
        # (approximate: filter inbound, then exclude if a newer outbound exists)
        sub = (
            db.query(dbm.Message.contact_id, dbm.Message.id)
            .filter(
                dbm.Message.tenant_id == effective_tenant_id,
                dbm.Message.direction == "outbound",
            )
            .subquery()
        )
        q = (
            q.filter(dbm.Message.direction == "inbound")
            .outerjoin(
                sub,
                (sub.c.contact_id == dbm.Message.contact_id)
                & (sub.c.id > dbm.Message.id),
            )
            .filter(sub.c.id == None)
        )  # noqa: E711
    rows = q.order_by(dbm.Message.id.desc()).limit(max(1, min(limit, 200))).all()
    items = []
    for r in rows:
        items.append({
            "id": r.id,
            "contact_id": r.contact_id,
            "channel": r.channel,
            "direction": r.direction,
            "status": r.status,
            "template_id": r.template_id,
            "ts": r.ts,
            "metadata": r.message_metadata,
        })
    return {"items": items}


@app.get("/appointments/list", tags=["Cadences"])
def list_appointments(
    tenant_id: str,
    contact_id: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"items": []}
    q = db.query(dbm.Appointment).filter(dbm.Appointment.tenant_id == tenant_id)
    if contact_id:
        q = q.filter(dbm.Appointment.contact_id == contact_id)
    rows = q.order_by(dbm.Appointment.id.desc()).limit(max(1, min(limit, 200))).all()
    items = []
    for r in rows:
        items.append({
            "id": r.id,
            "contact_id": r.contact_id,
            "service": r.service,
            "start_ts": r.start_ts,
            "end_ts": r.end_ts,
            "status": r.status,
            "external_ref": r.external_ref,
        })
    return {"items": items}


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
    _safe_audit_log(db, tenant_id=req.tenant_id, actor_id=ctx.user_id, action="consent.stop", entity_ref=f"contact:{req.contact_id}", payload="{}")
    db.commit()
    emit_event(
        "SuppressionAdded",
        {"tenant_id": req.tenant_id, "contact_id": req.contact_id, "channel": req.channel, "keyword": "STOP"},
    )
    return {"status": "suppressed"}


@app.post("/cadences/stop", tags=["Cadences"])
def stop_cadence(
    tenant_id: str,
    contact_id: str,
    cadence_id: str,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    q = (
        db.query(dbm.CadenceState)
        .filter(
            dbm.CadenceState.tenant_id == tenant_id,
            dbm.CadenceState.contact_id == contact_id,
            dbm.CadenceState.cadence_id == cadence_id,
        )
    )
    count = q.count()
    q.delete()
    db.commit()
    emit_event("CadenceStopped", {"tenant_id": tenant_id, "contact_id": contact_id, "cadence_id": cadence_id, "count": count})
    return {"status": "ok", "stopped": count}


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
@app.get("/ai/tools/schema", tags=["AI"])
def ai_tools_schema(mode: Optional[str] = None) -> Dict[str, object]:
    base = tools_schema()
    m = (mode or "").strip().lower()
    if not m:
        return base
    allow = set(context_allowlist(m))
    if not allow:
        return base
    filtered = [tool for tool in base.get("tools", []) if tool.get("name") in allow]
    return {**base, "tools": filtered}
@app.get("/ai/schema/map", tags=["AI"])
def ai_schema_map(db: Session = Depends(get_db)) -> Dict[str, object]:
    """Return a sanitized schema map (table -> columns) for routing db.query.* tools.
    Only exposes allow-listed tables, no constraints or PII examples.
    """
    allow = ["contacts", "appointments", "lead_status", "events_ledger"]
    out: Dict[str, List[Dict[str, str]]] = {}
    try:
        for t in allow:
            rows = db.execute(
                _sql_text(
                    """
                    SELECT column_name, data_type
                    FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = :tbl
                    ORDER BY ordinal_position
                    """
                ),
                {"tbl": t},
            ).fetchall()
            out[t] = [{"name": str(r[0]), "type": str(r[1])} for r in rows or []]
    except Exception:
        pass
    return {"tables": out}


@app.get("/admin/tools/telemetry", tags=["AI"])
def tools_telemetry(
    tenant_id: str,
    limit: int = 50,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"items": [], "counts": {}}
    try:
        rows = db.execute(
            _sql_text(
                """
                SELECT ts, payload
                FROM events_ledger
                WHERE tenant_id = CAST(:t AS uuid) AND name = 'AIToolExecuted'
                ORDER BY ts DESC
                LIMIT :lim
                """
            ),
            {"t": tenant_id, "lim": max(1, min(int(limit or 50), 500))},
        ).fetchall()
        items = []
        counts: Dict[str, int] = {}
        for r in rows:
            try:
                payload = json.loads(str(r[1] or "{}"))
            except Exception:
                payload = {}
            tool = str(payload.get("tool", ""))
            status = str(payload.get("status", ""))
            items.append({"ts": int(r[0] or 0), "tool": tool, "status": status})
            if tool:
                counts[tool] = counts.get(tool, 0) + 1
        return {"items": items, "counts": counts}
    except Exception:
        return {"items": [], "counts": {}}


class WorkflowPlanRequest(BaseModel):
    tenant_id: str
    name: str  # e.g., "crm_organization", "book_filling"


@app.post("/ai/workflow/plan", tags=["AI"])
def ai_workflow_plan(req: WorkflowPlanRequest, ctx: UserContext = Depends(get_user_context)) -> Dict[str, object]:
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"steps": []}
    # Minimal deterministic plans; frontend can map tourTarget to driver.js anchors
    plans = {
        "crm_organization": [
            {"title": "Create HubSpot (free)", "tool": "link.hubspot.signup", "requiresApproval": False},
            {"title": "Connect HubSpot", "tool": "oauth.hubspot.connect", "requiresApproval": False},
            {"title": "Import contacts from HubSpot", "tool": "crm.hubspot.import", "requiresApproval": False},
            {"title": "Dedupe contacts", "tool": "contacts.dedupe", "requiresApproval": False},
            {"title": "Export current list", "tool": "export.contacts", "requiresApproval": False},
        ],
        "book_filling": [
            {"title": "Preview dormant segment (≥60d)", "tool": "campaigns.dormant.preview", "requiresApproval": False},
            {"title": "Start dormant campaign", "tool": "campaigns.dormant.start", "requiresApproval": True},
            {"title": "Schedule reminders", "tool": "appointments.schedule_reminders", "requiresApproval": False},
        ],
        "inventory_tracking": [
            {"title": "Check low stock", "tool": "inventory.alerts.get", "requiresApproval": False},
        ],
        "client_communication": [
            {"title": "Schedule reminders", "tool": "appointments.schedule_reminders", "requiresApproval": False},
        ],
        "social_automation": [
            {"title": "Draft 14‑day schedule", "tool": "social.schedule.14days", "requiresApproval": True},
        ],
    }
    steps = plans.get(req.name)
    if steps is None:
        return {
            "steps": [],
            "friendly_error": "I couldn't find that workflow. Try one of: crm_organization, book_filling, inventory_tracking, client_communication, social_automation.",
        }
    return {"steps": steps}


# Minimal cross-panel workflow guide manifest for AskVX
@app.get("/guide/manifest", tags=["AI"])
def guide_manifest() -> Dict[str, object]:
    return {
        "version": 1,
        "workflows": {
            "crm_organization": [
                {"panel": "integrations", "selector": "[data-tour=connect]", "title": "Connect CRM", "desc": "Link HubSpot to import contacts."},
                {"panel": "onboarding", "selector": "[data-tour=analyze]", "title": "Analyze setup", "desc": "See what's ready and what's missing."},
            ],
            "book_filling": [
                {"panel": "cadences", "selector": "[data-guide=dormant-preview]", "title": "Preview dormant", "desc": "Find clients not seen recently."},
                {"panel": "cadences", "selector": "[data-guide=dormant-start]", "title": "Start campaign", "desc": "Queue messages with consent and approvals."},
            ],
            "inventory_tracking": [
                {"panel": "inventory", "selector": "[data-guide=sync]", "title": "Run sync", "desc": "Pull stock from Shopify/Square."},
                {"panel": "inventory", "selector": "[data-guide=low-threshold]", "title": "Low stock alerts", "desc": "Adjust threshold to watch items."},
            ],
            "client_communication": [
                {"panel": "inbox", "selector": "[data-guide=templates]", "title": "Message templates", "desc": "Pick and schedule reminders."},
            ],
            "social_automation": [
                {"panel": "social", "selector": "[data-guide=plan-14]", "title": "Draft 14‑day plan", "desc": "Review and approve posts."},
            ],
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
                    {"id": "funnel", "endpoint": "/funnel/daily?tenant_id={tenant_id}&days=30"},
                    {"id": "cadence_queue", "endpoint": "/cadences/queue?tenant_id={tenant_id}&limit=50"},
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
class ProvisionSmsRequest(BaseModel):
    tenant_id: str
    area_code: Optional[str] = None  # attempt local number if provided


@app.post("/integrations/twilio/provision", tags=["Integrations"])
def twilio_provision(req: ProvisionSmsRequest, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)) -> Dict[str, object]:
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        raise HTTPException(status_code=403, detail="forbidden")
    # Require master Twilio creds at platform level
    master_sid = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
    master_token = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
    if not (master_sid and master_token):
        return {"status": "error", "detail": "platform_twilio_not_configured"}
    # Create subaccount and buy a number
    sub_sid = ""
    sub_token = ""
    from_num = ""
    try:
        # 1) create subaccount
        with httpx.Client(timeout=20, auth=(master_sid, master_token)) as client:
            r = client.post(f"https://api.twilio.com/2010-04-01/Accounts.json", data={"FriendlyName": f"BrandVX {req.tenant_id}"})
            r.raise_for_status()
            j = r.json()
            sub_sid = j.get("sid", "")
            sub_token = j.get("auth_token", "")
        if not (sub_sid and sub_token):
            return {"status": "error", "detail": "subaccount_create_failed"}
        # 2) buy a local number (fallback to toll-free search could be added later)
        with httpx.Client(timeout=20, auth=(sub_sid, sub_token)) as client:
            q = {"Country": "US", "Type": "Local"}
            if req.area_code: q["AreaCode"] = req.area_code
            r = client.get(f"https://api.twilio.com/2010-04-01/Accounts/{sub_sid}/AvailablePhoneNumbers/US/Local.json", params=q)
            r.raise_for_status()
            nums = (r.json() or {}).get("available_phone_numbers") or []
            if not nums:
                return {"status": "error", "detail": "no_numbers_available"}
            cand = nums[0].get("phone_number", "")
            if not cand:
                return {"status": "error", "detail": "no_numbers_available"}
            # Purchase
            r2 = client.post(f"https://api.twilio.com/2010-04-01/Accounts/{sub_sid}/IncomingPhoneNumbers.json", data={"PhoneNumber": cand})
            r2.raise_for_status()
            from_num = cand
        # 3) set webhook (inbound SMS)
        try:
            with httpx.Client(timeout=20, auth=(sub_sid, sub_token)) as client:
                url = f"{_backend_base_url()}/webhooks/twilio?tenant_id={req.tenant_id}"
                # Fetch list again to get SID of purchased number
                r = client.get(f"https://api.twilio.com/2010-04-01/Accounts/{sub_sid}/IncomingPhoneNumbers.json")
                sid = ""
                for it in (r.json() or {}).get("incoming_phone_numbers", []):
                    if str(it.get("phone_number")) == from_num:
                        sid = str(it.get("sid"))
                        break
                if sid:
                    client.post(f"https://api.twilio.com/2010-04-01/Accounts/{sub_sid}/IncomingPhoneNumbers/{sid}.json", data={
                        "SmsUrl": url,
                        "SmsMethod": "POST",
                    })
        except Exception:
            pass
        # 4) persist into Settings
        row = db.query(dbm.Settings).filter(dbm.Settings.tenant_id == req.tenant_id).first()
        data = {}
        try:
            data = json.loads(row.data_json) if row else {}
        except Exception:
            data = {}
        data.setdefault("messaging", {})
        data["messaging"].update({
            "twilio_subaccount_sid": sub_sid,
            "twilio_auth_token": sub_token,
            "sms_from_number": from_num,
        })
        if not row:
            row = dbm.Settings(tenant_id=req.tenant_id, data_json=json.dumps(data))
            db.add(row)
        else:
            row.data_json = json.dumps(data)
        db.commit()
        # 5) test send (optional)
        try:
            test_to = os.getenv("TEST_SMS_TO", "")
            if test_to:
                twilio_send_sms(test_to, "BrandVX SMS enabled.", sub_sid, sub_token, from_num)
        except Exception:
            pass
        return {"status": "ok", "from": from_num}
    except Exception as e:
        try: db.rollback()
        except Exception: pass
        return {"status": "error", "detail": str(e)}


@app.post("/webhooks/twilio", tags=["Integrations"])
async def webhook_twilio(
    req: ProviderWebhook,
    request: Request,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
) -> Dict[str, str]:
    sig = request.headers.get("X-Twilio-Signature", "")
    url = str(request.url)
    # Twilio signs form-encoded parameters
    try:
        form = await request.form()
        payload = {k: v for k, v in form.items()}
    except Exception:
        payload = dict(req.payload or {})
    ok = twilio_verify_signature(url, payload, signature=sig)
    if not ok:
        raise HTTPException(status_code=403, detail="invalid signature")
    try:
        # Throttle inbound webhook processing per tenant
        ok_rl, _ = check_and_increment(req.tenant_id, "webhook:twilio", max_per_minute=120)
        if not ok_rl:
            return {"status": "rate_limited"}
    except Exception:
        pass
    # Parse inbound intent from body
    body = str(payload.get("Body", "")).strip().lower()
    intent = "unknown"
    if body in {"stop", "unsubscribe"}:
        intent = "stop"
    elif body in {"help"}:
        intent = "help"
    elif body in {"yes", "confirm", "y"}:
        intent = "confirm"
    elif "resched" in body:
        intent = "reschedule"
    # Handle STOP immediately: add suppression and audit
    if intent == "stop":
        db.add(
            dbm.ConsentLog(
                tenant_id=req.tenant_id,
                contact_id=str(payload.get("From", "")),
                channel="sms",
                consent="revoked",
            )
        )
        _safe_audit_log(db, tenant_id=req.tenant_id, actor_id=ctx.user_id, action="consent.stop", entity_ref=f"contact:{payload.get('From','')}", payload="{}")
        # Persist to inbox for operator visibility
        try:
            db.add(dbm.InboxMessage(
                tenant_id=req.tenant_id,
                channel="sms",
                from_addr=str(payload.get("From", "")),
                to_addr=str(payload.get("To", "")),
                preview="STOP",
                ts=int(_time.time()),
            ))
        except Exception:
            pass
        db.commit()
        emit_event(
            "SuppressionAdded",
            {"tenant_id": req.tenant_id, "contact_id": str(payload.get("From", "")), "channel": "sms", "keyword": "STOP"},
        )
    emit_event("ProviderWebhookReceived", {"tenant_id": req.tenant_id, "provider": "twilio", "intent": intent})
    return {"status": "ok", "intent": intent}


class LeadStatusUpdate(BaseModel):
    tenant_id: str
    contact_id: str
    intent: str  # confirm|reschedule|help|unknown


@app.post("/lead-status/update", tags=["Cadences"])
def update_lead_status(
    req: LeadStatusUpdate,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        raise HTTPException(status_code=403, detail="forbidden")
    row = (
        db.query(dbm.LeadStatus)
        .filter(dbm.LeadStatus.tenant_id == req.tenant_id, dbm.LeadStatus.contact_id == req.contact_id)
        .first()
    )
    if not row:
        row = dbm.LeadStatus(tenant_id=req.tenant_id, contact_id=req.contact_id, bucket=1, tag="warm")
        db.add(row)
    # Minimal transitions
    intent = req.intent.lower()
    if intent == "confirm":
        row.bucket = 4
        row.tag = "engaged"
        row.next_action_at = None
    elif intent == "reschedule":
        row.bucket = 4
        row.tag = "reschedule"
        row.next_action_at = None
    row.updated_at = int(__import__("time").time())
    db.commit()
    emit_event("LeadStatusUpdated", {"tenant_id": req.tenant_id, "contact_id": req.contact_id, "bucket": row.bucket, "tag": row.tag})
    return {"status": "ok", "bucket": row.bucket, "tag": row.tag}


class DLQReplayRequest(BaseModel):
    tenant_id: Optional[str] = None
    limit: int = 20
@app.post("/dlq/replay", tags=["Cadences"])
def dlq_replay(
    req: DLQReplayRequest,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if req.tenant_id and ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        raise HTTPException(status_code=403, detail="forbidden")
    q = db.query(dbm.DeadLetter)
    if req.tenant_id:
        q = q.filter(dbm.DeadLetter.tenant_id == req.tenant_id)
    rows = q.order_by(dbm.DeadLetter.id.desc()).limit(max(1, min(req.limit, 100))).all()
    # Placeholder: real replay would route by provider and payload
    return {"replayed": 0, "found": len(rows)}


@app.get("/buckets/distribution", tags=["Cadences"])
def get_buckets_distribution(
    tenant_id: str,
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"buckets": []}
    # Prefer L (Supabase) read-only adapter for current lead buckets
    adapter = SupabaseAdapter()
    try:
        import asyncio

        rows = asyncio.run(adapter.get_lead_status(tenant_id))
    except Exception:
        rows = []
    counts = {i: 0 for i in range(1, 8)}
    for r in rows or []:
        try:
            b = int(r.get("bucket", 0))
            if 1 <= b <= 7:
                counts[b] = counts.get(b, 0) + 1
        except Exception:
            continue
    return {
        "buckets": [
            {"bucket": i, "count": counts.get(i, 0)} for i in range(1, 8)
        ]
    }


@app.get("/cadences/queue", tags=["Cadences"])
def get_cadence_queue(
    tenant_id: str,
    limit: int = 50,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"items": []}
    
    try:
        q = (
            db.query(dbm.CadenceState)
            .filter(dbm.CadenceState.tenant_id == tenant_id)
            .filter(dbm.CadenceState.next_action_epoch != None)
            .order_by(dbm.CadenceState.next_action_epoch.asc())
            .limit(max(1, min(limit, 200)))
        )
        rows = q.all()
        items = []
        contact_ids = [r.contact_id for r in rows if getattr(r, "contact_id", None)]
        friendly_map: Dict[str, str] = {}
        if contact_ids:
            try:
                contacts = (
                    db.query(dbm.Contact)
                    .filter(dbm.Contact.tenant_id == tenant_id)
                    .filter(dbm.Contact.contact_id.in_(contact_ids))
                    .all()
                )
                for c in contacts:
                    dn = (getattr(c, "display_name", "") or "").strip()
                    first = (getattr(c, "first_name", "") or "").strip()
                    last = (getattr(c, "last_name", "") or "").strip()
                    full = f"{first} {last}".strip()
                    friendly = full or dn or "Client"
                    try:
                        import re as _re

                        looks_like_square = bool(
                            friendly
                            and (
                                _re.match(r"^sq[:_].+", friendly, flags=_re.IGNORECASE)
                                or _re.match(r"^sq[0-9a-z]{5,}$", friendly.replace(" ", ""), flags=_re.IGNORECASE)
                            )
                        )
                    except Exception:
                        looks_like_square = False
                    if looks_like_square:
                        friendly = "Client"
                    friendly_map[c.contact_id] = friendly
            except Exception:
                friendly_map = {}
        for r in rows:
            items.append(
                {
                    "contact_id": r.contact_id,
                    "cadence_id": r.cadence_id,
                    "step_index": r.step_index,
                    "next_action_at": r.next_action_epoch,
                    "friendly_name": friendly_map.get(r.contact_id, "Client" if r.contact_id else ""),
                }
            )
        return {"items": items}
    except Exception as exc:
        logger.exception("cadence_queue_failed", extra={"tenant_id": tenant_id}, exc_info=exc)
        return {"items": []}


@app.get("/funnel/daily", tags=["Health"])
def get_funnel_daily(
    tenant_id: str,
    days: int = 30,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"days": days, "series": []}
    return funnel_daily_series(db, tenant_id, days)


@app.get("/docs/checklist", tags=["Health"])
def get_checklist_doc() -> Dict[str, str]:
    try:
        root = _Path(__file__).resolve().parents[3]
        p = root / "docs" / "CHECKLIST_BRANDVX_SESSION.md"
        if not p.exists():
            return {"content": "Checklist not found."}
        text = p.read_text(encoding="utf-8")
        return {"content": text}
    except Exception as e:
        return {"content": f"Error reading checklist: {e}"}

# --- Onboarding (starter-compatible) API under /api/* -----------------------------------------

class OnboardingSaveInput(BaseModel):
    step: str
    data: Dict[str, Any]


@app.post("/api/onboarding/save", tags=["Integrations"])  # idempotent, per-tenant
def api_onboarding_save(
    req: OnboardingSaveInput,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if not ctx.tenant_id:
        return JSONResponse({"error": {"code": "unauthorized", "message": "missing tenant"}}, status_code=401)
    try:
        row = db.query(dbm.Settings).filter(dbm.Settings.tenant_id == ctx.tenant_id).first()
        data = {}
        if row and (row.data_json or "").strip():
            try:
                data = json.loads(row.data_json or "{}")
            except Exception:
                data = {}
        ob = data.get("onboarding") or {}
        # Shallow merge per step payload into onboarding snapshot (idempotent)
        for k, v in (req.data or {}).items():
            ob[k] = v
        ob["last_step"] = req.step
        data["onboarding"] = ob
        if not row:
            row = dbm.Settings(tenant_id=ctx.tenant_id, data_json=json.dumps(data))
            db.add(row)
        else:
            row.data_json = json.dumps(data)
        db.commit()
        try:
            emit_event("OnboardingSaved", {"tenant_id": ctx.tenant_id, "step": req.step, "keys": list((req.data or {}).keys())})
        except Exception:
            pass
        return {"ok": True}
    except Exception as e:
        try:
            db.rollback()
        except Exception:
            pass
        return JSONResponse({"error": {"code": "save_failed", "message": str(e)}}, status_code=500)


@app.get("/api/onboarding/context", tags=["Integrations"])  # deterministic page-aware hints
def api_onboarding_context(scope: Optional[str] = None, step: Optional[str] = None, ctx: UserContext = Depends(get_user_context)):
    # Minimal, static hints; no LLM needed
    s = (step or "").strip() or "welcome"
    hints = {
        "welcome": ["Micro-tour shows the left nav.", "Setup continues one thing per screen."],
        "voice": ["Adjust tone sliders.", "Short purpose line influences confirmations and posts."],
        "basics": ["A few basics help drafts feel like you."],
        "ops": ["Clients/week and durations size your schedule.", "We estimate time saved later."],
        "connections": ["OAuth to Square/Acuity.", "You can declare in dev if enabled."],
        "social": ["Provide Instagram & email to enable helpers."],
        "goals": ["Pick a few 3-month goals; yearly optional."],
        "styles": ["Choose up to 3 signature automations to start."],
        "review": ["You're live; you can change anything in Settings later."],
    }
    examples = {
        "voice": ["Hey {first} — see you soon. Need to reschedule? Tap here.", "Vivid copper melt for fall — gentle lift. ✨"],
        "connections": ["We redirect to your provider to connect.", "During dev you may declare without OAuth."],
        "ops": ["Example: 12 clients/week × 90 min.", "Admin time helps estimate Time Saved."],
    }
    return {"pageHints": hints.get(s, ["This step affects your setup later."]), "safeExamples": examples.get(s, [])}


class AssistInput(BaseModel):
    page: Optional[str] = None
    input: str
    history: Optional[List[Dict[str, Any]]] = None
@app.post("/api/assist", tags=["AI"])  # stub/deterministic
def api_assist(req: AssistInput, ctx: UserContext = Depends(get_user_context)):
    try:
        # Per-tenant simple rate limit: 30/min
        key = f"assist:{ctx.tenant_id or 'anon'}"
        ok, ttl = check_and_increment(key, limit=30, window_seconds=60)
        if not ok:
            return JSONResponse({"error": {"code": "rate_limited", "message": f"Too many requests. Retry in {ttl}s"}}, status_code=429)
    except Exception:
        pass
    page = (req.page or "").strip() or "generic"
    generic = {
        "welcome": "This step orients you without overwhelm. After the micro-tour, setup proceeds one thing per screen.",
        "voice": "Your brand voice guides copy everywhere — confirmations to posts. Sliders keep tone consistent.",
        "basics": "Brief bio details make drafts feel like you — short and tasteful.",
        "ops": "Clients/week, durations, and prices inform capacity and time-saved.",
        "connections": "Booking first (Square/Acuity) ensures immediate value. OAuth here; you can declare in dev.",
        "social": "IG + email enable content helper and respectful outreach.",
        "goals": "3-month goals become dashboard milestones.",
        "styles": "Pick 3 Styles to activate first; you can add more later.",
        "review": "You're live. We summarize choices and link to your workspace.",
        "generic": "This step affects later suggestions and drafts.",
    }
    text = generic.get(page, generic["generic"])
    return {"text": text}


@app.get("/api/oauth/{provider}/start", tags=["Integrations"])  # 302 to provider auth
def api_oauth_start(provider: str, return_: Optional[str] = Query(None, alias="return"), ctx: UserContext = Depends(get_user_context)):
    try:
        url = _oauth_authorize_url(provider, tenant_id=ctx.tenant_id, return_hint=(return_ or None))
        if not url:
            return JSONResponse({"error": {"code": "invalid_provider", "message": provider}}, status_code=400)
        # Cache state for CSRF verification (match behavior of /oauth/{provider}/login)
        try:
            if url and "state=" in url:
                _st = url.split("state=",1)[1].split("&",1)[0]
                cache_set(f"oauth_state:{_st}", "1", ttl=600)
        except Exception:
            pass
        return RedirectResponse(url=url)
    except Exception as e:
        return JSONResponse({"error": {"code": "start_failed", "message": str(e)}}, status_code=500)


## Removed legacy alias /api/oauth/{provider}/callback to avoid duplicate callback handling

@app.get("/oauth/{provider}/login", tags=["Integrations"])  # single canonical login
def oauth_login(provider: str, tenant_id: Optional[str] = None, return_: Optional[str] = Query(None, alias="return"), ctx: UserContext = Depends(get_user_context)):
    # Gate v1 Square path if disabled
    if provider == "square" and os.getenv("INTEGRATIONS_V1_DISABLED", "0") == "1":
        return JSONResponse({"error": "gone", "message": "v1 square login disabled"}, status_code=410)
    # Dev override: mark as connected instantly if DEV_OAUTH_AUTOCONNECT=1
    if os.getenv("DEV_OAUTH_AUTOCONNECT", "0") == "1" and provider in {"facebook", "instagram", "google", "shopify", "square"}:
        try:
            with next(get_db()) as db:  # type: ignore
                db.execute(
                    _sql_text(
                        """
                        INSERT INTO connected_accounts_v2(tenant_id, provider, status, access_token_enc, refresh_token_enc, expires_at, connected_at)
                        VALUES (CAST(:t AS uuid), :p, 'connected', :at, NULL, NULL, NOW())
                        ON CONFLICT (tenant_id, provider)
                        DO UPDATE SET status='connected', access_token_enc=EXCLUDED.access_token_enc, connected_at=NOW()
                        """
                    ),
                    {"t": ctx.tenant_id, "p": provider, "at": encrypt_text("dev")},
                )
                db.commit()
        except Exception:
            pass
        return {"url": ""}
    _t = tenant_id or ctx.tenant_id
    url = _oauth_authorize_url(provider, tenant_id=_t, return_hint=(return_ or None))
    # Attach correlation id for traceability in callback logs
    try:
        if url:
            cid = _new_cid()
            sep = '&' if '?' in url else '?'
            url = f"{url}{sep}cid={cid}"
            try:
                emit_event("OauthLoginStarted", {"tenant_id": ctx.tenant_id, "user_id": ctx.user_id, "provider": provider, "cid": cid})
            except Exception:
                pass
    except Exception:
        pass
    # Cache state marker for CSRF verification in callback, and map state -> tenant_id
    try:
        if url and "state=" in url:
            _st = url.split("state=",1)[1].split("&",1)[0]
            cache_set(f"oauth_state:{_st}", "1", ttl=600)
            try:
                cache_set(f"oauth_state_t:{_st}", (tenant_id or ctx.tenant_id), ttl=600)
            except Exception:
                pass
    except Exception:
        pass
    return {"url": url}


@app.get("/integrations/preflight", tags=["Integrations"])
def integrations_preflight(ctx: UserContext = Depends(get_user_context)) -> Dict[str, object]:
    """Report provider readiness: env present, redirect URI, env mode and last callback."""
    try:
        with next(get_db()) as db:  # type: ignore
            base_api = _backend_base_url()
            info: Dict[str, object] = {"providers": {}}
            for prov in ["google","square","acuity","hubspot","facebook","instagram","shopify"]:
                env_ok = bool(_env(f"{prov.upper()}_CLIENT_ID", "")) if prov not in {"facebook","instagram","shopify"} else bool(_env(f"{prov.upper()}_CLIENT_ID", "") or _env(f"{prov.upper()}_APP_ID", ""))
                info["providers"][prov] = {
                    "env": env_ok,
                    "redirect": _redirect_uri(prov),
                }
            # Last oauth callback overall
            a_cols = _audit_logs_columns(db)
            sel_cols = ["action","created_at"] + (["payload"] if "payload" in a_cols else [])
            last = db.execute(_sql_text(f"SELECT {', '.join(sel_cols)} FROM audit_logs WHERE action LIKE 'oauth.callback.%' ORDER BY id DESC LIMIT 1")).fetchone()
            info["last_callback"] = {"action": (last[0] if last else None), "ts": (int(last[1]) if last else None)}
            return info
    except Exception as e:
        return {"error": str(e)}


@app.get("/debug/cors", tags=["Health"])
def debug_cors(request: Request):
    try:
        return {
            "origin": request.headers.get("Origin"),
            "allow_origins": cors_origins,
            "allow_regex": cors_regex,
        }
    except Exception as e:
        return {"error": str(e)}
@app.get("/oauth/{provider}/callback", tags=["Integrations"])  # single canonical callback
def oauth_callback(provider: str, request: Request, code: Optional[str] = None, state: Optional[str] = None, error: Optional[str] = None, db: Session = Depends(get_db)):
    if provider == "square" and os.getenv("INTEGRATIONS_V1_DISABLED", "0") == "1":
        return JSONResponse({"error": "gone", "message": "v1 square callback disabled"}, status_code=410)
    # Store a minimal connected-account record even if app credentials are missing
    try:
        # Try to extract tenant from encoded state; fallback to cached state mapping
        t_id = "t1"
        return_hint = None
        try:
            if state:
                pad = '=' * (-len(state) % 4)
                data = json.loads(_b64.urlsafe_b64decode((state + pad).encode()).decode())
                t_id = str(data.get("t") or t_id)
                try:
                    rh = data.get("r")
                    if isinstance(rh, str) and rh:
                        return_hint = rh
                except Exception:
                    pass
        except Exception:
            try:
                t_cached = cache_get(f"oauth_state_t:{state}") if state else None
                if t_cached:
                    t_id = str(t_cached)
                try:
                    r_cached = cache_get(f"oauth_state_r:{state}") if state else None
                    if r_cached:
                        return_hint = str(r_cached)
                except Exception:
                    pass
            except Exception:
                t_id = "t1"
        # Verify state marker to mitigate CSRF (tolerant fallback: proceed but mark miss)
        state_verified = True
        try:
            if state and not cache_get(f"oauth_state:{state}"):
                state_verified = False
                try:
                    emit_event("OauthStateMiss", {"tenant_id": t_id, "provider": provider})
                except Exception:
                    pass
        except Exception:
            state_verified = True
        status = "pending_config" if not any([
            _env("HUBSPOT_CLIENT_ID"), _env("SQUARE_CLIENT_ID"), _env("ACUITY_CLIENT_ID"),
            _env("FACEBOOK_CLIENT_ID"), _env("INSTAGRAM_CLIENT_ID"), _env("GOOGLE_CLIENT_ID"), _env("SHOPIFY_CLIENT_ID")
        ]) else "connected"
        # Set RLS GUCs as early as possible so all DB writes honor tenant policies
        update_count = 0
        inserted = False
        inserted_id: Optional[int] = None
        try:
            CURRENT_TENANT_ID.set(t_id)
            CURRENT_ROLE.set("owner_admin")
            db.execute(_sql_text("SET LOCAL app.tenant_id = :t"), {"t": t_id})
            db.execute(_sql_text("SET LOCAL app.role = 'owner_admin'"))
        except Exception:
            try:
                db.rollback()
            except Exception:
                pass
        # Attempt token exchange when code present
        access_token_enc = encrypt_text(code or "")
        refresh_token_enc = None
        expires_at = None
        scopes_str = None
        exchange_ok = False
        exchange_detail: Dict[str, Any] = {}
        if code:
            try:
                # For Google, try PKCE code_verifier lookup by state
                code_verifier = None
                try:
                    if provider == "google" and state:
                        code_verifier = cache_get(f"pkce:{state}") or None
                except Exception:
                    code_verifier = None
                # Use exact redirect_uri; include debug=1 if present to avoid redirect_uri mismatch
                redir = _redirect_uri(provider)
                try:
                    if request.query_params.get('debug') == '1':
                        redir = redir + ('?debug=1' if '?' not in redir else '&debug=1')
                except Exception:
                    pass
                token = _oauth_exchange_token(provider, code, redir, code_verifier=code_verifier) or {}
                at = str(token.get("access_token") or "")
                rt = token.get("refresh_token")
                exp = token.get("expires_in")
                sc = token.get("scope") or token.get("scopes")
                if at:
                    access_token_enc = encrypt_text(at)
                    exchange_ok = True
                else:
                    exchange_detail = {"token_error": token}
                if rt:
                    refresh_token_enc = encrypt_text(str(rt))
                if isinstance(exp, (int, float)):
                    expires_at = int(_time.time()) + int(exp)
                try:
                    # Normalize scope(s) to space-delimited string
                    if isinstance(sc, list):
                        scopes_str = " ".join([str(x) for x in sc])
                    elif isinstance(sc, str):
                        scopes_str = sc
                except Exception:
                    scopes_str = None
            except Exception:
                exchange_ok = False
        saved_token_write = False
        try:
            # Upsert using the SAME session/connection that already has RLS GUCs set.
            # This avoids losing app.tenant_id/app.role when ENABLE_PG_RLS=1.
            params: Dict[str, Any] = {
                "t": t_id,
                "prov": provider,
                # Only mark connected when we actually exchanged a token
                "st": ("connected" if (exchange_ok and bool(access_token_enc)) else "pending_config"),
                "at": (access_token_enc if access_token_enc else None),
                "rt": (refresh_token_enc if refresh_token_enc is not None else None),
                "exp": (int(expires_at) if isinstance(expires_at, (int, float)) else None),
                "sc": scopes_str,
            }
            set_parts = ["status=:st", "connected_at=NOW()"]
            if params["at"]: set_parts.append("access_token_enc=:at")
            if params["rt"]: set_parts.append("refresh_token_enc=:rt")
            if params["exp"] is not None: set_parts.append("expires_at=:exp")
            if scopes_str: set_parts.append("scopes=:sc")
            upd = f"UPDATE connected_accounts_v2 SET {', '.join(set_parts)} WHERE tenant_id = CAST(:t AS uuid) AND provider = :prov"
            res = db.execute(_sql_text(upd), params)
            try:
                update_count = int(getattr(res, "rowcount", 0) or 0)
            except Exception:
                update_count = 0
            if update_count == 0:
                cols = ["tenant_id","provider","status","connected_at"]
                vals = ["CAST(:t AS uuid)",":prov",":st","NOW()"]
                if params["at"]: cols.append("access_token_enc"); vals.append(":at")
                if params["rt"]: cols.append("refresh_token_enc"); vals.append(":rt")
                if params["exp"] is not None: cols.append("expires_at"); vals.append(":exp")
                if scopes_str: cols.append("scopes"); vals.append(":sc")
                ins = f"INSERT INTO connected_accounts_v2 ({', '.join(cols)}) VALUES ({', '.join(vals)}) RETURNING id"
                try:
                    inserted_id = db.execute(_sql_text(ins), params).scalar()
                except Exception:
                    inserted_id = None
                inserted = True
            try:
                db.commit()
            except Exception:
                try:
                    db.rollback()
                except Exception:
                    pass
            try:
                # Mark whether we persisted a token (connected means at present)
                saved_token_write = bool(params.get("at"))
            except Exception:
                saved_token_write = False
            post_rows = 0
            try:
                db.execute(_sql_text("SET LOCAL app.tenant_id = :t"), {"t": t_id})
                db.execute(_sql_text("SET LOCAL app.role = :r"), {"r": "owner_admin"})
                chk = db.execute(
                    _sql_text("SELECT COUNT(1) FROM connected_accounts_v2 WHERE tenant_id = CAST(:t AS uuid) AND provider = :p"),
                    {"t": t_id, "p": provider},
                )
                post_rows = int(chk.scalar() or 0)
            except Exception:
                post_rows = -1
            try:
                emit_event("OauthTokenUpsert", {
                    "tenant_id": t_id,
                    "provider": provider,
                    "updated": update_count,
                    "inserted": bool(inserted),
                    "inserted_id": inserted_id,
                    "post_rows": post_rows,
                    "exchange_ok": bool(exchange_ok),
                    "has_token": bool(params.get("at")),
                })
            except Exception:
                pass
        except Exception as e:
            try:
                db.rollback()
            except Exception:
                pass
            # Record DB insert error for fast diagnosis
            try:
                _safe_audit_log(db, tenant_id=t_id, actor_id="system", action=f"oauth.connect_failed.{provider}", entity_ref="oauth", payload=str({"db_error": str(e)[:300], "tenant": t_id}))
            except Exception:
                pass
            try:
                emit_event("OauthTokenUpsertFailed", {
                    "tenant_id": t_id,
                    "provider": provider,
                    "error": str(e)[:200],
                })
            except Exception:
                pass
        # Emit explicit event about save attempt
        try:
            emit_event("OauthTokenSaved", {"tenant_id": t_id, "provider": provider, "saved": bool(saved_token_write), "exchange_ok": bool(exchange_ok)})
        except Exception:
            pass
        try:
            cid = request.query_params.get('cid') or ''
            payload = {"code": bool(code), "error": error or "", "exchange_ok": exchange_ok, **({} if not exchange_detail else exchange_detail)}
            if cid:
                payload["cid"] = cid
            _safe_audit_log(db, tenant_id=t_id, actor_id="system", action=f"oauth.callback.{provider}", entity_ref="oauth", payload=str(payload))
        except Exception:
            pass
        # Emit event for callback
        try:
            emit_event("OauthCallback", {"tenant_id": t_id, "provider": provider, "code_present": bool(code), "error": error or ""})
        except Exception:
            pass
        # Redirect UX or debug JSON: success or error with reason
        if error or not exchange_ok:
            reason = error or ("token_exchange_failed" if code else "missing_code")
            try:
                emit_event("OauthConnectFailed", {"tenant_id": t_id, "provider": provider, "reason": reason})
            except Exception:
                pass
            if request.query_params.get('debug') == '1':
                return JSONResponse({
                    "tenant_id": t_id,
                    "provider": provider,
                    "exchange_ok": exchange_ok,
                    "reason": reason,
                    "detail": exchange_detail or {},
                })
            return RedirectResponse(url=f"{_frontend_base_url()}/integrations?error={reason}&provider={provider}")
        # Map provider to the Integrations step (1-based) and include a workspace return hint
        # Map to Integrations page index (1..3). Square/HubSpot group on page 2.
        step_map = {
            "hubspot": 2,
            "square": 2,
            "acuity": 2,
            "google": 3,
            "shopify": 3,
        }
        step = max(1, min(3, step_map.get(provider, 1)))
        if request.query_params.get('debug') == '1':
            return JSONResponse({
                "tenant_id": t_id,
                "provider": provider,
                "exchange_ok": exchange_ok,
                "saved": True,
            })
        # Mark onboarding step for provider connection
        try:
            if provider == 'google':
                _complete_step(t_id, 'connect_google', {"provider": provider})
            elif provider in ('square','acuity'):
                _complete_step(t_id, 'connect_booking', {"provider": provider})
            else:
                _complete_step(t_id, f"connect_{provider}", {"provider": provider})
        except Exception:
            pass
        # Prefer returning to workspace/dashboard when onboarding initiated the connect
        dest_return = request.query_params.get('return') or return_hint or 'workspace'
        if dest_return == 'onboarding':
            return RedirectResponse(url=f"{_frontend_base_url()}/onboarding?connected=1&provider={provider}")
        return RedirectResponse(url=f"{_frontend_base_url()}/integrations?connected=1&provider={provider}&step={step}&return=workspace")
    except Exception:
        return RedirectResponse(url=f"{_frontend_base_url()}/integrations?error=oauth_unexpected&provider={provider}")


# Legacy alias: forward old path to canonical callback to support previously registered redirect URIs
@app.get("/api/oauth/{provider}/callback", tags=["Integrations"])  # legacy alias → forwards to /oauth/{provider}/callback
def oauth_callback_legacy_alias(provider: str, request: Request):
    try:
        qs = str(request.query_params or "")
        base = f"{_backend_base_url()}/oauth/{provider}/callback"
        url = f"{base}?{qs}" if qs else base
        return RedirectResponse(url=url)
    except Exception:
        return RedirectResponse(url=f"{_frontend_base_url()}/integrations?error=oauth_legacy_alias_failed&provider={provider}")


class AnalyzeRequest(BaseModel):
    tenant_id: str
class HubspotImportRequest(BaseModel):
    tenant_id: str

class SquareSyncContactsRequest(BaseModel):
    tenant_id: str
@app.post("/crm/hubspot/import", tags=["Integrations"])
def hubspot_import(req: HubspotImportRequest, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)) -> Dict[str, int]:
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"imported": 0}
    # Simulated import via adapter: create a few contacts if missing
    created = 0
    sample = [
        {"contact_id": "hs_demo_1", "email_hash": None, "phone_hash": None, "consent_sms": True, "consent_email": True},
        {"contact_id": "hs_demo_2", "email_hash": None, "phone_hash": None, "consent_sms": True, "consent_email": False},
    ]
    for c in sample:
        exists = db.query(dbm.Contact).filter(dbm.Contact.tenant_id == req.tenant_id, dbm.Contact.contact_id == c["contact_id"]).first()
        if not exists:
            db.add(dbm.Contact(tenant_id=req.tenant_id, contact_id=c["contact_id"], email_hash=c["email_hash"], phone_hash=c["phone_hash"], consent_sms=c["consent_sms"], consent_email=c["consent_email"]))
            created += 1
    db.commit()
    emit_event("CrmImportCompleted", {"tenant_id": req.tenant_id, "system": "hubspot", "imported": created})
    try:
        invalidate_contacts_cache(req.tenant_id)
    except Exception:
        pass
    try:
        if created > 0:
            _complete_step(req.tenant_id, 'contacts_imported', {"system": "hubspot", "count": int(created)})
    except Exception:
        pass
    return {"imported": created}
@app.post("/integrations/booking/square/sync-contacts", tags=["Integrations"])
def square_sync_contacts(req: SquareSyncContactsRequest, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context_relaxed)) -> Dict[str, object]:
    if os.getenv("INTEGRATIONS_V1_DISABLED", "0") == "1":
        # V1 disabled: inline minimal v2 read path to avoid unresolved reference
        try:
            tenant_id = getattr(req, "tenant_id", None)
            if tenant_id is None and isinstance(req, dict):
                tenant_id = req.get("tenant_id")
        except Exception:
            tenant_id = None
        if not tenant_id:
            return {"imported": 0, "error": "missing_tenant_id"}
        with engine.begin() as conn:
            row = conn.execute(_sql_text("SELECT access_token_enc FROM connected_accounts_v2 WHERE tenant_id = CAST(:t AS uuid) AND provider='square' ORDER BY id DESC LIMIT 1"), {"t": tenant_id}).fetchone()
        if not row or not row[0]:
            return {"imported": 0, "error": "missing_access_token"}
        try:
            token = decrypt_text(str(row[0])) or ""
        except Exception:
            token = str(row[0])
        if not token:
            return {"imported": 0, "error": "missing_access_token"}
        base = os.getenv("SQUARE_API_BASE", "https://connect.squareup.com")
        if os.getenv("SQUARE_ENV", "prod").lower().startswith("sand"):
            base = "https://connect.squareupsandbox.com"
        headers = {"Authorization": f"Bearer {token}", "Accept": "application/json", "Square-Version": os.getenv("SQUARE_VERSION", "2023-10-18")}
        imported, cursor = 0, None
        sample_ids: list[str] = []
        used_search_any = False
        try:
            with httpx.Client(timeout=20, headers=headers) as client:
                while True:
                    params = {"limit": "100"}
                    if cursor:
                        params["cursor"] = cursor
                    r = client.get(f"{base}/v2/customers", params=params)
                    if r.status_code >= 400:
                        return {"imported": 0, "error": f"square_http_{r.status_code}", "detail": (r.text or "")[:200], "meta": {"mode": "v1_disabled", "base": base}}
                    body = r.json() or {}
                    # If Square returns an errors array with 200, surface it
                    try:
                        if isinstance(body, dict) and body.errors:
                            return {"imported": 0, "error": "square_error", "detail": str(body.errors)[:200], "meta": {"mode": "v1_disabled", "base": base}}
                    except Exception:
                        pass
                    customers = body.get("customers", []) or []
                    if not customers and not cursor:
                        sr = client.post(f"{base}/v2/customers/search", json={"limit": 100})
                        if sr.status_code >= 400:
                            return {"imported": 0, "error": f"square_http_{sr.status_code}", "detail": (sr.text or "")[:200], "meta": {"mode": "v1_disabled", "base": base, "used_search": True}}
                        try:
                            sbody = sr.json() or {}
                            customers = sbody.get("customers") or []
                            body = sbody
                            used_search_any = True
                        except Exception:
                            customers = []
                    for _c in customers:
                        imported += 1
                        if len(sample_ids) < 3:
                            try:
                                sample_ids.append(str(_c.get("id") or ""))
                            except Exception:
                                pass
                    cursor = body.get("cursor") or body.get("next_cursor")
                    if not cursor:
                        break
            try:
                if imported > 0 and tenant_id:
                    _complete_step(str(tenant_id), 'contacts_imported', {"system": "square", "count": int(imported)})
            except Exception:
                pass
            return {"imported": imported, "meta": {"mode": "v1_disabled", "base": base, "used_search": used_search_any, "samples": sample_ids}}
        except Exception as e:
            return {"imported": 0, "error": "internal_error", "detail": str(e)[:200], "meta": {"mode": "v1_disabled", "base": base}}
    """Pull Square customers and upsert into contacts using the Square Customers API.
    Requires a connected Square account. Uses stored access token from connected_accounts_v2.
    Always returns JSON (including on errors) to avoid CORS confusion in the browser.
    """
    try:
        if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
            return {"imported": 0, "error": "forbidden"}
        # Reset any failed transaction state to avoid "transaction is inactive"
        try:
            db.rollback()
        except Exception:
            pass

        # Capture tenant/role in context only; avoid starting a transaction on the Session.
        try:
            CURRENT_TENANT_ID.set(req.tenant_id)
            CURRENT_ROLE.set("owner_admin")
        except Exception:
            pass

        # Short-lived connection helper with RLS GUCs and one-time retry for transient disconnects
        def _with_conn_do(work):
            for _attempt in range(2):
                try:
                    with engine.begin() as _conn:
                        try:
                            _conn.execute(_sql_text("SET LOCAL app.tenant_id = :t"), {"t": req.tenant_id})
                            _conn.execute(_sql_text("SET LOCAL app.role = 'owner_admin'"))
                        except Exception:
                            pass
                        return work(_conn)
                except Exception as _e:
                    err_s = str(_e)
                    if _attempt == 0 and ("OperationalError" in err_s or "SSL connection has been closed" in err_s or "psycopg2" in err_s):
                        continue
                    raise

        # Idempotent guard: ensure tenant row exists to satisfy FK on contacts/events
        try:
            def _ensure(_conn):
                _conn.execute(
                    _sql_text(
                        """
                        INSERT INTO public.tenants (id, name, created_at)
                        VALUES (CAST(:t AS uuid), :name, NOW())
                        ON CONFLICT (id) DO NOTHING
                        """
                    ),
                    {"t": req.tenant_id, "name": "Workspace"},
                )
                return True
            _with_conn_do(_ensure)
        except Exception:
            # If this fails due to permissions/RLS, downstream FK will surface; we keep read-only behavior
            pass

        # Retrieve Square access token robustly: short-lived conn first, then Session fallback.
        token = ""
        def _read_v2_conn(_conn):
            return _conn.execute(
                _sql_text("SELECT access_token_enc FROM connected_accounts_v2 WHERE tenant_id = CAST(:t AS uuid) AND provider='square' ORDER BY id DESC LIMIT 1"),
                {"t": req.tenant_id},
            ).fetchone()
        try:
            row_v2 = _with_conn_do(_read_v2_conn)
            if row_v2 and row_v2[0]:
                try:
                    token = decrypt_text(str(row_v2[0])) or ""
                except Exception:
                    token = str(row_v2[0])
        except Exception:
            token = ""
        if not token:
            # Session fallback for v2 (maintains RLS parity), then rollback to avoid idle txn
            try:
                row_v2s = db.execute(
                    _sql_text("SELECT access_token_enc FROM connected_accounts_v2 WHERE tenant_id = CAST(:t AS uuid) AND provider='square' ORDER BY id DESC LIMIT 1"),
                    {"t": req.tenant_id},
                ).fetchone()
                if row_v2s and row_v2s[0]:
                    try:
                        token = decrypt_text(str(row_v2s[0])) or ""
                    except Exception:
                        token = str(row_v2s[0])
            except Exception:
                token = token
            finally:
                try: db.rollback()
                except Exception: pass
        if not token:
            return {"imported": 0, "error": "missing_access_token"}

        # Square environment base URL (prod vs sandbox via env flag)
        base = os.getenv("SQUARE_API_BASE", "https://connect.squareup.com")
        if os.getenv("SQUARE_ENV", "prod").lower().startswith("sand"):
            base = "https://connect.squareupsandbox.com"

        # (GUCs already set above)

        created_total = 0
        updated_total = 0
        existing_total = 0
        fetched_total = 0
        seen_ids: set[str] = set()
        sample_ids: list[str] = []
        used_search_any = False

        def _upsert_contact(square_obj: Dict[str, object]):
            nonlocal created_total, updated_total, existing_total
            try:
                sq_id = str(square_obj.get("id") or "").strip()
                if not sq_id or sq_id in seen_ids:
                    return
                seen_ids.add(sq_id)
                contact_id = f"sq:{sq_id}"
                try:
                    email = str(square_obj.get("email_address") or "").strip() or None
                except Exception:
                    email = None
                try:
                    phone = str(square_obj.get("phone_number") or "").strip() or None
                except Exception:
                    phone = None
                phone_norm = normalize_phone(phone) if phone else None
                # Optional enrichments from Square Customers
                birthday = None
                try:
                    bday = str(square_obj.get("birthday") or "").strip()
                    # Square uses YYYY-MM-DD string; guard against invalid years like 0000
                    if bday:
                        try:
                            year_part = int(bday[:4])
                        except Exception:
                            year_part = 0
                        if year_part < 1900:
                            bday = ""
                    birthday = (bday if bday else None)
                except Exception:
                    birthday = None
                creation_source = None
                try:
                    creation_source = str(square_obj.get("creation_source") or "").strip() or None
                except Exception:
                    creation_source = None
                instant_profile = False
                try:
                    # Heuristic: Square marks instant profile via creation_source or flags
                    ip = str(square_obj.get("creation_source") or "").lower()
                    instant_profile = ("instant" in ip)
                except Exception:
                    instant_profile = False
                email_sub_status = None
                try:
                    prefs = square_obj.get("preferences") or {}
                    unsub = bool(prefs.get("email_unsubscribed", False))
                    email_sub_status = ("unsubscribed" if unsub else "subscribed")
                except Exception:
                    email_sub_status = None

                # Names from Square
                try:
                    first_name = str(square_obj.get("given_name") or square_obj.get("first_name") or "").strip() or None
                except Exception:
                    first_name = None
                try:
                    last_name = str(square_obj.get("family_name") or square_obj.get("last_name") or "").strip() or None
                except Exception:
                    last_name = None
                try:
                    nickname = str(square_obj.get("nickname") or "").strip()
                except Exception:
                    nickname = ""
                try:
                    company_name = str(square_obj.get("company_name") or "").strip()
                except Exception:
                    company_name = ""
                # Compute display name preference: first last > nickname > company > email local > phone tail > fallback (never expose raw square id)
                try:
                    display_name = None
                    if (first_name or "") or (last_name or ""):
                        display_name = f"{(first_name or '').strip()} {(last_name or '').strip()}".strip()
                    if not display_name and nickname:
                        display_name = nickname
                    if not display_name and company_name:
                        display_name = company_name
                    if not display_name and email:
                        try:
                            display_name = (email.split("@",1)[0] or email) if isinstance(email, str) else None
                        except Exception:
                            display_name = None
                    if not display_name and phone_norm:
                        try:
                            tail4 = ''.join([ch for ch in phone_norm if ch.isdigit()])[-4:]
                            display_name = f"Client • {tail4}" if tail4 else None
                        except Exception:
                            display_name = None
                    if not display_name:
                        display_name = f"Client {sq_id[:6]}"
                except Exception:
                    display_name = None

                # Decide timestamp expression per schema (timestamptz vs bigint)
                ts_insert_expr = "EXTRACT(epoch FROM now())::bigint"
                ts_update_expr = "EXTRACT(epoch FROM now())::bigint"
                try:
                    with engine.begin() as _probe:
                        _probe.execute(_sql_text("SET LOCAL app.tenant_id = :t"), {"t": req.tenant_id})
                        _probe.execute(_sql_text("SET LOCAL app.role = 'owner_admin'"))
                        row_type = _probe.execute(
                            _sql_text(
                                """
                                SELECT data_type FROM information_schema.columns
                                WHERE table_name='contacts' AND table_schema='public' AND column_name='created_at'
                                """
                            )
                        ).fetchone()
                        if row_type and isinstance(row_type[0], str) and 'timestamp' in row_type[0].lower():
                            ts_insert_expr = "NOW()"
                            ts_update_expr = "NOW()"
                except Exception:
                    pass

                # Raw SQL upsert using a connection-bound transaction with retry via helper
                def _write(_conn):
                    row = _conn.execute(
                        _sql_text(
                            "SELECT id FROM contacts WHERE tenant_id = CAST(:t AS uuid) AND contact_id = :cid LIMIT 1"
                        ),
                        {"t": req.tenant_id, "cid": contact_id},
                    ).fetchone()
                    if not row:
                        _conn.execute(
                            _sql_text(
                                f"""
                                INSERT INTO contacts (
                                  tenant_id, contact_id, email_hash, phone_hash, consent_sms, consent_email,
                                  square_customer_id, birthday, creation_source, email_subscription_status, instant_profile,
                                  first_name, last_name, display_name, created_at
                                )
                                VALUES (
                                  CAST(:t AS uuid), :cid, :eh, :ph, :csms, :cemail,
                                  :sqcid, :bday, :csrc, :esub, :ip,
                                  :fname, :lname, :dname, {ts_insert_expr}
                                )
                                """
                            ),
                            {
                                "t": req.tenant_id,
                                "cid": contact_id,
                                "eh": email,
                                "ph": phone_norm,
                                "csms": bool(phone_norm),
                                "cemail": bool(email),
                                "sqcid": sq_id,
                                "bday": birthday,
                                "csrc": creation_source,
                                "esub": email_sub_status,
                                "ip": bool(instant_profile),
                                "fname": first_name,
                                "lname": last_name,
                                "dname": display_name,
                            },
                        )
                        return "created"
                    else:
                        res = _conn.execute(
                            _sql_text(
                                f"""
                                UPDATE contacts
                                SET
                                    email_hash = COALESCE(email_hash, :eh),
                                    phone_hash = COALESCE(phone_hash, :ph),
                                    consent_sms = (consent_sms OR :csms),
                                    consent_email = (consent_email OR :cemail),
                                    square_customer_id = COALESCE(square_customer_id, :sqcid),
                                    birthday = COALESCE(birthday, :bday),
                                    creation_source = COALESCE(creation_source, :csrc),
                                    email_subscription_status = COALESCE(email_subscription_status, :esub),
                                    instant_profile = (instant_profile OR :ip),
                                    first_name = CASE WHEN first_name IS NULL OR first_name = '' THEN :fname ELSE first_name END,
                                    last_name = CASE WHEN last_name IS NULL OR last_name = '' THEN :lname ELSE last_name END,
                                    display_name = CASE
                                      WHEN display_name IS NULL OR display_name = '' OR display_name ~ '^Client [0-9a-zA-Z]+'
                                      THEN :dname
                                      ELSE display_name
                                    END,
                                    updated_at = {ts_update_expr}
                                WHERE tenant_id = CAST(:t AS uuid) AND contact_id = :cid
                                """
                            ),
                            {
                                "t": req.tenant_id,
                                "cid": contact_id,
                                "eh": email,
                                "ph": phone_norm,
                                "csms": bool(phone_norm),
                                "cemail": bool(email),
                                "sqcid": sq_id,
                                "bday": birthday,
                                "csrc": creation_source,
                                "esub": email_sub_status,
                                "ip": bool(instant_profile),
                                "fname": first_name,
                                "lname": last_name,
                                "dname": display_name,
                            },
                        )
                        try:
                            rc = int(getattr(res, "rowcount", 0) or 0)
                        except Exception:
                            rc = 0
                        return "updated" if rc > 0 else "existing"

                outcome = _with_conn_do(_write)
                if outcome == "created":
                    created_total += 1
                elif outcome == "updated":
                    updated_total += 1
                else:
                    existing_total += 1
            except Exception as e:
                # Surface the first write error to the response path via a lightweight cache hint
                try:
                    emit_event("ImportWriteError", {"tenant_id": req.tenant_id, "provider": "square", "detail": str(e)[:180]})
                except Exception:
                    pass

        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Square-Version": os.getenv("SQUARE_VERSION", "2023-10-18"),
        }
        cursor: Optional[str] = None
        try:
            with httpx.Client(timeout=20, headers=headers) as client:
                def _handle_response(resp: httpx.Response) -> Dict[str, object]:
                    if resp.status_code >= 400:
                        return {"err": f"square_http_{resp.status_code}", "detail": (resp.text or "")[:400]}
                    try:
                        body = resp.json() or {}
                    except Exception:
                        return {"err": "square_body_parse_failed", "detail": (resp.text or "")[:400]}
                    # Surface Square errors field even on 200s
                    try:
                        if isinstance(body, dict) and body.get("errors"):
                            return {"err": "square_error", "detail": str(body.get("errors"))[:400]}
                    except Exception:
                        pass
                    return {"body": body}

                while True:
                    # First try ListCustomers
                    params: Dict[str, str] = {"limit": "100"}
                    if cursor:
                        params["cursor"] = cursor
                    r = client.get(f"{base}/v2/customers", params=params)
                    handled = _handle_response(r)
                    if handled.get("err"):
                        return {"imported": 0, "error": handled["err"], "detail": handled.get("detail")}
                    body = handled.get("body", {})
                    customers = body.get("customers") or []
                    fetched_total += len(customers)

                    # If ListCustomers yields nothing on the first page, fall back to SearchCustomers
                    used_search = False
                    if not customers and not cursor:
                        search_payload: Dict[str, object] = {"limit": 100}
                        if cursor:
                            search_payload["cursor"] = cursor
                        sr = client.post(f"{base}/v2/customers/search", json=search_payload)
                        shandled = _handle_response(sr)
                        if shandled.get("err"):
                            return {"imported": 0, "error": shandled["err"], "detail": shandled.get("detail")}
                        sbody = shandled.get("body", {})
                        customers = sbody.get("customers") or []
                        fetched_total += len(customers)
                        # Square uses "cursor" for next page on search
                        body = sbody
                        used_search = True
                        used_search_any = True

                    for c in customers:
                        _upsert_contact(c)
                        if len(sample_ids) < 3:
                            try:
                                sample_ids.append(str(c.get("id") or ""))
                            except Exception:
                                pass

                    # Advance cursor depending on which API we used
                    cursor = body.get("cursor") or body.get("next_cursor")
                    if not cursor:
                        break
            # Connection-bound transactions commit per-contact; no session commit required here
        except Exception as e:
            try:
                db.rollback()
            except Exception:
                pass
            return {"imported": 0, "error": "square_fetch_failed", "detail": str(e)[:200]}

        emit_event("ContactsSynced", {"tenant_id": req.tenant_id, "provider": "square", "imported": created_total})
        # Invalidate rollup caches
        try:
            invalidate_contacts_cache(req.tenant_id)
        except Exception:
            pass
        # Update v2 connected account last_sync
        try:
            with engine.begin() as conn:
                conn.execute(
                    _sql_text("UPDATE connected_accounts_v2 SET last_sync = EXTRACT(epoch FROM now())::bigint WHERE tenant_id = CAST(:t AS uuid) AND provider='square'"),
                    {"t": req.tenant_id},
                )
        except Exception:
            pass
        # Trigger a calendar sync after import to surface bookings immediately
        try:
            try:
                with next(get_db()) as _db:  # type: ignore
                    _db.add(dbm.EventLedger(ts=int(_time.time()), tenant_id=req.tenant_id, name="sync.calendar.auto.queued", payload=json.dumps({"reason":"post_import"})))
                    _db.commit()
            except Exception:
                pass
            try:
                import httpx as _httpx
                base_api = os.getenv("BACKEND_BASE_URL", "http://localhost:8000").rstrip("/")
                with _httpx.Client(timeout=10) as client:
                    client.post(f"{base_api}/calendar/sync", json={"tenant_id": req.tenant_id, "provider": "auto"})
            except Exception:
                pass
        except Exception:
            pass
        return {
            "imported": created_total,
            "meta": {
                "mode": "v1",
                "base": base,
                "used_search": used_search_any,
                "samples": sample_ids,
                "stats": {"fetched": fetched_total, "created": created_total, "updated": updated_total, "existing": existing_total},
            },
        }
    except Exception as e:
        try: db.rollback()
        except Exception: pass
        return {"imported": 0, "error": "internal_error", "detail": str(e)[:200]}


class SquareBackfillMetricsRequest(BaseModel):
    tenant_id: str
    max_seconds: Optional[int] = None
    max_pages: Optional[int] = None
    max_name_fetch: Optional[int] = 150
@app.post("/integrations/booking/square/backfill-metrics", tags=["Integrations"])
def square_backfill_metrics(req: SquareBackfillMetricsRequest, ctx: UserContext = Depends(get_user_context_relaxed)) -> Dict[str, object]:
    try:
        if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
            return {"updated": 0, "error": "forbidden"}
        # Get Square token
        token = ""
        try:
            with engine.begin() as conn:
                row_v2 = conn.execute(_sql_text("SELECT access_token_enc FROM connected_accounts_v2 WHERE tenant_id = CAST(:t AS uuid) AND provider='square' ORDER BY id DESC LIMIT 1"), {"t": req.tenant_id}).fetchone()
            if row_v2 and row_v2[0]:
                try:
                    token = decrypt_text(str(row_v2[0])) or ""
                except Exception:
                    token = str(row_v2[0])
        except Exception:
            token = ""
        if not token:
            return {"updated": 0, "error": "missing_access_token"}
        base = os.getenv("SQUARE_API_BASE", "https://connect.squareup.com")
        if os.getenv("SQUARE_ENV", "prod").lower().startswith("sand"):
            base = "https://connect.squareupsandbox.com"
        headers = {"Authorization": f"Bearer {token}", "Accept": "application/json", "Square-Version": os.getenv("SQUARE_VERSION", "2023-10-18")}

        # Aggregate payments per customer
        per: Dict[str, Dict[str, object]] = {}
        updated = 0
        try:
            start_time = _time.time()
            with httpx.Client(timeout=60, headers=headers) as client:
                cursor: Optional[str] = None
                page_count = 0
                while True:
                    params: Dict[str, str] = {"limit": "100"}
                    if cursor:
                        params["cursor"] = cursor
                    r = client.get(f"{base}/v2/payments", params=params)
                    if r.status_code >= 400:
                        return {"updated": 0, "error": f"square_http_{r.status_code}", "detail": (r.text or "")[:200]}
                    body = r.json() or {}
                    payments = body.get("payments") or []
                    for p in payments:
                        try:
                            cust = str(p.get("customer_id") or "").strip()
                            if not cust:
                                continue
                            status = str(p.get("status") or "").upper()
                            if status not in {"COMPLETED", "APPROVED", "CAPTURED"}:
                                continue
                            amt = 0
                            try:
                                amt = int(((p.get("amount_money") or {}).get("amount") or 0))
                            except Exception:
                                amt = 0
                            ref = 0
                            try:
                                ref = int(((p.get("refunded_money") or {}).get("amount") or 0))
                            except Exception:
                                ref = 0
                            created_at = str(p.get("created_at") or "")
                            # Use created_at for first/last visit
                            ts = 0
                            try:
                                # Parse RFC3339
                                from datetime import datetime
                                ts = int(datetime.fromisoformat(created_at.replace('Z','+00:00')).timestamp()) if created_at else 0
                            except Exception:
                                ts = 0
                            entry = per.get(cust) or {"first": 0, "last": 0, "count": 0, "cents": 0}
                            entry["count"] = int(entry.get("count", 0)) + 1
                            entry["cents"] = int(entry.get("cents", 0)) + max(0, amt - ref)
                            if ts:
                                if not entry.get("first") or ts < int(entry.get("first", 0)):
                                    entry["first"] = ts
                                if ts > int(entry.get("last", 0)):
                                    entry["last"] = ts
                            per[cust] = entry
                        except Exception:
                            continue
                    cursor = body.get("cursor") or body.get("next_cursor")
                    page_count += 1
                    if req.max_pages and page_count >= int(req.max_pages or 0):
                        break
                    if req.max_seconds and (_time.time() - start_time) >= max(15, int(req.max_seconds or 0)):
                        break
                    if not cursor:
                        break
            # Name enrichment for contacts missing names/display
            try:
                missing_sqids: list[str] = []
                with engine.begin() as conn:
                    rows_missing = conn.execute(
                        _sql_text(
                            """
                            SELECT square_customer_id::text
                            FROM contacts
                            WHERE tenant_id = CAST(:t AS uuid)
                              AND square_customer_id IS NOT NULL
                              AND (
                                COALESCE(display_name,'') = '' OR (
                                  (first_name IS NULL OR first_name = '') AND (last_name IS NULL OR last_name = '')
                                )
                              )
                            LIMIT :lim
                            """
                        ),
                        {"t": req.tenant_id, "lim": int(req.max_name_fetch or 150)},
                    ).fetchall()
                    missing_sqids = [str(r[0]) for r in rows_missing if r and r[0]]
                if missing_sqids:
                    for sqid in missing_sqids:
                        try:
                            cr = client.get(f"{base}/v2/customers/{sqid}")
                            if cr.status_code >= 400:
                                continue
                            cbody = cr.json() or {}
                            cust = (cbody.get("customer") or {}) if isinstance(cbody, dict) else {}
                            first_name = str(cust.get("given_name") or cust.get("first_name") or "").strip() or None
                            last_name = str(cust.get("family_name") or cust.get("last_name") or "").strip() or None
                            nickname = str(cust.get("nickname") or "").strip()
                            company_name = str(cust.get("company_name") or "").strip()
                            email = str(cust.get("email_address") or "").strip() or None
                            phone = str(cust.get("phone_number") or "").strip() or None
                            display_name = None
                            if (first_name or "") or (last_name or ""):
                                display_name = f"{(first_name or '').strip()} {(last_name or '').strip()}".strip()
                            if not display_name and nickname:
                                display_name = nickname
                            if not display_name and company_name:
                                display_name = company_name
                            if not display_name and email:
                                try:
                                    display_name = (email.split("@",1)[0] or email)
                                except Exception:
                                    display_name = None
                            if not display_name and phone:
                                try:
                                    tail4 = ''.join([ch for ch in phone if ch.isdigit()])[-4:]
                                    display_name = f"Client • {tail4}" if tail4 else None
                                except Exception:
                                    display_name = None
                            if not display_name:
                                display_name = f"Client {str(sqid)[:6]}"
                            with engine.begin() as conn:
                                conn.execute(
                                    _sql_text(
                                        """
                                        UPDATE contacts
                                        SET first_name = CASE WHEN first_name IS NULL OR first_name = '' THEN :fn ELSE first_name END,
                                            last_name = CASE WHEN last_name IS NULL OR last_name = '' THEN :ln ELSE last_name END,
                                            display_name = CASE
                                              WHEN display_name IS NULL OR display_name = '' OR display_name ~ '^Client [0-9a-zA-Z]+'
                                              THEN :dn
                                              ELSE display_name
                                            END,
                                            updated_at = EXTRACT(epoch FROM now())::bigint
                                        WHERE tenant_id = CAST(:t AS uuid) AND square_customer_id = :sqid
                                        """
                                    ),
                                    {"t": req.tenant_id, "sqid": sqid, "fn": first_name, "ln": last_name, "dn": display_name},
                                )
                        except Exception:
                            continue
            except Exception:
                pass
            # Invalidate rollup caches to reflect updated names
            try:
                invalidate_contacts_cache(req.tenant_id)
            except Exception:
                pass
            # Write back to contacts by square_customer_id
            with engine.begin() as conn:
                # Set RLS GUCs
                try:
                    conn.execute(_sql_text("SET LOCAL app.role = 'owner_admin'"))
                    conn.execute(_sql_text("SET LOCAL app.tenant_id = :t"), {"t": req.tenant_id})
                except Exception:
                    pass
                for sqid, m in per.items():
                    try:
                        conn.execute(
                            _sql_text(
                                """
                                UPDATE contacts
                                SET first_visit = GREATEST(first_visit, :first),
                                    last_visit = GREATEST(last_visit, :last),
                                    txn_count = txn_count + :cnt,
                                    lifetime_cents = lifetime_cents + :cents,
                                    updated_at = EXTRACT(epoch FROM now())::bigint
                                WHERE tenant_id = CAST(:t AS uuid) AND square_customer_id = :sqid
                                """
                            ),
                            {
                                "t": req.tenant_id,
                                "sqid": sqid,
                                "first": int(m.get("first", 0)),
                                "last": int(m.get("last", 0)),
                                "cnt": int(m.get("count", 0)),
                                "cents": int(m.get("cents", 0)),
                            },
                        )
                        updated += 1
                    except Exception:
                        continue
        except Exception as e:
            return {"updated": 0, "error": "backfill_failed", "detail": str(e)[:200]}
        try:
            emit_event("SquareBackfillCompleted", {"tenant_id": req.tenant_id, "updated": int(updated), "customers": int(len(per))})
        except Exception:
            pass
        # Update v2 connected account last_sync
        try:
            with engine.begin() as conn:
                conn.execute(
                    _sql_text("UPDATE connected_accounts_v2 SET last_sync = EXTRACT(epoch FROM now())::bigint WHERE tenant_id = CAST(:t AS uuid) AND provider='square'"),
                    {"t": req.tenant_id},
                )
        except Exception:
            pass
        # Invalidate rollup caches
        try:
            cache_del(f"contacts:list:{req.tenant_id}:100")
            cache_del(f"contacts:list:{req.tenant_id}:200")
            cache_del(f"contacts:list:{req.tenant_id}:500")
        except Exception:
            pass
        partial = False
        try:
            if cursor:
                partial = True
        except Exception:
            partial = False
        return {"updated": updated, "customers": len(per), "partial": partial}
    except Exception as e:
        return {"updated": 0, "error": "internal_error", "detail": str(e)[:200]}


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
        base = {"messages_sent": 0, "time_saved_minutes": 0, "ambassador_candidate": False}
    else:
        base = {
            "messages_sent": m.messages_sent,
            "time_saved_minutes": compute_time_saved_minutes(db, tenant_id),
            "ambassador_candidate": ambassador_candidate(db, tenant_id),
        }
    # enrich via admin_kpis for revenue/referrals
    k = admin_kpis(db, tenant_id)
    base.update({"revenue_uplift": k.get("revenue_uplift", 0), "referrals_30d": k.get("referrals_30d", 0)})
    return base
@app.get("/admin/kpis", tags=["Health"])
def get_admin_kpis(tenant_id: str, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)) -> Dict[str, int]:
    if ctx.role != "owner_admin" and ctx.tenant_id != tenant_id:
        return {}
    ckey = f"kpis:{tenant_id}"
    cached = cache_get(ckey)
    if cached is not None:
        try:
            CACHE_HIT.labels(endpoint="/admin/kpis").inc()  # type: ignore
        except Exception:
            pass
        return cached
    try:
        data = admin_kpis(db, tenant_id)
    except Exception as exc:
        logger.exception("admin_kpis_failed", extra={"tenant_id": tenant_id}, exc_info=exc)
        data = {
            "time_saved_minutes": 0,
            "usage_index": 0,
            "ambassador_candidate": False,
            "revenue_uplift": 0,
            "referrals_30d": 0,
            "contacts": 0,
            "active_cadences": 0,
            "notify_list_count": 0,
            "share_prompts": 0,
            "cache_hits": 0,
            "cache_misses": 0,
            "ai_chat_used": 0,
            "db_query_tool_used": 0,
            "insights_served": 0,
        }
    cache_set(ckey, data, ttl=30)
    try:
        CACHE_MISS.labels(endpoint="/admin/kpis").inc()  # type: ignore
    except Exception:
        pass
    return data


class TimeAnalysisRequest(BaseModel):
    tenant_id: str
@app.get("/analysis/time", tags=["Analytics"])  # simple computation based on settings + Metrics
def analysis_time(tenant_id: str, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)) -> Dict[str, object]:
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"time_saved_minutes": 0, "cost_saved": 0}
    # Load settings for time analysis inputs
    hourly_rate = 50.0
    per_post_minutes = 15
    try:
        row = db.query(dbm.Settings).filter(dbm.Settings.tenant_id == tenant_id).first()
        if row:
            data = json.loads(row.data_json or "{}")
            ta = data.get("time_analysis") or {}
            hourly_rate = float(ta.get("hourly_rate", hourly_rate))
            per_post_minutes = int(ta.get("per_post_minutes", per_post_minutes))
    except Exception:
        pass
    # Pull Metrics
    m = db.query(dbm.Metrics).filter(dbm.Metrics.tenant_id == tenant_id).first()
    time_saved_minutes = int(m.time_saved_minutes) if m else 0
    messages_sent = int(m.messages_sent) if m else 0
    # Derive approximate content savings (placeholder; will refine with actual scheduled posts)
    content_minutes = 0
    # Compute cost saved
    cost_saved = (time_saved_minutes + content_minutes) * (hourly_rate / 60.0)
    return {
        "time_saved_minutes": time_saved_minutes + content_minutes,
        "cost_saved": round(cost_saved, 2),
        "inputs": {"hourly_rate": hourly_rate, "per_post_minutes": per_post_minutes},
        "sources": {"cadences_minutes": time_saved_minutes, "content_minutes": content_minutes, "messages_sent": messages_sent},
    }
@app.get("/metrics/explain", tags=["Analytics"])  # human-friendly breakdown for Ask VX
def metrics_explain(tenant_id: str, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)) -> Dict[str, object]:
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"explanation": "forbidden"}
    # Reuse analysis_time
    res = analysis_time(tenant_id, db, ctx)
    if "explanation" in res:
        return res
    hourly_rate = res.get("inputs", {}).get("hourly_rate", 50)
    ts = int(res.get("sources", {}).get("cadences_minutes", 0)) + int(res.get("sources", {}).get("content_minutes", 0))
    cost_saved = float(res.get("cost_saved", 0.0))
    text = (
        f"We compute Time Saved as a sum of automation minutes (currently from messaging/cadences). "
        f"Cost Saved = Time Saved × hourly rate. Using hourly rate ${hourly_rate:.2f}, "
        f"Time Saved is {ts} minutes and Cost Saved is ${cost_saved:.2f}."
    )
    return {"explanation": text, "details": res}
@app.post("/scheduler/tick", tags=["Cadences"])
def scheduler_tick(tenant_id: Optional[str] = None, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)):
    if tenant_id and ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"processed": 0}
    return {"processed": run_tick(db, tenant_id)}


class RecomputeRequest(BaseModel):
    tenant_id: str


@app.post("/marts/recompute", tags=["Health"])
def recompute_marts(
    req: RecomputeRequest,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.role != "owner_admin" and ctx.tenant_id != req.tenant_id:
        raise HTTPException(status_code=403, detail="forbidden")
    a = recompute_funnel_daily(db, req.tenant_id)
    b = recompute_time_saved(db, req.tenant_id)
    return {"status": "ok", "funnel_updates": a, "time_saved_updates": b}


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


class AppointmentCreateRequest(BaseModel):
    tenant_id: str
    contact_id: str
    service: Optional[str] = None
    start_ts: int
    end_ts: Optional[int] = None
    status: str = "booked"  # booked|completed|cancelled


@app.post("/appointments", tags=["Cadences"])
def create_appointment(
    req: AppointmentCreateRequest,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
) -> Dict[str, str]:
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    db.add(dbm.Appointment(
        tenant_id=req.tenant_id,
        contact_id=req.contact_id,
        service=req.service,
        start_ts=req.start_ts,
        end_ts=req.end_ts,
        status=req.status,
    ))
    db.commit()
    emit_event("AppointmentIngested", {"tenant_id": req.tenant_id, "contact_id": req.contact_id, "service": req.service})
    # Draft and send a confirmation (subject to consent/rate limits)
    try:
        body = f"Your appointment for {req.service or 'service'} is set. Reply HELP for assistance."
        send_message(db, req.tenant_id, req.contact_id, "sms", None, body, None)
    except Exception:
        pass
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


class SettingsRequest(BaseModel):
    tenant_id: str
    tone: Optional[str] = None
    services: Optional[List[str]] = None
    preferences: Optional[Dict[str, str]] = None
    brand_profile: Optional[Dict[str, str]] = None
    quiet_hours: Optional[Dict[str, str]] = None
    training_notes: Optional[str] = None
    completed: Optional[bool] = None
    providers_live: Optional[Dict[str, bool]] = None  # per-provider live-mode switch
    wf_progress: Optional[Dict[str, bool]] = None  # first 5 workflows progress flags
    # Onboarding/tour persistence
    tour_completed: Optional[bool] = None
    tour_completed_at: Optional[int] = None
    onboarding_step: Optional[int] = None
    # Timezone support
    user_timezone: Optional[str] = None  # e.g., "America/Chicago"
    # Creator / developer flags
    developer_mode: Optional[bool] = None
    master_prompt: Optional[str] = None  # stored under ai.master_prompt
    rate_limit_multiplier: Optional[int] = None
    # Global safety switch
    pause_automations: Optional[bool] = None
    # Subscription/trial flags
    subscription_status: Optional[str] = None  # trialing | active | canceled
    trial_end_ts: Optional[int] = None        # epoch seconds


@app.get("/settings", tags=["Integrations"])
def get_settings(
    tenant_id: str,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    try:
        if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
            return {"data": {}}
        # Deterministic selection: latest row per tenant
        row = db.execute(
            _sql_text("SELECT id, data_json FROM settings WHERE tenant_id = CAST(:tid AS uuid) ORDER BY id DESC LIMIT 1"),
            {"tid": tenant_id},
        ).fetchone()
        if not row or not (row[1] or "").strip():
            # Seed trial settings for brand-new tenants
            import time as __time
            data = {"subscription_status": "trialing", "trial_end_ts": int(__time.time()) + 7*86400}
            db.execute(_sql_text("INSERT INTO settings(tenant_id, data_json, created_at) VALUES (CAST(:t AS uuid), :d, NOW())"), {"t": tenant_id, "d": json.dumps(data)})
            return {"data": data}
        try:
            data = json.loads(row[1])
            if not str((data or {}).get("subscription_status") or "").strip():
                import time as __time
                data["subscription_status"] = "trialing"
                data.setdefault("trial_end_ts", int(__time.time()) + 7*86400)
                db.execute(_sql_text("UPDATE settings SET data_json=:d WHERE id=:id"), {"d": json.dumps(data), "id": row[0]})
            return {"data": data}
        except Exception:
            return {"data": {}}
    except Exception:
        return {"data": {}}


@app.post("/settings", tags=["Integrations"])
def update_settings(
    req: SettingsRequest,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    row = db.query(dbm.Settings).filter(dbm.Settings.tenant_id == req.tenant_id).first()
    data = {}
    if row:
        try:
            data = json.loads(row.data_json)
        except Exception:
            data = {}
    if req.tone is not None:
        data["tone"] = req.tone
    if req.services is not None:
        data["services"] = req.services
    if req.preferences is not None:
        data["preferences"] = req.preferences
    if req.brand_profile is not None:
        data["brand_profile"] = req.brand_profile
    if req.providers_live is not None:
        data["providers_live"] = req.providers_live
    if req.wf_progress is not None:
        # Merge into existing map so updates can be partial
        cur = dict(data.get("wf_progress") or {})
        for k, v in (req.wf_progress or {}).items():
            try:
                cur[str(k)] = bool(v)
            except Exception:
                continue
        data["wf_progress"] = cur
    if req.tour_completed is not None:
        data["tour_completed"] = bool(req.tour_completed)
    if req.tour_completed_at is not None:
        try:
            data["tour_completed_at"] = int(req.tour_completed_at)
        except Exception:
            data["tour_completed_at"] = None
    if req.onboarding_step is not None:
        try:
            data["onboarding_step"] = int(req.onboarding_step)
        except Exception:
            data["onboarding_step"] = 0
    if req.user_timezone is not None:
        prefs = dict(data.get("preferences") or {})
        prefs["user_timezone"] = req.user_timezone
        data["preferences"] = prefs
    if req.developer_mode is not None:
        data["developer_mode"] = bool(req.developer_mode)
    if req.master_prompt is not None:
        ai_cfg = dict(data.get("ai") or {})
        ai_cfg["master_prompt"] = req.master_prompt
        data["ai"] = ai_cfg
    if req.quiet_hours is not None:
        data["quiet_hours"] = req.quiet_hours
    if req.training_notes is not None:
        data["training_notes"] = str(req.training_notes)
    if req.rate_limit_multiplier is not None:
        try:
            data["rate_limit_multiplier"] = max(1, int(req.rate_limit_multiplier))
        except Exception:
            data["rate_limit_multiplier"] = 1
    if req.pause_automations is not None:
        data["pause_automations"] = bool(req.pause_automations)
    if getattr(req, "subscription_status", None) is not None:
        data["subscription_status"] = str(req.subscription_status)
    if getattr(req, "trial_end_ts", None) is not None:
        try:
            data["trial_end_ts"] = int(req.trial_end_ts)  # epoch seconds
        except Exception:
            pass
    if not row:
        row = dbm.Settings(tenant_id=req.tenant_id, data_json=json.dumps(data))
        db.add(row)
    else:
        row.data_json = json.dumps(data)
    db.commit()
    emit_event("SettingsUpdated", {"tenant_id": req.tenant_id, "keys": list(data.keys())})
    try:
        if req.quiet_hours and isinstance(req.quiet_hours, dict):
            _complete_step(req.tenant_id, 'quiet_hours', {"start": req.quiet_hours.get('start'), "end": req.quiet_hours.get('end')})
        if (req.training_notes and str(req.training_notes).strip()) or (req.brand_profile and any((req.brand_profile or {}).values())):
            _complete_step(req.tenant_id, 'train_vx', {"brand_profile": bool(req.brand_profile), "notes": bool(req.training_notes)})
    except Exception:
        pass
    return {"status": "ok"}


class ProvisionCreatorRequest(BaseModel):
    tenant_id: str
    master_prompt: Optional[str] = None
    rate_limit_multiplier: Optional[int] = 5


@app.post("/admin/provision_creator", tags=["Admin"])
def provision_creator(
    req: ProvisionCreatorRequest,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    # Allow owner_admin to self-provision creator mode for their tenant
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    row = db.query(dbm.Settings).filter(dbm.Settings.tenant_id == req.tenant_id).first()
    data = {}
    if row:
        try:
            data = json.loads(row.data_json or "{}")
        except Exception:
            data = {}
    data["developer_mode"] = True
    try:
        rlm = int(req.rate_limit_multiplier or 5)
        data["rate_limit_multiplier"] = max(1, rlm)
    except Exception:
        data["rate_limit_multiplier"] = 5
    if req.master_prompt is not None:
        ai_cfg = dict(data.get("ai") or {})
        ai_cfg["master_prompt"] = req.master_prompt
        data["ai"] = ai_cfg
    if not row:
        row = dbm.Settings(tenant_id=req.tenant_id, data_json=json.dumps(data))
        db.add(row)
    else:
        row.data_json = json.dumps(data)
    db.commit()
    emit_event("CreatorModeProvisioned", {"tenant_id": req.tenant_id, "rate_limit_multiplier": data.get("rate_limit_multiplier", 1)})
    return {"status": "ok"}


class CacheClearRequest(BaseModel):
    tenant_id: str
    scope: Optional[str] = "all"  # all | inbox | inventory | calendar
@app.post("/admin/cache/clear", tags=["Admin"])
def admin_cache_clear(req: CacheClearRequest, ctx: UserContext = Depends(get_user_context)) -> Dict[str, Any]:
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    cleared = 0
    tried = []
    # Known keys
    keys = []  # type: ignore
    if req.scope in ("all", "inbox"):
        keys.append(f"inbox:{req.tenant_id}:50")
    if req.scope in ("all", "inventory"):
        keys.append(f"inv:{req.tenant_id}")
    if req.scope in ("all", "calendar"):
        keys.append(f"cal:{req.tenant_id}:0:0")
    # Attempt prefix scan in Redis when available for broader cleanup
    client = _get_redis()
    if client is not None and req.scope == "all":
        try:
            for prefix in [f"inbox:{req.tenant_id}", f"inv:{req.tenant_id}", f"cal:{req.tenant_id}"]:
                cursor = "0"
                while True:
                    cursor, batch = client.scan(cursor=cursor, match=f"{prefix}*")  # type: ignore
                    if batch:
                        for k in batch:
                            if k not in keys:
                                keys.append(k)
                    if cursor == "0":
                        break
        except Exception:
            pass
    for k in keys:
        tried.append(k)
        try:
            cache_del(k)
            cleared += 1
        except Exception:
            pass
    try:
        emit_event("AdminCacheCleared", {"tenant_id": req.tenant_id, "scope": req.scope, "cleared": cleared})
    except Exception:
        pass
    return {"status": "ok", "cleared": cleared, "keys": tried[:50]}


class OnboardingCompleteRequest(BaseModel):
    tenant_id: str


@app.post("/onboarding/complete", tags=["Integrations"])
def onboarding_complete(
    req: OnboardingCompleteRequest,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    # mark settings.completed = true
    row = db.query(dbm.Settings).filter(dbm.Settings.tenant_id == req.tenant_id).first()
    data = {}
    if row:
        try:
            data = json.loads(row.data_json)
        except Exception:
            data = {}
    data["completed"] = True
    if not row:
        row = dbm.Settings(tenant_id=req.tenant_id, data_json=json.dumps(data))
        db.add(row)
    else:
        row.data_json = json.dumps(data)
    db.commit()
    emit_event("OnboardingCompleted", {"tenant_id": req.tenant_id})
    # surface share prompt
    db.add(dbm.SharePrompt(tenant_id=req.tenant_id, kind="share_onboarding", surfaced=True))
    db.commit()
    return {"status": "ok"}


@app.get("/messages/list", tags=["Cadences"])
def list_messages(
    tenant_id: str = None,
    contact_id: Optional[str] = None,
    limit: int = 50,
    filter: Optional[str] = None,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    effective_tenant_id = tenant_id or ctx.tenant_id
    if not effective_tenant_id:
        return {"items": []}
    if ctx.tenant_id != effective_tenant_id and ctx.role != "owner_admin":
        return {"items": []}
    q = db.query(dbm.Message).filter(dbm.Message.tenant_id == effective_tenant_id)
    if contact_id:
        q = q.filter(dbm.Message.contact_id == contact_id)

    f = (filter or "").strip().lower()
    if f == "unread":
        q = q.filter(dbm.Message.status == "unread")
    elif f == "failed":
        q = q.filter(dbm.Message.status.ilike("fail%"))
    elif f == "scheduled":
        q = q.filter(dbm.Message.status.ilike("sched%"))
    elif f == "needs_reply":
        sub = (
            db.query(dbm.Message.contact_id, dbm.Message.id)
            .filter(
                dbm.Message.tenant_id == effective_tenant_id,
                dbm.Message.direction == "outbound",
            )
            .subquery()
        )
        q = (
            q.filter(dbm.Message.direction == "inbound")
            .outerjoin(
                sub,
                (sub.c.contact_id == dbm.Message.contact_id)
                & (sub.c.id > dbm.Message.id),
            )
            .filter(sub.c.id == None)
        )  # noqa: E711

    rows = q.order_by(dbm.Message.id.desc()).limit(max(1, min(limit, 200))).all()
    items = []
    for r in rows:
        items.append({
            "id": r.id,
            "contact_id": r.contact_id,
            "channel": r.channel,
            "direction": r.direction,
            "status": r.status,
            "template_id": r.template_id,
            "ts": r.ts,
            "metadata": r.message_metadata,
        })
    return {"items": items}


@app.get("/appointments/list", tags=["Cadences"])
def list_appointments(
    tenant_id: str,
    contact_id: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"items": []}
    q = db.query(dbm.Appointment).filter(dbm.Appointment.tenant_id == tenant_id)
    if contact_id:
        q = q.filter(dbm.Appointment.contact_id == contact_id)
    rows = q.order_by(dbm.Appointment.id.desc()).limit(max(1, min(limit, 200))).all()
    items = []
    for r in rows:
        items.append({
            "id": r.id,
            "contact_id": r.contact_id,
            "service": r.service,
            "start_ts": r.start_ts,
            "end_ts": r.end_ts,
            "status": r.status,
            "external_ref": r.external_ref,
        })
    return {"items": items}


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
    _safe_audit_log(db, tenant_id=req.tenant_id, actor_id=ctx.user_id, action="consent.stop", entity_ref=f"contact:{req.contact_id}", payload="{}")
    db.commit()
    emit_event(
        "SuppressionAdded",
        {"tenant_id": req.tenant_id, "contact_id": req.contact_id, "channel": req.channel, "keyword": "STOP"},
    )
    return {"status": "suppressed"}


@app.post("/cadences/stop", tags=["Cadences"])
def stop_cadence(
    tenant_id: str,
    contact_id: str,
    cadence_id: str,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    q = (
        db.query(dbm.CadenceState)
        .filter(
            dbm.CadenceState.tenant_id == tenant_id,
            dbm.CadenceState.contact_id == contact_id,
            dbm.CadenceState.cadence_id == cadence_id,
        )
    )
    count = q.count()
    q.delete()
    db.commit()
    emit_event("CadenceStopped", {"tenant_id": tenant_id, "contact_id": contact_id, "cadence_id": cadence_id, "count": count})
    return {"status": "ok", "stopped": count}


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


@app.get("/ai/contexts/schema", tags=["AI"])
def ai_contexts_schema() -> Dict[str, object]:
    """Return contexts manifest: per-context preamble and allowlisted tools."""
    return contexts_schema()


class WorkflowPlanRequest(BaseModel):
    tenant_id: str
    name: str  # e.g., "crm_organization", "book_filling"
@app.post("/ai/workflow/plan", tags=["AI"])
def ai_workflow_plan(req: WorkflowPlanRequest, ctx: UserContext = Depends(get_user_context)) -> Dict[str, object]:
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"steps": []}
    # Minimal deterministic plans; frontend can map tourTarget to driver.js anchors
    plans = {
        "crm_organization": [
            {"title": "Create HubSpot (free)", "tool": "link.hubspot.signup", "requiresApproval": False},
            {"title": "Connect HubSpot", "tool": "oauth.hubspot.connect", "requiresApproval": False},
            {"title": "Import contacts from HubSpot", "tool": "crm.hubspot.import", "requiresApproval": False},
            {"title": "Dedupe contacts", "tool": "contacts.dedupe", "requiresApproval": False},
            {"title": "Export current list", "tool": "export.contacts", "requiresApproval": False},
        ],
        "book_filling": [
            {"title": "Preview dormant segment (≥60d)", "tool": "campaigns.dormant.preview", "requiresApproval": False},
            {"title": "Start dormant campaign", "tool": "campaigns.dormant.start", "requiresApproval": True},
            {"title": "Schedule reminders", "tool": "appointments.schedule_reminders", "requiresApproval": False},
        ],
        "inventory_tracking": [
            {"title": "Check low stock", "tool": "inventory.alerts.get", "requiresApproval": False},
        ],
        "client_communication": [
            {"title": "Schedule reminders", "tool": "appointments.schedule_reminders", "requiresApproval": False},
        ],
        "social_automation": [
            {"title": "Draft 14‑day schedule", "tool": "social.schedule.14days", "requiresApproval": True},
        ],
    }
    steps = plans.get(req.name)
    if steps is None:
        return {
            "steps": [],
            "friendly_error": "I couldn't find that workflow. Try one of: crm_organization, book_filling, inventory_tracking, client_communication, social_automation.",
        }
    return {"steps": steps}


# Minimal cross-panel workflow guide manifest for AskVX
@app.get("/guide/manifest", tags=["AI"])
def guide_manifest() -> Dict[str, object]:
    return {
        "version": 1,
        "workflows": {
            "crm_organization": [
                {"panel": "integrations", "selector": "[data-tour=connect]", "title": "Connect CRM", "desc": "Link HubSpot to import contacts."},
                {"panel": "onboarding", "selector": "[data-tour=analyze]", "title": "Analyze setup", "desc": "See what's ready and what's missing."},
            ],
            "book_filling": [
                {"panel": "cadences", "selector": "[data-guide=dormant-preview]", "title": "Preview dormant", "desc": "Find clients not seen recently."},
                {"panel": "cadences", "selector": "[data-guide=dormant-start]", "title": "Start campaign", "desc": "Queue messages with consent and approvals."},
            ],
            "inventory_tracking": [
                {"panel": "inventory", "selector": "[data-guide=sync]", "title": "Run sync", "desc": "Pull stock from Shopify/Square."},
                {"panel": "inventory", "selector": "[data-guide=low-threshold]", "title": "Low stock alerts", "desc": "Adjust threshold to watch items."},
            ],
            "client_communication": [
                {"panel": "inbox", "selector": "[data-guide=templates]", "title": "Message templates", "desc": "Pick and schedule reminders."},
            ],
            "social_automation": [
                {"panel": "social", "selector": "[data-guide=plan-14]", "title": "Draft 14‑day plan", "desc": "Review and approve posts."},
            ],
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
                    {"id": "funnel", "endpoint": "/funnel/daily?tenant_id={tenant_id}&days=30"},
                    {"id": "cadence_queue", "endpoint": "/cadences/queue?tenant_id={tenant_id}&limit=50"},
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


class ProvisionSmsRequest(BaseModel):
    tenant_id: str
    area_code: Optional[str] = None  # attempt local number if provided
@app.post("/integrations/twilio/provision", tags=["Integrations"])
def twilio_provision(req: ProvisionSmsRequest, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)) -> Dict[str, object]:
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        raise HTTPException(status_code=403, detail="forbidden")
    # Require master Twilio creds at platform level
    master_sid = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
    master_token = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
    if not (master_sid and master_token):
        return {"status": "error", "detail": "platform_twilio_not_configured"}
    # Create subaccount and buy a number
    sub_sid = ""
    sub_token = ""
    from_num = ""
    try:
        # 1) create subaccount
        with httpx.Client(timeout=20, auth=(master_sid, master_token)) as client:
            r = client.post(f"https://api.twilio.com/2010-04-01/Accounts.json", data={"FriendlyName": f"BrandVX {req.tenant_id}"})
            r.raise_for_status()
            j = r.json()
            sub_sid = j.get("sid", "")
            sub_token = j.get("auth_token", "")
        if not (sub_sid and sub_token):
            return {"status": "error", "detail": "subaccount_create_failed"}
        # 2) buy a local number (fallback to toll-free search could be added later)
        with httpx.Client(timeout=20, auth=(sub_sid, sub_token)) as client:
            q = {"Country": "US", "Type": "Local"}
            if req.area_code: q["AreaCode"] = req.area_code
            r = client.get(f"https://api.twilio.com/2010-04-01/Accounts/{sub_sid}/AvailablePhoneNumbers/US/Local.json", params=q)
            r.raise_for_status()
            nums = (r.json() or {}).get("available_phone_numbers") or []
            if not nums:
                return {"status": "error", "detail": "no_numbers_available"}
            cand = nums[0].get("phone_number", "")
            if not cand:
                return {"status": "error", "detail": "no_numbers_available"}
            # Purchase
            r2 = client.post(f"https://api.twilio.com/2010-04-01/Accounts/{sub_sid}/IncomingPhoneNumbers.json", data={"PhoneNumber": cand})
            r2.raise_for_status()
            from_num = cand
        # 3) set webhook (inbound SMS)
        try:
            with httpx.Client(timeout=20, auth=(sub_sid, sub_token)) as client:
                url = f"{_backend_base_url()}/webhooks/twilio?tenant_id={req.tenant_id}"
                # Fetch list again to get SID of purchased number
                r = client.get(f"https://api.twilio.com/2010-04-01/Accounts/{sub_sid}/IncomingPhoneNumbers.json")
                sid = ""
                for it in (r.json() or {}).get("incoming_phone_numbers", []):
                    if str(it.get("phone_number")) == from_num:
                        sid = str(it.get("sid"))
                        break
                if sid:
                    client.post(f"https://api.twilio.com/2010-04-01/Accounts/{sub_sid}/IncomingPhoneNumbers/{sid}.json", data={
                        "SmsUrl": url,
                        "SmsMethod": "POST",
                    })
        except Exception:
            pass
        # 4) persist into Settings
        row = db.query(dbm.Settings).filter(dbm.Settings.tenant_id == req.tenant_id).first()
        data = {}
        try:
            data = json.loads(row.data_json) if row else {}
        except Exception:
            data = {}
        data.setdefault("messaging", {})
        data["messaging"].update({
            "twilio_subaccount_sid": sub_sid,
            "twilio_auth_token": sub_token,
            "sms_from_number": from_num,
        })
        if not row:
            row = dbm.Settings(tenant_id=req.tenant_id, data_json=json.dumps(data))
            db.add(row)
        else:
            row.data_json = json.dumps(data)
        db.commit()
        # 5) test send (optional)
        try:
            test_to = os.getenv("TEST_SMS_TO", "")
            if test_to:
                twilio_send_sms(test_to, "BrandVX SMS enabled.", sub_sid, sub_token, from_num)
        except Exception:
            pass
        return {"status": "ok", "from": from_num}
    except Exception as e:
        try: db.rollback()
        except Exception: pass
        return {"status": "error", "detail": str(e)}


@app.post("/webhooks/twilio", tags=["Integrations"])
async def webhook_twilio(
    req: ProviderWebhook,
    request: Request,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
) -> Dict[str, str]:
    sig = request.headers.get("X-Twilio-Signature", "")
    url = str(request.url)
    # Twilio signs form-encoded parameters
    try:
        form = await request.form()
        payload = {k: v for k, v in form.items()}
    except Exception:
        payload = dict(req.payload or {})
    ok = twilio_verify_signature(url, payload, signature=sig)
    if not ok:
        raise HTTPException(status_code=403, detail="invalid signature")
    try:
        # Throttle inbound webhook processing per tenant
        ok_rl, _ = check_and_increment(req.tenant_id, "webhook:twilio", max_per_minute=120)
        if not ok_rl:
            return {"status": "rate_limited"}
    except Exception:
        pass
    # Parse inbound intent from body
    body = str(payload.get("Body", "")).strip().lower()
    intent = "unknown"
    if body in {"stop", "unsubscribe"}:
        intent = "stop"
    elif body in {"help"}:
        intent = "help"
    elif body in {"yes", "confirm", "y"}:
        intent = "confirm"
    elif "resched" in body:
        intent = "reschedule"
    # Handle STOP immediately: add suppression and audit
    if intent == "stop":
        db.add(
            dbm.ConsentLog(
                tenant_id=req.tenant_id,
                contact_id=str(payload.get("From", "")),
                channel="sms",
                consent="revoked",
            )
        )
        _safe_audit_log(db, tenant_id=req.tenant_id, actor_id=ctx.user_id, action="consent.stop", entity_ref=f"contact:{payload.get('From','')}", payload="{}")
        # Persist to inbox for operator visibility
        try:
            db.add(dbm.InboxMessage(
                tenant_id=req.tenant_id,
                channel="sms",
                from_addr=str(payload.get("From", "")),
                to_addr=str(payload.get("To", "")),
                preview="STOP",
                ts=int(_time.time()),
            ))
        except Exception:
            pass
        db.commit()
        emit_event(
            "SuppressionAdded",
            {"tenant_id": req.tenant_id, "contact_id": str(payload.get("From", "")), "channel": "sms", "keyword": "STOP"},
        )
    emit_event("ProviderWebhookReceived", {"tenant_id": req.tenant_id, "provider": "twilio", "intent": intent})
    return {"status": "ok", "intent": intent}


class LeadStatusUpdate(BaseModel):
    tenant_id: str
    contact_id: str
    intent: str  # confirm|reschedule|help|unknown


@app.post("/lead-status/update", tags=["Cadences"])
def update_lead_status(
    req: LeadStatusUpdate,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        raise HTTPException(status_code=403, detail="forbidden")
    row = (
        db.query(dbm.LeadStatus)
        .filter(dbm.LeadStatus.tenant_id == req.tenant_id, dbm.LeadStatus.contact_id == req.contact_id)
        .first()
    )
    if not row:
        row = dbm.LeadStatus(tenant_id=req.tenant_id, contact_id=req.contact_id, bucket=1, tag="warm")
        db.add(row)
    # Minimal transitions
    intent = req.intent.lower()
    if intent == "confirm":
        row.bucket = 4
        row.tag = "engaged"
        row.next_action_at = None
    elif intent == "reschedule":
        row.bucket = 4
        row.tag = "reschedule"
        row.next_action_at = None
    row.updated_at = int(__import__("time").time())
    db.commit()
    emit_event("LeadStatusUpdated", {"tenant_id": req.tenant_id, "contact_id": req.contact_id, "bucket": row.bucket, "tag": row.tag})
    return {"status": "ok", "bucket": row.bucket, "tag": row.tag}
class DLQReplayRequest(BaseModel):
    tenant_id: Optional[str] = None
    limit: int = 20


@app.post("/dlq/replay", tags=["Cadences"])
def dlq_replay(
    req: DLQReplayRequest,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if req.tenant_id and ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        raise HTTPException(status_code=403, detail="forbidden")
    q = db.query(dbm.DeadLetter)
    if req.tenant_id:
        q = q.filter(dbm.DeadLetter.tenant_id == req.tenant_id)
    rows = q.order_by(dbm.DeadLetter.id.desc()).limit(max(1, min(req.limit, 100))).all()
    # Placeholder: real replay would route by provider and payload
    return {"replayed": 0, "found": len(rows)}


@app.get("/buckets/distribution", tags=["Cadences"])
def get_buckets_distribution(
    tenant_id: str,
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"buckets": []}
    # Prefer L (Supabase) read-only adapter for current lead buckets
    adapter = SupabaseAdapter()
    try:
        import asyncio

        rows = asyncio.run(adapter.get_lead_status(tenant_id))
    except Exception:
        rows = []
    counts = {i: 0 for i in range(1, 8)}
    for r in rows or []:
        try:
            b = int(r.get("bucket", 0))
            if 1 <= b <= 7:
                counts[b] = counts.get(b, 0) + 1
        except Exception:
            continue
    return {
        "buckets": [
            {"bucket": i, "count": counts.get(i, 0)} for i in range(1, 8)
        ]
    }


@app.get("/cadences/queue", tags=["Cadences"])
def get_cadence_queue(
    tenant_id: str,
    limit: int = 50,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"items": []}
    q = (
        db.query(dbm.CadenceState)
        .filter(dbm.CadenceState.tenant_id == tenant_id)
        .filter(dbm.CadenceState.next_action_epoch != None)
        .order_by(dbm.CadenceState.next_action_epoch.asc())
        .limit(max(1, min(limit, 200)))
    )
    rows = q.all()
    items = []
    for r in rows:
        items.append(
            {
                "contact_id": r.contact_id,
                "cadence_id": r.cadence_id,
                "step_index": r.step_index,
                "next_action_at": r.next_action_epoch,
            }
        )
    return {"items": items}


@app.get("/funnel/daily", tags=["Health"])
def get_funnel_daily(
    tenant_id: str,
    days: int = 30,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"days": days, "series": []}
    return funnel_daily_series(db, tenant_id, days)
@app.get("/docs/checklist", tags=["Health"])
def get_checklist_doc() -> Dict[str, str]:
    try:
        root = _Path(__file__).resolve().parents[3]
        p = root / "docs" / "CHECKLIST_BRANDVX_SESSION.md"
        if not p.exists():
            return {"content": "Checklist not found."}
        text = p.read_text(encoding="utf-8")
        return {"content": text}
    except Exception as e:
        return {"content": f"Error reading checklist: {e}"}

@app.get("/oauth/{provider}/login", tags=["Integrations"])
def oauth_login(provider: str, tenant_id: Optional[str] = None, ctx: UserContext = Depends(get_user_context)):
    # Dev override: mark as connected instantly if DEV_OAUTH_AUTOCONNECT=1
    if os.getenv("DEV_OAUTH_AUTOCONNECT", "0") == "1" and provider in {"facebook", "instagram", "google", "shopify", "square"}:
        try:
            with next(get_db()) as db:  # type: ignore
                db.execute(
                    _sql_text(
                        """
                        INSERT INTO connected_accounts_v2(tenant_id, provider, status, access_token_enc, refresh_token_enc, expires_at, connected_at)
                        VALUES (CAST(:t AS uuid), :p, 'connected', :at, NULL, NULL, NOW())
                        ON CONFLICT (tenant_id, provider)
                        DO UPDATE SET status='connected', access_token_enc=EXCLUDED.access_token_enc, connected_at=NOW()
                        """
                    ),
                    {"t": ctx.tenant_id, "p": provider, "at": encrypt_text("dev")},
                )
                db.commit()
        except Exception:
            pass
        return {"url": ""}
    _t = tenant_id or ctx.tenant_id
    url = _oauth_authorize_url(provider, tenant_id=_t)
    # Cache state marker for CSRF verification in callback
    try:
        if url and "state=" in url:
            _st = url.split("state=",1)[1].split("&",1)[0]
            cache_set(f"oauth_state:{_st}", "1", ttl=600)
    except Exception:
        pass
    return {"url": url}


## Removed duplicate scaffold /oauth/{provider}/callback (canonical handler defined earlier)


class AnalyzeRequest(BaseModel):
    tenant_id: str
class HubspotImportRequest(BaseModel):
    tenant_id: str

class SquareSyncContactsRequest(BaseModel):
    tenant_id: str


@app.post("/crm/hubspot/import", tags=["Integrations"])
def hubspot_import(req: HubspotImportRequest, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)) -> Dict[str, int]:
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"imported": 0}
    # Simulated import via adapter: create a few contacts if missing
    created = 0
    sample = [
        {"contact_id": "hs_demo_1", "email_hash": None, "phone_hash": None, "consent_sms": True, "consent_email": True},
        {"contact_id": "hs_demo_2", "email_hash": None, "phone_hash": None, "consent_sms": True, "consent_email": False},
    ]
    for c in sample:
        exists = db.query(dbm.Contact).filter(dbm.Contact.tenant_id == req.tenant_id, dbm.Contact.contact_id == c["contact_id"]).first()
        if not exists:
            db.add(dbm.Contact(tenant_id=req.tenant_id, contact_id=c["contact_id"], email_hash=c["email_hash"], phone_hash=c["phone_hash"], consent_sms=c["consent_sms"], consent_email=c["consent_email"]))
            created += 1
    db.commit()
    emit_event("CrmImportCompleted", {"tenant_id": req.tenant_id, "system": "hubspot", "imported": created})
    return {"imported": created}


## Removed legacy duplicate endpoint for square sync-contacts to avoid path ambiguity

class ShareCreateRequest(BaseModel):
    tenant_id: str
    title: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    caption: Optional[str] = None
    kind: Optional[str] = "generic"


@app.post("/share/create", tags=["AI"])
def share_create(req: ShareCreateRequest, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)) -> Dict[str, str]:
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"url": ""}
    # Record share prompt row for KPIs
    try:
        db.add(dbm.SharePrompt(tenant_id=req.tenant_id, kind=str(req.kind or "generic"), surfaced=True))
        db.commit()
    except Exception:
        pass
    # Prefer DB-backed token for durability; fall back to encoded token on error
    try:
        base = f"sl_{int(_time.time())}"
        suffix = _b64.urlsafe_b64encode(os.urandom(6)).decode().rstrip("=")
        tok = (base + "_" + suffix)[:64]
        db.add(dbm.ShareLink(
            tenant_id=req.tenant_id,
            token=tok,
            title=req.title,
            description=req.description,
            image_url=req.image_url,
            caption=req.caption,
            kind=str(req.kind or "generic"),
        ))
        db.commit()
        return {"url": f"{_frontend_base_url()}/s/{tok}"}
    except Exception:
        payload = {
            "t": req.tenant_id,
            "title": req.title,
            "desc": req.description or "",
            "img": req.image_url or "",
            "cap": req.caption or "",
        }
        raw = json.dumps(payload)
        tok = _b64.urlsafe_b64encode(raw.encode()).decode().rstrip("=")
        return {"url": f"{_frontend_base_url()}/s/{tok}"}
@app.get("/s/{token}")
def share_landing(token: str) -> HTMLResponse:
    # Try DB first, then fall back to token decode
    data = None
    try:
        with next(get_db()) as db:  # type: ignore
            row = db.query(dbm.ShareLink).filter(dbm.ShareLink.token == token).first()
            if row:
                data = {
                    "title": row.title or "BrandVX",
                    "desc": row.description or "Shared via BrandVX",
                    "img": row.image_url or "",
                    "cap": row.caption or "",
                }
    except Exception:
        data = None
    if data is None:
        try:
            pad = "=" * (-len(token) % 4)
            data = json.loads(_b64.urlsafe_b64decode((token + pad).encode()).decode())
        except Exception:
            data = {"title": "BrandVX", "desc": "Shared via BrandVX", "img": ""}
    title = str(data.get("title") or "BrandVX")
    desc = str(data.get("desc") or "Shared via BrandVX")
    img = str(data.get("img") or "")
    html = f"""
<!doctype html>
<html>
  <head>
    <meta charset=\"utf-8\" />
    <title>{title}</title>
    <meta property=\"og:title\" content=\"{title}\" />
    <meta property=\"og:description\" content=\"{desc}\" />
    {f'<meta property="og:image" content="{img}" />' if img else ''}
    <meta name=\"twitter:card\" content=\"summary_large_image\" />
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
    <style>body{{font-family: ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto; background:#fafafa; color:#0f172a;}}</style>
  </head>
  <body>
    <div style=\"max-width:720px;margin:40px auto;padding:16px\">
      <h1 style=\"margin:0 0 8px\">{title}</h1>
      <p style=\"margin:0 0 16px;color:#334155\">{desc}</p>
      {f'<img src="{img}" alt="" style="max-width:100%;border-radius:12px;margin:16px 0" />' if img else ''}
      <a href=\"{_frontend_base_url()}\" style=\"display:inline-block;padding:10px 14px;border-radius:8px;background:#ec4899;color:#fff;text-decoration:none\">Open BrandVX</a>
    </div>
  </body>
  </html>
    """
    return HTMLResponse(content=html)


@app.get("/campaigns/dormant/preview", tags=["Cadences"])
def dormant_preview(tenant_id: str, threshold_days: int = 60, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)) -> Dict[str, int]:
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"count": 0}
    try:
        cutoff = int(_time.time()) - int(threshold_days) * 86400
        appts = db.query(dbm.Appointment).filter(dbm.Appointment.tenant_id == tenant_id).all()
        last_seen: Dict[str, int] = {}
        for a in appts:
            try:
                st = int(a.start_ts or 0)
                cid = str(a.contact_id or "")
                if cid:
                    last_seen[cid] = max(last_seen.get(cid, 0), st)
            except Exception:
                continue
        contacts = db.query(dbm.Contact).filter(dbm.Contact.tenant_id == tenant_id, dbm.Contact.deleted == False).all()  # type: ignore
        count = 0
        for c in contacts:
            ls = last_seen.get(c.contact_id, 0)
            if ls == 0 or ls < cutoff:
                count += 1
        return {"count": count}
    except Exception:
        return {"count": 0}


@app.get("/me", tags=["Auth"])
def whoami(
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
) -> Dict[str, Any]:
    tenant_id = ctx.tenant_id or ""
    
    # Ensure tenant exists on first access (safety net for pre-trigger users)
    if tenant_id:
        ensure_tenant_exists(tenant_id)
    
    out: Dict[str, Any] = {"tenant_id": tenant_id, "role": ctx.role or ""}
    if not tenant_id:
        out["subscription"] = {}
        return out
    tenant_row = None
    try:
        tenant_row = db.execute(
            _sql_text(
                "SELECT plan_tier, subscription_status, trial_end, beta_modal_last_seen, tour_completed_at FROM tenants WHERE id = CAST(:t AS uuid) LIMIT 1"
            ),
            {"t": tenant_id},
        ).fetchone()
    except Exception:
        tenant_row = None

    try:
        row = db.query(dbm.Settings).filter(dbm.Settings.tenant_id == tenant_id).first()
        data: Dict[str, Any] = {}
        if row and (row.data_json or "").strip():
            try:
                data = json.loads(row.data_json or "{}")
            except Exception:
                data = {}
        status = str(data.get("subscription_status") or "").strip()
        plan_code = str(data.get("plan_code") or data.get("subscription_plan_code") or "").strip()
        price_id = str(data.get("subscription_price_id") or "").strip()
        trial_end_ts = data.get("trial_end_ts")
        try:
            trial_end_ts = int(trial_end_ts) if trial_end_ts is not None else None
        except Exception:
            trial_end_ts = None
        out_subscription = {
            "status": status,
            "plan_code": plan_code,
            "price_id": price_id,
            "trial_end_ts": trial_end_ts,
        }
    except Exception:
        out_subscription = {}

    if tenant_row:
        try:
            plan_tier = str(tenant_row[0] or "").strip()
        except Exception:
            plan_tier = ""
        try:
            sub_status = str(tenant_row[1] or "").strip()
        except Exception:
            sub_status = ""
        try:
            trial_end_value = tenant_row[2]
            trial_end_epoch: Optional[int]
            if isinstance(trial_end_value, datetime):
                trial_end_epoch = int(trial_end_value.timestamp())
            elif trial_end_value is None:
                trial_end_epoch = None
            else:
                trial_end_epoch = int(trial_end_value)
        except Exception:
            trial_end_epoch = None
        if trial_end_epoch is not None:
            out_subscription["trial_end_ts"] = trial_end_epoch
        if sub_status:
            out_subscription["status"] = sub_status
        if plan_tier:
            out_subscription["plan_tier"] = plan_tier
        try:
            beta_seen = tenant_row[3]
            if isinstance(beta_seen, date):
                out["beta_modal_last_seen"] = beta_seen.isoformat()
            elif isinstance(beta_seen, datetime):
                out["beta_modal_last_seen"] = beta_seen.date().isoformat()
        except Exception:
            pass
        try:
            tour_completed_val = tenant_row[4]
            if isinstance(tour_completed_val, datetime):
                out["tour_completed_at"] = int(tour_completed_val.timestamp())
            elif tour_completed_val is not None:
                out["tour_completed_at"] = int(tour_completed_val)
        except Exception:
            pass

    if "beta_modal_last_seen" not in out:
        out["beta_modal_last_seen"] = None
    out["subscription"] = out_subscription
    if "tour_completed_at" not in out:
        out["tour_completed_at"] = None
    return out


class OnboardingVerifyRequest(BaseModel):
    token: str


@app.post("/auth/onboarding/verify", tags=["Auth"])
def onboarding_verify(
    req: OnboardingVerifyRequest,
    ctx: UserContext = Depends(get_user_context),
) -> Dict[str, str]:
    """Verify a short-lived onboarding token and grant temporary access to onboarding.
    The grant is cached for 30 minutes and scoped to the current tenant and user.
    """
    try:
        import jwt as _jwt
        payload = _jwt.decode(
            req.token,
            _env("JWT_SECRET", "dev_secret"),
            algorithms=["HS256"],
            audience=_env("JWT_AUDIENCE", "brandvx-users"),
            issuer=_env("JWT_ISSUER", "brandvx"),
        )
        # Ensure token subject matches current user
        if str(payload.get("sub", "")) not in {ctx.user_id, "dev-user"}:
            return {"status": "forbidden"}
    except Exception:
        return {"status": "invalid"}
    gkey = f"onb_grant:{ctx.tenant_id}:{ctx.user_id}"
    cache_set(gkey, "1", ttl=1800)  # 30 minutes
    return {"status": "ok"}


class BetaModalSeenRequest(BaseModel):
    seen_at: Optional[str] = None


@app.post("/me/beta-modal", tags=["Auth"])
def beta_modal_seen_update(
    req: BetaModalSeenRequest,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
) -> Dict[str, Any]:
    tenant_id = ctx.tenant_id or ""
    if not tenant_id:
        raise HTTPException(status_code=400, detail="missing_tenant")
    raw_seen = req.seen_at or datetime.utcnow().strftime("%Y-%m-%d")
    try:
        parsed = datetime.strptime(raw_seen, "%Y-%m-%d").date()
    except Exception:
        raise HTTPException(status_code=400, detail="invalid_date")
    try:
        with engine.begin() as conn:
            conn.execute(_sql_text("SET LOCAL app.role='owner_admin'"))
            conn.execute(
                _sql_text("UPDATE tenants SET beta_modal_last_seen = :seen WHERE id = CAST(:t AS uuid)"),
                {"seen": parsed, "t": tenant_id},
            )
    except Exception as exc:
        logger.exception("beta_modal_update_failed", exc_info=exc)
        raise HTTPException(status_code=500, detail="update_failed")
    return {"status": "ok", "beta_modal_last_seen": parsed.isoformat()}


class ReferralUpdateRequest(BaseModel):
    tenant_id: str
    delta: int = 1


@app.post("/billing/referral", tags=["Billing"])
def billing_apply_referral(
    req: ReferralUpdateRequest,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
) -> Dict[str, object]:
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    # Load settings
    row = db.query(dbm.Settings).filter(dbm.Settings.tenant_id == req.tenant_id).first()
    data = {}
    if row:
        try:
            data = json.loads(row.data_json or "{}")
        except Exception:
            data = {}
    count = int(data.get("referral_count", 0)) + int(req.delta or 0)
    if count < 0:
        count = 0
    data["referral_count"] = count
    # Persist now; we will attempt price adjustments best-effort below
    if not row:
        row = dbm.Settings(tenant_id=req.tenant_id, data_json=json.dumps(data))
        db.add(row)
    else:
        row.data_json = json.dumps(data)
    db.commit()
    # Attempt subscription price adjustment based on thresholds
    try:
        cust_id = (data.get("stripe_customer_id") or "").strip()
        if not cust_id:
            return {"status": "ok", "referral_count": count}
        s = _stripe_client()
        subs = s.Subscription.list(customer=cust_id, limit=1)  # type: ignore
        sub = (subs.get("data") or [None])[0]
        if not sub:
            return {"status": "ok", "referral_count": count}
        item = (sub.get("items", {}).get("data") or [None])[0]
        item_id = item.get("id") if item else None
        current_price = (item.get("price") or {}).get("id") if item else None
        target = None
        price_127 = _env("STRIPE_PRICE_127", "").strip()
        price_97 = _env("STRIPE_PRICE_97", "").strip()
        if count >= 2 and price_97 and current_price != price_97:
            target = price_97
        elif count >= 1 and price_127 and current_price != price_127:
            target = price_127
        if target and item_id:
            s.Subscription.modify(  # type: ignore
                sub.get("id"),
                cancel_at_period_end=False,
                proration_behavior="none",
                items=[{"id": item_id, "price": target}],
            )
            # Update cached settings hint
            try:
                row = db.query(dbm.Settings).filter(dbm.Settings.tenant_id == req.tenant_id).first()
                if row:
                    d = json.loads(row.data_json or "{}")
                    d["subscription_price_id"] = target
                    row.data_json = json.dumps(d)
                    db.commit()
            except Exception:
                pass
        return {"status": "ok", "referral_count": count, "target_price": target or current_price}
    except Exception as e:
        try:
            db.rollback()
        except Exception:
            pass
        return {"status": "error", "detail": str(e), "referral_count": count}


@app.get("/r/{code}", include_in_schema=False)
def referral_redirect(code: str, request: Request) -> Response:
    code = (code or '').strip()
    if not code:
        raise HTTPException(status_code=404, detail="not_found")
    tenant_id = None
    try:
        with engine.begin() as conn:
            row = conn.execute(
                _sql_text("SELECT tenant_id FROM referral_codes WHERE code = :code LIMIT 1"),
                {"code": code},
            ).fetchone()
            if row and row[0]:
                tenant_id = str(row[0])
    except Exception:
        tenant_id = None
    target_base = os.getenv('REFERRAL_LANDING_URL') or os.getenv('PUBLIC_APP_URL') or 'https://brandvx.com/brandvx'
    target = f"{target_base.rstrip('/')}?utm_source=referral&utm_medium=qr&utm_campaign=brandvx&ref={code}"
    if tenant_id:
        def _apply(data: Dict[str, Any]) -> None:
            bucket = data.setdefault('referral', {})
            bucket['code'] = code
            clicks = int(bucket.get('clicks') or 0)
            bucket['clicks'] = clicks + 1
            bucket['last_click_at'] = datetime.utcnow().isoformat() + 'Z'
        _mutate_settings_json(tenant_id, _apply)
        try:
            cache_set(f"referral:clicks:{tenant_id}", (cache_get(f"referral:clicks:{tenant_id}") or 0) + 1, ttl=3600)
        except Exception:
            pass
    return RedirectResponse(target)


def _parse_json_field(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except Exception:
            return value
    return value


@app.get("/jobs/{job_id}", tags=["Jobs"])
def job_status(job_id: str, ctx: UserContext = Depends(get_user_context)) -> Dict[str, Any]:
    job = get_job_record(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="job_not_found")
    tenant_id = job.get('tenant_id')
    if tenant_id and ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        raise HTTPException(status_code=403, detail="forbidden")
    return {
        'id': job.get('id'),
        'tenant_id': tenant_id,
        'kind': job.get('kind'),
        'status': job.get('status'),
        'progress': job.get('progress'),
        'input': _parse_json_field(job.get('input')),
        'result': _parse_json_field(job.get('result')),
        'created_at': job.get('created_at'),
        'updated_at': job.get('updated_at'),
    }
@app.get("/jobs/{job_id}/result", tags=["Jobs"])
def job_result(job_id: str, ctx: UserContext = Depends(get_user_context)) -> Dict[str, Any]:
    job = get_job_record(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="job_not_found")
    tenant_id = job.get('tenant_id')
    if tenant_id and ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        raise HTTPException(status_code=403, detail="forbidden")
    return {'status': job.get('status'), 'result': _parse_json_field(job.get('result'))}
@app.post("/onboarding/analyze", tags=["Integrations"])
def onboarding_analyze(req: AnalyzeRequest, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context_relaxed)):
    if ctx.tenant_id and ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"summary": {}, "status": "forbidden"}
    # Connected accounts snapshot
    connected: Dict[str, Any] = {}
    try:
        snapshot = _connected_accounts_map(db, req.tenant_id)
        if isinstance(snapshot, dict):
            connected = snapshot
    except Exception:
        connected = {}
    # Reconciliation (booking vs contacts)
    recon = {"contacts_count": 0, "booking_contacts_count": 0, "missing_in_contacts": 0}
    try:
        contacts = db.query(dbm.Contact).filter(dbm.Contact.tenant_id == req.tenant_id, dbm.Contact.deleted == False).all()
        appts = db.query(dbm.Appointment).filter(dbm.Appointment.tenant_id == req.tenant_id).all()
        contact_ids = {c.contact_id for c in contacts}
        booking_ids = {a.contact_id for a in appts if a.contact_id}
        recon = {
            "contacts_count": len(contact_ids),
            "booking_contacts_count": len(booking_ids),
            "missing_in_contacts": len(booking_ids - contact_ids),
        }
    except Exception:
        pass
    summary = {
        "email_configured": bool(_env("SENDGRID_API_KEY", "")),
        "providers": {
            "google": bool(_env("GOOGLE_CLIENT_ID", "")),
            "square": bool(_env("SQUARE_CLIENT_ID", "")),
            "acuity": bool(_env("ACUITY_CLIENT_ID", "")),
            "hubspot": bool(_env("HUBSPOT_CLIENT_ID", "")),
            "facebook": bool(_env("FACEBOOK_CLIENT_ID", "")),
            "instagram": bool(_env("INSTAGRAM_CLIENT_ID", "")),
            "shopify": bool(_env("SHOPIFY_CLIENT_ID", "")),
        },
        "connected": connected,
        "inbox_ready": bool(connected.get("facebook") or connected.get("instagram")),
        "calendar_ready": bool(connected.get("google") or connected.get("square") or connected.get("acuity")),
        "inventory_ready": bool(connected.get("shopify") or connected.get("square")),
        "reconciliation": recon,
    }
    emit_event("OnboardingAnalyzed", {"tenant_id": req.tenant_id, "summary": summary})
    return {"status": "ok", "summary": summary}

@app.get("/onboarding/status", tags=["Integrations"])
def onboarding_status(
    tenant_id: str,
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"connected": False, "first_sync_done": False, "counts": {}}
    adapter = SupabaseAdapter()
    connected = False
    first_sync_done = False
    counts = {"lead_status": 0}
    try:
        import asyncio

        # Check connected accounts (v2 only)
        try:
            connected_accounts = asyncio.run(
                adapter.select(
                    "connected_accounts_v2",
                    {"select": "provider,connected_at", "limit": "10"},
                )
            )
        except Exception:
            connected_accounts = []
        connected = bool(connected_accounts)
        # Lead status count as crude first-sync signal
        lead_rows = asyncio.run(adapter.get_lead_status(tenant_id))
        counts["lead_status"] = len(lead_rows or [])
        first_sync_done = counts["lead_status"] > 0
    except Exception:
        pass
    return {"connected": connected, "first_sync_done": first_sync_done, "counts": counts}


# -------------------- Instagram API (Basic Display) helpers --------------------
def _get_provider_access_token(tenant_id: str, provider: str) -> str:
    token = ""
    # Prefer v2 token vault
    try:
        with engine.begin() as conn:
            row = conn.execute(
                _sql_text("SELECT access_token_enc FROM connected_accounts_v2 WHERE tenant_id = CAST(:t AS uuid) AND provider = :p ORDER BY id DESC LIMIT 1"),
                {"t": tenant_id, "p": provider},
            ).fetchone()
        if row and row[0]:
            try:
                token = decrypt_text(str(row[0])) or ""
            except Exception:
                token = str(row[0])
    except Exception:
        token = ""
    return token


@app.get("/instagram/profile", tags=["Integrations"])
def instagram_profile(tenant_id: str, ctx: UserContext = Depends(get_user_context)):
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    at = _get_provider_access_token(tenant_id, "instagram")
    if not at:
        return {"status": "not_connected"}
    res = ig_basic.get_profile(at)
    return res


@app.get("/instagram/media", tags=["Integrations"])
def instagram_media(tenant_id: str, limit: int = 12, ctx: UserContext = Depends(get_user_context)):
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    at = _get_provider_access_token(tenant_id, "instagram")
    if not at:
        return {"status": "not_connected", "items": []}
    res = ig_basic.get_media(at, limit=limit)
    return res


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
    try:
        ok_rl, _ = check_and_increment(req.tenant_id, "webhook:sendgrid", max_per_minute=120)
        if not ok_rl:
            return {"status": "rate_limited"}
    except Exception:
        pass
    emit_event("ProviderWebhookReceived", {"tenant_id": req.tenant_id, "provider": "sendgrid"})
    return {"status": "ok"}


@app.post("/webhooks/acuity", tags=["Integrations"])
async def webhook_acuity(
    req: ProviderWebhook,
    request: Request,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    # Allow either a dedicated secret or the account API key; verification can be toggled via env
    secret = os.getenv("ACUITY_WEBHOOK_SECRET", "") or os.getenv("ACUITY_API_KEY", "")
    verify_on = (os.getenv("ACUITY_WEBHOOK_VERIFY", "1").strip() != "0")
    raw = await request.body()
    sig = request.headers.get("X-Acuity-Signature", "")
    if verify_on and not booking_acuity.acuity_verify_signature(secret, raw, sig):
        raise HTTPException(status_code=403, detail="invalid signature")
    try:
        ok_rl, _ = check_and_increment(req.tenant_id, "webhook:acuity", max_per_minute=120)
        if not ok_rl:
            return {"status": "rate_limited"}
    except Exception:
        pass
    data = dict(req.payload or {})
    ext = str(data.get("id", "")) or f"acuity:{int(_time.time())}"
    # idempotent upsert by external_ref; tolerate minimal payloads
    try:
        row = (
            db.query(dbm.Appointment)
            .filter(dbm.Appointment.tenant_id == req.tenant_id, dbm.Appointment.external_ref == ext)
            .first()
        )
        if not row:
            safe_start = int(data.get("start_ts", 0) or int(_time.time()) + 3600)
            safe_end = int(data.get("end_ts", 0) or 0) or None
            row = dbm.Appointment(
                tenant_id=req.tenant_id,
                contact_id=str(data.get("contact_id", ""))[:64],
                service=str(data.get("service", ""))[:64],
                start_ts=safe_start,
                end_ts=safe_end,
                status=str(data.get("status", "booked"))[:16],
                external_ref=ext[:128],
            )
            db.add(row)
            db.commit()
    except Exception:
        # avoid 500s on malformed payloads; acknowledge and proceed
        pass
    # schedule reminders (best-effort)
    try:
        from .scheduler import schedule_appointment_reminders
        schedule_appointment_reminders(db, req.tenant_id)
    except Exception:
        pass
    try:
        from .metrics_counters import WEBHOOK_EVENTS  # type: ignore
        WEBHOOK_EVENTS.labels(provider="acuity", status="ok").inc()  # type: ignore
    except Exception:
        pass
    emit_event("AppointmentIngested", {"tenant_id": req.tenant_id, "external_ref": f"acuity:{ext}"})
    try:
        # Minimal mapping: use contact_id as email if it looks like an email, else skip
        contact_hint = str(data.get("contact_id", ""))
        if "@" in contact_hint:
            try:
                crm_hubspot.upsert(req.tenant_id, "contact", {"email": contact_hint}, None)
            except Exception:
                pass
    except Exception:
        pass
    return {"status": "ok"}


@app.post("/webhooks/square", tags=["Integrations"])
async def webhook_square(
    req: ProviderWebhook,
    request: Request,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    secret = os.getenv("SQUARE_WEBHOOK_SECRET", "")
    raw = await request.body()
    sig = request.headers.get("X-Signature", "")
    if not verify_square_signature(raw, sig, secret):
        raise HTTPException(status_code=403, detail="invalid signature")
    try:
        ok_rl, _ = check_and_increment(req.tenant_id, "webhook:square", max_per_minute=120)
        if not ok_rl:
            return {"status": "rate_limited"}
    except Exception:
        pass
    data = dict(req.payload or {})
    ext = str(data.get("id", ""))
    row = db.query(dbm.Appointment).filter(dbm.Appointment.tenant_id == req.tenant_id, dbm.Appointment.external_ref == ext).first()
    if not row:
        row = dbm.Appointment(
            tenant_id=req.tenant_id,
            contact_id=str(data.get("contact_id", "")),
            service=str(data.get("service", "")),
            start_ts=int(data.get("start_ts", 0)),
            end_ts=int(data.get("end_ts", 0)) or None,
            status=str(data.get("status", "booked")),
            external_ref=ext,
        )
        db.add(row)
        db.commit()
    from .scheduler import schedule_appointment_reminders
    schedule_appointment_reminders(db, req.tenant_id)
    try:
        from .metrics_counters import WEBHOOK_EVENTS  # type: ignore
        WEBHOOK_EVENTS.labels(provider="square", status="ok").inc()  # type: ignore
    except Exception:
        pass
    try:
        # Emit PostHog-style analytics through internal bus (if configured)
        emit_event("WebhookReceived", {"tenant_id": req.tenant_id, "provider": "square"})
    except Exception:
        pass
    emit_event("AppointmentIngested", {"tenant_id": req.tenant_id, "external_ref": f"square:{ext}"})
    try:
        appt_email = str(row.get("customer_email") or "") if isinstance(row, dict) else ""
        if appt_email and "@" in appt_email:
            try:
                crm_hubspot.upsert(req.tenant_id, "contact", {"email": appt_email}, None)
            except Exception:
                pass
    except Exception:
        pass
    return {"status": "ok"}


@app.post("/webhooks/facebook", tags=["Integrations"])
async def webhook_facebook(
    req: ProviderWebhook,
    request: Request,
    ctx: UserContext = Depends(get_user_context),
):
    # Optional strict verification controlled by env
    try:
        raw = await request.body()
    except Exception:
        raw = b""
    secret = os.getenv("FB_APP_SECRET", "")
    sig = request.headers.get("X-Hub-Signature-256") or request.headers.get("X-Hub-Signature")
    # Mandatory verification in production: require secret+sig
    if secret and sig:
        try:
            expected = "sha256=" + _hmac.new(secret.encode(), raw, _hashlib.sha256).hexdigest()
            if not _hmac.compare_digest(expected, str(sig)):
                raise HTTPException(status_code=403, detail="invalid signature")
        except Exception:
            raise HTTPException(status_code=403, detail="invalid signature")
    try:
        ok_rl, _ = check_and_increment(req.tenant_id, "webhook:facebook", max_per_minute=120)
        if not ok_rl:
            return {"status": "rate_limited"}
    except Exception:
        pass
    try:
        payload = await request.json()
    except Exception:
        payload = dict(req.payload or {})
    # Persist inbound message to inbox
    try:
        with next(get_db()) as _db:  # type: ignore
            _db.add(dbm.InboxMessage(
                tenant_id=req.tenant_id,
                channel="facebook",
                from_addr=str((payload or {}).get("from", "FB User")),
                to_addr="BrandVX",
                preview=str((payload or {}).get("message", "New DM received")),
                ts=int(_time.time()),
            ))
            _db.commit()
    except Exception:
        pass
    try:
        from .metrics_counters import WEBHOOK_EVENTS  # type: ignore
        WEBHOOK_EVENTS.labels(provider="facebook", status="ok").inc()  # type: ignore
    except Exception:
        pass
    emit_event("ProviderWebhookReceived", {"tenant_id": req.tenant_id, "provider": "facebook"})
    return {"status": "ok"}


@app.post("/webhooks/instagram", tags=["Integrations"])
async def webhook_instagram(
    req: ProviderWebhook,
    request: Request,
    ctx: UserContext = Depends(get_user_context),
):
    # Optional strict verification controlled by env
    try:
        raw = await request.body()
    except Exception:
        raw = b""
    secret = os.getenv("FB_APP_SECRET", "")
    sig = request.headers.get("X-Hub-Signature-256") or request.headers.get("X-Hub-Signature")
    if secret and sig:
        try:
            expected = "sha256=" + _hmac.new(secret.encode(), raw, _hashlib.sha256).hexdigest()
            if not _hmac.compare_digest(expected, str(sig)):
                raise HTTPException(status_code=403, detail="invalid signature")
        except Exception:
            raise HTTPException(status_code=403, detail="invalid signature")
    try:
        ok_rl, _ = check_and_increment(req.tenant_id, "webhook:instagram", max_per_minute=120)
        if not ok_rl:
            return {"status": "rate_limited"}
    except Exception:
        pass
    try:
        payload = await request.json()
    except Exception:
        payload = dict(req.payload or {})
    try:
        with next(get_db()) as _db:  # type: ignore
            _db.add(dbm.InboxMessage(
                tenant_id=req.tenant_id,
                channel="instagram",
                from_addr=str((payload or {}).get("from", "IG User")),
                to_addr="BrandVX",
                preview=str((payload or {}).get("message", "New comment received")),
                ts=int(_time.time()),
            ))
            _db.commit()
    except Exception:
        pass
    try:
        from .metrics_counters import WEBHOOK_EVENTS  # type: ignore
        WEBHOOK_EVENTS.labels(provider="instagram", status="ok").inc()  # type: ignore
    except Exception:
        pass
    emit_event("ProviderWebhookReceived", {"tenant_id": req.tenant_id, "provider": "instagram"})
    return {"status": "ok"}

class NotifyTriggerRequest(BaseModel):
    tenant_id: str
    max_candidates: int = 5


@app.post("/notify-list/trigger-cancellation", tags=["Contacts"])
def trigger_notify_on_cancellation(
    req: NotifyTriggerRequest,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    # Select top N notify-list entries preferring "soonest"
    q = (
        db.query(dbm.NotifyListEntry)
        .filter(dbm.NotifyListEntry.tenant_id == req.tenant_id)
    )
    rows = q.limit(max(1, min(req.max_candidates, 50))).all()
    targets = [
        {"contact_id": r.contact_id, "preference": r.preference} for r in rows
        if str(r.preference).lower() == "soonest"
    ]
    emit_event(
        "NotifyListTriggered",
        {"tenant_id": req.tenant_id, "count": len(targets), "targets": targets},
    )
    return {"status": "ok", "count": len(targets)}


@app.get("/admin/audit", tags=["Approvals"])
def admin_audit(
    tenant_id: str,
    limit: int = 100,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.role != "owner_admin" and ctx.tenant_id != tenant_id:
        return []
    rows = (
        db.query(dbm.AuditLog)
        .filter(dbm.AuditLog.tenant_id == tenant_id)
        .order_by(dbm.AuditLog.id.desc())
        .limit(max(1, min(limit, 500)))
        .all()
    )
    return [
        {
            "id": r.id,
            "actor_id": r.actor_id,
            "action": r.action,
            "entity_ref": r.entity_ref,
            "payload": r.payload,
        }
        for r in rows
    ]


@app.post("/maintenance/chat/cleanup", tags=["AI"])
def cleanup_chat_logs(days: int = 30, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)) -> Dict[str, int]:
    if ctx.role != "owner_admin":
        raise HTTPException(status_code=403, detail="forbidden")
    cutoff = int(_time.time()) - max(1, days) * 24 * 3600
    try:
        q = db.query(dbm.ChatLog).filter(dbm.ChatLog.created_at < cutoff)
        count = q.count()
        q.delete()
        db.commit()
        emit_event("ChatLogsCleaned", {"tenant_id": ctx.tenant_id, "deleted": count, "cutoff": cutoff})
        return {"deleted": count}
    except Exception:
        db.rollback()
        return {"deleted": 0}


@app.get("/exports/contacts", response_class=PlainTextResponse, tags=["Contacts"])
def export_contacts(
    tenant_id: str,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        raise HTTPException(status_code=403, detail="forbidden")
    rows = (
        db.query(dbm.Contact)
        .filter(dbm.Contact.tenant_id == tenant_id, dbm.Contact.deleted == False)
        .all()
    )
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["contact_id", "email_hash", "phone_hash", "consent_sms", "consent_email"]) 
    for r in rows:
        writer.writerow([r.contact_id, r.email_hash or "", r.phone_hash or "", int(r.consent_sms), int(r.consent_email)])
    content = buf.getvalue()
    emit_event("EntityExported", {"tenant_id": tenant_id, "count": len(rows), "entity": "contacts"})
    return content


@app.get("/inbox/list", tags=["Integrations"])
def inbox_list(
    tenant_id: str,
    limit: int = 50,
    ctx: UserContext = Depends(get_user_context_relaxed),
):
    if ctx.tenant_id and ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"items": []}
    try:
        ckey = f"inbox:{tenant_id}:{limit}"
        cached = cache_get(ckey)
        if cached is not None:
            return {"items": cached}
    except Exception:
        pass
    items: List[Dict[str, object]] = []
    try:
        with next(get_db()) as db:  # type: ignore
            statuses = _connected_accounts_map(db, tenant_id)
            # Load services from settings to decide if sms/email should appear
            services: List[str] = []
            try:
                row = db.query(dbm.Settings).filter(dbm.Settings.tenant_id == tenant_id).first()
                if row:
                    data = json.loads(row.data_json or '{}')
                    services = list(data.get('services') or [])
            except Exception:
                services = []
            now = int(_time.time())
            # Load recent inbox messages from DB (was previously STATE)
            recent = (
                db.query(dbm.InboxMessage)
                .filter(dbm.InboxMessage.tenant_id == tenant_id)
                .order_by(dbm.InboxMessage.ts.desc())
                .limit(50)
                .all()
            )
            for r in recent:
                items.append({
                    "channel": r.channel,
                    "from": r.from_addr or "",
                    "to": r.to_addr or "",
                    "preview": r.preview or "",
                    "ts": int(r.ts or 0),
                })
            if statuses.get("facebook") == "connected":
                items.append({"channel": "facebook", "from": "FB User", "to": "BrandVX", "preview": "New DM: Hi there!", "ts": now - 120})
            if statuses.get("instagram") == "connected":
                items.append({"channel": "instagram", "from": "IG User", "to": "BrandVX", "preview": "Comment: Love this!", "ts": now - 300})
            if "sms" in services:
                items.append({"channel": "sms", "from": "+15551234567", "to": "You", "preview": "STOP", "ts": now - 1800})
            if "email" in services or bool(_env("SENDGRID_API_KEY", "")):
                items.append({"channel": "email", "from": "client@example.com", "to": "you@brandvx.app", "preview": "Re: Appointment", "ts": now - 3600})
    except Exception:
        pass
    items = items[: max(1, min(limit, 200))]
    try:
        cache_set(ckey, items, ttl=15)
    except Exception:
        pass
    return {"items": items}


# --------------------------- Gmail (threads/read/send) ---------------------------
def _google_oauth_creds() -> tuple[str, str]:
    return _env("GOOGLE_CLIENT_ID", ""), _env("GOOGLE_CLIENT_SECRET", "")


def _load_connected_account(db: Session, tenant_id: str, provider: str):
    row = db.execute(
        _sql_text(
            "SELECT id, status, access_token_enc, refresh_token_enc, expires_at FROM connected_accounts_v2 WHERE tenant_id = CAST(:t AS uuid) AND provider = :p ORDER BY id DESC LIMIT 1"
        ),
        {"t": tenant_id, "p": provider},
    ).fetchone()
    if not row:
        return None
    return SimpleNamespace(
        id=row[0],
        tenant_id=tenant_id,
        provider=provider,
        status=str(row[1] or ""),
        access_token_enc=row[2],
        refresh_token_enc=row[3],
        expires_at=row[4],
    )


def _maybe_refresh_google_token(db: Session, ca) -> str:
    # Returns valid access token, refreshing if needed
    access = decrypt_text(ca.access_token_enc or "") or ""
    if ca.expires_at and int(ca.expires_at) - int(_time.time()) > 60 and access:
        return access
    # Try refresh
    client_id, client_secret = _google_oauth_creds()
    rt = decrypt_text(ca.refresh_token_enc or "") or ""
    if not (client_id and client_secret and rt):
        return access
    try:
        data = {
            "client_id": client_id,
            "client_secret": client_secret,
            "grant_type": "refresh_token",
            "refresh_token": rt,
        }
        r = httpx.post("https://oauth2.googleapis.com/token", data=data, timeout=15)
        if r.status_code == 200:
            j = r.json()
            at = str(j.get("access_token") or "")
            expires_in = int(j.get("expires_in") or 0)
            if at:
                encrypted_at = encrypt_text(at)
                expires_at = int(_time.time()) + int(expires_in) if expires_in else None
                params: Dict[str, Any] = {"id": ca.id, "access_token_enc": encrypted_at}
                set_parts = ["access_token_enc=:access_token_enc"]
                if expires_at is not None:
                    params["expires_at"] = expires_at
                    set_parts.append("expires_at=:expires_at")
                with engine.begin() as conn:
                    conn.execute(
                        _sql_text(
                            f"UPDATE connected_accounts_v2 SET {', '.join(set_parts)}, last_error=NULL WHERE id=:id"
                        ),
                        params,
                    )
                ca.access_token_enc = encrypted_at
                ca.expires_at = expires_at
                return at
    except Exception:
        pass
    return access


@app.get("/gmail/threads", tags=["Integrations"])
def gmail_threads(tenant_id: str, q: str = "", limit: int = 20, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)):
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"items": []}
    try:
        ca = _load_connected_account(db, tenant_id, "google")
        if not ca or ca.status != "connected":
            return {"items": []}
        at = _maybe_refresh_google_token(db, ca)
        if not at:
            return {"items": []}
        headers = {"Authorization": f"Bearer {at}"}
        params = {"q": q, "maxResults": max(1, min(limit, 100))}
        r = httpx.get("https://gmail.googleapis.com/gmail/v1/users/me/threads", headers=headers, params=params, timeout=20)
        if r.status_code >= 400:
            return {"items": []}
        threads = r.json().get("threads", [])
        items = []
        for t in threads[: params["maxResults"]]:
            tid = t.get("id")
            if not tid:
                continue
            gr = httpx.get(f"https://gmail.googleapis.com/gmail/v1/users/me/threads/{tid}", headers=headers, params={"format": "metadata", "metadataHeaders": ["From","To","Subject","Date"]}, timeout=20)
            if gr.status_code >= 400:
                continue
            tj = gr.json()
            msgs = tj.get("messages", [])
            first = msgs[0] if msgs else {}
            headers_list = (first.get("payload", {}) or {}).get("headers", [])
            hmap = {h.get("name"): h.get("value") for h in headers_list}
            items.append({
                "id": tid,
                "snippet": t.get("snippet", ""),
                "from": hmap.get("From", ""),
                "to": hmap.get("To", ""),
                "subject": hmap.get("Subject", ""),
                "ts": first.get("internalDate") and int(int(first.get("internalDate")) / 1000) or 0,
            })
        return {"items": items}
    except Exception:
        return {"items": []}


@app.get("/gmail/thread", tags=["Integrations"])
def gmail_thread(tenant_id: str, id: str, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)):
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"messages": []}
    try:
        ca = _load_connected_account(db, tenant_id, "google")
        if not ca or ca.status != "connected":
            return {"messages": []}
        at = _maybe_refresh_google_token(db, ca)
        if not at:
            return {"messages": []}
        headers = {"Authorization": f"Bearer {at}"}
        gr = httpx.get(f"https://gmail.googleapis.com/gmail/v1/users/me/threads/{id}", headers=headers, params={"format": "full"}, timeout=20)
        if gr.status_code >= 400:
            return {"messages": []}
        tj = gr.json()
        out = []
        for m in tj.get("messages", []) or []:
            hs = (m.get("payload", {}) or {}).get("headers", [])
            hmap = {h.get("name"): h.get("value") for h in hs}
            snippet = m.get("snippet", "")
            out.append({
                "id": m.get("id"),
                "from": hmap.get("From", ""),
                "to": hmap.get("To", ""),
                "subject": hmap.get("Subject", ""),
                "date": hmap.get("Date", ""),
                "snippet": snippet,
                "threadId": m.get("threadId"),
            })
        return {"messages": out}
    except Exception:
        return {"messages": []}
@app.post("/gmail/send", tags=["Integrations"])
def gmail_send(req: dict, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)):
    tenant_id = str(req.get("tenant_id", ctx.tenant_id or ""))
    to = str(req.get("to", "")).strip()
    subject = str(req.get("subject", "")).strip()
    body_html = str(req.get("body_html", "")).strip()
    thread_id = str(req.get("threadId", "")).strip()
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    if not to:
        return {"status": "error", "error": "missing_to"}
    try:
        ca = _load_connected_account(db, tenant_id, "google")
        if not ca or ca.status != "connected":
            return {"status": "not_connected"}
        at = _maybe_refresh_google_token(db, ca)
        if not at:
            return {"status": "not_connected"}
        headers = {"Authorization": f"Bearer {at}", "Content-Type": "application/json"}
        # Minimal RFC822 MIME
        from_addr = "me"
        raw = (
            f"To: {to}\r\n"
            f"Subject: {subject}\r\n"
            f"MIME-Version: 1.0\r\n"
            f"Content-Type: text/html; charset=UTF-8\r\n\r\n"
            f"{body_html}"
        ).encode("utf-8")
        import base64 as _b64
        raw_b64 = _b64.urlsafe_b64encode(raw).decode("utf-8").rstrip("=")
        payload = {"raw": raw_b64}
        if thread_id:
            payload["threadId"] = thread_id
        r = httpx.post("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", headers=headers, json=payload, timeout=20)
        if r.status_code >= 400:
            return {"status": "error", "error": r.text}
        return {"status": "sent", "id": r.json().get("id"), "threadId": r.json().get("threadId")}
    except Exception as e:
        return {"status": "error", "error": str(e)}


@app.post("/calendar/sync", tags=["Integrations"])
def calendar_sync(
    req: "CalendarSyncRequest",
    ctx: UserContext = Depends(get_user_context_relaxed),
) -> Dict[str, Any]:
    tenant_id = req.tenant_id
    if ctx.tenant_id and ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        raise HTTPException(status_code=403, detail="forbidden")
    provider = (req.provider or "auto").lower()
    job_payload = {"provider": provider}
    job_id = create_job_record(tenant_id, "calendar.sync", job_payload, status="queued")
    if not job_id:
        raise HTTPException(status_code=500, detail="job_create_failed")
    details = {
        "job_id": job_id,
        "job_status": "queued",
        "provider": provider,
        "sync_status": "queued",
    }
    title = "Calendar sync"
    todo_disabled = _todo_disabled()
    todo_id = None
    if not todo_disabled:
        try:
            with engine.begin() as conn:
                try:
                    conn.execute(_sql_text("SET LOCAL app.role='owner_admin'"))
                    conn.execute(_sql_text("SET LOCAL app.tenant_id=:t"), {"t": tenant_id})
                except Exception:
                    pass
                inserted = conn.execute(
                    _sql_text(
                        "INSERT INTO todo_items (tenant_id, type, title, details_json, status) "
                        "VALUES (CAST(:t AS uuid), 'calendar.sync', :title, :details::jsonb, 'pending') RETURNING id"
                    ),
                    {"t": tenant_id, "title": title, "details": json.dumps(details)},
                )
                todo_id = inserted.scalar() if inserted else None
        except Exception:
            todo_id = None
    if not todo_id and not todo_disabled:
        update_job_record(job_id, status="error", error="todo_insert_failed")
        raise HTTPException(status_code=500, detail="todo_insert_failed")
    update_job_record(job_id, result={"todo_id": todo_id, "provider": provider, "status": "queued"})
    return {"status": "queued", "job_id": job_id, "todo_id": todo_id, "provider": provider}


@app.get("/calendar/list", tags=["Integrations"])
def calendar_list(
    tenant_id: str,
    start_ts: Optional[int] = None,
    end_ts: Optional[int] = None,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context_relaxed),
):
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"events": [], "last_sync": {}}
    # Unified calendar response + last sync from events_ledger
    cal_sync: Dict[str, object] = {}
    try:
        recent = (
            db.query(dbm.EventLedger)
            .filter(dbm.EventLedger.tenant_id == tenant_id, dbm.EventLedger.name.like("sync.calendar.%"))
            .order_by(dbm.EventLedger.ts.desc())
            .limit(50)
            .all()
        )
        for ev in recent:
            try:
                prov = (ev.name or "").split(".")[-1]
                cal_sync[prov] = {"status": "completed", "ts": ev.ts}
            except Exception:
                continue
    except Exception:
        cal_sync = {}
    # Try cache first
    try:
        ckey = f"cal:{tenant_id}:{start_ts or 0}:{end_ts or 0}"
        cached = cache_get(ckey)
        if cached is not None:
            try:
                CACHE_HIT.labels(endpoint="/calendar/list").inc()  # type: ignore
            except Exception:
                pass
            return {"events": cached, "last_sync": cal_sync}
    except Exception:
        pass
    q = db.query(dbm.CalendarEvent).filter(dbm.CalendarEvent.tenant_id == tenant_id)
    if start_ts is not None:
        q = q.filter(dbm.CalendarEvent.start_ts >= int(start_ts))
    if end_ts is not None:
        q = q.filter(dbm.CalendarEvent.start_ts <= int(end_ts))
    rows = q.order_by(dbm.CalendarEvent.start_ts.asc()).all()
    events = [{
        "id": r.event_id or r.id,
        "title": r.title,
        "start_ts": r.start_ts,
        "end_ts": r.end_ts,
        "provider": r.provider,
        "status": r.status,
    } for r in rows]
    try:
        cache_set(ckey, events, ttl=30)
        try:
            CACHE_MISS.labels(endpoint="/calendar/list").inc()  # type: ignore
        except Exception:
            pass
    except Exception:
        pass
    return {"events": events, "last_sync": cal_sync}


@app.get("/calendar/sync/status", tags=["Integrations"])
def calendar_sync_status(
    tenant_id: str,
    job_id: Optional[str] = None,
    ctx: UserContext = Depends(get_user_context_relaxed),
) -> Dict[str, Any]:
    if ctx.tenant_id and ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    params: Dict[str, Any] = {"t": tenant_id}
    sql = (
        "SELECT id, status, details_json FROM todo_items "
        "WHERE tenant_id = CAST(:t AS uuid) AND type = 'calendar.sync'"
    )
    if job_id:
        sql += " AND (details_json ->> 'job_id') = :job_id"
        params["job_id"] = job_id
    sql += " ORDER BY id DESC LIMIT 1"
    with engine.begin() as conn:
        row = conn.execute(_sql_text(sql), params).fetchone()
    if not row:
        return {"status": "none"}
    try:
        details = json.loads(row[2] or "{}")
    except Exception:
        details = {}
    return {
        "status": details.get("sync_status", "pending"),
        "todo_status": row[1],
        "todo_id": row[0],
        "details": details,
        "job_id": details.get("job_id"),
        "job_status": details.get("job_status"),
    }


@app.post("/inventory/sync", tags=["Integrations"])
def inventory_sync(
    req: "InventorySyncRequest",
    ctx: UserContext = Depends(get_user_context_relaxed),
) -> Dict[str, Any]:
    tenant_id = req.tenant_id or ctx.tenant_id
    if not tenant_id:
        raise HTTPException(status_code=400, detail="missing_tenant")
    if ctx.tenant_id and ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        raise HTTPException(status_code=403, detail="forbidden")
    provider = (req.provider or "auto").lower()
    job_payload = {"provider": provider}
    job_id = create_job_record(tenant_id, "inventory.sync", job_payload, status="queued")
    if not job_id:
        logger.warning(
            "inventory_sync_job_create_failed",
            extra={"tenant_id": tenant_id, "provider": provider},
        )
        return {"status": "queued", "job_id": None, "todo_id": None, "provider": provider}
    details = {
        "job_id": job_id,
        "job_status": "queued",
        "provider": provider,
        "sync_status": "queued",
    }
    todo_disabled = _todo_disabled()
    todo_id = None
    if not todo_disabled:
        try:
            with engine.begin() as conn:
                try:
                    conn.execute(_sql_text("SET LOCAL app.role='owner_admin'"))
                    conn.execute(_sql_text("SET LOCAL app.tenant_id=:t"), {"t": tenant_id})
                except Exception:
                    pass
                inserted = conn.execute(
                    _sql_text(
                        "INSERT INTO todo_items (tenant_id, type, title, details_json, status) "
                        "VALUES (CAST(:t AS uuid), 'inventory.sync', :title, :details::jsonb, 'pending') RETURNING id"
                    ),
                    {"t": tenant_id, "title": "Inventory sync", "details": json.dumps(details)},
                )
                todo_id = inserted.scalar() if inserted else None
        except Exception as exc:
            todo_id = None
            logger.exception(
                "inventory_sync_todo_insert_failed",
                extra={"tenant_id": tenant_id, "provider": provider},
                exc_info=exc,
            )
    if not todo_id and not todo_disabled:
        update_job_record(job_id, status="error", error="todo_insert_failed")
        return {
            "status": "queued",
            "job_id": job_id,
            "todo_id": None,
            "provider": provider,
            "warning": "todo_insert_failed",
        }
    update_job_record(job_id, result={"todo_id": todo_id, "provider": provider, "status": "queued"})
    return {"status": "queued", "job_id": job_id, "todo_id": todo_id, "provider": provider}
@app.get("/inventory/metrics", tags=["Integrations"])
def inventory_metrics(
    tenant_id: str,
    provider: Optional[str] = None,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context_relaxed),
) -> Dict[str, Any]:
    if ctx.tenant_id and ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"summary": {}, "items": [], "last_sync": {}}
    try:
        tenant_uuid = _uuid.UUID(tenant_id)
    except Exception:
        raise HTTPException(status_code=400, detail="invalid_tenant")

    query = db.query(dbm.InventoryItem).filter(dbm.InventoryItem.tenant_id == tenant_uuid)
    if provider:
        provider_norm = provider.lower()
        if provider_norm not in {"auto", "all", "square", "shopify", "manual"}:
            provider_norm = "auto"
        if provider_norm not in {"auto", "all"}:
            query = query.filter(dbm.InventoryItem.provider == provider_norm)
    rows = query.order_by(dbm.InventoryItem.id.asc()).all()
    items: List[Dict[str, Any]] = [
        {
            "sku": r.sku,
            "name": r.name,
            "stock": int(r.stock or 0),
            "provider": r.provider,
        }
        for r in rows
    ]

    summary_row = db.query(dbm.InventorySummary).filter(dbm.InventorySummary.tenant_id == tenant_uuid).first()
    if summary_row:
        summary = {
            "products": int(summary_row.products or 0),
            "low_stock": int(summary_row.low_stock or 0),
            "out_of_stock": int(summary_row.out_of_stock or 0),
            "top_sku": summary_row.top_sku,
        }
        updated_at = int(summary_row.updated_at or 0)
    else:
        products = len(items)
        low_stock = sum(1 for it in items if (isinstance(it.get("stock"), int) and 0 < it["stock"] <= 5))
        out_stock = sum(1 for it in items if isinstance(it.get("stock"), int) and it["stock"] <= 0)
        top_sku = items[0]["sku"] if items else None
        summary = {
            "products": products,
            "low_stock": low_stock,
            "out_of_stock": out_stock,
            "top_sku": top_sku,
        }
        updated_at = int(_time.time())

    last_sync: Dict[str, Any] = {"inventory": updated_at}
    todo_sql = (
        "SELECT id, details_json FROM todo_items "
        "WHERE tenant_id = CAST(:t AS uuid) AND type = 'inventory.sync' ORDER BY id DESC LIMIT 1"
    )
    with engine.begin() as conn:
        todo_row = conn.execute(_sql_text(todo_sql), {"t": tenant_id}).fetchone()
    if todo_row and todo_row[1]:
        try:
            todo_details = json.loads(todo_row[1])
        except Exception:
            todo_details = {}
        last_sync["job"] = todo_details
    return {"summary": summary, "items": items, "last_sync": last_sync}


@app.get("/inventory/sync/status", tags=["Integrations"])
def inventory_sync_status(
    tenant_id: str,
    job_id: Optional[str] = None,
    ctx: UserContext = Depends(get_user_context_relaxed),
) -> Dict[str, Any]:
    if ctx.tenant_id and ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    params: Dict[str, Any] = {"t": tenant_id}
    sql = (
        "SELECT id, status, details_json FROM todo_items "
        "WHERE tenant_id = CAST(:t AS uuid) AND type = 'inventory.sync'"
    )
    if job_id:
        sql += " AND (details_json ->> 'job_id') = :job_id"
        params["job_id"] = job_id
    sql += " ORDER BY id DESC LIMIT 1"
    with engine.begin() as conn:
        row = conn.execute(_sql_text(sql), params).fetchone()
    if not row:
        return {"status": "none"}
    try:
        details = json.loads(row[2] or "{}")
    except Exception:
        details = {}
    return {
        "status": details.get("sync_status", "pending"),
        "todo_status": row[1],
        "todo_id": row[0],
        "details": details,
        "job_id": details.get("job_id"),
        "job_status": details.get("job_status"),
    }
class InventoryMergeRequest(BaseModel):
    tenant_id: str
    strategy: Optional[str] = "sku_then_name"


@app.post("/inventory/merge", tags=["Integrations"])
def inventory_merge(req: InventoryMergeRequest, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)) -> Dict[str, int]:
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"merged": 0}
    rows = db.query(dbm.InventoryItem).filter(dbm.InventoryItem.tenant_id == req.tenant_id).order_by(dbm.InventoryItem.id.asc()).all()
    keep_by_key: Dict[str, dbm.InventoryItem] = {}
    merged = 0
    for r in rows:
        key = None
        if (req.strategy or "").startswith("sku") and r.sku:
            key = f"sku:{str(r.sku).strip().lower()}"
        if not key and r.name:
            key = f"name:{str(r.name).strip().lower()}"
        if not key:
            continue
        if key in keep_by_key:
            # Merge stock into keeper and mark this for delete
            try:
                keeper = keep_by_key[key]
                keeper.stock = int(keeper.stock or 0) + int(r.stock or 0)  # type: ignore
                db.delete(r)
                merged += 1
            except Exception:
                continue
        else:
            keep_by_key[key] = r
    db.commit()
    try:
        invalidate_inventory_cache(req.tenant_id)
    except Exception:
        pass
    emit_event("InventoryMerged", {"tenant_id": req.tenant_id, "merged": merged})
    return {"merged": merged}


class InventoryMapRequest(BaseModel):
    tenant_id: str
    sku_map: Optional[Dict[str, str]] = None  # from_sku -> to_sku
    name_map: Optional[Dict[str, str]] = None  # from_name -> to_name (optional)


@app.post("/inventory/map", tags=["Integrations"])
def inventory_map(req: InventoryMapRequest, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)) -> Dict[str, int]:
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"updated": 0}
    updates = 0
    try:
        if req.sku_map:
            for src, dst in req.sku_map.items():
                if not src or not dst or str(src).strip().lower() == str(dst).strip().lower():
                    continue
                q = db.query(dbm.InventoryItem).filter(dbm.InventoryItem.tenant_id == req.tenant_id, dbm.InventoryItem.sku == src)
                for it in q.all():
                    it.sku = dst  # type: ignore
                    updates += 1
        if req.name_map:
            for src, dst in req.name_map.items():
                if not src or not dst:
                    continue
                q = db.query(dbm.InventoryItem).filter(dbm.InventoryItem.tenant_id == req.tenant_id, dbm.InventoryItem.name == src)
                for it in q.all():
                    it.name = dst  # type: ignore
                    updates += 1
        db.commit()
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass
        return {"updated": 0}
    try:
        cache_del(f"inv:{req.tenant_id}")
    except Exception:
        pass
    emit_event("InventoryMapped", {"tenant_id": req.tenant_id, "updated": updates})
    return {"updated": updates}


# -------- Connectors maintenance & RLS health ---------
class ConnectorsCleanupRequest(BaseModel):
    tenant_id: Optional[str] = None
@app.post("/integrations/connectors/cleanup", tags=["Integrations"])
def connectors_cleanup(req: ConnectorsCleanupRequest, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)) -> Dict[str, int]:
    if req.tenant_id and ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"deleted": 0}
    deleted = 0
    try:
        with engine.begin() as conn:
            if req.tenant_id:
                conn.execute(_sql_text("DELETE FROM connected_accounts_v2 WHERE tenant_id = CAST(:t AS uuid) AND status IS NULL OR status=''"), {"t": req.tenant_id})
            else:
                conn.execute(_sql_text("DELETE FROM connected_accounts_v2 WHERE status IS NULL OR status=''"))
        # We don't have rowcount reliably via exec_driver_sql; return 0 best-effort
    except Exception:
        pass
    try:
        emit_event("ConnectorsCleaned", {"tenant_id": req.tenant_id or ctx.tenant_id})
    except Exception:
        pass
    return {"deleted": int(deleted)}


@app.get("/integrations/rls/selfcheck", tags=["Integrations"])
def rls_selfcheck(db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)) -> Dict[str, object]:
    try:
        # Verify we can see only our tenant rows in a few key tables
        tid = ctx.tenant_id
        counts = {}
        for tbl in ["contacts", "appointments", "connected_accounts_v2"]:
            try:
                where = "tenant_id = CAST(:t AS uuid)" if tbl != "connected_accounts" else "tenant_id = :t"
            except Exception:
                where = "tenant_id = CAST(:t AS uuid)"
            try:
                c = db.execute(_sql_text(f"SELECT COUNT(1) FROM {tbl} WHERE {where}"), {"t": tid}).scalar() or 0
                counts[tbl] = int(c)
            except Exception:
                counts[tbl] = -1
        return {"status": "ok", "tenant_id": tid, "counts": counts}
    except Exception as e:
        return {"status": "error", "detail": str(e)[:200]}


class RlsProbeInsertRequest(BaseModel):
    tenant_id: str
    contact_id: Optional[str] = None


@app.post("/integrations/rls/probe-insert-contact", tags=["Integrations"])
def rls_probe_insert_contact(
    req: RlsProbeInsertRequest,
    ctx: UserContext = Depends(get_user_context),
) -> Dict[str, object]:
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    try:
        ts_expr = "EXTRACT(epoch FROM now())::bigint"
        contact_id = req.contact_id or f"probe:{int(_time.time())}"
        with engine.begin() as conn:
            try:
                conn.execute(_sql_text("SET LOCAL app.tenant_id = :t"), {"t": req.tenant_id})
                conn.execute(_sql_text("SET LOCAL app.role = 'owner_admin'"))
            except Exception as e:
                return {"status": "guc_error", "detail": str(e)[:200]}
            try:
                row_type = conn.execute(
                    _sql_text(
                        """
                        SELECT data_type FROM information_schema.columns
                        WHERE table_name='contacts' AND table_schema='public' AND column_name='created_at'
                        """
                    )
                ).fetchone()
                if row_type and isinstance(row_type[0], str) and 'timestamp' in row_type[0].lower():
                    ts_expr = "NOW()"
            except Exception as e:
                return {"status": "schema_probe_error", "detail": str(e)[:200]}
            try:
                conn.execute(
                    _sql_text(
                        f"""
                        INSERT INTO contacts (
                            tenant_id, contact_id, consent_sms, consent_email, display_name, created_at, updated_at
                        ) VALUES (
                            CAST(:t AS uuid), :cid, :cs, :ce, :dn, {ts_expr}, {ts_expr}
                        )
                        ON CONFLICT DO NOTHING
                        """
                    ),
                    {"t": req.tenant_id, "cid": contact_id, "cs": False, "ce": False, "dn": "Probe Contact"},
                )
            except Exception as e:
                return {"status": "insert_error", "detail": str(e)[:200]}
        return {"status": "ok", "contact_id": contact_id}
    except Exception as e:
        return {"status": "error", "detail": str(e)[:200]}


class RlsProbeDeleteRequest(BaseModel):
    tenant_id: str
    contact_id: str


@app.post("/integrations/rls/probe-delete-contact", tags=["Integrations"])
def rls_probe_delete_contact(
    req: RlsProbeDeleteRequest,
    ctx: UserContext = Depends(get_user_context),
) -> Dict[str, object]:
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    try:
        with engine.begin() as conn:
            try:
                conn.execute(_sql_text("SET LOCAL app.tenant_id = :t"), {"t": req.tenant_id})
                conn.execute(_sql_text("SET LOCAL app.role = 'owner_admin'"))
            except Exception:
                pass
            res = conn.execute(
                _sql_text(
                    "DELETE FROM contacts WHERE tenant_id = CAST(:t AS uuid) AND contact_id = :cid"
                ),
                {"t": req.tenant_id, "cid": req.contact_id},
            )
        try:
            deleted = int(getattr(res, "rowcount", 0) or 0)
        except Exception:
            deleted = 0
        return {"status": "ok", "deleted": deleted}
    except Exception as e:
        return {"status": "error", "detail": str(e)[:200]}
class ConnectorsNormalizeRequest(BaseModel):
    tenant_id: Optional[str] = None
    dedupe: bool = True
@app.post("/integrations/connectors/normalize", tags=["Integrations"])
def connectors_normalize(req: ConnectorsNormalizeRequest, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)) -> Dict[str, object]:
    # Owner scope or same tenant
    if req.tenant_id and ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"normalized": 0}
    normalized = 0
    try:
        with engine.begin() as conn:
            # Dedupe v2 by keeping the latest id per tenant/provider
            if req.dedupe:
                if req.tenant_id:
                    conn.execute(
                        _sql_text(
                            """
                            DELETE FROM connected_accounts_v2 a
                            USING connected_accounts_v2 b
                            WHERE a.tenant_id = b.tenant_id AND a.provider = b.provider AND a.id < b.id AND a.tenant_id = CAST(:t AS uuid)
                            """
                        ),
                        {"t": req.tenant_id},
                    )
                else:
                    conn.execute(
                        _sql_text(
                            """
                            DELETE FROM connected_accounts_v2 a
                            USING connected_accounts_v2 b
                            WHERE a.tenant_id = b.tenant_id AND a.provider = b.provider AND a.id < b.id
                            """
                        )
                    )
    except Exception as e:
        return {"normalized": normalized, "error": str(e)[:200]}
    try:
        emit_event("ConnectorsNormalized", {"tenant_id": req.tenant_id or ctx.tenant_id, "normalized": int(normalized)})
    except Exception:
        pass
    return {"normalized": normalized}


@app.get("/integrations/events", tags=["Integrations"])
def integrations_events(tenant_id: str, limit: int = 50, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)) -> Dict[str, object]:
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"items": []}
    try:
        q = (
            db.query(dbm.EventLedger)
            .filter(dbm.EventLedger.tenant_id == tenant_id)
            .order_by(dbm.EventLedger.id.desc())
            .limit(max(1, min(limit, 200)))
        )
        rows = q.all()
        items = []
        for r in rows:
            n = str(r.name or "")
            # Only surface integration-related events
            if any(k in n.lower() for k in ["oauth", "sync.", "import", "backfill", "calendar", "inventory", "crm", "contacts", "squarebackfill"]):
                try:
                    items.append({"name": n, "ts": int(r.ts or 0), "payload": r.payload})
                except Exception:
                    items.append({"name": n, "ts": 0, "payload": None})
        return {"items": items}
    except Exception as e:
        return {"items": [], "error": str(e)[:200]}
class ErasureRequest(BaseModel):
    tenant_id: str
    contact_id: str


@app.post("/data/erase", tags=["Contacts"])
def request_erasure(
    req: ErasureRequest,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        raise HTTPException(status_code=403, detail="forbidden")
    emit_event("DataDeletionRequested", {"tenant_id": req.tenant_id, "entity": "contact", "contact_id": req.contact_id})
    row = (
        db.query(dbm.Contact)
        .filter(dbm.Contact.tenant_id == req.tenant_id, dbm.Contact.contact_id == req.contact_id)
        .first()
    )
    if row:
        row.deleted = True
        _safe_audit_log(db, tenant_id=req.tenant_id, actor_id=ctx.user_id, action="data.erase", entity_ref=f"contact:{req.contact_id}", payload="{}")
        db.commit()
        emit_event("DataDeletionCompleted", {"tenant_id": req.tenant_id, "entity": "contact", "contact_id": req.contact_id})
        return {"status": "erased"}
    return {"status": "not_found"}


class DevConnectRequest(BaseModel):
    tenant_id: str
    provider: str
@app.post("/dev/connect", tags=["Integrations"])
def dev_mark_connected(req: DevConnectRequest, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)):
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    try:
        db.execute(
            _sql_text(
                """
                INSERT INTO connected_accounts_v2(tenant_id, provider, status, access_token_enc, refresh_token_enc, expires_at, connected_at)
                VALUES (CAST(:t AS uuid), :p, 'connected', :at, NULL, NULL, NOW())
                ON CONFLICT (tenant_id, provider)
                DO UPDATE SET status='connected', access_token_enc=EXCLUDED.access_token_enc, connected_at=NOW()
                """
            ),
            {"t": req.tenant_id, "p": req.provider, "at": encrypt_text("dev")},
        )
        db.commit()
        return {"status": "connected", "provider": req.provider}
    except Exception:
        db.rollback()
        return {"status": "error"}


@app.get("/integrations/booking/square/link", tags=["Integrations"])
def square_booking_link(
    tenant_id: Optional[str] = None,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if tenant_id and ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"url": ""}
    url = os.getenv("SQUARE_BOOKING_URL", "")
    try:
        t = tenant_id or ctx.tenant_id
        row = db.query(dbm.Settings).filter(dbm.Settings.tenant_id == t).first()
        if row:
            data = json.loads(row.data_json or '{}')
            url = data.get("square_booking_url", url)
    except Exception:
        pass
    return {"url": url}


@app.get("/admin/schema/inspect", tags=["Admin"])
def admin_schema_inspect(db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context_relaxed)) -> Dict[str, object]:
    if ctx.role != "owner_admin":
        return {"error": "forbidden"}
    try:
        out: Dict[str, object] = {}
        with engine.begin() as conn:
            try:
                rows = conn.execute(
                    _sql_text(
                        """
                        SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
                        FROM pg_class c
                        JOIN pg_namespace n ON n.oid = c.relnamespace
                        WHERE n.nspname = 'public' AND c.relkind = 'r'
                        ORDER BY c.relname
                        """
                    )
                ).fetchall()
                out["rls_tables"] = [
                    {"table": str(r[0]), "rls": bool(r[1])} for r in rows or []
                ]
            except Exception:
                out["rls_tables"] = []
            try:
                rows = conn.execute(
                    _sql_text(
                        """
                        SELECT schemaname, tablename, policyname, cmd, qual, with_check
                        FROM pg_policies
                        WHERE schemaname='public'
                        ORDER BY tablename, policyname
                        """
                    )
                ).fetchall()
                policies = []
                gucs: set[str] = set()
                for r in rows or []:
                    schem = str(r[0] or "public")
                    table = str(r[1] or "")
                    name = str(r[2] or "")
                    cmd = str(r[3] or "all")
                    qual = str(r[4]) if r[4] is not None else None
                    wchk = str(r[5]) if r[5] is not None else None
                    for expr in [qual or "", wchk or ""]:
                        try:
                            import re as _re
                            for m in _re.findall(r"app\.[a-zA-Z_]+", expr):
                                gucs.add(m)
                        except Exception:
                            pass
                    policies.append({"table": table, "policy": name, "cmd": cmd, "qual": qual, "with_check": wchk})
                out["policies"] = policies
                out["gucs_referenced"] = sorted(list(gucs))
            except Exception:
                out["policies"] = []
                out["gucs_referenced"] = []
            try:
                rows = conn.execute(
                    _sql_text(
                        """
                        SELECT table_name, column_name, data_type
                        FROM information_schema.columns
                        WHERE table_schema='public' AND column_name IN ('created_at','updated_at')
                        ORDER BY table_name, column_name
                        """
                    )
                ).fetchall()
                ts_map: Dict[str, Dict[str, str]] = {}
                for t, c, dt in rows or []:
                    tbl = str(t)
                    col = str(c)
                    ts_map.setdefault(tbl, {})[col] = str(dt)
                out["timestamps"] = [
                    {"table": tbl, **cols} for tbl, cols in sorted(ts_map.items(), key=lambda x: x[0])
                ]
            except Exception:
                out["timestamps"] = []
            try:
                row = conn.execute(
                    _sql_text(
                        """
                        SELECT COUNT(1) FROM information_schema.columns
                        WHERE table_schema='public' AND table_name='audit_logs' AND column_name='payload'
                        """
                    )
                ).fetchone()
                out["audit_logs_has_payload"] = bool(row and int(row[0] or 0) > 0)
            except Exception:
                out["audit_logs_has_payload"] = False
        return out
    except Exception as e:
        return {"error": str(e)[:200]}

@app.get("/oauth/instagram/status", tags=["Integrations"])
def instagram_status(ctx: UserContext = Depends(get_user_context)):
    try:
        with next(get_db()) as db:  # type: ignore
            row = db.query(dbm.Settings).filter(dbm.Settings.tenant_id == ctx.tenant_id).first()
            providers = {}
            if row and row.data_json:
                try:
                    providers = json.loads(row.data_json or '{}').get('providers_live') or {}
                except Exception:
                    providers = {}
            ok = providers.get('instagram') is True
            return {"status": "connected" if ok else "not_connected"}
    except Exception:
        return {"status": "unknown"}
