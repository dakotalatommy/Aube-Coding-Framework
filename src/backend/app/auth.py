from dataclasses import dataclass
from fastapi import Header, HTTPException
from typing import Optional


@dataclass
class UserContext:
    user_id: str
    role: str  # owner_admin | practitioner | viewer
    tenant_id: str


async def get_user_context(
    x_user_id: Optional[str] = Header(default=None),
    x_role: Optional[str] = Header(default=None),
    x_tenant_id: Optional[str] = Header(default=None),
) -> UserContext:
    # Minimal dev default; replace with JWT/session in production
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


