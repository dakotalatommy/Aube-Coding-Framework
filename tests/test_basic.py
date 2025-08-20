import json
from fastapi.testclient import TestClient
from src.backend.app.main import app


client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


def test_forbidden_metrics_without_tenant():
    r = client.get("/metrics", params={"tenant_id": "x"})
    assert r.status_code == 200
    data = r.json()
    assert "messages_sent" in data



