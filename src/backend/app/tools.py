from typing import Any, Dict, Optional, List
from sqlalchemy.orm import Session
from .auth import UserContext
from . import models as dbm
from .ai import AIClient
from .brand_prompts import BRAND_SYSTEM, cadence_intro_prompt
from .cadence import get_cadence_definition
from .messaging import send_message
from sqlalchemy import text as _sql_text
from .db import engine
from .crypto import decrypt_text
import re as _re
import math
import io
import csv
import time
import os
import httpx
import secrets as _secrets
from .rate_limit import check_and_increment
from sqlalchemy import text as _sql_text
from .metrics_counters import DB_QUERY_TOOL_USED
from .integrations import calendar_google as cal_google
import base64 as _b64
import json as _json
import urllib.parse as _urlparse
from typing import Tuple as _Tuple
try:
    from PIL import Image as _PILImage  # type: ignore
except Exception:
    _PILImage = None  # Pillow optional; guarded at runtime
_DEFAULT_HTTP_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/126.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


# ---------------------- Gemini Adapter (no extra deps) ----------------------

def _gemini_base() -> str:
    return os.getenv("GEMINI_API_BASE", "https://generativelanguage.googleapis.com").rstrip("/")


def _gemini_model() -> str:
    return os.getenv("GEMINI_IMAGE_MODEL", "gemini-2.5-flash")


def _gemini_key() -> str:
    return os.getenv("GEMINI_API_KEY", "")


async def _gemini_generate(parts: list[dict], temperature: float = 0.2, timeout_s: int = 45, response_mime: str | None = None) -> dict:
    key = _gemini_key()
    if not key:
        return {"status": "error", "detail": "missing_gemini_key"}
    url = f"{_gemini_base()}/v1beta/models/{_gemini_model()}:generateContent?key={key}"
    gen_cfg: dict = {"temperature": float(temperature)}
    if response_mime:
        # Request an image response (e.g., image/png) when editing
        gen_cfg["responseMimeType"] = response_mime
    payload = {"contents": [{"role": "user", "parts": parts}], "generationConfig": gen_cfg}
    try:
        async with httpx.AsyncClient(timeout=timeout_s) as client:
            r = await client.post(url, json=payload)
            if r.status_code >= 400:
                # Include upstream body and selected headers for diagnosis
                ct = r.headers.get("content-type", "")
                rid = r.headers.get("x-request-id") or r.headers.get("x-goog-request-id") or ""
                body_text = (r.text or "")[:2000]
                # Print once to logs for backend visibility
                try:
                    print(f"[gemini] HTTP {r.status_code} ct={ct} rid={rid} body={body_text}")
                except Exception:
                    pass
                # Try to parse structured error message if JSON
                err_json = None
                try:
                    if ct.startswith("application/json"):
                        err_json = r.json()
                except Exception:
                    err_json = None
                detail = f"gemini_http_{r.status_code}"
                return {"status": "error", "detail": detail, "body": body_text, "rid": rid, "content_type": ct, "error_json": err_json}
            return r.json()
    except httpx.HTTPError as e:
        # Network/timeout level errors
        try:
            print(f"[gemini] HTTPError: {str(e)}")
        except Exception:
            pass
        return {"status": "error", "detail": str(e)}


def _allowed_image_mime(mime: str) -> bool:
    try:
        # Allow common camera/mobile formats by default; can be overridden via env
        allowed = (os.getenv("VISION_ALLOWED_MIME", "jpeg,png,dng,heic,heif,webp") or "").lower().split(",")
        mime = (mime or "").lower()
        if mime.startswith("image/"):
            short = mime.split("/", 1)[1]
        else:
            short = mime
        return short in {s.strip() for s in allowed}
    except Exception:
        return True


async def _load_image_as_inline(image_url: Optional[str], input_b64: Optional[str], input_mime: Optional[str] = None) -> Optional[dict]:
    max_mb = float(os.getenv("VISION_MAX_IMAGE_MB", "10") or "10")
    if input_b64:
        # Prefer provided mime; default to image/jpeg
        mime = (input_mime or "image/jpeg").strip() or "image/jpeg"
        return {"inlineData": {"mimeType": mime, "data": input_b64}}
    if image_url:
        # Support data URLs directly (e.g., data:image/png;base64,....)
        try:
            if image_url.startswith("data:"):
                head, b64 = image_url.split(",", 1)
                mime = "image/jpeg"
                try:
                    if head.startswith("data:"):
                        # e.g., data:image/png;base64
                        core = head[5:]
                        if ";" in core:
                            mime = core.split(";", 1)[0] or mime
                        elif core:
                            mime = core or mime
                except Exception:
                    pass
                if not _allowed_image_mime(mime):
                    return None
                # Basic size guard (approx) – base64 expands ~4/3; estimate bytes
                try:
                    approx_bytes = int(len(b64) * 3 / 4)
                    if approx_bytes > max_mb * 1024 * 1024:
                        return None
                except Exception:
                    pass
                return {"inlineData": {"mimeType": mime, "data": b64}}
        except Exception:
            return None
        try:
            async with httpx.AsyncClient(timeout=20, headers=_DEFAULT_HTTP_HEADERS) as client:
                r = await client.get(image_url)
                if r.status_code >= 400:
                    return None
                data = r.content or b""
                if len(data) > max_mb * 1024 * 1024:
                    return None
                mime = r.headers.get("content-type", "image/jpeg")
                if not _allowed_image_mime(mime):
                    return None
                b64 = _b64.b64encode(data).decode("ascii")
                return {"inlineData": {"mimeType": mime, "data": b64}}
        except Exception:
            return None
    return None


# ---------------------- Vision + Edit Tools ----------------------

# Nano Banana (direct edit) adapter
def _banana_base() -> str:
    return os.getenv("NANO_BANANA_API_URL", os.getenv("BANANA_API_URL", "")).rstrip("/")


def _banana_key() -> str:
    return os.getenv("NANO_BANANA_API_KEY", os.getenv("BANANA_API_KEY", ""))


from typing import Optional as _Optional

async def _banana_edit(image_b64: str, prompt: str, output_format: _Optional[str] = None, timeout_s: int = 60) -> dict:
    base = _banana_base()
    key = _banana_key()
    if not base:
        return {"status": "error", "detail": "missing_banana_url"}
    if not key:
        return {"status": "error", "detail": "missing_banana_key"}
    url = base
    # Allow passing a full URL or base + fixed path
    if not url.startswith("http"):
        url = f"https://{url}"
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json", "x-api-key": key}
    payload = {"prompt": prompt, "image_base64": image_b64}
    if output_format:
        payload["output_format"] = output_format
    try:
        async with httpx.AsyncClient(timeout=timeout_s) as client:
            r = await client.post(url, json=payload, headers=headers)
            if r.status_code >= 400:
                return {"status": "error", "detail": f"banana_http_{r.status_code}", "body": r.text[:200]}
            body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
            # Heuristic field extraction
            img_b64 = (
                body.get("image_base64")
                or (body.get("data") or {}).get("image_base64")
                or (body.get("result") or {}).get("image_base64")
                or body.get("image")
                or (body.get("data") or {}).get("image")
            )
            out_url = body.get("url") or body.get("output_url") or (body.get("data") or {}).get("url")
            mime = body.get("mime") or (body.get("data") or {}).get("mime") or "image/png"
            if out_url:
                return {"status": "ok", "preview_url": out_url, "mime": mime}
            if img_b64:
                data_url = f"data:{mime};base64,{img_b64}"
                return {"status": "ok", "data_url": data_url, "mime": mime}
            return {"status": "error", "detail": "banana_no_image"}
    except httpx.HTTPError as e:
        return {"status": "error", "detail": str(e)[:160]}

async def tool_vision_inspect(
    db: Session,
    ctx: UserContext,
    tenant_id: str,
    image_url: _Optional[str] = None,
    inputImageBase64: _Optional[str] = None,
    inputMime: _Optional[str] = None,
    ret: Optional[List[str]] = None,
) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    try:
        ok, ttl = check_and_increment(str(ctx.tenant_id), "vision.inspect", max_per_minute=30, burst=15)
        if not ok:
            return {"status": "rate_limited", "retry_s": int(ttl)}
    except Exception:
        pass
    img = await _load_image_as_inline(image_url, inputImageBase64, inputMime)
    if not img:
        return {"status": "error", "detail": "invalid_image"}
    prompt = (
        "Analyze this beauty image. Return concise JSON with keys: brief (<=80 words), "
        "faces (count), lighting (type/quality), colors (dominant, undertone guess), "
        "makeup (key cues), accessories, background, qualityFlags (blur, hotspots, casts), safeSearch (yes/no)."
    )
    parts = [img, {"text": prompt}]
    res = await _gemini_generate(parts, temperature=0.2)
    if res.get("status") == "error":
        return res
    # Try to parse JSON from text parts
    brief = ""
    details: Dict[str, Any] = {}
    try:
        text = "".join(
            [p.get("text", "") for p in (res.get("candidates") or [{}])[0].get("content", {}).get("parts", [])]
        )
        if text:
            try:
                details = _json.loads(text)
            except Exception:
                brief = text[:400]
    except Exception:
        pass
    if not brief:
        brief = str(details.get("brief") or "Analysis ready.")
    return {"status": "ok", "brief": brief, "details": details}


