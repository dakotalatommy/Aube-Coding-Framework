from __future__ import annotations
from fastapi import FastAPI, Depends, Response, Request, HTTPException
from fastapi.responses import PlainTextResponse, RedirectResponse, FileResponse, JSONResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from prometheus_client import Counter, generate_latest, CONTENT_TYPE_LATEST, CollectorRegistry
from .events import emit_event
from .db import Base, engine, get_db, get_l_db, CURRENT_TENANT_ID, CURRENT_ROLE
from . import models as dbm
from .crypto import encrypt_text, decrypt_text
from .auth import get_user_context, require_role, UserContext
from .cadence import get_cadence_definition, schedule_initial_next_action
from .kpi import compute_time_saved_minutes, ambassador_candidate, admin_kpis, funnel_daily_series
from .cache import cache_get, cache_set, cache_del
from .metrics_counters import CACHE_HIT, CACHE_MISS
from .messaging import send_message
from .integrations import crm_hubspot, booking_acuity
from .integrations import inventory_shopify as inv_shopify
from .integrations import inventory_square as inv_square
from .integrations import calendar_google as cal_google
from .integrations import calendar_apple as cal_apple
from .integrations.booking_square import verify_square_signature
from .integrations.email_sendgrid import sendgrid_verify_signature
from .utils import normalize_phone
from .rate_limit import check_and_increment
from .scheduler import run_tick
from .ai import AIClient
from .brand_prompts import BRAND_SYSTEM, cadence_intro_prompt, chat_system_prompt
from .tools import execute_tool
from .marts import recompute_funnel_daily, recompute_time_saved
from . import models as dbm
from .integrations.sms_twilio import twilio_verify_signature
from .integrations.sms_twilio import twilio_send_sms
import threading as _threading
from .adapters.supabase_adapter import SupabaseAdapter
import json
import os
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
import io
import csv
import os.path as _osp
from pathlib import Path as _Path
from sqlalchemy import text as _sql_text
from sqlalchemy import func as _sql_func
import time as _time
import urllib.parse as _url
import httpx
import hmac as _hmac
import hashlib as _hashlib
import base64 as _b64
import json as _json
import stripe as _stripe


tags_metadata = [
    {"name": "Health", "description": "Health checks and metrics."},
    {"name": "Contacts", "description": "Contact import and consent."},
    {"name": "Cadences", "description": "Cadence scheduling and messaging."},
    {"name": "AI", "description": "Ask VX chat, tools, embeddings and search."},
    {"name": "Integrations", "description": "External integrations and provider webhooks."},
    {"name": "Approvals", "description": "Human-in-the-loop approvals."},
]

app = FastAPI(title="BrandVX Backend", version="0.2.0", openapi_tags=tags_metadata)
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
cors_origins = [
    o.strip()
    for o in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:8000,http://localhost:5173,http://localhost:5174,"
        "http://127.0.0.1:5173,http://127.0.0.1:5174,http://127.0.0.1:5175",
    ).split(",")
    if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TenantScopeMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        try:
            x_tenant = request.headers.get("X-Tenant-Id")
            x_role = request.headers.get("X-Role")
            if x_tenant:
                CURRENT_TENANT_ID.set(x_tenant)
            if x_role:
                CURRENT_ROLE.set(x_role)
        except Exception:
            pass
        response = await call_next(request)
        return response


app.add_middleware(TenantScopeMiddleware)
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
            t = _threading.Thread(target=_scheduler_loop, daemon=True)
            t.start()
    except Exception:
        pass



# --- OAuth scaffolding helpers (env-driven) ---
def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default)


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
    # Store stripe customer id in settings table per tenant
    with next(get_db()) as db:  # type: ignore
        row = db.execute(
            _sql_text("SELECT data_json FROM settings WHERE tenant_id = :tid ORDER BY id DESC LIMIT 1"),
            {"tid": ctx.tenant_id},
        ).fetchone()
        data = {}
        if row and row[0]:
            try:
                data = _json.loads(row[0])
            except Exception:
                data = {}
        cust_id = data.get("stripe_customer_id")
        if not cust_id:
            customer = s.Customer.create(metadata={"tenant_id": ctx.tenant_id})
            cust_id = customer["id"]
            data["stripe_customer_id"] = cust_id
            payload = {"tenant_id": ctx.tenant_id, "data_json": _json.dumps(data)}
            db.execute(_sql_text("INSERT INTO settings(tenant_id, data_json) VALUES (:tenant_id, :data_json)"), payload)
            db.commit()
        return {"customer_id": cust_id}


@app.post("/billing/create-setup-intent", tags=["Integrations"])
def create_setup_intent(ctx: UserContext = Depends(get_user_context)):
    s = _stripe_client()
    # Ensure a customer first
    cust = create_customer(ctx)
    setup_intent = s.SetupIntent.create(customer=cust["customer_id"])  # type: ignore
    return {"client_secret": setup_intent["client_secret"]}


