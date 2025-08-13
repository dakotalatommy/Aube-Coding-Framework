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
            if jwks_url:
                jwk_client = PyJWKClient(jwks_url)
                signing_key = jwk_client.get_signing_key_from_jwt(token)
                payload = jwt.decode(
                    token,
                    signing_key.key,
                    algorithms=["RS256", "ES256"],
                    audience=os.getenv("JWT_AUDIENCE", "brandvx-users"),
                    issuer=os.getenv("JWT_ISSUER", "brandvx"),
                )
            else:
                payload = jwt.decode(
                    token,
                    os.getenv("JWT_SECRET", "dev_secret"),
                    algorithms=["HS256"],
                    audience=os.getenv("JWT_AUDIENCE", "brandvx-users"),
                    issuer=os.getenv("JWT_ISSUER", "brandvx"),
                )
            return UserContext(
                user_id=str(payload.get("sub", "user")),
                role=str(payload.get("role", "practitioner")),
                tenant_id=str(payload.get("tenant_id", "t1")),
            )
        except Exception:
            raise HTTPException(status_code=401, detail="invalid token")
    # Minimal dev default via headers
    user_id = x_user_id or "dev-user"
    role = (x_role or "practitioner").lower()
    tenant_id = x_tenant_id or "t1"
    if role not in {"owner_admin", "practitioner", "viewer"}:
        raise HTTPException(status_code=403, detail="invalid role")
    return UserContext(user_id=user_id, role=role, tenant_id=tenant_id)


def require_role(min_role: str):
    order = {"viewer": 0, "practitioner": 1, "owner_admin": 2}

    async def guard(ctx: UserContext = None):
        if ctx is None:
            raise HTTPException(status_code=401, detail="no context")
        if order[ctx.role] < order[min_role]:
            raise HTTPException(status_code=403, detail="forbidden")
        return ctx

    return guard