async def tool_image_edit(
    db: Session,
    ctx: UserContext,
    tenant_id: str,
    mode: str,
    prompt: str,
    inputImageBase64: _Optional[str],
    outputFormat: _Optional[str] = None,
    imageUrl: _Optional[str] = None,
    inputMime: _Optional[str] = None,
    preserveDims: Optional[bool] = None,
) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    try:
        ok, ttl = check_and_increment(str(ctx.tenant_id), "image.edit", max_per_minute=20, burst=10)
        if not ok:
            return {"status": "rate_limited", "retry_s": int(ttl)}
    except Exception:
        pass
    # Accept either base64 or imageUrl and perform edit via Gemini
    img_obj = await _load_image_as_inline(imageUrl, inputImageBase64 or None, inputMime)
    if not img_obj:
        return {"status": "error", "detail": "missing_image"}
    # Determine original dimensions if Pillow is available
    orig_w: int | None = None
    orig_h: int | None = None
    try:
        if _PILImage is not None:
            b64 = (img_obj.get("inlineData") or {}).get("data")
            if b64:
                _raw = _b64.b64decode(b64)
                with _PILImage.open(io.BytesIO(_raw)) as _im:
                    orig_w, orig_h = _im.size
    except Exception:
        orig_w = orig_h = None
    preserve = True if preserveDims is None else bool(preserveDims)
    preserve_clause = ""
    if preserve:
        if orig_w and orig_h:
            preserve_clause = (
                f" Keep canvas exactly {orig_w}x{orig_h} px;"
                " no upscaling, no cropping, no zoom; preserve aspect as captured."
            )
        else:
            preserve_clause = " Preserve original resolution and aspect ratio."
    parts = [
        img_obj,
        {"text": f"Edit instruction: {prompt}.{preserve_clause} Keep skin texture; no body morphing; match undertone."},
    ]
    # Gemini's generateContent currently restricts response_mime_type to text/* & application/*.
    # For image edits, omit responseMimeType and parse inlineData returned by the model.
    res = await _gemini_generate(parts, temperature=0.2)
    if res.get("status") == "error":
        # Emit a detailed event for diagnosis
        try:
            from .events import emit_event
            emit_event("GeminiEditError", {
                "tenant_id": tenant_id,
                "detail": res.get("detail"),
                "rid": res.get("rid"),
                "content_type": res.get("content_type"),
                "body": (res.get("body") or "")[:500],
                "preserveDims": preserveDims,
            })
        except Exception:
            pass
        # Retry once only for 5xx
        if "http_5" in str(res.get("detail", "")):
            res2 = await _gemini_generate(parts, temperature=0.2)
            if res2.get("status") != "error":
                res = res2
        if res.get("status") == "error":
            return res
    # Locate inline image data in candidates
    data_b64 = ""
    mime = "image/png"
    try:
        cand = (res.get("candidates") or [{}])[0]
        for p in cand.get("content", {}).get("parts", []):
            if "inlineData" in p and p["inlineData"].get("data"):
                data_b64 = p["inlineData"]["data"]
                mime = p["inlineData"].get("mimeType", mime)
                break
    except Exception:
        data_b64 = ""
    if not data_b64:
        # Do NOT fallback to Vertex. Force Gemini-only path.
        return {"status": "error", "detail": "no_image_returned"}
    # Enforce original dimensions if requested and we know them
    if preserve and orig_w and orig_h and _PILImage is not None:
        try:
            _decoded = _b64.b64decode(data_b64)
            with _PILImage.open(io.BytesIO(_decoded)) as _im2:
                w2, h2 = _im2.size
                if (w2, h2) != (orig_w, orig_h):
                    # Fit with padding (transparent) to avoid distortion
                    scale = min(orig_w / w2, orig_h / h2)
                    new_w = max(1, int(round(w2 * scale)))
                    new_h = max(1, int(round(h2 * scale)))
                    _im_resized = _im2.resize((new_w, new_h), (_PILImage.LANCZOS if hasattr(_PILImage, 'LANCZOS') else _PILImage.BICUBIC))
                    canvas = _PILImage.new("RGBA", (orig_w, orig_h), (0, 0, 0, 0))
                    off_x = (orig_w - new_w) // 2
                    off_y = (orig_h - new_h) // 2
                    canvas.paste(_im_resized, (off_x, off_y))
                    buf = io.BytesIO()
                    canvas.save(buf, format="PNG")
                    data_b64 = _b64.b64encode(buf.getvalue()).decode("ascii")
                    mime = "image/png"
        except Exception:
            pass
    # Persist to share_reports and return a link (and data_url for immediate preview)
    token = _secrets.token_urlsafe(16)
    filename = f"brandvx_edit.{ 'png' if 'png' in mime else ('jpg' if 'jpeg' in mime else 'img')}"
    data_url = f"data:{mime};base64,{data_b64}"
    try:
        with engine.begin() as conn:
            conn.execute(
                _sql_text(
                    "INSERT INTO share_reports (tenant_id, token, mime, filename, data_text) VALUES (CAST(:t AS uuid), :tok, :m, :fn, :dt)"
                ),
                {"t": tenant_id, "tok": token, "m": mime, "fn": filename, "dt": data_url},
            )
    except Exception as e:
        return {"status": "error", "detail": f"persist_failed: {str(e)[:120]}"}
    # Ensure preview links are absolute so the frontend on app.brandvx.io can fetch
    # them even if BACKEND_BASE_URL is not set in the environment.
    base_api = os.getenv(
        "BACKEND_BASE_URL",
        os.getenv("PUBLIC_API_BASE_URL", "https://api.brandvx.io"),
    ).rstrip("/")
    url = f"{base_api}/reports/download/{token}" if base_api else f"/reports/download/{token}"
    return {"status": "ok", "preview_url": url, "data_url": data_url, "mime": mime}


# ---------------------- Vertex Images Fallback ----------------------

def _vertex_project() -> str:
    return os.getenv("VERTEX_PROJECT", "").strip()


def _vertex_location() -> str:
    return os.getenv("VERTEX_LOCATION", "us-central1").strip() or "us-central1"


def _vertex_sa_token() -> str:
    """Return an OAuth2 bearer token using the service account JSON from env.
    Expects VERTEX_SA_JSON_B64 to contain the base64-encoded JSON key.
    """
    try:
        enc = os.getenv("VERTEX_SA_JSON_B64", "")
        if not enc:
            return ""
        data = _b64.b64decode(enc)
        info = _json.loads(data.decode("utf-8"))
        # Import lazily so local dev without google-auth still works
        from google.oauth2 import service_account as _gsa  # type: ignore
        from google.auth.transport.requests import Request as _GARequest  # type: ignore

        creds = _gsa.Credentials.from_service_account_info(
            info,
            scopes=["https://www.googleapis.com/auth/cloud-platform"],
        )
        creds.refresh(_GARequest())
        return str(creds.token or "")
    except Exception:
        return ""


async def _vertex_try_image_edit(img_obj: dict, prompt: str, preserve_dims: bool) -> dict | None:
    """Attempt image edit via Vertex Images (Gemini 2.5 Flash Image).
    Returns {data: base64, mime: str} on success, else None.
    """
    project = _vertex_project()
    if not project:
        return {"error": "vertex_not_configured"}
    token = _vertex_sa_token()
    if not token:
        return {"error": "vertex_token_missing"}
    # The Gemini 2.5 Flash Image (preview) model is exposed under locations/global
    # per Vertex docs; use global regardless of regional env.
    location = "global"
    try:
        inline = (img_obj or {}).get("inlineData", {})
        input_mime = inline.get("mimeType", "image/jpeg")
        input_b64 = inline.get("data", "")
        if not input_b64:
            return None
        # Upload the image to GCS as this model expects fileData (not inlineData)
        bucket = os.getenv("GCS_BUCKET", "").strip()
        if not bucket:
            return {"error": "gcs_bucket_missing"}
        object_name = f"brandvzn/tmp/{_secrets.token_urlsafe(8)}.jpg"
        try:
            gs_uri = await _gcs_upload_base64(bucket, object_name, input_b64, input_mime, token)
        except Exception as e:
            return {"error": f"gcs_upload_failed:{str(e)[:80]}"}
        preserve_clause = " Preserve original resolution and aspect ratio." if preserve_dims else ""
        url = (
            f"https://aiplatform.googleapis.com/v1/projects/{project}/locations/{location}/"
            "publishers/google/models/gemini-2.5-flash-image-preview:generateContent"
        )
        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {"fileData": {"mimeType": input_mime, "fileUri": gs_uri}},
                        {"text": f"Edit instruction: {prompt}.{preserve_clause} Keep skin texture; no body morphing; match undertone."},
                    ],
                }
            ],
        }
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(url, headers=headers, json=payload)
            if r.status_code >= 400:
                # Return structured error so client can display it
                ct = r.headers.get("content-type", "")
                rid = r.headers.get("x-request-id") or r.headers.get("x-goog-request-id") or ""
                body_text = (r.text or "")[:2000]
                try:
                    print(f"[vertex] HTTP {r.status_code} ct={ct} rid={rid} body={body_text}")
                except Exception:
                    pass
                # Best-effort cleanup of temp object
                try:
                    await _gcs_delete_object(bucket, object_name, token)
                except Exception:
                    pass
                return {"error": f"vertex_http_{r.status_code}", "body": body_text, "rid": rid}
            j = r.json()
            try:
                parts = ((j.get("candidates") or [{}])[0].get("content") or {}).get("parts") or []
                for p in parts:
                    if p.get("inlineData") and p["inlineData"].get("data"):
                        # Cleanup temp object after success
                        try:
                            await _gcs_delete_object(bucket, object_name, token)
                        except Exception:
                            pass
                        return {
                            "data": p["inlineData"]["data"],
                            "mime": p["inlineData"].get("mimeType", "image/png"),
                        }
            except Exception:
                try:
                    await _gcs_delete_object(bucket, object_name, token)
                except Exception:
                    pass
                return None
        return None
    except Exception:
        return None


async def _gcs_upload_base64(bucket: str, object_name: str, b64: str, mime: str, bearer_token: str) -> str:
    """Upload base64-encoded bytes to GCS using JSON API; return gs:// URI."""
    data = _b64.b64decode(b64)
    url = f"https://storage.googleapis.com/upload/storage/v1/b/{bucket}/o?uploadType=media&name={_urlparse.quote(object_name, safe='')}"
    headers = {"Authorization": f"Bearer {bearer_token}", "Content-Type": mime or "application/octet-stream"}
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(url, headers=headers, content=data)
        if r.status_code >= 400:
            raise RuntimeError(f"gcs_http_{r.status_code}: {r.text[:200]}")
    return f"gs://{bucket}/{object_name}"


async def _gcs_delete_object(bucket: str, object_name: str, bearer_token: str) -> None:
    url = f"https://storage.googleapis.com/storage/v1/b/{bucket}/o/{_urlparse.quote(object_name, safe='')}"
    headers = {"Authorization": f"Bearer {bearer_token}"}
    async with httpx.AsyncClient(timeout=20) as client:
        await client.delete(url, headers=headers)


# ---------------------- Brand Vision (Instagram-driven) ----------------------

async def tool_brand_vision_analyze(
    db: Session,
    ctx: UserContext,
    tenant_id: str,
    sample: int = 12,
) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    try:
        ok, ttl = check_and_increment(str(ctx.tenant_id), "ai.brand.vision", max_per_minute=6, burst=3)
        if not ok:
            return {"status": "rate_limited", "retry_s": int(ttl)}
    except Exception:
        pass
    base_api = os.getenv("BACKEND_BASE_URL", "http://localhost:8000").rstrip("/")
    profile: Dict[str, Any] = {}
    items: list[dict] = []
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            rp = await client.get(f"{base_api}/instagram/profile", params={"tenant_id": tenant_id})
            if rp.status_code < 400:
                j = rp.json()
                if isinstance(j, dict):
                    profile = j.get("profile") or {}
            rm = await client.get(f"{base_api}/instagram/media", params={"tenant_id": tenant_id, "limit": max(1, min(int(sample or 12), 30))})
            if rm.status_code < 400:
                j2 = rm.json()
                if isinstance(j2, dict):
                    items = list(j2.get("items") or [])
    except Exception:
        pass
    # Build a concise analysis prompt
    captions = []
    for it in items[: max(1, min(int(sample or 12), 20))]:
        cap = str((it or {}).get("caption") or "").strip()
        if cap:
            captions.append(cap[:220])
    ptext = (
        "Analyze this Instagram presence for a beauty professional. Return JSON with keys: "
        "summary (<=60w), tone (<=5 words), palette (<=6 adjectives), strengths (list), weaknesses (list), cadence (one sentence). "
        "Base analysis on provided captions and any visible cues. Be specific but concise."
    )
    try:
        if profile:
            uname = str(profile.get("username") or "").strip()
            mcount = str(profile.get("media_count") or "")
            if uname:
                ptext += f"\nAccount: {uname}."
            if mcount:
                ptext += f" Media count: {mcount}."
    except Exception:
        pass
    if captions:
        caps_joined = "\n- ".join(captions[:10])
        ptext += f"\nRecent captions (samples):\n- {caps_joined}"
    client = AIClient()
    raw = await client.generate(
        BRAND_SYSTEM,
        [{"role": "user", "content": ptext}],
        max_tokens=600,
    )
    analysis: Dict[str, Any] = {}
    summary = ""
    try:
        analysis = _json.loads(raw)
    except Exception:
        summary = raw[:400]
        analysis = {"summary": summary}
    # Persist into settings.brand_profile
    try:
        row = db.query(dbm.Settings).filter(dbm.Settings.tenant_id == tenant_id).first()
        data = {}
        if row and row.data_json:
            try:
                data = _json.loads(row.data_json)
            except Exception:
                data = {}
        bp = dict(data.get("brand_profile") or {})
        for k in ["summary", "tone", "palette", "strengths", "weaknesses", "cadence"]:
            if analysis.get(k) is not None:
                bp[k] = analysis.get(k)
        data["brand_profile"] = bp
        blob = _json.dumps(data)
        if not row:
            db.add(dbm.Settings(tenant_id=tenant_id, data_json=blob))
        else:
            row.data_json = blob
        db.commit()
    except Exception:
        try: db.rollback()
        except Exception: pass
    return {"status": "ok", "analysis": analysis}