@app.post("/billing/create-checkout-session", tags=["Integrations"])
def create_checkout_session(req: dict, ctx: UserContext = Depends(get_user_context)):
    s = _stripe_client()
    price_id = str(req.get("price_id", "")).strip()
    price_cents = int(req.get("price_cents", 0) or 0)
    currency = str(req.get("currency", "usd")).strip() or "usd"
    product_name = str(req.get("product_name", "BrandVX Membership")).strip() or "BrandVX Membership"
    if not price_id and price_cents <= 0:
        raise HTTPException(status_code=400, detail="missing price_id_or_amount")
    cust = create_customer(ctx)
    origin = _env("APP_ORIGIN", "http://localhost:5173")
    line_items = (
        [{"price": price_id, "quantity": 1}]
        if price_id
        else [{
            "price_data": {
                "currency": currency,
                "product_data": {"name": product_name},
                "unit_amount": price_cents,
                "recurring": {"interval": "month"},
            },
            "quantity": 1,
        }]
    )
    session = s.checkout.Session.create(
        mode="subscription",
        line_items=line_items,
        success_url=f"{origin}/workspace?pane=dashboard&billing=success",
        cancel_url=f"{origin}/billing?cancel=1",
        customer=cust["customer_id"],  # type: ignore
        allow_promotion_codes=True,
    )
    return {"url": session["url"]}


@app.post("/billing/portal", tags=["Integrations"])
def billing_portal(ctx: UserContext = Depends(get_user_context)):
    s = _stripe_client()
    cust = create_customer(ctx)
    origin = _env("APP_ORIGIN", "http://localhost:5173")
    portal = s.billing_portal.Session.create(customer=cust["customer_id"], return_url=f"{origin}/billing")  # type: ignore
    return {"url": portal["url"]}


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
    elif typ == "customer.subscription.updated" or typ == "customer.subscription.created":
        cust_id = data.get("customer")
        t_update = {
            "subscription_status": data.get("status"),
            "current_period_end": int(data.get("current_period_end", 0)),
        }
    else:
        return JSONResponse({"status": "ignored"})
    # Persist to settings for the tenant owning this customer (lookup by metadata if available)
    try:
        # Note: for a full system, map customer->tenant using a dedicated table; here we scan latest settings rows
        with next(get_db()) as db:  # type: ignore
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
                    break
    except Exception:
        pass
    return JSONResponse({"status": "ok"})


def _backend_base_url() -> str:
    return _env("BACKEND_BASE_URL", "http://localhost:8000")


def _frontend_base_url() -> str:
    return _env("FRONTEND_BASE_URL", "http://127.0.0.1:5174")


def _redirect_uri(provider: str) -> str:
    return f"{_backend_base_url()}/oauth/{provider}/callback"


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


def _oauth_authorize_url(provider: str, tenant_id: Optional[str] = None) -> str:
    # Encode state with tenant context for multi-tenant callback handling
    try:
        _state_obj = {"t": (tenant_id or "t1"), "s": os.urandom(8).hex()}
        _state = _b64.urlsafe_b64encode(json.dumps(_state_obj).encode()).decode().rstrip("=")
    except Exception:
        _state = os.urandom(16).hex()
    if provider == "google":
        auth = _env("GOOGLE_AUTH_URL", "https://accounts.google.com/o/oauth2/v2/auth")
        client_id = _env("GOOGLE_CLIENT_ID", "")
        scope = _env("GOOGLE_SCOPES", "openid email profile")
        return (
            f"{auth}?response_type=code&client_id={client_id}&redirect_uri={_url.quote(_redirect_uri('google'))}"
            f"&scope={_url.quote(scope)}&access_type=offline&prompt=consent&state={_state}"
        )
    if provider == "square":
        auth = _env("SQUARE_AUTH_URL", "https://connect.squareupsandbox.com/oauth2/authorize")
        client_id = _env("SQUARE_CLIENT_ID", "")
        scope = _env("SQUARE_SCOPES", "MERCHANT_PROFILE_READ PAYMENTS_READ")
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


