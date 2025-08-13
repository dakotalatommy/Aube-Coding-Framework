import os
import jwt


def make_token(sub: str = "user", role: str = "practitioner", tenant_id: str = "t1") -> str:
    payload = {
        "sub": sub,
        "role": role,
        "tenant_id": tenant_id,
        "aud": os.getenv("JWT_AUDIENCE", "brandvx-users"),
        "iss": os.getenv("JWT_ISSUER", "brandvx"),
    }
    return jwt.encode(payload, os.getenv("JWT_SECRET", "dev_secret"), algorithm="HS256")


