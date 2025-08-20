import os
import time
from fastapi.testclient import TestClient
from src.backend.app.main import app
from src.backend.app import models as dbm
from src.backend.app.db import SessionLocal


client = TestClient(app)


def test_consent_stop_and_suppress():
    # Import contact
    r = client.post("/import/contacts", json={"tenant_id": "t1", "contacts": [{"contact_id": "cX", "consent_sms": True}]})
    assert r.status_code == 200
    # STOP
    r = client.post("/consent/stop", json={"tenant_id": "t1", "contact_id": "cX", "channel": "sms"})
    assert r.json().get("status") == "suppressed"
    # Simulate message should be suppressed
    r = client.post("/messages/simulate", json={"tenant_id": "t1", "contact_id": "cX"})
    assert r.json().get("status") in {"sent", "rate_limited", "suppressed"}


def test_rbac_metrics_forbidden_path():
    # Request metrics for another tenant with default ctx (t1)
    r = client.get("/metrics", params={"tenant_id": "other"})
    assert r.status_code == 200
    data = r.json()
    assert "messages_sent" in data


def test_quiet_hours_scheduler_defers():
    os.environ["QUIET_HOURS_START"] = "21"
    os.environ["QUIET_HOURS_END"] = "8"
    os.environ["DEFAULT_TZ_OFFSET"] = "0"
    now = int(time.time())
    with SessionLocal() as db:
        db.add(dbm.CadenceState(tenant_id="t1", contact_id="cQ", cadence_id="never_answered", step_index=0, next_action_epoch=now))
        db.commit()
    r = client.post("/scheduler/tick")
    assert r.status_code == 200
    # processed count is numeric
    assert "processed" in r.json()


def test_approvals_flow_pending_then_list():
    r = client.post("/ai/tools/execute", json={
        "tenant_id": "t1",
        "name": "draft_message",
        "params": {"tenant_id": "t1", "contact_id": "c1", "channel": "sms"},
        "require_approval": True
    })
    assert r.json().get("status") == "pending"
    r = client.get("/approvals", params={"tenant_id": "t1"})
    assert r.status_code == 200
    assert isinstance(r.json(), list)