def _oauth_exchange_token(provider: str, code: str, redirect_uri: str) -> Dict[str, object]:
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
            r = httpx.post(url, data=data, timeout=20)
            return r.json() if r.status_code < 400 else {}
        if provider == "square":
            url = _env("SQUARE_TOKEN_URL", "https://connect.squareupsandbox.com/oauth2/token")
            data = {
                "grant_type": "authorization_code",
                "code": code,
                "client_id": _env("SQUARE_CLIENT_ID", ""),
                "client_secret": _env("SQUARE_CLIENT_SECRET", ""),
                "redirect_uri": redirect_uri,
            }
            r = httpx.post(url, json=data, timeout=20)
            return r.json() if r.status_code < 400 else {}
        if provider == "acuity":
            url = _env("ACUITY_TOKEN_URL", "https://acuityscheduling.com/oauth2/token")
            data = {
                "grant_type": "authorization_code",
                "code": code,
                "client_id": _env("ACUITY_CLIENT_ID", ""),
                "client_secret": _env("ACUITY_CLIENT_SECRET", ""),
                "redirect_uri": redirect_uri,
            }
            r = httpx.post(url, data=data, timeout=20)
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
            r = httpx.post(url, data=data, headers=headers, timeout=20)
            return r.json() if r.status_code < 400 else {}
        if provider == "facebook":
            url = _env("FACEBOOK_TOKEN_URL", "https://graph.facebook.com/v18.0/oauth/access_token")
            params = {
                "client_id": _env("FACEBOOK_CLIENT_ID", ""),
                "client_secret": _env("FACEBOOK_CLIENT_SECRET", ""),
                "redirect_uri": redirect_uri,
                "code": code,
            }
            r = httpx.get(url, params=params, timeout=20)
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
            r = httpx.post(url, data=data, timeout=20)
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
            r = httpx.post(url, json=data, timeout=20)
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
            r = httpx.post(url, data=data, timeout=20)
            return r.json() if r.status_code < 400 else {}
        if provider == "square":
            url = _env("SQUARE_TOKEN_URL", "https://connect.squareupsandbox.com/oauth2/token")
            data = {
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
                "client_id": _env("SQUARE_CLIENT_ID", ""),
                "client_secret": _env("SQUARE_CLIENT_SECRET", ""),
            }
            r = httpx.post(url, json=data, timeout=20)
            return r.json() if r.status_code < 400 else {}
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
            r = httpx.post(url, data=data, headers=headers, timeout=20)
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
        row = (
            db.query(dbm.ConnectedAccount)
            .filter(dbm.ConnectedAccount.tenant_id == req.tenant_id, dbm.ConnectedAccount.provider == req.provider)
            .order_by(dbm.ConnectedAccount.id.desc())
            .first()
        )
        if not row:
            return {"status": "not_found"}
        if not row.refresh_token_enc:
            return {"status": "no_refresh_token"}
        rt = decrypt_text(row.refresh_token_enc) or ""
        if not rt:
            return {"status": "invalid_refresh_token"}
        token = _oauth_refresh_token(req.provider, rt, _redirect_uri(req.provider)) or {}
        if not token:
            row.status = "error"
            db.commit()
            return {"status": "error"}
        new_at = str(token.get("access_token") or "")
        new_rt = token.get("refresh_token")
        exp = token.get("expires_in")
        if new_at:
            row.access_token_enc = encrypt_text(new_at)
        if new_rt:
            row.refresh_token_enc = encrypt_text(str(new_rt))
        if isinstance(exp, (int, float)):
            row.expires_at = int(_time.time()) + int(exp)
        row.status = "connected"
        db.add(dbm.AuditLog(tenant_id=req.tenant_id, actor_id=ctx.user_id, action=f"oauth.refresh.{req.provider}", entity_ref="oauth", payload="{}"))
        db.commit()
        return {"status": "ok"}
    except Exception as e:
        try:
            db.rollback()
        except Exception:
            pass
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
    imported = 0
    try:
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
    ctx: UserContext = Depends(get_user_context),
) -> Dict[str, List[Dict[str, object]]]:
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
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
        # Idempotent send guard
        idem_key = f"{req.tenant_id}:{req.contact_id}:{req.channel}:{req.template_id or 'default'}"
        existed = db.query(dbm.IdempotencyKey).filter(dbm.IdempotencyKey.key == idem_key).first()
        if not existed:
            db.add(dbm.IdempotencyKey(tenant_id=req.tenant_id, key=idem_key))
            db.commit()
            send_message(db, req.tenant_id, req.contact_id, req.channel, req.template_id)
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
    try:
        cache_del(f"inbox:{req.tenant_id}:50")
    except Exception:
        pass
    return {"status": "sent"}


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
    return {"status": "sent"}


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    tenant_id: str
    messages: List[ChatMessage]
    allow_tools: bool = False
    session_id: Optional[str] = None


@app.post("/ai/chat", tags=["AI"])
async def ai_chat(
    req: ChatRequest,
    ctx: UserContext = Depends(get_user_context),
) -> Dict[str, str]:
    try:
        ok_rl, _ = check_and_increment(req.tenant_id, "ai:chat", max_per_minute=30)
        if not ok_rl:
            return {"text": "rate_limited"}
    except Exception:
        pass
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"text": "forbidden"}
    # Dynamic capability injection: reflect current enabled surfaces/tools
    cap = {
        "features": app.openapi().get("tags", []),
        "tools": ai_tools_schema().get("tools", []),
    }
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
    system_prompt = chat_system_prompt(capabilities_text + (f"\nBrand profile: {brand_profile_text}" if brand_profile_text else ""))
    client = AIClient()
    # Allow configuring response length via env
    _max_tokens = int(os.getenv("AI_CHAT_MAX_TOKENS", "1200"))
    content = await client.generate(
        system_prompt,
        [
            {"role": m.role, "content": m.content}
            for m in req.messages
        ],
        max_tokens=_max_tokens,
    )
    # Persist chat logs (last user msg + assistant reply)
    try:
        with next(get_db()) as db:  # type: ignore
            sid = req.session_id or "default"
            if req.messages:
                last = req.messages[-1]
                db.add(dbm.ChatLog(tenant_id=ctx.tenant_id, session_id=sid, role=str(last.role), content=str(last.content)))
            db.add(dbm.ChatLog(tenant_id=ctx.tenant_id, session_id=sid, role="assistant", content=content))
            db.commit()
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
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"items": []}
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
    try:
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
        # Auto-approve toggle from settings
        auto_approve = False
        try:
            row = db.query(dbm.Settings).filter(dbm.Settings.tenant_id == req.tenant_id).first()
            if row:
                data = json.loads(row.data_json or "{}")
                auto_approve = bool(data.get("auto_approve_all", False))
        except Exception:
            try:
                db.rollback()
            except Exception:
                pass
            auto_approve = False
        if req.require_approval and not auto_approve:
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
        # Normalize return shape minimally
        if not isinstance(result, dict) or "status" not in result:
            result = {"status": str(result)} if not isinstance(result, dict) else {**result, "status": result.get("status", "ok")}
        emit_event("AIToolExecuted", {"tenant_id": req.tenant_id, "tool": req.name, "status": result.get("status")})
        return result
    except Exception as e:
        try:
            db.rollback()
        except Exception:
            pass
        return {"status": "error", "message": str(e)}


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
    rows = base.order_by(dbm.Contact.id.asc()).limit(max(1, min(limit, 50))).all()
    return {"items": [
        {"id": r.contact_id, "name": r.contact_id, "email_hash": r.email_hash, "phone_hash": r.phone_hash, "favorite": False}
        for r in rows
    ]}


