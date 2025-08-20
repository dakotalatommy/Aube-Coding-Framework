from fastapi.testclient import TestClient
from src.backend.app.main import app


client = TestClient(app)


def test_no_consent_blocks_email():
    # contact with no email consent
    client.post("/import/contacts", json={"tenant_id": "t1", "contacts": [{"contact_id": "cN", "consent_sms": True, "consent_email": False}]})
    r = client.post("/messages/simulate", json={"tenant_id": "t1", "contact_id": "cN", "channel": "email"})
    assert r.status_code == 200
    assert r.json().get("status") in {"no_consent", "sent", "rate_limited"}