# ---------------------- Memories (Train VX) ----------------------
def tool_memories_upsert(
    db: Session,
    ctx: UserContext,
    tenant_id: str,
    key: str,
    value: str,
    tags: Optional[str] = None,
) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    try:
        with engine.begin() as conn:
            # Set RLS GUCs for policies
            try:
                conn.execute(_sql_text("SET LOCAL app.role = 'owner_admin'"))
                conn.execute(_sql_text("SET LOCAL app.tenant_id = :t"), {"t": tenant_id})
            except Exception:
                pass
            # Write as JSONB universally; works when column is json/jsonb. If column is TEXT in a dev env,
            # callers can use report endpoint or migration to switch. Production expects JSON.
            upd = _sql_text(
                "UPDATE ai_memories SET value=to_jsonb(:v::text), tags=to_jsonb(:tg::text), updated_at=NOW() "
                "WHERE tenant_id = CAST(:t AS uuid) AND key=:k"
            )
            conn.execute(upd, {"t": tenant_id or str(ctx.tenant_id), "k": key, "v": value, "tg": (tags or None)})

            ins = _sql_text(
                "INSERT INTO ai_memories (tenant_id, key, value, tags) "
                "SELECT CAST(:t AS uuid), :k, to_jsonb(:v::text), to_jsonb(:tg::text) "
                "WHERE NOT EXISTS (SELECT 1 FROM ai_memories WHERE tenant_id = CAST(:t AS uuid) AND key=:k)"
            )
            conn.execute(ins, {"t": tenant_id or str(ctx.tenant_id), "k": key, "v": value, "tg": (tags or None)})
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "detail": str(e)[:200]}


# ---------------------- Social scraping (public metadata only) ----------------------

async def tool_social_fetch_profile(
    db: Session,
    ctx: UserContext,
    tenant_id: str,
    url: str,
) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    if os.getenv("SOCIAL_SCRAPER_ENABLED", "0") != "1":
        return {"status": "disabled"}
    try:
        ok, ttl = check_and_increment(str(ctx.tenant_id), "social.fetch_profile", max_per_minute=12, burst=6)
        if not ok:
            return {"status": "rate_limited", "retry_s": int(ttl)}
    except Exception:
        pass
    try:
        async with httpx.AsyncClient(timeout=15, headers=_DEFAULT_HTTP_HEADERS) as client:
            r = await client.get(url)
            if r.status_code >= 400:
                return {"status": "error", "detail": f"http_{r.status_code}"}
            html = r.text or ""
            # Heuristic extraction
            def _find(tag: str) -> str:
                idx = html.lower().find(tag.lower())
                if idx < 0:
                    return ""
                cut = html[idx: idx+300]
                for sep in ['content="', 'content=\"', '"content":"']:
                    j = cut.find(sep)
                    if j >= 0:
                        val = cut[j+len(sep):]
                        return val.split('"', 1)[0]
                return ""
            bio = _find('property="og:description"') or _find('name="description"')
            title = _find('property="og:title"')
            image = _find('property="og:image"')
            return {"status": "ok", "profile": {"title": title, "bio": bio, "image": image}}
    except Exception as e:
        return {"status": "error", "detail": str(e)[:120]}


async def tool_social_scrape_posts(
    db: Session,
    ctx: UserContext,
    tenant_id: str,
    url: str,
    limit: int = 12,
) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    if os.getenv("SOCIAL_SCRAPER_ENABLED", "0") != "1":
        return {"status": "disabled"}
    try:
        ok, ttl = check_and_increment(str(ctx.tenant_id), "social.scrape_posts", max_per_minute=12, burst=6)
        if not ok:
            return {"status": "rate_limited", "retry_s": int(ttl)}
    except Exception:
        pass
    try:
        async with httpx.AsyncClient(timeout=15, headers=_DEFAULT_HTTP_HEADERS) as client:
            r = await client.get(url)
            if r.status_code >= 400:
                return {"status": "error", "detail": f"http_{r.status_code}"}
            html = r.text or ""
            thumbs: list[str] = []
            # Naive parse for image URLs
            for marker in ["display_url", "thumbnail_src", "og:image"]:
                i = 0
                while True:
                    j = html.find(marker, i)
                    if j < 0 or len(thumbs) >= int(limit or 12):
                        break
                    cut = html[j: j+500]
                    k = cut.find("https://")
                    if k >= 0:
                        val = cut[k:].split('"', 1)[0]
                        if val and val not in thumbs:
                            thumbs.append(val)
                    i = j + len(marker)
            return {"status": "ok", "items": thumbs[: int(limit or 12)]}
    except Exception as e:
        return {"status": "error", "detail": str(e)[:120]}


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


# Quick connector actions
async def tool_connectors_cleanup(db: Session, ctx: UserContext, tenant_id: str) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    base_api = os.getenv("BACKEND_BASE_URL", "http://localhost:8000").rstrip("/")
    headers = {"X-User-Id": str(getattr(ctx, 'user_id', 'user') or 'user'), "X-Role": str(getattr(ctx, 'role', 'owner_admin') or 'owner_admin'), "X-Tenant-Id": str(tenant_id)}
    async with httpx.AsyncClient(timeout=30, headers=headers) as client:
        r = await client.post(f"{base_api}/integrations/connectors/cleanup", json={"tenant_id": tenant_id})
        return r.json() if r.headers.get("content-type", "").startswith("application/json") else {"status": r.status_code}

async def tool_connectors_normalize(db: Session, ctx: UserContext, tenant_id: str) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    base_api = os.getenv("BACKEND_BASE_URL", "http://localhost:8000").rstrip("/")
    headers = {"X-User-Id": str(getattr(ctx, 'user_id', 'user') or 'user'), "X-Role": str(getattr(ctx, 'role', 'owner_admin') or 'owner_admin'), "X-Tenant-Id": str(tenant_id)}
    async with httpx.AsyncClient(timeout=60, headers=headers) as client:
        r = await client.post(f"{base_api}/integrations/connectors/normalize", json={"tenant_id": tenant_id, "migrate_legacy": True, "dedupe": True})
        return r.json() if r.headers.get("content-type", "").startswith("application/json") else {"status": r.status_code}

async def tool_calendar_sync(db: Session, ctx: UserContext, tenant_id: str, provider: Optional[str] = None) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    base_api = os.getenv("BACKEND_BASE_URL", "http://localhost:8000").rstrip("/")
    headers = {"X-User-Id": str(getattr(ctx, 'user_id', 'user') or 'user'), "X-Role": str(getattr(ctx, 'role', 'owner_admin') or 'owner_admin'), "X-Tenant-Id": str(tenant_id)}
    async with httpx.AsyncClient(timeout=30, headers=headers) as client:
        r = await client.post(f"{base_api}/calendar/sync", json={"tenant_id": tenant_id, "provider": provider or "auto"})
        return r.json() if r.headers.get("content-type", "").startswith("application/json") else {"status": r.status_code}

async def tool_calendar_merge(db: Session, ctx: UserContext, tenant_id: str) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    base_api = os.getenv("BACKEND_BASE_URL", "http://localhost:8000").rstrip("/")
    headers = {"X-User-Id": str(getattr(ctx, 'user_id', 'user') or 'user'), "X-Role": str(getattr(ctx, 'role', 'owner_admin') or 'owner_admin'), "X-Tenant-Id": str(tenant_id)}
    async with httpx.AsyncClient(timeout=30, headers=headers) as client:
        r = await client.post(f"{base_api}/calendar/merge", json={"tenant_id": tenant_id})
        return r.json() if r.headers.get("content-type", "").startswith("application/json") else {"status": r.status_code}

async def tool_calendar_reschedule(db: Session, ctx: UserContext, tenant_id: str, external_ref: _Optional[str], provider: _Optional[str], provider_event_id: _Optional[str], start_ts: int, end_ts: _Optional[int]) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    base_api = os.getenv("BACKEND_BASE_URL", "http://localhost:8000").rstrip("/")
    payload = {"tenant_id": tenant_id, "external_ref": external_ref, "provider": provider, "provider_event_id": provider_event_id, "start_ts": int(start_ts), "end_ts": (int(end_ts) if end_ts else None)}
    headers = {"X-User-Id": str(getattr(ctx, 'user_id', 'user') or 'user'), "X-Role": str(getattr(ctx, 'role', 'owner_admin') or 'owner_admin'), "X-Tenant-Id": str(tenant_id)}
    async with httpx.AsyncClient(timeout=30, headers=headers) as client:
        r = await client.post(f"{base_api}/calendar/reschedule", json=payload)
        return r.json() if r.headers.get("content-type", "").startswith("application/json") else {"status": r.status_code}

async def tool_calendar_cancel(db: Session, ctx: UserContext, tenant_id: str, external_ref: _Optional[str], provider: _Optional[str], provider_event_id: _Optional[str]) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    base_api = os.getenv("BACKEND_BASE_URL", "http://localhost:8000").rstrip("/")
    payload = {"tenant_id": tenant_id, "external_ref": external_ref, "provider": provider, "provider_event_id": provider_event_id}
    headers = {"X-User-Id": str(getattr(ctx, 'user_id', 'user') or 'user'), "X-Role": str(getattr(ctx, 'role', 'owner_admin') or 'owner_admin'), "X-Tenant-Id": str(tenant_id)}
    async with httpx.AsyncClient(timeout=30, headers=headers) as client:
        r = await client.post(f"{base_api}/calendar/cancel", json=payload)
        return r.json() if r.headers.get("content-type", "").startswith("application/json") else {"status": r.status_code}

async def tool_calendar_push_google(db: Session, ctx: UserContext, tenant_id: str) -> Dict[str, Any]:
    """Create Google Calendar events for upcoming non-Google events (7-day window),
    avoiding duplicates by title+start match.
    """
    _require_tenant(ctx, tenant_id)
    now = int(time.time())
    week_end = now + 7*86400
    # Load existing google events map by (title, start_ts)
    g_events = (
        db.query(dbm.CalendarEvent)
        .filter(dbm.CalendarEvent.tenant_id == tenant_id, dbm.CalendarEvent.provider == 'google', dbm.CalendarEvent.start_ts >= now, dbm.CalendarEvent.start_ts <= week_end)
        .all()
    )
    gkeys = {(str(r.title or '').strip(), int(r.start_ts or 0)) for r in g_events}
    # Candidates: non-google events in the same window
    src_events = (
        db.query(dbm.CalendarEvent)
        .filter(dbm.CalendarEvent.tenant_id == tenant_id, dbm.CalendarEvent.provider != 'google', dbm.CalendarEvent.start_ts >= now, dbm.CalendarEvent.start_ts <= week_end)
        .order_by(dbm.CalendarEvent.start_ts.asc())
        .all()
    )
    pushed = 0
    errors: List[Dict[str,str]] = []
    for ev in src_events:
        key = (str(ev.title or '').strip(), int(ev.start_ts or 0))
        if key in gkeys:
            continue
        try:
            desc = f"Mirrored from {ev.provider or 'source'} via BrandVX"
            res = cal_google.create_event(str(tenant_id), ev.title or 'Appointment', int(ev.start_ts or now), int(ev.end_ts or (int(ev.start_ts or now)+3600)), desc)
            if res.get('status') == 'ok':
                # Persist a mirror row for unified view
                db.add(dbm.CalendarEvent(tenant_id=tenant_id, event_id=res.get('id') or None, title=ev.title or 'Appointment', start_ts=int(ev.start_ts or now), end_ts=(int(ev.end_ts or 0) or None), provider='google', status='confirmed'))
                db.commit()
                gkeys.add(key)
                pushed += 1
            else:
                errors.append({'title': ev.title or '', 'error': str(res.get('error') or res.get('detail') or 'push_failed')})
        except Exception as e:
            try: db.rollback()
            except Exception: pass
            errors.append({'title': ev.title or '', 'error': str(e)[:160]})
    return {'status': 'ok', 'pushed': pushed, 'errors': errors[:5]}