# --- Human-friendly tool schema for AskVX palette ---
@app.get("/ai/tools/schema_human", tags=["AI"])
def ai_tools_schema_human() -> Dict[str, object]:
    tools = [
        {"id": "draft_message", "label": "Draft message", "gated": False, "category": "messaging"},
        {"id": "pricing_model", "label": "Pricing model", "gated": False, "category": "analytics"},
        {"id": "safety_check", "label": "Safety check", "gated": False, "category": "assist"},
        {"id": "contacts.dedupe", "label": "Deduplicate contacts", "gated": True, "category": "crm"},
        {"id": "export.contacts", "label": "Export contacts (CSV)", "gated": True, "category": "crm"},
        {"id": "campaigns.dormant.preview", "label": "Preview dormant segment", "gated": False, "category": "campaigns"},
        {"id": "campaigns.dormant.start", "label": "Start dormant campaign", "gated": True, "category": "campaigns"},
        {"id": "appointments.schedule_reminders", "label": "Schedule reminders", "gated": True, "category": "appointments"},
        {"id": "inventory.alerts.get", "label": "Low‑stock alerts", "gated": True, "category": "inventory"},
        {"id": "social.schedule.14days", "label": "Draft 14‑day social plan", "gated": True, "category": "social"},
    ]
    return {"version": "v1", "tools": tools}


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
    data = admin_kpis(db, tenant_id)
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
    completed: Optional[bool] = None
    providers_live: Optional[Dict[str, bool]] = None  # per-provider live-mode switch
    # Onboarding/tour persistence
    tour_completed: Optional[bool] = None
    onboarding_step: Optional[int] = None
    # Timezone support
    user_timezone: Optional[str] = None  # e.g., "America/Chicago"


@app.get("/settings", tags=["Integrations"])
def get_settings(
    tenant_id: str,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"data": {}}
    row = db.query(dbm.Settings).filter(dbm.Settings.tenant_id == tenant_id).first()
    return {"data": json.loads(row.data_json) if row else {}}


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
    if req.tour_completed is not None:
        data["tour_completed"] = bool(req.tour_completed)
    if req.onboarding_step is not None:
        try:
            data["onboarding_step"] = int(req.onboarding_step)
        except Exception:
            data["onboarding_step"] = 0
    if req.user_timezone is not None:
        prefs = dict(data.get("preferences") or {})
        prefs["user_timezone"] = req.user_timezone
        data["preferences"] = prefs
    if not row:
        row = dbm.Settings(tenant_id=req.tenant_id, data_json=json.dumps(data))
        db.add(row)
    else:
        row.data_json = json.dumps(data)
    db.commit()
    emit_event("SettingsUpdated", {"tenant_id": req.tenant_id, "keys": list(data.keys())})
    return {"status": "ok"}


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
    tenant_id: str,
    contact_id: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"items": []}
    q = db.query(dbm.Message).filter(dbm.Message.tenant_id == tenant_id)
    if contact_id:
        q = q.filter(dbm.Message.contact_id == contact_id)
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
def ai_tools_schema() -> Dict[str, object]:
    """Return tool registry with public/gated flags and basic param hints.
    This enables a visible agentic system without external Agents.
    """
    return {
        "version": "v1",
        "tools": [
            {
                "name": "draft_message",
                "public": True,
                "description": "Draft a first outreach message respecting consent and tone.",
                "params": {
                    "tenant_id": "string",
                    "contact_id": "string",
                    "channel": {"enum": ["sms", "email"]},
                    "service": "string?"
                }
            },
            {
                "name": "pricing_model",
                "public": True,
                "description": "Compute effective hourly and margin from inputs.",
                "params": {
                    "tenant_id": "string",
                    "price": "number",
                    "product_cost": "number",
                    "service_time_minutes": "number"
                }
            },
            {
                "name": "safety_check",
                "public": True,
                "description": "Review text for compliance/PII and suggest safe rewrites.",
                "params": {"tenant_id": "string", "text": "string"}
            },
            {
                "name": "vision_analyze",
                "public": True,
                "description": "Analyze an uploaded image and return actionable feedback.",
                "params": {"tenant_id": "string", "image_b64": "string", "prompt": "string?"}
            },
            {
                "name": "propose_next_cadence_step",
                "public": True,
                "description": "Propose the next cadence step for a contact.",
                "params": {
                    "tenant_id": "string",
                    "contact_id": "string",
                    "cadence_id": "string"
                }
            },
            # Gated tools (require approvals)
            {"name": "send_message", "public": False, "description": "Send a message (consent + rate limits enforced)."},
            {"name": "start_cadence", "public": False, "description": "Start a cadence for a contact."},
            {"name": "stop_cadence", "public": False, "description": "Stop a cadence for a contact."},
            {"name": "notify_trigger_send", "public": False, "description": "Send waitlist pings to top candidates."},
            {"name": "scheduler_tick", "public": False, "description": "Process scheduled actions."},
            {"name": "lead_status.update", "public": False, "description": "Update lead status by intent."},
            {"name": "appointments.create", "public": False, "description": "Create an appointment and schedule reminders."},
            {"name": "marts.recompute", "public": False, "description": "Recompute analytics marts."},
            {"name": "settings.update", "public": False, "description": "Update tenant settings (tone/services)."},
            {"name": "export.contacts", "public": False, "description": "Export contacts as CSV."},
            {"name": "contacts.dedupe", "public": False, "description": "Deduplicate contacts by email/phone hashes (keeps first)."},
            {"name": "campaigns.dormant.start", "public": False, "description": "Start dormant campaign for inactive clients."},
            {"name": "appointments.schedule_reminders", "public": False, "description": "Schedule appointment reminder messages."},
            {"name": "inventory.alerts.get", "public": False, "description": "List low-stock inventory items."},
            {"name": "social.schedule.14days", "public": False, "description": "Draft a 14-day posting plan (approval required)."},
        ]
    }


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
            "friendly_error": "I couldn’t find that workflow. Try one of: crm_organization, book_filling, inventory_tracking, client_communication, social_automation.",
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
                {"panel": "onboarding", "selector": "[data-tour=analyze]", "title": "Analyze setup", "desc": "See what’s ready and what’s missing."},
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
        db.add(
            dbm.AuditLog(
                tenant_id=req.tenant_id,
                actor_id=ctx.user_id,
                action="consent.stop",
                entity_ref=f"contact:{payload.get('From','')}",
                payload="{}",
            )
        )
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
                db.add(dbm.ConnectedAccount(
                    tenant_id=ctx.tenant_id, user_id=ctx.user_id, provider=provider, scopes=None,
                    access_token_enc=encrypt_text("dev"), refresh_token_enc=None, expires_at=None, status="connected"
                ))
                db.commit()
        except Exception:
            pass
        return {"url": ""}
    _t = tenant_id or ctx.tenant_id
    url = _oauth_authorize_url(provider, tenant_id=_t)
    return {"url": url}


