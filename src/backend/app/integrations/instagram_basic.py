import os
from typing import Any, Dict, List, Optional
import httpx

GRAPH_BASE = "https://graph.instagram.com"


def _auth_headers() -> Dict[str, str]:
    return {"Accept": "application/json"}


def get_profile(access_token: str) -> Dict[str, Any]:
    if not access_token:
        return {"status": "error", "detail": "missing_access_token"}
    url = f"{GRAPH_BASE}/me"
    params = {"fields": "id,username,account_type,media_count", "access_token": access_token}
    try:
        r = httpx.get(url, params=params, headers=_auth_headers(), timeout=15)
        if r.status_code >= 400:
            return {"status": "error", "detail": f"http_{r.status_code}", "body": (r.text or "")[:200]}
        return {"status": "ok", "profile": r.json()}
    except httpx.HTTPError as e:
        return {"status": "error", "detail": str(e)[:160]}


def get_media(access_token: str, limit: int = 12) -> Dict[str, Any]:
    if not access_token:
        return {"status": "error", "detail": "missing_access_token"}
    url = f"{GRAPH_BASE}/me/media"
    params = {
        "fields": "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp",
        "access_token": access_token,
        "limit": str(max(1, min(int(limit or 12), 50))),
    }
    try:
        r = httpx.get(url, params=params, headers=_auth_headers(), timeout=20)
        if r.status_code >= 400:
            return {"status": "error", "detail": f"http_{r.status_code}", "body": (r.text or "")[:200]}
        data = r.json() or {}
        items: List[Dict[str, Any]] = data.get("data") or []
        out = []
        for it in items:
            url = it.get("media_url") or it.get("thumbnail_url") or ""
            if not url:
                continue
            out.append({
                "id": it.get("id"),
                "caption": it.get("caption"),
                "url": url,
                "type": it.get("media_type"),
                "permalink": it.get("permalink"),
                "timestamp": it.get("timestamp"),
            })
        return {"status": "ok", "items": out}
    except httpx.HTTPError as e:
        return {"status": "error", "detail": str(e)[:160]}