async def tool_oauth_refresh(db: Session, ctx: UserContext, tenant_id: str, provider: str) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    base_api = os.getenv("BACKEND_BASE_URL", "http://localhost:8000").rstrip("/")
    headers = {"X-User-Id": str(getattr(ctx, 'user_id', 'user') or 'user'), "X-Role": str(getattr(ctx, 'role', 'owner_admin') or 'owner_admin'), "X-Tenant-Id": str(tenant_id)}
    async with httpx.AsyncClient(timeout=30, headers=headers) as client:
        r = await client.post(f"{base_api}/oauth/refresh", json={"tenant_id": tenant_id, "provider": provider})
        return r.json() if r.headers.get("content-type", "").startswith("application/json") else {"status": r.status_code}

async def tool_square_backfill(db: Session, ctx: UserContext, tenant_id: str) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    base_api = os.getenv("BACKEND_BASE_URL", "http://localhost:8000").rstrip("/")
    headers = {"X-User-Id": str(getattr(ctx, 'user_id', 'user') or 'user'), "X-Role": str(getattr(ctx, 'role', 'owner_admin') or 'owner_admin'), "X-Tenant-Id": str(tenant_id)}
    async with httpx.AsyncClient(timeout=60, headers=headers) as client:
        r = await client.post(f"{base_api}/integrations/booking/square/backfill-metrics", json={"tenant_id": tenant_id})
        return r.json() if r.headers.get("content-type", "").startswith("application/json") else {"status": r.status_code}
async def tool_twilio_provision(db: Session, ctx: UserContext, tenant_id: str, area_code: str = "") -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    base_api = os.getenv("BACKEND_BASE_URL", "http://localhost:8000").rstrip("/")
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(f"{base_api}/integrations/twilio/provision", json={"tenant_id": tenant_id, "area_code": area_code})
        return r.json() if r.headers.get("content-type", "").startswith("application/json") else {"status": r.status_code}


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


# Simple pricing model calculator
def tool_pricing_model(
    db: Session,
    ctx: UserContext,
    tenant_id: str,
    price: float,
    product_cost: float,
    service_time_minutes: float,
) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    service_hours = max(0.01, service_time_minutes / 60.0)
    effective_hourly = (price - product_cost) / service_hours
    margin = 0.0
    try:
        margin = (price - product_cost) / max(0.01, price)
    except Exception:
        margin = 0.0
    suggestions = []
    target_hourly = 100.0  # default benchmark; UI can pass a target later
    if effective_hourly < target_hourly:
        suggestions.append("Consider adjusting price, reducing time, or adding profitable add-ons.")
    else:
        suggestions.append("Effective hourly meets or exceeds a common target benchmark.")
    return {
        "status": "ok",
        "effective_hourly": round(effective_hourly, 2),
        "margin_ratio": round(margin, 2),
        "inputs": {
            "price": price,
            "product_cost": product_cost,
            "service_time_minutes": service_time_minutes,
        },
        "suggestions": suggestions,
    }


# Safety check: light moderation/sanity pass using AI
async def tool_safety_check(
    db: Session,
    ctx: UserContext,
    tenant_id: str,
    text: str,
) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    client = AIClient()
    prompt = (
        "Review the following marketing or client messaging for medical/legal claims, PII, or non-compliant promises. "
        "Return a brief list of issues and suggested safe rewrites. If acceptable, say 'OK'.\n\nTEXT:\n" + text
    )
    result = await client.generate(BRAND_SYSTEM, [{"role": "user", "content": prompt}], max_tokens=240)
    return {"status": "ok", "review": result}


# Stop cadence for a contact

def tool_stop_cadence(
    db: Session,
    ctx: UserContext,
    tenant_id: str,
    contact_id: str,
    cadence_id: str,
) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
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
    return {"status": "ok", "stopped": count}


# Notify waitlist candidates and send message (gated externally)

def tool_notify_trigger_send(
    db: Session,
    ctx: UserContext,
    tenant_id: str,
    max_candidates: int = 5,
    message_template: Optional[str] = None,
) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    q = db.query(dbm.NotifyListEntry).filter(dbm.NotifyListEntry.tenant_id == tenant_id)
    rows = q.limit(max(1, min(max_candidates, 50))).all()
    targets = [r for r in rows if str(r.preference).lower() == "soonest"]
    sent = 0
    for t in targets:
        try:
            body = message_template or "A spot just opened. Reply YES for the soonest appointment."
            # We use channel sms; send_message routes to TEST_SMS_TO in dev
            send_message(db, tenant_id, t.contact_id, "sms", None, body, None)
            sent += 1
        except Exception:
            continue
    return {"status": "ok", "count": len(targets), "sent": sent}


REGISTRY = {
    "draft_message": tool_draft_message,  # async
    "propose_next_cadence_step": tool_propose_next_cadence_step,  # sync
    "pricing_model": tool_pricing_model,  # sync
    "safety_check": tool_safety_check,    # async
    "stop_cadence": tool_stop_cadence,    # sync
    "notify_trigger_send": tool_notify_trigger_send,  # sync
}


async def execute_tool(name: str, params: Dict[str, Any], db: Session, ctx: UserContext) -> Dict[str, Any]:
    # Prefer extended tools first so registry presence doesn't block routing
    from .metrics_counters import TOOL_LATENCY_SEC  # type: ignore
    ext = await _dispatch_extended(name, params, db, ctx)
    if ext is not None:
        return ext
    # Handle built-in tools that bypass REGISTRY mapping
    if name == "messages.send":
        with TOOL_LATENCY_SEC.labels(name=name).time():  # type: ignore
            return send_message(
                db,
                tenant_id=str(params.get("tenant_id", ctx.tenant_id)),
                contact_id=str(params.get("contact_id", "")),
                channel=str(params.get("channel", "sms")),
                template_id=str(params.get("template_id") or ""),
                body=str(params.get("body") or ""),
                subject=str(params.get("subject") or ""),
            )
    fn = REGISTRY.get(name)
    if not fn:
        return {"status": "unknown_tool"}
    try:
        if name == "draft_message":
            with TOOL_LATENCY_SEC.labels(name=name).time():  # type: ignore
                return await fn(
                db,
                ctx,
                tenant_id=str(params.get("tenant_id", ctx.tenant_id)),
                contact_id=str(params.get("contact_id", "")),
                channel=str(params.get("channel", "sms")),
                service=params.get("service"),
            )
        if name == "safety_check":
            with TOOL_LATENCY_SEC.labels(name=name).time():  # type: ignore
                return await fn(
                db,
                ctx,
                tenant_id=str(params.get("tenant_id", ctx.tenant_id)),
                text=str(params.get("text", "")),
            )
        # sync tools
        if name == "propose_next_cadence_step":
            with TOOL_LATENCY_SEC.labels(name=name).time():  # type: ignore
                return fn(
                db,
                ctx,
                tenant_id=str(params.get("tenant_id", ctx.tenant_id)),
                contact_id=str(params.get("contact_id", "")),
                cadence_id=str(params.get("cadence_id", "")),
            )
        if name == "pricing_model":
            with TOOL_LATENCY_SEC.labels(name=name).time():  # type: ignore
                return fn(
                db,
                ctx,
                tenant_id=str(params.get("tenant_id", ctx.tenant_id)),
                price=float(params.get("price", 0)),
                product_cost=float(params.get("product_cost", 0)),
                service_time_minutes=float(params.get("service_time_minutes", 0)),
            )
        if name == "stop_cadence":
            with TOOL_LATENCY_SEC.labels(name=name).time():  # type: ignore
                return fn(
                db,
                ctx,
                tenant_id=str(params.get("tenant_id", ctx.tenant_id)),
                contact_id=str(params.get("contact_id", "")),
                cadence_id=str(params.get("cadence_id", "")),
            )
        if name == "notify_trigger_send":
            with TOOL_LATENCY_SEC.labels(name=name).time():  # type: ignore
                return fn(
                db,
                ctx,
                tenant_id=str(params.get("tenant_id", ctx.tenant_id)),
                max_candidates=int(params.get("max_candidates", 5)),
                message_template=params.get("message_template"),
            )
        # CRM helpers
        if name == "contacts.list.top_ltv":
            return tool_contacts_list_top_ltv(
                db,
                ctx,
                tenant_id=str(params.get("tenant_id", ctx.tenant_id)),
                limit=int(params.get("limit", 10)),
            )
        if name == "contacts.import.square":
            return await tool_contacts_import_square(
                db,
                ctx,
                tenant_id=str(params.get("tenant_id", ctx.tenant_id)),
            )
        return {"status": "not_implemented"}
    except ToolError as te:
        return {"status": str(te)}
    except Exception:
        return {"status": "error"}

async def tool_vision_analyze_gpt5(
    db: Session,
    ctx: UserContext,
    tenant_id: str,
    inputImageBase64: _Optional[str] = None,
    imageUrl: _Optional[str] = None,
    inputMime: _Optional[str] = None,
    question: _Optional[str] = None,
) -> Dict[str, Any]:
    """Analyze a beauty image and return a short, beauty‑friendly brief.
    Uses Gemini inspect for structured cues (if image provided), then GPT‑5 to compose a concise answer.
    """
    _require_tenant(ctx, tenant_id)
    details: Dict[str, Any] = {}
    brief_seed = ""
    try:
        # Try a lightweight vision inspect first for grounding
        res = await tool_vision_inspect(db, ctx, tenant_id, image_url=imageUrl, inputImageBase64=inputImageBase64, inputMime=inputMime, ret=["faces","lighting","colors","qualityFlags"])
        if res.get('status') == 'ok':
            details = res.get('details') or {}
            brief_seed = res.get('brief') or ''
    except Exception:
        details = {}
    client = AIClient()
    system = (
        "You are a concise beauty photo analyst. Provide a short, friendly analysis for a beauty professional. "
        "Focus on lighting, color, skin texture, and practical improvements. Keep it under 90 words."
    )
    user_parts: List[Dict[str, str]] = []
    if details:
        user_parts.append({"role": "user", "content": f"Context (JSON): {json_dumps_safe(details)}"})
    q = (question or "Analyze this photo for portfolio‑quality best practices.").strip()
    user_parts.append({"role": "user", "content": q})
    try:
        text = await client.generate(system, user_parts, max_tokens=220)
        out = text or brief_seed or "Analysis ready."
        return {"status": "ok", "brief": out}
    except Exception as e:
        return {"status": "ok", "brief": (brief_seed or str(e)[:140] or "Analysis ready.")}

def json_dumps_safe(obj: Any) -> str:
    try:
        return _json.dumps(obj, ensure_ascii=False)
    except Exception:
        try:
            return str(obj)
        except Exception:
            return "{}"


# ---------------------- Additional high-ROI tools ----------------------

def tool_contacts_dedupe(
    db: Session,
    ctx: UserContext,
    tenant_id: str,
) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    removed = 0
    seen: Dict[str, int] = {}
    q = (
        db.query(dbm.Contact)
        .filter(dbm.Contact.tenant_id == tenant_id, dbm.Contact.deleted == False)  # type: ignore
        .order_by(dbm.Contact.id.asc())
    )
    for c in q.all():
        key = f"{c.email_hash or ''}|{c.phone_hash or ''}"
        if key.strip() == "|":
            continue
        if key in seen:
            c.deleted = True  # type: ignore
            removed += 1
        else:
            seen[key] = c.id  # type: ignore
    db.commit()
    return {"status": "ok", "removed": removed}