@app.get("/oauth/{provider}/callback", tags=["Integrations"])  # scaffold
def oauth_callback(provider: str, request: Request, code: Optional[str] = None, state: Optional[str] = None, error: Optional[str] = None, db: Session = Depends(get_db)):
    # Store a minimal connected-account record even if app credentials are missing
    try:
        # Try to extract tenant from encoded state
        t_id = "t1"
        try:
            if state:
                pad = '=' * (-len(state) % 4)
                data = json.loads(_b64.urlsafe_b64decode((state + pad).encode()).decode())
                t_id = str(data.get("t") or t_id)
        except Exception:
            t_id = "t1"
        status = "pending_config" if not any([
            _env("HUBSPOT_CLIENT_ID"), _env("SQUARE_CLIENT_ID"), _env("ACUITY_CLIENT_ID"),
            _env("FACEBOOK_CLIENT_ID"), _env("INSTAGRAM_CLIENT_ID"), _env("GOOGLE_CLIENT_ID"), _env("SHOPIFY_CLIENT_ID")
        ]) else "connected"
        # Attempt token exchange when code present
        access_token_enc = encrypt_text(code or "")
        refresh_token_enc = None
        expires_at = None
        if code:
            try:
                token = _oauth_exchange_token(provider, code, _redirect_uri(provider)) or {}
                at = str(token.get("access_token") or "")
                rt = token.get("refresh_token")
                exp = token.get("expires_in")
                if at:
                    access_token_enc = encrypt_text(at)
                if rt:
                    refresh_token_enc = encrypt_text(str(rt))
                if isinstance(exp, (int, float)):
                    expires_at = int(_time.time()) + int(exp)
            except Exception:
                pass
        try:
            db.add(dbm.ConnectedAccount(
                tenant_id=t_id, user_id="dev", provider=provider, scopes=None,
                access_token_enc=access_token_enc, refresh_token_enc=refresh_token_enc, expires_at=expires_at, status=status
            ))
            db.commit()
        except Exception:
            try: db.rollback()
            except Exception: pass
        try:
            db.add(dbm.AuditLog(tenant_id=t_id, actor_id="system", action=f"oauth.callback.{provider}", entity_ref="oauth", payload=str({"code": bool(code), "error": error or ""})))
            db.commit()
        except Exception:
            try: db.rollback()
            except Exception: pass
        try:
            if provider in {"shopify", "square"}:
                # Fire an initial inventory sync so onboarding analysis shows results fast
                _ = inventory_sync(SyncRequest(tenant_id=t_id, provider=provider), db=db, ctx=UserContext(tenant_id=t_id, role="owner_admin", user_id="system"))
        except Exception:
            pass
    except Exception:
        pass
    dest = f"{_frontend_base_url()}/onboarding?connected={provider}"
    if error:
        dest += f"&error={_url.quote(error)}"
    return RedirectResponse(dest)


class AnalyzeRequest(BaseModel):
    tenant_id: str
class HubspotImportRequest(BaseModel):
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
def whoami(ctx: UserContext = Depends(get_user_context)) -> Dict[str, str]:
    return {"tenant_id": ctx.tenant_id or "", "role": ctx.role or ""}


