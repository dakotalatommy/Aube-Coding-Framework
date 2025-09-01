from dataclasses import dataclass
from fastapi import Header, HTTPException
from typing import Optional
import os
import time
import jwt
from jwt import PyJWKClient


@dataclass
class UserContext:
    user_id: str
    role: str  # owner_admin | practitioner | viewer
    tenant_id: str


async def get_user_context(
    x_user_id: Optional[str] = Header(default=None),
    x_role: Optional[str] = Header(default=None),
    x_tenant_id: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
) -> UserContext:
    # Prefer JWT if provided
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1]
        try:
            jwks_url = os.getenv("JWT_JWKS_URL")
            # If not explicitly set, derive Supabase JWKS/issuer/audience from SUPABASE_URL
            if not jwks_url:
                supa_url = os.getenv("SUPABASE_URL", "").strip()
                if supa_url:
                    host = supa_url.rstrip("/")
                    # Supabase JWKS endpoint
                    jwks_url = f"{host}/auth/v1/keys"
                    os.environ.setdefault("JWT_JWKS_URL", jwks_url)
                    os.environ.setdefault("JWT_ISSUER", f"{host}/auth/v1")
                    os.environ.setdefault("JWT_AUDIENCE", os.getenv("JWT_AUDIENCE", "authenticated"))

            # Determine algorithm from header, choose appropriate verification path
            alg = ""
            try:
                alg = (jwt.get_unverified_header(token) or {}).get("alg", "")
            except Exception:
                alg = ""

            if alg.startswith("HS"):
                # Supabase project configured for HS access tokens (HS256/HS512)
                secret = os.getenv("JWT_SECRET", "dev_secret")
                aud = os.getenv("JWT_AUDIENCE", "authenticated")
                iss_env = os.getenv("JWT_ISSUER", "")
                supa_url = os.getenv("SUPABASE_URL", "").rstrip("/")
                # Try a small set of plausible issuers to tolerate config differences
                candidate_issuers = []
                if iss_env:
                    candidate_issuers.append(iss_env)
                if supa_url:
                    candidate_issuers.append(f"{supa_url}/auth/v1")
                    candidate_issuers.append(supa_url)
                last_err: Optional[Exception] = None
                for iss in candidate_issuers:
                    try:
                        payload = jwt.decode(
                            token,
                            secret,
                            algorithms=["HS256", "HS512"],
                            audience=aud,
                            issuer=iss,
                        )
                        break
                    except Exception as e:  # try next issuer form
                        payload = None  # type: ignore
                        last_err = e
                if not payload:
                    # Fallback: verify signature and audience, but not issuer (still safe for single-tenant secret)
                    payload = jwt.decode(
                        token,
                        secret,
                        algorithms=["HS256", "HS512"],
                        audience=aud,
                        options={"verify_iss": False},
                    )
            elif jwks_url:
                # Attempt JWKS verification (RS/ES)
                jwk_client = PyJWKClient(jwks_url)
                signing_key = jwk_client.get_signing_key_from_jwt(token)
                payload = jwt.decode(
                    token,
                    signing_key.key,
                    algorithms=["RS256", "ES256"],
                    audience=os.getenv("JWT_AUDIENCE", "authenticated"),
                    issuer=os.getenv("JWT_ISSUER", "brandvx"),
                )
            else:
                # Fallback to HS256 if JWKS not configured
                payload = jwt.decode(
                    token,
                    os.getenv("JWT_SECRET", "dev_secret"),
                    algorithms=["HS256"],
                    audience=os.getenv("JWT_AUDIENCE", "authenticated"),
                    issuer=os.getenv("JWT_ISSUER", "brandvx"),
                )
            # Resolve tenant: prefer explicit claim; else app_metadata.tenant_id; else fallback to subject (Supabase user UUID)
            _tenant_id = (
                payload.get("tenant_id")
                or (payload.get("app_metadata") or {}).get("tenant_id")
                or payload.get("sub")
                or "t1"
            )
            return UserContext(
                user_id=str(payload.get("sub", "user")),
                role=str(payload.get("role", "practitioner")),
                tenant_id=str(_tenant_id),
            )
        except Exception:
            # Optional weak JWT mode: allow unverified decode when explicitly enabled (dev only)
            if os.getenv("ALLOW_WEAK_JWT", "0") == "1":
                try:
                    payload = jwt.decode(
                        token,
                        options={
                            "verify_signature": False,
                            "verify_aud": False,
                            "verify_iss": False,
                            "verify_exp": False,
                        },
                    )
                    _tenant_id = (
                        payload.get("tenant_id")
                        or (payload.get("app_metadata") or {}).get("tenant_id")
                        or payload.get("sub")
                        or "t1"
                    )
                    return UserContext(
                        user_id=str(payload.get("sub", "user")),
                        role=str(payload.get("role", "authenticated")),
                        tenant_id=str(_tenant_id),
                    )
                except Exception:
                    pass
            # In TESTING, accept unsigned dev tokens to simplify fixtures
            if os.getenv("TESTING") == "1":
                try:
                    payload = jwt.decode(
                        token,
                        os.getenv("JWT_SECRET", "dev_secret"),
                        algorithms=["HS256"],
                        audience=os.getenv("JWT_AUDIENCE", "brandvx-users"),
                        issuer=os.getenv("JWT_ISSUER", "brandvx"),
                    )
                    _tenant_id = (
                        payload.get("tenant_id")
                        or (payload.get("app_metadata") or {}).get("tenant_id")
                        or payload.get("sub")
                        or "t1"
                    )
                    return UserContext(
                        user_id=str(payload.get("sub", "user")),
                        role=str(payload.get("role", "owner_admin")),
                        tenant_id=str(_tenant_id),
                    )
                except Exception:
                    # Last resort: decode without verification in tests
                    try:
                        payload = jwt.decode(
                            token,
                            options={
                                "verify_signature": False,
                                "verify_aud": False,
                                "verify_iss": False,
                                "verify_exp": False,
                            },
                        )
                        _tenant_id = (
                            payload.get("tenant_id")
                            or (payload.get("app_metadata") or {}).get("tenant_id")
                            or payload.get("sub")
                            or "t1"
                        )
                        return UserContext(
                            user_id=str(payload.get("sub", "user")),
                            role=str(payload.get("role", "owner_admin")),
                            tenant_id=str(_tenant_id),
                        )
                    except Exception:
                        pass
            # Graceful fallback: if developer headers are present, build a context instead of 401
            if x_user_id or x_role or x_tenant_id:
                role_fallback = (x_role or "owner_admin").lower()
                return UserContext(user_id=str(x_user_id or "dev-user"), role=role_fallback, tenant_id=str(x_tenant_id or "t1"))
            # Only allow blanket fallback in explicit dev mode
            dev_allow = os.getenv("DEV_AUTH_ALLOW", "0") == "1"
            if not dev_allow:
                raise HTTPException(status_code=401, detail="invalid_token")
    # No Authorization header provided: only permit dev fallback when explicitly allowed
    dev_allow = os.getenv("DEV_AUTH_ALLOW", "0") == "1"
    if not dev_allow:
        raise HTTPException(status_code=401, detail="missing_token")
    # Minimal dev default via headers (explicitly allowed)
    user_id = x_user_id or "dev-user"
    role = (x_role or "practitioner").lower()
    tenant_id = x_tenant_id or "t1"
    if role not in {"owner_admin", "practitioner", "viewer"}:
        raise HTTPException(status_code=403, detail="invalid role")
    return UserContext(user_id=user_id, role=role, tenant_id=tenant_id)