def tool_contacts_dedupe_preview(
    db: Session,
    ctx: UserContext,
    tenant_id: str,
) -> Dict[str, Any]:
    """Preview duplicate contacts grouped by (email_hash, phone_hash) without modifying data."""
    _require_tenant(ctx, tenant_id)
    groups: Dict[str, Dict[str, Any]] = {}
    q = (
        db.query(dbm.Contact)
        .filter(dbm.Contact.tenant_id == tenant_id, dbm.Contact.deleted == False)  # type: ignore
        .order_by(dbm.Contact.id.asc())
    )
    for c in q.all():
        key = f"{c.email_hash or ''}|{c.phone_hash or ''}"
        if key.strip() == "|":
            continue
        g = groups.get(key)
        entry = {
            "contact_id": getattr(c, "contact_id", None),
            "display_name": getattr(c, "display_name", None),
            "first_name": getattr(c, "first_name", None),
            "last_name": getattr(c, "last_name", None),
            "lifetime_cents": int(getattr(c, "lifetime_cents", 0) or 0),
            "txn_count": int(getattr(c, "txn_count", 0) or 0),
        }
        if not g:
            groups[key] = {"count": 1, "items": [entry]}
        else:
            g["count"] = int(g.get("count", 0)) + 1
            g.setdefault("items", []).append(entry)
    # Only return groups with duplicates (count >= 2)
    dupes = [{"key": k, **v} for k, v in groups.items() if int(v.get("count", 0)) >= 2]
    # Sort by group size desc
    dupes.sort(key=lambda x: int(x.get("count", 0)), reverse=True)
    return {"status": "ok", "groups": dupes[:200]}


def tool_campaigns_dormant_start(
    db: Session,
    ctx: UserContext,
    tenant_id: str,
    threshold_days: int = 60,
) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    # Ensure no pending aborted transaction
    try:
        db.rollback()
    except Exception:
        pass
    try:
        with engine.begin() as conn:
            # Set RLS GUCs
            conn.execute(_sql_text("SET LOCAL app.role = 'owner_admin'"))
            conn.execute(_sql_text("SET LOCAL app.tenant_id = :t"), {"t": tenant_id})

            # Build last_seen per contact
            last_seen_rows = conn.execute(
                _sql_text(
                    """
                    SELECT contact_id::text AS cid, MAX(start_ts) AS last_ts
                    FROM appointments
                    WHERE tenant_id = CAST(:tenant AS uuid)
                    GROUP BY contact_id
                    """
                ),
                {"tenant": tenant_id},
            ).fetchall()
            last_seen_map: Dict[str, str] = {str(r[0]): (str(r[1]) if r[1] is not None else "") for r in last_seen_rows}

            # Fetch contacts
            contact_rows = conn.execute(
                _sql_text(
                    """
                    SELECT id::text AS id
                    FROM contacts
                    WHERE tenant_id = CAST(:tenant AS uuid)
                    """
                ),
                {"tenant": tenant_id},
            ).fetchall()
            if not contact_rows:
                return {"status": "ok", "started": 0, "threshold_days": threshold_days}

            started = 0
            for (cid_text,) in contact_rows:
                ls_ts = last_seen_map.get(cid_text)
                should_start = False
                if not ls_ts:
                    should_start = True
                else:
                    row = conn.execute(
                        _sql_text(
                            "SELECT (CAST(:ls AS timestamptz) < now() - (:days || ' days')::interval)"
                        ),
                        {"ls": ls_ts, "days": str(int(max(0, threshold_days)))},
                    ).scalar()
                    should_start = bool(row)
                if should_start:
                    conn.execute(
                        _sql_text(
                            """
                            INSERT INTO cadence_states (tenant_id, contact_id, cadence_id, step_index, next_action_epoch, created_at)
                            VALUES (:tenant_txt, :cid_txt, 'retargeting_no_answer', 0, extract(epoch from now())::int, now())
                            """
                        ),
                        {"tenant_txt": tenant_id, "cid_txt": cid_text},
                    )
                    started += 1
            return {"status": "ok", "started": started, "threshold_days": threshold_days}
    except Exception as e:
        try:
            db.rollback()
        except Exception:
            pass
        return {"status": "error", "detail": str(e)}


def tool_segment_dormant_preview(
    db: Session,
    ctx: UserContext,
    tenant_id: str,
    threshold_days: int = 60,
) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    try:
        with engine.begin() as conn:
            conn.execute(_sql_text("SET LOCAL app.role = 'owner_admin'"))
            conn.execute(_sql_text("SET LOCAL app.tenant_id = :t"), {"t": tenant_id})
            # Compute last_seen per contact (appointments.start_ts is epoch seconds)
            last_seen_rows = conn.execute(
                _sql_text(
                    """
                    SELECT contact_id::text AS cid, MAX(start_ts) AS last_ts
                    FROM appointments
                    WHERE tenant_id = CAST(:tenant AS uuid)
                    GROUP BY contact_id
                    """
                ),
                {"tenant": tenant_id},
            ).fetchall()
            last_seen = {}
            for r in last_seen_rows:
                cid = str(r[0])
                val = r[1]
                ts = 0
                try:
                    # Handle integer epoch or datetime
                    if val is None:
                        ts = 0
                    elif isinstance(val, (int, float)):
                        ts = int(val)
                    else:
                        # datetime-like
                        ts = int(getattr(val, 'timestamp')() if hasattr(val, 'timestamp') else int(val))
                except Exception:
                    ts = 0
                last_seen[cid] = ts
            cutoff = int(time.time()) - int(threshold_days) * 86400
            # Fetch contacts and count dormant
            rows = conn.execute(
                _sql_text(
                    "SELECT contact_id::text FROM contacts WHERE tenant_id = CAST(:tenant AS uuid)"
                ),
                {"tenant": tenant_id},
            ).fetchall()
            count = 0
            for (cid,) in rows:
                ls = last_seen.get(cid, 0)
                if ls == 0 or ls < cutoff:
                    count += 1
            return {"status": "ok", "count": count, "threshold_days": threshold_days}
    except Exception as e:
        return {"status": "error", "detail": str(e)}

def tool_appointments_schedule_reminders(
    db: Session,
    ctx: UserContext,
    tenant_id: str,
) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    # Ensure no pending aborted transaction
    try:
        db.rollback()
    except Exception:
        pass
    try:
        # Use Supabase-native schema: lead_status next_action_at is timestamptz
        # For upcoming booked appointments, set next_action_at triggers
        with engine.begin() as conn:
            conn.execute(_sql_text("SET LOCAL app.role = 'owner_admin'"))
            conn.execute(_sql_text("SET LOCAL app.tenant_id = :t"), {"t": tenant_id})
            appts = conn.execute(
                _sql_text(
                    """
                    SELECT contact_id::text AS cid, start_ts
                    FROM appointments
                    WHERE tenant_id = CAST(:tenant AS uuid) AND status = 'booked'
                    LIMIT 200
                    """
                ),
                {"tenant": tenant_id},
            ).fetchall()
            if not appts:
                return {"status": "ok", "scheduled": 0}
            scheduled = 0
            for cid_text, start_ts in appts:
                for delta in (7, 3, 1, 0):
                    row = conn.execute(
                        _sql_text(
                            """
                            WITH triggers AS (
                              SELECT (CAST(:start AS timestamptz) - (:d || ' days')::interval) AS t
                            )
                            UPDATE lead_status ls
                            SET next_action_at = COALESCE(ls.next_action_at, (SELECT t FROM triggers))
                            WHERE ls.tenant_id = CAST(:tenant AS uuid) AND ls.contact_id = CAST(:cid AS uuid)
                            RETURNING 1
                            """
                        ),
                        {"start": str(start_ts), "d": str(delta), "tenant": tenant_id, "cid": cid_text},
                    ).rowcount
                    if row == 0:
                        ins = conn.execute(
                            _sql_text(
                                """
                                INSERT INTO lead_status (id, tenant_id, contact_id, bucket, tag, next_action_at)
                                VALUES (gen_random_uuid(), CAST(:tenant AS uuid), CAST(:cid AS uuid), 4, 'reminder', CAST(:start AS timestamptz) - (:d || ' days')::interval)
                                ON CONFLICT DO NOTHING
                                """
                            ),
                            {"tenant": tenant_id, "cid": cid_text, "start": str(start_ts), "d": str(delta)},
                        )
                        scheduled += ins.rowcount or 0
                    else:
                        scheduled += row or 0
            return {"status": "ok", "scheduled": scheduled}
    except Exception as e:
        try:
            db.rollback()
        except Exception:
            pass
        return {"status": "error", "detail": str(e)}


def tool_inventory_alerts_get(
    db: Session,
    ctx: UserContext,
    tenant_id: str,
    low_stock_threshold: int = 5,
) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    # Placeholder until inventory is persisted; return empty list with threshold
    return {"status": "ok", "items": [], "threshold": int(low_stock_threshold)}


def tool_export_contacts(
    db: Session,
    ctx: UserContext,
    tenant_id: str,
) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    rows = (
        db.query(dbm.Contact)
        .filter(dbm.Contact.tenant_id == tenant_id, dbm.Contact.deleted == False)  # type: ignore
        .order_by(dbm.Contact.id.asc())
        .all()
    )
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["contact_id", "email_hash", "phone_hash", "consent_sms", "consent_email"])
    for r in rows:
        writer.writerow([r.contact_id, r.email_hash or "", r.phone_hash or "", bool(r.consent_sms), bool(r.consent_email)])
    return {"status": "ok", "csv": buffer.getvalue()}


# Extend registry with new tools
REGISTRY.update(
    {
        "contacts.dedupe": tool_contacts_dedupe,
        "contacts.dedupe.preview": lambda db, ctx, tenant_id, **kw: tool_contacts_dedupe_preview(db, ctx, tenant_id),
        "campaigns.dormant.start": tool_campaigns_dormant_start,
        "appointments.schedule_reminders": tool_appointments_schedule_reminders,
        "inventory.alerts.get": tool_inventory_alerts_get,
        "export.contacts": tool_export_contacts,
        "campaigns.dormant.preview": tool_segment_dormant_preview,
        # Link and OAuth pseudo-tools (frontend or endpoint triggers)
        "link.hubspot.signup": lambda *a, **k: {"status": "ok", "url": "https://app.hubspot.com/signup"},
        "oauth.hubspot.connect": lambda *a, **k: {"status": "ok", "url": "/oauth/hubspot/login"},
        "crm.hubspot.import": lambda *a, **k: {"status": "ok", "endpoint": "/crm/hubspot/import"},
        # New quick exec tools
        "connectors.cleanup": tool_connectors_cleanup,
        "connectors.normalize": tool_connectors_normalize,
        "calendar.sync": tool_calendar_sync,
        "calendar.merge": tool_calendar_merge,
        "calendar.reschedule": tool_calendar_reschedule,
        "calendar.cancel": tool_calendar_cancel,
        "calendar.push.google": tool_calendar_push_google,
        "oauth.refresh": tool_oauth_refresh,
        "square.backfill": tool_square_backfill,
        "integrations.twilio.provision": tool_twilio_provision,
        # Vision + Edit + Social
        "vision.inspect": tool_vision_inspect,
        "image.edit": tool_image_edit,
        "brand.vision.analyze": tool_brand_vision_analyze,
        "vision.analyze.gpt5": tool_vision_analyze_gpt5,
        "memories.remember": tool_memories_upsert,
        "social.fetch_profile": tool_social_fetch_profile,
        "social.scrape_posts": tool_social_scrape_posts,
        # db.query.* registered below after definitions
        # registered after definition below
    }
)


# Social automation: draft a 14‑day schedule (placeholder planning tool)
def tool_social_schedule_14days(
    db: Session,
    ctx: UserContext,
    tenant_id: str,
) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    import datetime as _dt
    today = _dt.datetime.utcnow().date()
    entries = []
    for i in range(14):
        d = today + _dt.timedelta(days=i)
        entries.append({"date": d.isoformat(), "channels": ["instagram","facebook"], "status": "planned"})
    return {"status": "ok", "days": entries}


# Register after definition to avoid NameError on import
REGISTRY["social.schedule.14days"] = tool_social_schedule_14days