@app.post("/onboarding/analyze", tags=["Integrations"])  # scaffold
def onboarding_analyze(req: AnalyzeRequest, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)):
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"summary": {}, "status": "forbidden"}
    # Connected accounts snapshot
    try:
        ca = db.query(dbm.ConnectedAccount).filter(dbm.ConnectedAccount.tenant_id == req.tenant_id).all()
        connected = {r.provider: r.status for r in (ca or [])}
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

        # Check connected accounts
        connected_accounts = asyncio.run(
            adapter.select(
                "connected_accounts",
                {"select": "platform,connected_at", "user_id": f"eq.{ctx.user_id}", "limit": "10"},
            )
        )
        connected = bool(connected_accounts)
        # Lead status count as crude first-sync signal
        lead_rows = asyncio.run(adapter.get_lead_status(tenant_id))
        counts["lead_status"] = len(lead_rows or [])
        first_sync_done = counts["lead_status"] > 0
    except Exception:
        pass
    return {"connected": connected, "first_sync_done": first_sync_done, "counts": counts}


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
    secret = os.getenv("ACUITY_WEBHOOK_SECRET", "")
    raw = await request.body()
    sig = request.headers.get("X-Acuity-Signature", "")
    if not booking_acuity.acuity_verify_signature(secret, raw, sig):
        raise HTTPException(status_code=403, detail="invalid signature")
    try:
        ok_rl, _ = check_and_increment(req.tenant_id, "webhook:acuity", max_per_minute=120)
        if not ok_rl:
            return {"status": "rate_limited"}
    except Exception:
        pass
    data = dict(req.payload or {})
    ext = str(data.get("id", ""))
    # idempotent upsert by external_ref
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
    # schedule reminders
    from .scheduler import schedule_appointment_reminders
    schedule_appointment_reminders(db, req.tenant_id)
    try:
        from .metrics_counters import WEBHOOK_EVENTS  # type: ignore
        WEBHOOK_EVENTS.labels(provider="acuity", status="ok").inc()  # type: ignore
    except Exception:
        pass
    emit_event("AppointmentIngested", {"tenant_id": req.tenant_id, "external_ref": f"acuity:{ext}"})
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
    emit_event("AppointmentIngested", {"tenant_id": req.tenant_id, "external_ref": f"square:{ext}"})
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
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"items": []}
    # Unified inbox scaffold: surface a few sample items if providers are connected
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
            conns = db.query(dbm.ConnectedAccount).filter(dbm.ConnectedAccount.tenant_id == tenant_id).all()
            statuses = {c.provider: c.status for c in (conns or [])}
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
    return (
        db.query(dbm.ConnectedAccount)
        .filter(dbm.ConnectedAccount.tenant_id == tenant_id, dbm.ConnectedAccount.provider == provider)
        .order_by(dbm.ConnectedAccount.id.desc())
        .first()
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
                ca.access_token_enc = encrypt_text(at)
                if expires_in:
                    ca.expires_at = int(_time.time()) + int(expires_in)
                db.add(ca)
                db.commit()
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


@app.get("/calendar/list", tags=["Integrations"])
def calendar_list(
    tenant_id: str,
    start_ts: Optional[int] = None,
    end_ts: Optional[int] = None,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
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


@app.get("/inventory/metrics", tags=["Integrations"])
def inventory_metrics(
    tenant_id: str,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"summary": {}, "last_sync": {}}
    inv_sync: Dict[str, object] = {}
    try:
        recent = (
            db.query(dbm.EventLedger)
            .filter(dbm.EventLedger.tenant_id == tenant_id, dbm.EventLedger.name.like("sync.inventory.%"))
            .order_by(dbm.EventLedger.ts.desc())
            .limit(50)
            .all()
        )
        for ev in recent:
            try:
                prov = (ev.name or "").split(".")[-1]
                inv_sync[prov] = {"status": "completed", "ts": ev.ts}
            except Exception:
                continue
    except Exception:
        inv_sync = {}
    # Try cache first
    try:
        ckey = f"inv:{tenant_id}"
        cached = cache_get(ckey)
        if cached is not None:
            try:
                CACHE_HIT.labels(endpoint="/inventory/metrics").inc()  # type: ignore
            except Exception:
                pass
            return cached
    except Exception:
        pass
    srow = db.query(dbm.InventorySummary).filter(dbm.InventorySummary.tenant_id == tenant_id).first()
    items = db.query(dbm.InventoryItem).filter(dbm.InventoryItem.tenant_id == tenant_id).order_by(dbm.InventoryItem.name.asc()).all()
    summary = {
        "products": int(srow.products) if srow else 0,
        "low_stock": int(srow.low_stock) if srow else 0,
        "out_of_stock": int(srow.out_of_stock) if srow else 0,
        "top_sku": srow.top_sku if srow else None,
    }
    out = {
        "summary": summary,
        "last_sync": inv_sync,
        "items": [{"sku": it.sku, "name": it.name, "stock": it.stock, "provider": it.provider} for it in items],
    }
    try:
        cache_set(ckey, out, ttl=30)
        try:
            CACHE_MISS.labels(endpoint="/inventory/metrics").inc()  # type: ignore
        except Exception:
            pass
    except Exception:
        pass
    return out


class SyncRequest(BaseModel):
    tenant_id: str
    provider: Optional[str] = None  # shopify|square|manual or google|apple for calendar


@app.post("/inventory/sync", tags=["Integrations"])
def inventory_sync(req: SyncRequest, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)) -> Dict[str, str]:
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    prov = (req.provider or "auto").lower()
    now = int(_time.time())
    # Record sync queued in events_ledger instead of in-memory state
    try:
        db.add(dbm.EventLedger(ts=now, tenant_id=req.tenant_id, name=f"sync.inventory.{prov}", payload=None))
        db.commit()
    except Exception:
        pass
    # Simulate a quick sync completion and basic metrics for visibility during scaffolding
    summary_row = db.query(dbm.InventorySummary).filter(dbm.InventorySummary.tenant_id == req.tenant_id).first()
    if not summary_row:
        summary_row = dbm.InventorySummary(tenant_id=req.tenant_id)
        db.add(summary_row)
        db.commit()
        db.refresh(summary_row)
    if prov == "shopify":
        snap = inv_shopify.fetch_inventory_snapshot(req.tenant_id)
        ss = snap.get("summary", {})
        summary_row.products = int(ss.get("products", summary_row.products or 0))
        summary_row.low_stock = int(ss.get("low_stock", summary_row.low_stock or 0))
        summary_row.out_of_stock = int(ss.get("out_of_stock", summary_row.out_of_stock or 0))
        summary_row.top_sku = ss.get("top_sku", summary_row.top_sku)
        db.query(dbm.InventoryItem).filter(dbm.InventoryItem.tenant_id == req.tenant_id).delete()
        for it in snap.get("items", []):
            db.add(dbm.InventoryItem(tenant_id=req.tenant_id, sku=it.get("sku"), name=it.get("name"), stock=int(it.get("stock", 0)), provider="shopify"))
    elif prov == "square":
        snap = inv_square.fetch_inventory_snapshot(req.tenant_id)
        ss = snap.get("summary", {})
        summary_row.products = max(int(summary_row.products or 0), int(ss.get("products", 0)))
        summary_row.low_stock = int(ss.get("low_stock", summary_row.low_stock or 0))
        summary_row.out_of_stock = int(ss.get("out_of_stock", summary_row.out_of_stock or 0))
        summary_row.top_sku = summary_row.top_sku or ss.get("top_sku")
        existing = {r.sku for r in db.query(dbm.InventoryItem).filter(dbm.InventoryItem.tenant_id == req.tenant_id).all()}
        for it in snap.get("items", []):
            if it.get("sku") not in existing:
                db.add(dbm.InventoryItem(tenant_id=req.tenant_id, sku=it.get("sku"), name=it.get("name"), stock=int(it.get("stock", 0)), provider="square"))
    else:
        # Manual recompute based on current items snapshot
        items = db.query(dbm.InventoryItem).filter(dbm.InventoryItem.tenant_id == req.tenant_id).all()
        products = len(items)
        low_stock = sum(1 for it in items if int(it.stock or 0) > 0 and int(it.stock or 0) <= 5)
        out_of_stock = sum(1 for it in items if int(it.stock or 0) == 0)
        top_sku = items[0].sku if items else None
        summary_row.products = products
        summary_row.low_stock = low_stock
        summary_row.out_of_stock = out_of_stock
        summary_row.top_sku = top_sku
    db.commit()
    try:
        cache_del(f"inv:{req.tenant_id}")
    except Exception:
        pass
    try:
        with next(get_db()) as _db:  # type: ignore
            _db.add(dbm.EventLedger(ts=now, tenant_id=req.tenant_id, name=f"sync.inventory.{prov}", payload=json.dumps({"status":"completed"})))
            _db.commit()
    except Exception:
        pass
    emit_event("InventorySyncRequested", {"tenant_id": req.tenant_id, "provider": prov})
    return {"status": "completed", "provider": prov}


@app.post("/calendar/sync", tags=["Integrations"])
def calendar_sync(req: SyncRequest, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)) -> Dict[str, str]:
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    prov = (req.provider or "auto").lower()
    now = int(_time.time())
    try:
        with next(get_db()) as _db:  # type: ignore
            _db.add(dbm.EventLedger(ts=now, tenant_id=req.tenant_id, name=f"sync.calendar.{prov}.queued", payload=json.dumps({"status":"queued"})))
            _db.commit()
    except Exception:
        pass
    emit_event("CalendarSyncRequested", {"tenant_id": req.tenant_id, "provider": prov})
    # Scaffold provider adapters: populate some sample events depending on provider and persist
    def _add_events(new_events: List[Dict[str, object]]):
        seen_ids = {str(r.event_id) for r in db.query(dbm.CalendarEvent).filter(dbm.CalendarEvent.tenant_id == req.tenant_id, dbm.CalendarEvent.event_id.isnot(None)).all()}
        for e in new_events:
            eid = str(e.get("id")) if e.get("id") is not None else None
            if eid and eid in seen_ids:
                continue
            db.add(dbm.CalendarEvent(
                tenant_id=req.tenant_id,
                event_id=eid,
                title=str(e.get("title") or e.get("service") or ""),
                start_ts=int(e.get("start_ts") or 0),
                end_ts=int(e.get("end_ts") or 0) or None,
                provider=str(e.get("provider") or req.provider or ""),
                status=str(e.get("status") or ""),
            ))
    if prov == "google":
        _add_events(cal_google.fetch_events(req.tenant_id))
    elif prov == "apple":
        _add_events(cal_apple.fetch_events(req.tenant_id))
    else:
        # bookings merge (Square/Acuity)
        try:
            from .integrations import booking_square as bk_square
            from .integrations import booking_acuity as bk_acuity
            _add_events(bk_square.fetch_bookings(req.tenant_id))
            _add_events(bk_acuity.fetch_bookings(req.tenant_id))
        except Exception:
            pass
    db.commit()
    try:
        cache_del(f"cal:{req.tenant_id}:0:0")
    except Exception:
        pass
    try:
        with next(get_db()) as _db:  # type: ignore
            _db.add(dbm.EventLedger(ts=now, tenant_id=req.tenant_id, name=f"sync.calendar.{prov}", payload=json.dumps({"status":"completed"})))
            _db.commit()
    except Exception:
        pass
    return {"status": "completed", "provider": prov}


