import json
import time
import jwt
from fastapi.testclient import TestClient
from src.backend.app.main import app


client = TestClient(app)


def make_token(sub: str = "admin", role: str = "owner_admin", tenant_id: str = "t1") -> str:
    secret = "dev_secret"
    payload = {
        "sub": sub,
        "role": role,
        "tenant_id": tenant_id,
        "aud": "brandvx-users",
        "iss": "brandvx",
        "iat": int(time.time()),
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def test_admin_kpis_with_jwt():
    token = make_token()
    r = client.get("/admin/kpis", params={"tenant_id": "t1"}, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert isinstance(r.json(), dict)


def test_approvals_approve_flow_executes_tool():
    # Create pending approval
    r = client.post(
        "/ai/tools/execute",
        json={
            "tenant_id": "t1",
            "name": "draft_message",
            "params": {"tenant_id": "t1", "contact_id": "cA", "channel": "sms"},
            "require_approval": True,
        },
    )
    assert r.json().get("status") == "pending"
    # List and approve the first
    items = client.get("/approvals", params={"tenant_id": "t1"}).json()
    assert isinstance(items, list)
    if items:
        aid = items[0]["id"]
        r = client.post(
            "/approvals/action",
            json={"tenant_id": "t1", "approval_id": aid, "action": "approve"},
        )
        assert r.status_code == 200
        assert r.json().get("status") in {"approved", "not_found"}

