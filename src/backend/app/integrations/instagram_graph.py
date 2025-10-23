import os
from typing import Any, Dict, Iterable, List, Optional, Tuple

import httpx


def _api_version() -> str:
    version = os.getenv("FB_GRAPH_API_VERSION", "").strip()
    if not version:
        return "v18.0"
    if not version.startswith("v"):
        version = f"v{version}"
    return version


def _api_base() -> str:
    base = "https://graph.facebook.com"
    return f"{base.rstrip('/')}/{_api_version().lstrip('/')}"


def _auth_headers() -> Dict[str, str]:
    return {"Accept": "application/json"}


def _full_url(path: str) -> str:
    path = path.lstrip("/")
    return f"{_api_base()}/{path}"


def _split_scopes(scope_value: Optional[Any]) -> List[str]:
    if not scope_value:
        return []
    if isinstance(scope_value, str):
        if "," in scope_value:
            return [s.strip() for s in scope_value.split(",") if s.strip()]
        return [s.strip() for s in scope_value.split() if s.strip()]
    if isinstance(scope_value, Iterable):
        return [str(s).strip() for s in scope_value if str(s).strip()]
    return []


def _request(method: str, path: str, *, params: Optional[Dict[str, Any]] = None, data: Optional[Dict[str, Any]] = None, timeout: int = 20) -> Tuple[bool, Dict[str, Any]]:
    url = _full_url(path)
    try:
        resp = httpx.request(method.upper(), url, params=params, data=data, headers=_auth_headers(), timeout=timeout)
    except httpx.HTTPError as exc:
        return False, {"detail": str(exc)[:200], "kind": "network"}
    try:
        payload = resp.json()
    except ValueError:
        payload = {}
    if resp.status_code >= 400:
        body = payload or {}
        detail = body.get("error") or body or (resp.text or "")
        return False, {"detail": detail, "status_code": resp.status_code, "body": (resp.text or "")[:400]}
    return True, payload or {}


def _extend_user_token(app_id: str, app_secret: str, short_lived_token: str) -> Tuple[str, int, Dict[str, Any]]:
    params = {
        "grant_type": "fb_exchange_token",
        "client_id": app_id,
        "client_secret": app_secret,
        "fb_exchange_token": short_lived_token,
    }
    ok, data = _request("GET", "oauth/access_token", params=params)
    if not ok or "access_token" not in data:
        return short_lived_token, 0, data
    token = str(data.get("access_token") or short_lived_token)
    expires = int(data.get("expires_in") or 0)
    return token, expires, data


def _fetch_pages(user_token: str) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    params = {
        "access_token": user_token,
        "fields": "id,name,access_token,instagram_business_account,instagram_business_account{id,username}"
    }
    ok, data = _request("GET", "me/accounts", params=params)
    if not ok:
        return [], data
    pages = data.get("data") or []
    return pages, data


def _select_page(pages: List[Dict[str, Any]], preferred_page_id: Optional[str]) -> Optional[Dict[str, Any]]:
    preferred = None
    fallback = None
    for page in pages:
        ig_obj = page.get("instagram_business_account") or {}
        ig_id = (ig_obj or {}).get("id")
        if not ig_id:
            continue
        if preferred_page_id and str(page.get("id")) == str(preferred_page_id):
            preferred = page
            break
        if fallback is None:
            fallback = page
    return preferred or fallback


def _fetch_ig_profile(ig_user_id: str, page_access_token: str) -> Tuple[Optional[Dict[str, Any]], Dict[str, Any]]:
    params = {
        "access_token": page_access_token,
        "fields": "id,username,name,ig_id,profile_picture_url,followers_count,follows_count,media_count"
    }
    ok, data = _request("GET", f"{ig_user_id}", params=params)
    if not ok:
        return None, data
    return data, {}


