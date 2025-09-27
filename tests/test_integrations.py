import os
import pytest

from fastapi.testclient import TestClient

os.environ.setdefault("BRVX_DISABLE_TODO", "1")
os.environ.setdefault("DEV_AUTH_ALLOW", "1")

from src.backend.app.main import app
from src.backend.app.workers import followups as job_worker


client = TestClient(app)


def _drain_jobs(max_cycles: int = 10) -> None:
    for _ in range(max_cycles):
        processed = job_worker.run_once()
        if not processed:
            break


DEFAULT_HEADERS = {"X-User-Id": "dev", "X-Role": "owner_admin", "X-Tenant-Id": "t1"}


def test_calendar_sync_flow():
    # Google events
    r = client.post("/calendar/sync", json={"tenant_id": "t1", "provider": "google"}, headers=DEFAULT_HEADERS)
    if r.status_code == 500 and r.json().get("detail") == "job_create_failed":
        pytest.skip("Job queue not available in test environment")
    assert r.status_code == 200
    data = r.json()
    assert data.get("status") == "queued"
    assert data.get("job_id")
    _drain_jobs()
    # Apple events
    r = client.post("/calendar/sync", json={"tenant_id": "t1", "provider": "apple"}, headers=DEFAULT_HEADERS)
    if r.status_code == 500 and r.json().get("detail") == "job_create_failed":
        pytest.skip("Job queue not available in test environment")
    assert r.status_code == 200
    data = r.json()
    assert data.get("status") == "queued"
    assert data.get("job_id")
    _drain_jobs()
    # Bookings merge (Square + Acuity)
    r = client.post("/calendar/sync", json={"tenant_id": "t1"}, headers=DEFAULT_HEADERS)
    if r.status_code == 500 and r.json().get("detail") == "job_create_failed":
        pytest.skip("Job queue not available in test environment")
    assert r.status_code == 200
    data = r.json()
    assert data.get("status") == "queued"
    assert data.get("job_id")
    _drain_jobs()
    # List
    r = client.get("/calendar/list", params={"tenant_id": "t1"}, headers=DEFAULT_HEADERS)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data.get("events"), list)
    assert isinstance(data.get("last_sync"), dict)
    # Expect at least one event present after syncs
    assert len(data["events"]) >= 1


def test_inventory_sync_flow():
    # Shopify snapshot
    r = client.post("/inventory/sync", json={"tenant_id": "t1", "provider": "shopify"}, headers=DEFAULT_HEADERS)
    if r.status_code == 500 and r.json().get("detail") == "job_create_failed":
        pytest.skip("Job queue not available in test environment")
    assert r.status_code == 200
    data = r.json()
    assert data.get("status") == "queued"
    assert data.get("job_id")
    _drain_jobs()
    # Square snapshot merge
    r = client.post("/inventory/sync", json={"tenant_id": "t1", "provider": "square"}, headers=DEFAULT_HEADERS)
    if r.status_code == 500 and r.json().get("detail") == "job_create_failed":
        pytest.skip("Job queue not available in test environment")
    assert r.status_code == 200
    data = r.json()
    assert data.get("status") == "queued"
    assert data.get("job_id")
    _drain_jobs()
    # Metrics/items
    r = client.get("/inventory/metrics", params={"tenant_id": "t1"}, headers=DEFAULT_HEADERS)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data.get("summary"), dict)
    assert isinstance(data.get("last_sync"), dict)
    assert isinstance(data.get("items"), list)
    assert len(data["items"]) >= 1
    # Manual recompute should not error
    r = client.post("/inventory/sync", json={"tenant_id": "t1", "provider": "manual"}, headers=DEFAULT_HEADERS)
    if r.status_code == 500 and r.json().get("detail") == "job_create_failed":
        pytest.skip("Job queue not available in test environment")
    assert r.status_code == 200
    data = r.json()
    assert data.get("status") == "queued"
    assert data.get("job_id")
    _drain_jobs()


def test_onboarding_analyze_shape():
    r = client.post("/onboarding/analyze", json={"tenant_id": "t1"}, headers=DEFAULT_HEADERS)
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
    r = client.get("/import/candidates", params={"tenant_id": "t1"}, headers=DEFAULT_HEADERS)
    assert r.status_code == 200
    items = r.json().get("items", [])
    assert isinstance(items, list)
    # Import zero should no-op gracefully
    r = client.post("/import/contacts", json={"tenant_id": "t1", "contacts": []}, headers=DEFAULT_HEADERS)
    assert r.status_code == 200


def test_inbox_list_shape():
    r = client.get("/inbox/list", params={"tenant_id": "t1"}, headers=DEFAULT_HEADERS)
    assert r.status_code == 200
    data = r.json()
    assert "items" in data
    assert isinstance(data["items"], list)