async def get_user_context_relaxed(
    x_user_id: Optional[str] = Header(default=None),
    x_role: Optional[str] = Header(default=None),
    x_tenant_id: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
) -> UserContext:
    """Relaxed variant for guarded endpoints: accepts X-* headers when no Bearer.
    Safety: only use on narrowly scoped server-side actions (e.g., import) and
    still honors normal Bearer verification when provided.
    """
    if authorization and authorization.lower().startswith("bearer "):
        # Reuse strict path
        return await get_user_context(x_user_id, x_role, x_tenant_id, authorization)
    # No Bearer: allow header-based context if all present
    if x_user_id and x_role and x_tenant_id:
        role = (x_role or "practitioner").lower()
        if role not in {"owner_admin", "practitioner", "viewer"}:
            raise HTTPException(status_code=403, detail="invalid role")
        return UserContext(user_id=str(x_user_id), role=role, tenant_id=str(x_tenant_id))
    # Otherwise defer to standard dev flag behavior
    return await get_user_context(x_user_id, x_role, x_tenant_id, authorization)


def require_role(min_role: str):
    order = {"viewer": 0, "practitioner": 1, "owner_admin": 2}

    async def guard(ctx: UserContext = None):
        if ctx is None:
            raise HTTPException(status_code=401, detail="no context")
        if order[ctx.role] < order[min_role]:
            raise HTTPException(status_code=403, detail="forbidden")
        return ctx

    return guard