# Extend dispatcher
async def _dispatch_extended(name: str, params: Dict[str, Any], db: Session, ctx: UserContext) -> Optional[Dict[str, Any]]:
    if name == "todo.enqueue":
        return await tool_todo_enqueue(
            db,
            ctx,
            tenant_id=str(params.get("tenant_id", ctx.tenant_id)),
            type=str(params.get("type", "generic")),
            message=params.get("message"),
            severity=params.get("severity"),
            payload=(params.get("payload") if isinstance(params.get("payload"), dict) else None),
            idempotency_key=params.get("idempotency_key"),
        )
    if name == "contacts.dedupe":
        return tool_contacts_dedupe(db, ctx, tenant_id=str(params.get("tenant_id", ctx.tenant_id)))
    if name == "campaigns.dormant.start":
        return tool_campaigns_dormant_start(
            db,
            ctx,
            tenant_id=str(params.get("tenant_id", ctx.tenant_id)),
            threshold_days=int(params.get("threshold_days", 60)),
        )
    if name == "appointments.schedule_reminders":
        return tool_appointments_schedule_reminders(db, ctx, tenant_id=str(params.get("tenant_id", ctx.tenant_id)))
    if name == "inventory.alerts.get":
        return tool_inventory_alerts_get(
            db,
            ctx,
            tenant_id=str(params.get("tenant_id", ctx.tenant_id)),
            low_stock_threshold=int(params.get("low_stock_threshold", 5)),
        )
    if name == "export.contacts":
        return tool_export_contacts(db, ctx, tenant_id=str(params.get("tenant_id", ctx.tenant_id)))
    if name == "social.schedule.14days":
        return tool_social_schedule_14days(db, ctx, tenant_id=str(params.get("tenant_id", ctx.tenant_id)))
    if name == "campaigns.dormant.preview":
        return tool_segment_dormant_preview(
            db,
            ctx,
            tenant_id=str(params.get("tenant_id", ctx.tenant_id)),
            threshold_days=int(params.get("threshold_days", 60)),
        )
    if name == "contacts.dedupe.preview":
        return tool_contacts_dedupe_preview(db, ctx, tenant_id=str(params.get("tenant_id", ctx.tenant_id)))
    if name == "connectors.cleanup":
        return await tool_connectors_cleanup(db, ctx, tenant_id=str(params.get("tenant_id", ctx.tenant_id)))
    if name == "connectors.normalize":
        return await tool_connectors_normalize(db, ctx, tenant_id=str(params.get("tenant_id", ctx.tenant_id)))
    if name == "calendar.sync":
        return await tool_calendar_sync(db, ctx, tenant_id=str(params.get("tenant_id", ctx.tenant_id)), provider=params.get("provider"))
    if name == "calendar.merge":
        return await tool_calendar_merge(db, ctx, tenant_id=str(params.get("tenant_id", ctx.tenant_id)))
    if name == "calendar.reschedule":
        return await tool_calendar_reschedule(
            db, ctx,
            tenant_id=str(params.get("tenant_id", ctx.tenant_id)),
            external_ref=params.get("external_ref"),
            provider=params.get("provider"),
            provider_event_id=params.get("provider_event_id"),
            start_ts=int(params.get("start_ts", 0)),
            end_ts=(int(params.get("end_ts", 0)) if params.get("end_ts") is not None else None),
        )
    if name == "calendar.cancel":
        return await tool_calendar_cancel(
            db, ctx,
            tenant_id=str(params.get("tenant_id", ctx.tenant_id)),
            external_ref=params.get("external_ref"),
            provider=params.get("provider"),
            provider_event_id=params.get("provider_event_id"),
        )
    if name == "calendar.push.google":
        return await tool_calendar_push_google(db, ctx, tenant_id=str(params.get("tenant_id", ctx.tenant_id)))
    if name == "oauth.refresh":
        return await tool_oauth_refresh(db, ctx, tenant_id=str(params.get("tenant_id", ctx.tenant_id)), provider=str(params.get("provider", "")))
    if name == "contacts.import.square":
        return await tool_contacts_import_square(db, ctx, tenant_id=str(params.get("tenant_id", ctx.tenant_id)))
    if name == "square.backfill":
        return await tool_square_backfill(db, ctx, tenant_id=str(params.get("tenant_id", ctx.tenant_id)))
    if name == "integrations.twilio.provision":
        return await tool_twilio_provision(db, ctx, tenant_id=str(params.get("tenant_id", ctx.tenant_id)), area_code=str(params.get("area_code", "")))
    if name == "vision.inspect":
        return await tool_vision_inspect(
            db,
            ctx,
            tenant_id=str(params.get("tenant_id", ctx.tenant_id)),
            image_url=params.get("imageUrl"),
            inputImageBase64=params.get("inputImageBase64"),
            inputMime=params.get("inputMime"),
            ret=params.get("return"),
        )
    if name == "image.edit":
        return await tool_image_edit(
            db,
            ctx,
            tenant_id=str(params.get("tenant_id", ctx.tenant_id)),
            mode=str(params.get("mode", "edit")),
            prompt=str(params.get("prompt", "")),
            inputImageBase64=(str(params.get("inputImageBase64")) if params.get("inputImageBase64") else None),
            outputFormat=params.get("outputFormat"),
            imageUrl=(str(params.get("imageUrl")) if params.get("imageUrl") else None),
            inputMime=params.get("inputMime"),
            preserveDims=(bool(params.get("preserveDims")) if params.get("preserveDims") is not None else None),
        )
    if name == "brand.vision.analyze":
        return await tool_brand_vision_analyze(
            db,
            ctx,
            tenant_id=str(params.get("tenant_id", ctx.tenant_id)),
            sample=int(params.get("sample", 12)),
        )
    if name == "vision.analyze.gpt5":
        return await tool_vision_analyze_gpt5(
            db,
            ctx,
            tenant_id=str(params.get("tenant_id", ctx.tenant_id)),
            inputImageBase64=(str(params.get("inputImageBase64")) if params.get("inputImageBase64") else None),
            imageUrl=(str(params.get("imageUrl")) if params.get("imageUrl") else None),
            inputMime=params.get("inputMime"),
            question=str(params.get("question", "")) or None,
        )
    if name == "social.fetch_profile":
        return await tool_social_fetch_profile(
            db,
            ctx,
            tenant_id=str(params.get("tenant_id", ctx.tenant_id)),
            url=str(params.get("url", "")),
        )
    if name == "social.scrape_posts":
        return await tool_social_scrape_posts(
            db,
            ctx,
            tenant_id=str(params.get("tenant_id", ctx.tenant_id)),
            url=str(params.get("url", "")),
            limit=int(params.get("limit", 12)),
        )
    if name == "memories.remember":
        return tool_memories_upsert(
            db,
            ctx,
            tenant_id=str(params.get("tenant_id", ctx.tenant_id)),
            key=str(params.get("key", "")),
            value=str(params.get("value", "")),
            tags=(str(params.get("tags")) if params.get("tags") is not None else None),
        )
    if name == "db.query.sql":
        out = await tool_db_query_sql(
            db,
            ctx,
            tenant_id=str(params.get("tenant_id", ctx.tenant_id)),
            sql=str(params.get("sql", "")),
            limit=int(params.get("limit", 100)),
        )
        try:
            DB_QUERY_TOOL_USED.labels(tenant_id=str(ctx.tenant_id), name="sql").inc()  # type: ignore
        except Exception:
            pass
        return out
    if name == "db.query.named":
        out = await tool_db_query_named(
            db,
            ctx,
            tenant_id=str(params.get("tenant_id", ctx.tenant_id)),
            name=str(params.get("name", "")),
            params=params.get("params") if isinstance(params.get("params"), dict) else None,
        )
        try:
            DB_QUERY_TOOL_USED.labels(tenant_id=str(ctx.tenant_id), name=str(params.get("name",""))).inc()  # type: ignore
        except Exception:
            pass
        return out
    return None


# ---------------------- CRM helpers ----------------------

# ---------------------- Unified To-Do enqueue ----------------------
async def tool_todo_enqueue(
    db: Session,
    ctx: UserContext,
    tenant_id: str,
    type: str,
    message: Optional[str] = None,
    severity: Optional[str] = None,
    payload: Optional[Dict[str, Any]] = None,
    idempotency_key: Optional[str] = None,
) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    # Idempotency guard at DB level (unique on idempotency_keys.key)
    if idempotency_key:
        try:
            with engine.begin() as conn:
                conn.execute(
                    _sql_text(
                        """
                        INSERT INTO idempotency_keys (tenant_id, key, created_at)
                        VALUES (CAST(:t AS uuid), :k, extract(epoch from now())::int)
                        ON CONFLICT (key) DO NOTHING
                        """
                    ),
                    {"t": tenant_id, "k": idempotency_key},
                )
                # If not inserted, assume duplicate and no-op
                dup = conn.execute(
                    _sql_text("SELECT 1 FROM idempotency_keys WHERE key = :k"), {"k": idempotency_key}
                ).fetchone()
                if dup is None:
                    return {"status": "duplicate"}
        except Exception:
            # proceed without idempotency if insert fails
            pass
    params_obj: Dict[str, Any] = {
        "message": message or "",
        "severity": severity or "info",
        "payload": payload or {},
        "tenant_id": tenant_id,
        "type": type,
    }
    try:
        with engine.begin() as conn:
            conn.execute(
                _sql_text(
                    """
                    INSERT INTO approvals (tenant_id, tool_name, params_json, status, created_at)
                    VALUES (CAST(:t AS uuid), :tool, :p, 'pending', extract(epoch from now())::int)
                    """
                ),
                {"t": tenant_id, "tool": f"todo.{type}", "p": _json.dumps(params_obj)},
            )
    except Exception as e:
        return {"status": "error", "detail": str(e)[:160]}
    return {"status": "ok"}
def tool_contacts_list_top_ltv(
    db: Session,
    ctx: UserContext,
    tenant_id: str,
    limit: int = 10,
) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    rows = (
        db.query(dbm.Contact)
        .filter(dbm.Contact.tenant_id == tenant_id, dbm.Contact.deleted == False)  # type: ignore
        .order_by(dbm.Contact.lifetime_cents.desc())
        .limit(max(1, min(int(limit or 10), 200)))
        .all()
    )
    def _friendly_name_py(r: dbm.Contact) -> str:  # type: ignore
        try:
            first = (getattr(r, "first_name", None) or "").strip()
            last = (getattr(r, "last_name", None) or "").strip()
            disp = (getattr(r, "display_name", None) or "").strip()
            email = (getattr(r, "email_hash", None) or "").strip()
            phone = (getattr(r, "phone_hash", None) or "").strip()
            name = f"{first} {last}".strip()
            if name:
                return name
            # Avoid Square-ID style fallback like "Client ABC123"
            if disp and not __import__("re").match(r"^Client [0-9A-Za-z]+$", disp):
                return disp
            if email and "@" in email:
                return email.split("@", 1)[0]
            if phone:
                import re as _re
                digits = _re.sub(r"\D", "", phone)
                tail4 = digits[-4:] if digits else ""
                return f"Client • {tail4}" if tail4 else "Client"
            return "Client"
        except Exception:
            return "Client"
    out = []
    for r in rows:
        out.append({
            "contact_id": r.contact_id,
            "friendly_name": _friendly_name_py(r),
            "txn_count": int(getattr(r, "txn_count", 0) or 0),
            "lifetime_cents": int(getattr(r, "lifetime_cents", 0) or 0),
            "last_visit": int(getattr(r, "last_visit", 0) or 0),
        })
    return {"status": "ok", "items": out}


async def tool_contacts_import_square(
    db: Session,
    ctx: UserContext,
    tenant_id: str,
) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    base_api = os.getenv("BACKEND_BASE_URL", "http://localhost:8000").rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(f"{base_api}/integrations/booking/square/sync-contacts", json={"tenant_id": tenant_id})
            try:
                body = r.json()
            except Exception:
                body = {"status": r.status_code, "detail": (r.text or "")[:200]}
            return body if isinstance(body, dict) else {"status": "ok", **body}
    except httpx.HTTPError as e:
        return {"status": "error", "detail": str(e)}


# ---------------------- DB query tools (read-only) ----------------------