def exchange_for_business_account(
    app_id: str,
    app_secret: str,
    redirect_uri: str,
    code: str,
    *,
    preferred_page_id: Optional[str] = None,
) -> Dict[str, Any]:
    if not app_id or not app_secret:
        return {"status": "error", "detail": "missing_app_credentials"}
    params = {
        "client_id": app_id,
        "client_secret": app_secret,
        "redirect_uri": redirect_uri,
        "code": code,
    }
    ok, auth_data = _request("GET", "oauth/access_token", params=params)
    if not ok or "access_token" not in auth_data:
        return {"status": "error", "detail": "user_token_exchange_failed", "error": auth_data}
    user_token = str(auth_data.get("access_token") or "")
    user_expires = int(auth_data.get("expires_in") or 0)
    granted_scopes = _split_scopes(auth_data.get("granted_scopes") or auth_data.get("scope"))

    user_token, long_expires, extend_meta = _extend_user_token(app_id, app_secret, user_token)
    if long_expires:
        user_expires = long_expires
    pages, pages_meta = _fetch_pages(user_token)
    if not pages:
        return {"status": "error", "detail": "no_pages_or_missing_permissions", "error": pages_meta}
    page = _select_page(pages, preferred_page_id)
    if not page:
        return {"status": "error", "detail": "no_instagram_account_on_pages", "pages": pages}

    page_access_token = str(page.get("access_token") or "")
    ig_obj = page.get("instagram_business_account") or {}
    ig_user_id = str(ig_obj.get("id") or "")
    profile, profile_meta = (None, {})
    if ig_user_id and page_access_token:
        profile, profile_meta = _fetch_ig_profile(ig_user_id, page_access_token)

    return {
        "status": "ok",
        "page_id": page.get("id"),
        "page_name": page.get("name"),
        "page_access_token": page_access_token,
        "page_access_token_expires_in": 0,
        "instagram_business_account_id": ig_user_id,
        "instagram_username": (profile or {}).get("username") or ig_obj.get("username"),
        "user_access_token": user_token,
        "user_access_token_expires_in": user_expires,
        "scopes": granted_scopes,
        "granted_scopes": granted_scopes,
        "profile": profile_meta if profile is None else profile,
        "pages_response": pages_meta,
        "extend_response": extend_meta,
    }


def refresh_page_access_token(
    app_id: str,
    app_secret: str,
    user_access_token: str,
    page_id: str,
) -> Dict[str, Any]:
    if not user_access_token:
        return {"status": "error", "detail": "missing_user_access_token"}
    user_token = user_access_token
    user_expires = 0
    user_token, user_expires, extend_meta = _extend_user_token(app_id, app_secret, user_token)

    params = {
        "access_token": user_token,
        "fields": "name,access_token,instagram_business_account,instagram_business_account{id,username}"
    }
    ok, page_data = _request("GET", f"{page_id}", params=params)
    if not ok or "access_token" not in page_data:
        return {"status": "error", "detail": "page_lookup_failed", "error": page_data}

    page_access_token = str(page_data.get("access_token") or "")
    ig_obj = page_data.get("instagram_business_account") or {}
    ig_user_id = str(ig_obj.get("id") or "")

    profile, profile_meta = (None, {})
    if ig_user_id and page_access_token:
        profile, profile_meta = _fetch_ig_profile(ig_user_id, page_access_token)

    return {
        "status": "ok",
        "page_id": page_data.get("id") or page_id,
        "page_name": page_data.get("name"),
        "page_access_token": page_access_token,
        "page_access_token_expires_in": 0,
        "instagram_business_account_id": ig_user_id,
        "instagram_username": (profile or {}).get("username") or ig_obj.get("username"),
        "user_access_token": user_token,
        "user_access_token_expires_in": user_expires,
        "profile": profile_meta if profile is None else profile,
        "extend_response": extend_meta,
    }


def get_profile(page_access_token: str, ig_user_id: str) -> Dict[str, Any]:
    if not page_access_token:
        return {"status": "error", "detail": "missing_access_token"}
    if not ig_user_id:
        return {"status": "error", "detail": "missing_ig_user_id"}
    profile, meta = _fetch_ig_profile(ig_user_id, page_access_token)
    if profile is None:
        return {"status": "error", "detail": "profile_fetch_failed", "error": meta}
    return {"status": "ok", "profile": profile}


def get_media(page_access_token: str, ig_user_id: str, limit: int = 12) -> Dict[str, Any]:
    if not page_access_token:
        return {"status": "error", "detail": "missing_access_token"}
    if not ig_user_id:
        return {"status": "error", "detail": "missing_ig_user_id"}
    params = {
        "access_token": page_access_token,
        "fields": "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp",
        "limit": str(max(1, min(int(limit or 12), 50))),
    }
    ok, data = _request("GET", f"{ig_user_id}/media", params=params, timeout=25)
    if not ok:
        return {"status": "error", "detail": "media_fetch_failed", "error": data}
    items: List[Dict[str, Any]] = data.get("data") or []
    simplified: List[Dict[str, Any]] = []
    for item in items:
        media_url = item.get("media_url") or item.get("thumbnail_url")
        if not media_url:
            continue
        simplified.append(
            {
                "id": item.get("id"),
                "caption": item.get("caption"),
                "url": media_url,
                "type": item.get("media_type"),
                "permalink": item.get("permalink"),
                "timestamp": item.get("timestamp"),
            }
        )
    paging = data.get("paging")
    return {"status": "ok", "items": simplified, "paging": paging}
