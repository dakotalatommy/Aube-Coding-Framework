from fastapi.testclient import TestClient
from src.backend.app.main import app


client = TestClient(app)


def test_calendar_sync_flow():
    # Google events
    r = client.post("/calendar/sync", json={"tenant_id": "t1", "provider": "google"})
    assert r.status_code == 200
    # Apple events
    r = client.post("/calendar/sync", json={"tenant_id": "t1", "provider": "apple"})
    assert r.status_code == 200
    # Bookings merge (Square + Acuity)
    r = client.post("/calendar/sync", json={"tenant_id": "t1"})
    assert r.status_code == 200
    # List
    r = client.get("/calendar/list", params={"tenant_id": "t1"})
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data.get("events"), list)
    assert isinstance(data.get("last_sync"), dict)
    # Expect at least one event present after syncs
    assert len(data["events"]) >= 1


def test_inventory_sync_flow():
    # Shopify snapshot
    r = client.post("/inventory/sync", json={"tenant_id": "t1", "provider": "shopify"})
    assert r.status_code == 200
    # Square snapshot merge
    r = client.post("/inventory/sync", json={"tenant_id": "t1", "provider": "square"})
    assert r.status_code == 200
    # Metrics/items
    r = client.get("/inventory/metrics", params={"tenant_id": "t1"})
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data.get("summary"), dict)
    assert isinstance(data.get("last_sync"), dict)
    assert isinstance(data.get("items"), list)
    assert len(data["items"]) >= 1
    # Manual recompute should not error
    r = client.post("/inventory/sync", json={"tenant_id": "t1", "provider": "manual"})
    assert r.status_code == 200


def test_onboarding_analyze_shape():
    r = client.post("/onboarding/analyze", json={"tenant_id": "t1"})
    assert r.status_code == 200
    data = r.json()
    assert "summary" in data
    s = data["summary"]
    # Expect keys to exist per scaffolding
    for key in [
        "connected",
        "inbox_ready",
        "calendar_ready",
        "inventory_ready",
        "reconciliation",
    ]:
        assert key in s


def test_import_candidates_and_contacts():
    # Candidates should return list
    r = client.get("/import/candidates", params={"tenant_id": "t1"})
    assert r.status_code == 200
    items = r.json().get("items", [])
    assert isinstance(items, list)
    # Import zero should no-op gracefully
    r = client.post("/import/contacts", json={"tenant_id": "t1", "contacts": []})
    assert r.status_code == 200


def test_inbox_list_shape():
    r = client.get("/inbox/list", params={"tenant_id": "t1"})
    assert r.status_code == 200
    data = r.json()
    assert "items" in data
    assert isinstance(data["items"], list)