ALLOWED_TABLES = {
    "contacts",
    "appointments",
    "lead_status",
    "events_ledger",
}

def _is_safe_select(sql: str) -> bool:
    s = sql.strip().lower()
    if not s.startswith("select "):
        return False
    forbidden = [";", "--", "/*", " insert ", " update ", " delete ", " drop ", " alter ", " truncate "]
    if any(tok in s for tok in forbidden):
        return False
    tables = set(_re.findall(r"\bfrom\s+([a-zA-Z_][a-zA-Z0-9_\.]*)|\bjoin\s+([a-zA-Z_][a-zA-Z0-9_\.]*)", s))
    flat = {t for pair in tables for t in pair if t}
    flat = {t.split(".")[-1] for t in flat}
    return all(t in ALLOWED_TABLES for t in flat if t)


async def tool_db_query_sql(
    db: Session,
    ctx: UserContext,
    tenant_id: str,
    sql: str,
    limit: int = 100,
) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    try:
        ok, ttl = check_and_increment(str(ctx.tenant_id), "db.query.sql", max_per_minute=60, burst=30)
        if not ok:
            return {"status": "rate_limited", "retry_s": int(ttl)}
    except Exception:
        pass
    sql = sql.strip()
    if not _is_safe_select(sql):
        return {"status": "rejected", "reason": "unsafe_sql"}
    hard_limit = max(1, min(int(limit or 100), 500))
    try:
        with engine.begin() as conn:
            conn.execute(_sql_text("SET LOCAL app.role = 'owner_admin'"))
            conn.execute(_sql_text("SET LOCAL app.tenant_id = :t"), {"t": tenant_id})
            q = sql
            if " limit " not in sql.lower():
                q = f"{sql} LIMIT {hard_limit}"
            rows = conn.execute(_sql_text(q)).fetchall()
            cols = [c for c in rows[0].keys()] if rows else []
            data = [dict(r._mapping) for r in rows]
            return {"status": "ok", "columns": cols, "rows": data}
    except Exception as e:
        return {"status": "error", "detail": str(e)[:200]}