class CalendarMergeRequest(BaseModel):
    tenant_id: str
    # in future: strategy fields


@app.post("/calendar/merge", tags=["Integrations"])
def calendar_merge(req: CalendarMergeRequest, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)) -> Dict[str, int]:
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"merged": 0}
    rows = db.query(dbm.CalendarEvent).filter(dbm.CalendarEvent.tenant_id == req.tenant_id).order_by(dbm.CalendarEvent.start_ts.asc()).all()
    if not rows:
        return {"merged": 0}
    seen = set()
    drops = 0
    keep_ids: List[int] = []
    for r in rows:
        k = (str((r.title or "").strip().lower()), int(r.start_ts or 0))
        if k in seen:
            drops += 1
            continue
        seen.add(k)
        keep_ids.append(r.id)
    if drops > 0:
        db.query(dbm.CalendarEvent).filter(dbm.CalendarEvent.tenant_id == req.tenant_id, dbm.CalendarEvent.id.notin_(keep_ids)).delete(synchronize_session=False)
        db.commit()
    emit_event("CalendarMerged", {"tenant_id": req.tenant_id, "dropped": drops, "kept": len(keep_ids)})
    return {"merged": drops}

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
        db.add(
            dbm.AuditLog(
                tenant_id=req.tenant_id,
                actor_id=ctx.user_id,
                action="data.erase",
                entity_ref=f"contact:{req.contact_id}",
                payload="{}",
            )
        )
        db.commit()
        emit_event("DataDeletionCompleted", {"tenant_id": req.tenant_id, "entity": "contact", "contact_id": req.contact_id})
        return {"status": "erased"}
    return {"status": "not_found"}


class DevConnectRequest(BaseModel):
    tenant_id: str
    provider: str


@app.post("/dev/connect", tags=["Integrations"])
def dev_mark_connected(req: DevConnectRequest, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)):
    # Dev helper: mark provider as connected for the tenant
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    try:
        row = dbm.ConnectedAccount(
            tenant_id=req.tenant_id,
            user_id=ctx.user_id,
            provider=req.provider,
            scopes=None,
            access_token_enc=encrypt_text("dev"),
            refresh_token_enc=None,
            expires_at=None,
            status="connected",
        )
        db.add(row)
        db.commit()
        return {"status": "connected", "provider": req.provider}
    except Exception:
        db.rollback()
        return {"status": "error"}


class CurationListRequest(BaseModel):
    tenant_id: str
    limit: int = 10


@app.post("/curation/list", tags=["Contacts"])
def curation_list(req: CurationListRequest, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)):
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"items": []}
    # Select up to N contacts without a decision yet
    decided_ids = {r.client_id for r in db.query(dbm.CurationDecision).filter(dbm.CurationDecision.tenant_id == req.tenant_id).all()}
    q = db.query(dbm.Contact).filter(dbm.Contact.tenant_id == req.tenant_id)
    rows = q.limit(max(1, min(req.limit, 50))).all()
    items = []
    for r in rows:
        if r.contact_id in decided_ids:
            continue
        # Placeholder booking-derived stats — to be replaced with real joins
        items.append({
            "client_id": r.contact_id,
            "visits": 0,
            "services": [],
            "total_minutes": 0,
            "revenue": 0,
        })
        if len(items) >= req.limit:
            break
    return {"items": items}


class CurationDecisionRequest(BaseModel):
    tenant_id: str
    client_id: str
    decision: str  # keep|discard
    reason: Optional[str] = None


@app.post("/curation/decide", tags=["Contacts"])
def curation_decide(req: CurationDecisionRequest, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)):
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    d = dbm.CurationDecision(tenant_id=req.tenant_id, client_id=req.client_id, decision=req.decision, reason=req.reason or None)
    db.add(d)
    db.commit()
    emit_event("ClientCurated", {"tenant_id": req.tenant_id, "client_id": req.client_id, "decision": req.decision})
    return {"status": "ok"}


class CurationUndoRequest(BaseModel):
    tenant_id: str
    client_id: str


@app.post("/curation/undo", tags=["Contacts"])
def curation_undo(req: CurationUndoRequest, db: Session = Depends(get_db), ctx: UserContext = Depends(get_user_context)):
    if ctx.tenant_id != req.tenant_id and ctx.role != "owner_admin":
        return {"status": "forbidden"}
    # Delete the most recent decision for this client (scaffold)
    row = (
        db.query(dbm.CurationDecision)
        .filter(dbm.CurationDecision.tenant_id == req.tenant_id, dbm.CurationDecision.client_id == req.client_id)
        .order_by(dbm.CurationDecision.id.desc())
        .first()
    )
    if not row:
        return {"status": "not_found"}
    db.delete(row)
    db.commit()
    emit_event("ClientCurationUndone", {"tenant_id": req.tenant_id, "client_id": req.client_id})
    return {"status": "ok"}

@app.get("/integrations/booking/square/link", tags=["Integrations"])
def square_booking_link(
    tenant_id: Optional[str] = None,
    db: Session = Depends(get_db),
    ctx: UserContext = Depends(get_user_context),
):
    if tenant_id and ctx.tenant_id != tenant_id and ctx.role != "owner_admin":
        return {"url": ""}
    url = os.getenv("SQUARE_BOOKING_URL", "")
    # Prefer settings override if available
    try:
        t = tenant_id or ctx.tenant_id
        row = db.query(dbm.Settings).filter(dbm.Settings.tenant_id == t).first()
        if row:
            data = json.loads(row.data_json or "{}")
            url = data.get("square_booking_url", url)
    except Exception:
        pass
    return {"url": url}