async def tool_db_query_named(
    db: Session,
    ctx: UserContext,
    tenant_id: str,
    name: str,
    params: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    try:
        ok, ttl = check_and_increment(str(ctx.tenant_id), "db.query.named", max_per_minute=120, burst=60)
        if not ok:
            return {"status": "rate_limited", "retry_s": int(ttl)}
    except Exception:
        pass
    n = (name or "").strip().lower()
    p = params or {}
    try:
        with engine.begin() as conn:
            conn.execute(_sql_text("SET LOCAL app.role = 'owner_admin'"))
            conn.execute(_sql_text("SET LOCAL app.tenant_id = :t"), {"t": tenant_id})
            if n == "contacts.top_ltv":
                q = _sql_text(
                    """
                    SELECT
                      contact_id,
                      lifetime_cents,
                      last_visit,
                      txn_count,
                      CASE
                        WHEN btrim(concat_ws(' ', coalesce(first_name,''), coalesce(last_name,''))) <> '' THEN btrim(concat_ws(' ', coalesce(first_name,''), coalesce(last_name,'')))
                        WHEN display_name IS NOT NULL AND display_name !~ '^Client [0-9A-Za-z]+' THEN display_name
                        WHEN email_hash IS NOT NULL AND position('@' in email_hash) > 0 THEN split_part(email_hash,'@',1)
                        WHEN phone_hash IS NOT NULL THEN 'Client • ' || right(regexp_replace(phone_hash, '\\D', '', 'g'), 4)
                        ELSE coalesce(display_name, 'Client')
                      END AS friendly_name
                    FROM contacts
                    WHERE tenant_id = CAST(:t AS uuid) AND (deleted IS NULL OR deleted = false)
                    ORDER BY lifetime_cents DESC
                    LIMIT :lim
                    """
                )
                lim = max(1, min(int(p.get("limit", 10)), 200))
                rows = conn.execute(q, {"t": tenant_id, "lim": lim}).fetchall()
                return {"status": "ok", "rows": [dict(r._mapping) for r in rows]}
            if n == "cohort.dormant":
                days = int(p.get("threshold_days", p.get("days", 60)) or 60)
                q = _sql_text(
                    """
                    SELECT contact_id, lifetime_cents, last_visit
                    FROM contacts
                    WHERE tenant_id = CAST(:t AS uuid)
                      AND (last_visit IS NULL OR last_visit < (EXTRACT(epoch FROM now())::bigint - :sec))
                    ORDER BY lifetime_cents DESC
                    LIMIT :lim
                    """
                )
                lim = max(1, min(int(p.get("limit", 25)), 200))
                rows = conn.execute(q, {"t": tenant_id, "sec": int(days)*86400, "lim": lim}).fetchall()
                return {"status": "ok", "rows": [dict(r._mapping) for r in rows]}
            if n == "metric.rebook_rate_30d":
                q = _sql_text(
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
                    SELECT (SELECT COUNT(*) FROM base) AS total, (SELECT COUNT(*) FROM rebook) AS rebooked,
                           ROUND((CASE WHEN (SELECT COUNT(*) FROM base) = 0 THEN 0 ELSE ((SELECT COUNT(*) FROM rebook)::numeric / NULLIF((SELECT COUNT(*) FROM base),0)) * 100 END), 1) AS pct
                    """
                )
                row = conn.execute(q, {"t": tenant_id}).fetchone()
                out = {"total": 0, "rebooked": 0, "pct": 0.0}
                if row:
                    out = {"total": int(row[0] or 0), "rebooked": int(row[1] or 0), "pct": float(row[2] or 0.0)}
                return {"status": "ok", "rows": [out]}
            if n == "cohort.dormant_90d":
                q = _sql_text(
                    """
                    SELECT contact_id, lifetime_cents, last_visit
                    FROM contacts
                    WHERE tenant_id = CAST(:t AS uuid)
                      AND (last_visit IS NULL OR last_visit < (EXTRACT(epoch FROM now())::bigint - 90*86400))
                    ORDER BY lifetime_cents DESC
                    LIMIT :lim
                    """
                )
                lim = max(1, min(int(p.get("limit", 25)), 100))
                rows = conn.execute(q, {"t": tenant_id, "lim": lim}).fetchall()
                return {"status": "ok", "rows": [dict(r._mapping) for r in rows]}
            if n == "metric.weekly_revenue_last_week":
                # Pull from Square payments API if connected
                token: str = ""
                try:
                    row_v2 = conn.execute(
                        _sql_text(
                            "SELECT access_token_enc FROM connected_accounts_v2 WHERE tenant_id = CAST(:t AS uuid) AND provider='square' ORDER BY id DESC LIMIT 1"
                        ),
                        {"t": tenant_id},
                    ).fetchone()
                    if row_v2 and row_v2[0]:
                        try:
                            token = decrypt_text(str(row_v2[0])) or ""
                        except Exception:
                            token = str(row_v2[0])
                except Exception:
                    token = ""
                if not token:
                    return {"status": "ok", "rows": [{"cents": 0}]}  # no connection
                import datetime as _dt
                today = _dt.datetime.utcnow().date()
                weekday = today.isoweekday()
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
                            for pay in payments:
                                try:
                                    status = str(pay.get("status") or "").upper()
                                    if status not in {"COMPLETED", "APPROVED", "CAPTURED"}:
                                        continue
                                    amt = int(((pay.get("amount_money") or {}).get("amount") or 0))
                                    tax = int(((pay.get("tax_money") or {}).get("amount") or 0))
                                    refunded = int(((pay.get("refunded_money") or {}).get("amount") or 0))
                                    net = max(0, amt - tax - refunded)
                                    total_cents += net
                                except Exception:
                                    continue
                            cursor = body.get("cursor") or body.get("next_cursor")
                            if not cursor:
                                break
                except Exception:
                    total_cents = 0
                return {"status": "ok", "rows": [{"cents": int(total_cents)}]}
            if n == "metric.rebook_rate_category_fri_after_4pm_90d":
                # Rebook definition: next completed appointment within 30 days of index appointment
                q = _sql_text(
                    """
                    WITH base AS (
                      SELECT id, COALESCE(lower(service),'unknown') AS category, contact_id, start_ts
                      FROM appointments
                      WHERE tenant_id = CAST(:t AS uuid)
                        AND status = 'completed'
                        AND start_ts >= (EXTRACT(epoch FROM now())::bigint - 90*86400)
                        AND EXTRACT(DOW FROM to_timestamp(start_ts)) = 5
                        AND to_timestamp(start_ts)::time >= time '16:00'
                    ),
                    rebooked AS (
                      SELECT a1.id AS id
                      FROM appointments a1
                      WHERE a1.tenant_id = CAST(:t AS uuid)
                        AND a1.status = 'completed'
                        AND a1.start_ts >= (EXTRACT(epoch FROM now())::bigint - 90*86400)
                        AND EXTRACT(DOW FROM to_timestamp(a1.start_ts)) = 5
                        AND to_timestamp(a1.start_ts)::time >= time '16:00'
                        AND EXISTS (
                          SELECT 1 FROM appointments a2
                          WHERE a2.tenant_id = a1.tenant_id
                            AND a2.contact_id = a1.contact_id
                            AND a2.status = 'completed'
                            AND a2.start_ts > a1.start_ts
                            AND a2.start_ts <= a1.start_ts + 30*86400
                        )
                    )
                    SELECT b.category,
                           COUNT(*) AS total,
                           COUNT(*) FILTER (WHERE b.id IN (SELECT id FROM rebooked)) AS rebooked,
                           ROUND((COUNT(*) FILTER (WHERE b.id IN (SELECT id FROM rebooked))::numeric / NULLIF(COUNT(*),0)) * 100, 1) AS pct
                    FROM base b
                    GROUP BY b.category
                    ORDER BY pct DESC, total DESC
                    LIMIT :lim
                    """
                )
                lim = max(1, min(int(p.get("limit", 50)), 200))
                rows = conn.execute(q, {"t": tenant_id, "lim": lim}).fetchall()
                return {"status": "ok", "rows": [dict(r._mapping) for r in rows]}
            if n == "cohort.fragrance_sensitive_cancels_2x_24h_1y":
                # Heuristic: use appointments marked canceled where created_at is within 24h prior to start_ts
                q = _sql_text(
                    """
                    WITH canc AS (
                      SELECT contact_id
                      FROM appointments
                      WHERE tenant_id = CAST(:t AS uuid)
                        AND status ILIKE 'cancel%'
                        AND start_ts >= (EXTRACT(epoch FROM now())::bigint - 365*86400)
                        AND (start_ts - COALESCE(created_at, start_ts)) <= 86400
                    ),
                    cnt AS (
                      SELECT contact_id, COUNT(*) AS cancels_24h
                      FROM canc
                      GROUP BY contact_id
                    )
                    SELECT ct.contact_id, ct.lifetime_cents, ct.last_visit
                    FROM cnt
                    JOIN contacts ct ON ct.tenant_id = CAST(:t AS uuid) AND ct.contact_id = cnt.contact_id
                    WHERE cnt.cancels_24h >= 2
                      AND EXISTS (
                        SELECT 1 FROM lead_status ls
                        WHERE ls.tenant_id = CAST(:t AS uuid)
                          AND ls.contact_id = ct.contact_id
                          AND ls.tag ILIKE '%fragrance%'
                      )
                    ORDER BY ct.lifetime_cents DESC
                    LIMIT :lim
                    """
                )
                lim = max(1, min(int(p.get("limit", 100)), 200))
                rows = conn.execute(q, {"t": tenant_id, "lim": lim}).fetchall()
                return {"status": "ok", "rows": [dict(r._mapping) for r in rows]}
            if n == "cohort.ig_first_timers_500_in_60d":
                # Approximation: creation_source/tag indicates Instagram; lifetime >= $500; last_visit within 60d of first_visit
                q = _sql_text(
                    """
                    SELECT c.contact_id, c.lifetime_cents, c.first_visit, c.last_visit
                    FROM contacts c
                    WHERE c.tenant_id = CAST(:t AS uuid)
                      AND c.lifetime_cents >= 50000
                      AND (
                        lower(COALESCE(c.creation_source,'')) LIKE '%insta%'
                        OR EXISTS (
                          SELECT 1 FROM lead_status ls
                          WHERE ls.tenant_id = c.tenant_id AND ls.contact_id = c.contact_id AND ls.tag ILIKE '%insta%'
                        )
                      )
                      AND c.first_visit IS NOT NULL AND c.last_visit IS NOT NULL
                      AND c.last_visit <= c.first_visit + 60*86400
                    ORDER BY c.lifetime_cents DESC
                    LIMIT :lim
                    """
                )
                lim = max(1, min(int(p.get("limit", 100)), 200))
                rows = conn.execute(q, {"t": tenant_id, "lim": lim}).fetchall()
                return {"status": "ok", "rows": [dict(r._mapping) for r in rows]}
            if n == "cohort.gloss_after_balayage_no_rebook_12w":
                q = _sql_text(
                    """
                    WITH balay AS (
                      SELECT contact_id, start_ts AS balay_ts
                      FROM appointments
                      WHERE tenant_id = CAST(:t AS uuid)
                        AND status = 'completed'
                        AND lower(COALESCE(service,'')) LIKE '%balay%'
                    ),
                    gloss AS (
                      SELECT contact_id, start_ts AS gloss_ts
                      FROM appointments
                      WHERE tenant_id = CAST(:t AS uuid)
                        AND status = 'completed'
                        AND lower(COALESCE(service,'')) LIKE '%gloss%'
                    ),
                    pairs AS (
                      SELECT b.contact_id, b.balay_ts, g.gloss_ts
                      FROM balay b
                      JOIN gloss g ON g.contact_id = b.contact_id
                      WHERE g.gloss_ts >= b.balay_ts AND g.gloss_ts <= b.balay_ts + 42*86400
                    ),
                    no_rebook12 AS (
                      SELECT p.contact_id, p.gloss_ts
                      FROM pairs p
                      WHERE NOT EXISTS (
                        SELECT 1 FROM appointments a3
                        WHERE a3.tenant_id = CAST(:t AS uuid)
                          AND a3.contact_id = p.contact_id
                          AND a3.status = 'completed'
                          AND a3.start_ts > p.gloss_ts
                          AND a3.start_ts <= p.gloss_ts + 84*86400
                      )
                    )
                    SELECT c.contact_id, c.lifetime_cents, c.last_visit
                    FROM no_rebook12 nr
                    JOIN contacts c ON c.tenant_id = CAST(:t AS uuid) AND c.contact_id = nr.contact_id
                    ORDER BY c.lifetime_cents DESC
                    LIMIT :lim
                    """
                )
                lim = max(1, min(int(p.get("top", p.get("limit", 10))), 100))
                rows = conn.execute(q, {"t": tenant_id, "lim": lim}).fetchall()
                return {"status": "ok", "rows": [dict(r._mapping) for r in rows]}
            return {"status": "not_implemented", "name": n}
    except Exception as e:
        return {"status": "error", "detail": str(e)[:200]}


# ---------------------- Report generation (CSV) ----------------------

def _rows_to_csv(rows: list[dict], header_order: Optional[list[str]] = None) -> str:
    buffer = io.StringIO()
    if not rows:
        return ""
    cols = header_order or list(rows[0].keys())
    writer = csv.DictWriter(buffer, fieldnames=cols)
    writer.writeheader()
    for r in rows:
        writer.writerow({k: r.get(k) for k in cols})
    return buffer.getvalue()


async def tool_report_generate_csv(
    db: Session,
    ctx: UserContext,
    tenant_id: str,
    source: str,
    params: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    _require_tenant(ctx, tenant_id)
    # For now, support named-query backed CSV
    if source == "db.query.named":
        name = str((params or {}).get("name", ""))
        qparams = (params or {}).get("params") if isinstance((params or {}).get("params"), dict) else {}
        result = await tool_db_query_named(db, ctx, tenant_id, name=name, params=qparams)
        if result.get("status") != "ok":
            return result
        rows = result.get("rows") or []
        if not isinstance(rows, list):
            return {"status": "error", "detail": "rows_not_list"}
        csv_text = _rows_to_csv(rows)
        # Persist a signed download token
        token = _secrets.token_urlsafe(16)
        filename = f"report_{name.replace('.', '_')}.csv"
        try:
            with engine.begin() as conn:
                conn.execute(
                    _sql_text(
                        """
                        CREATE TABLE IF NOT EXISTS share_reports (
                          id BIGSERIAL PRIMARY KEY,
                          tenant_id UUID NOT NULL,
                          token TEXT NOT NULL,
                          mime TEXT NOT NULL,
                          filename TEXT NOT NULL,
                          data_text TEXT NOT NULL,
                          created_at TIMESTAMPTZ DEFAULT NOW()
                        );
                        """
                    )
                )
                conn.execute(
                    _sql_text(
                        "INSERT INTO share_reports (tenant_id, token, mime, filename, data_text) VALUES (CAST(:t AS uuid), :tok, :m, :fn, :dt)"
                    ),
                    {"t": tenant_id, "tok": token, "m": "text/csv", "fn": filename, "dt": csv_text},
                )
        except Exception:
            # Fallback: return inline CSV if persistence failed
            return {"status": "ok", "mime": "text/csv", "filename": filename, "csv": csv_text}
        base_api = os.getenv("BACKEND_BASE_URL", "").rstrip("/")
        url = f"{base_api}/reports/download/{token}" if base_api else f"/reports/download/{token}"
        return {"status": "ok", "mime": "text/csv", "filename": filename, "csv": csv_text, "url": url}
    return {"status": "not_implemented"}
# Extend registry with CRM tools
REGISTRY.update(
    {
        "contacts.list.top_ltv": tool_contacts_list_top_ltv,
        "contacts.import.square": tool_contacts_import_square,  # async
        "db.query.sql": tool_db_query_sql,
        "db.query.named": tool_db_query_named,
        "report.generate.csv": tool_report_generate_csv,
        # PII audit tool (lightweight)
        "pii.audit": tool_safety_check,
    }
)


# ---------------------- Tool Registry Metadata & Schema ----------------------

TOOL_META: Dict[str, Dict[str, object]] = {
    "draft_message": {"label": "Draft outreach message", "category": "Messaging", "summary": "Draft a first outreach message aligned to brand tone."},
    "messages.send": {"label": "Send message", "category": "Messaging", "summary": "Send SMS or email via connected providers.", "requires_approval": True},
    "appointments.schedule_reminders": {"label": "Schedule appointment reminders", "category": "Messaging", "summary": "Queue 7d/3d/1d/0 reminders."},
    "safety_check": {"label": "Check text for safety", "category": "Compliance", "summary": "Scan text for PII/compliance issues."},
    "pii.audit": {"label": "Audit text for PII", "category": "Compliance", "summary": "Recommend safe substitutions for PII."},
    "pricing_model": {"label": "Calculate pricing & margins", "category": "Analytics", "summary": "Compute hourly rate and margin from price/cost/time."},
    "contacts.list.top_ltv": {"label": "List top clients by LTV", "category": "Analytics", "summary": "List top clients using full names."},
    "campaigns.dormant.preview": {"label": "Preview dormant clients", "category": "CRM", "summary": "Preview size of dormant cohort."},
    "campaigns.dormant.start": {"label": "Start dormant outreach", "category": "CRM", "summary": "Trigger dormant outreach cadence.", "requires_approval": True},
    "propose_next_cadence_step": {"label": "Propose next cadence step", "category": "CRM", "summary": "Suggest the next cadence action."},
    "export.contacts": {"label": "Export contacts CSV", "category": "Data", "summary": "Download contacts CSV."},
    "db.query.named": {"label": "Run saved report", "category": "Data", "summary": "Run a named read-only SQL report."},
    "db.query.sql": {"label": "Run SQL (read-only)", "category": "Data", "summary": "Execute an allow-listed read-only SQL query."},
    "report.generate.csv": {"label": "Generate CSV from report", "category": "Data", "summary": "Generate CSV export for a report."},
    "social.schedule.14days": {"label": "Plan 14-day social calendar", "category": "Social", "summary": "Draft 14-day social plan."},
    "social.fetch_profile": {"label": "Fetch social profile", "category": "Social", "summary": "Fetch public profile metadata."},
    "social.scrape_posts": {"label": "Scrape recent posts", "category": "Social", "summary": "Scrape thumbnails/links."},
    "calendar.sync": {"label": "Sync calendar", "category": "Calendar", "summary": "Sync Google/booking calendars."},
    "calendar.merge": {"label": "Merge duplicate events", "category": "Calendar", "summary": "Merge duplicate events by title/time."},
    "calendar.reschedule": {"label": "Reschedule appointment", "category": "Calendar", "summary": "Reschedule using provider identifiers."},
    "calendar.cancel": {"label": "Cancel appointment", "category": "Calendar", "summary": "Cancel a booking via provider."},
    "contacts.import.square": {"label": "Import from Square", "category": "Integrations", "summary": "Import contacts from Square."},
    "crm.hubspot.import": {"label": "Import from HubSpot", "category": "Integrations", "summary": "Import sample contacts from HubSpot."},
    "link.hubspot.signup": {"label": "Link HubSpot", "category": "Integrations", "summary": "Start HubSpot signup."},
    "oauth.hubspot.connect": {"label": "Connect HubSpot", "category": "Integrations", "summary": "Authorize HubSpot OAuth."},
    "oauth.refresh": {"label": "Refresh OAuth token", "category": "Integrations", "summary": "Refresh provider token."},
    "vision.inspect": {"label": "Analyze an image", "category": "Vision", "summary": "Analyze image lighting/color."},
    "image.edit": {"label": "Edit an image", "category": "Vision", "summary": "Apply Gemini edits to an image."},
    "brand.vision.analyze": {"label": "Analyze social brand", "category": "Vision", "summary": "Assess Instagram presence."},
    "todo.enqueue": {"label": "Create to-do", "category": "Operations", "summary": "Queue a task for review."},
    "memories.remember": {"label": "Save brand memory", "category": "Operations", "summary": "Persist brand note for AskVX."},
}

SAFE_TOOLS = {
    "db.query.named", "db.query.sql", "report.generate.csv", "contacts.list.top_ltv",
    "campaigns.dormant.preview", "pricing_model", "pii.audit", "safety_check",
    "calendar.sync", "calendar.merge", "calendar.reschedule", "calendar.cancel",
    "appointments.schedule_reminders", "social.schedule.14days", "social.fetch_profile", "social.scrape_posts",
    "contacts.import.square", "crm.hubspot.import", "link.hubspot.signup", "oauth.hubspot.connect", "oauth.refresh",
    "vision.inspect", "image.edit", "brand.vision.analyze", "todo.enqueue", "memories.remember"
}

HUMAN_TOOL_SCHEMA = [
    {
        "id": tool_id,
        "label": meta.get("label", tool_id.replace(".", " ").title()),
        "category": meta.get("category", "General"),
        "summary": meta.get("summary", ""),
        "requires_approval": bool(meta.get("requires_approval")),
    }
    for tool_id, meta in TOOL_META.items()
]

def tools_schema() -> Dict[str, object]:
    tools: List[Dict[str, object]] = []
    for tool_id, meta in TOOL_META.items():
        tools.append({
            "name": tool_id,
            "safe": tool_id in SAFE_TOOLS,
            "label": meta.get("label", tool_id.replace(".", " ").title()),
            "category": meta.get("category", "General"),
            "summary": meta.get("summary", ""),
            "requires_approval": bool(meta.get("requires_approval")),
        })
    return {"version": "v1", "tools": tools}

def tools_schema_human() -> Dict[str, object]:
    return {"version": "v1", "tools": HUMAN_TOOL_SCHEMA}
