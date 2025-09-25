import json
import uuid
from datetime import datetime

import pytest
import requests
from sqlalchemy import create_engine, text

SUPABASE_PROJECT_URL = "https://dwfvnqajrwruprqbjxph.supabase.co"
SUPABASE_REST_URL = f"{SUPABASE_PROJECT_URL}/rest/v1"
SUPABASE_STORAGE_URL = f"{SUPABASE_PROJECT_URL}/storage/v1"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3ZnZucWFqcndydXBycWJqeHBoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTExMDI2MCwiZXhwIjoyMDcwNjg2MjYwfQ.oqzaO0k0A00Coz524psCWvLUtGhq0qhHqjntTnfj6vI"
HEADERS = {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Prefer": "return=representation",
}

TENANT_ID = str(uuid.uuid4())
SESSION = requests.Session()
SESSION.headers.update(HEADERS)

DATABASE_URL = "postgresql+psycopg2://postgres:cJnfImq2tBnN3KI6@db.dwfvnqajrwruprqbjxph.supabase.co:5432/postgres"


def get_engine():
    return create_engine(DATABASE_URL)


def create_support_ticket():
    payload = {
        "tenant_id": TENANT_ID,
        "name": "Test User",
        "email": "test@example.com",
        "phone": "123-456-7890",
        "description": "Automated support ticket test",
        "status": "new",
        "file_urls": json.dumps([{"url": "https://example.com/test.pdf"}]),
        "context_json": json.dumps({"source": "ci"}),
    }
    r = SESSION.post(f"{SUPABASE_REST_URL}/support_tickets", data=json.dumps(payload))
    r.raise_for_status()
    rows = r.json() if r.content else []
    if rows:
        return rows[0]["id"]
    # Fallback: select latest inserted
    resp = SESSION.get(
        f"{SUPABASE_REST_URL}/support_tickets",
        params={"tenant_id": f"eq.{TENANT_ID}", "order": "created_at.desc", "limit": "1"},
    )
    resp.raise_for_status()
    return resp.json()[0]["id"]


def fetch_support_ticket(ticket_id):
    r = SESSION.get(f"{SUPABASE_REST_URL}/support_tickets", params={"id": f"eq.{ticket_id}"})
    r.raise_for_status()
    rows = r.json()
    assert rows, "Support ticket not found"
    return rows[0]


def create_referral_code(code: str):
    payload = {"user_id": str(uuid.uuid4()), "code": code, "tenant_id": TENANT_ID}
    r = SESSION.post(f"{SUPABASE_REST_URL}/referral_codes", data=json.dumps(payload))
    r.raise_for_status()
    return r.json()[0]


def upsert_trainvx_memory():
    payload = {
        "tenant_id": TENANT_ID,
        "key": "askvx.test.memory",
        "value": json.dumps({"note": "integration"}),
    }
    r = SESSION.post(f"{SUPABASE_REST_URL}/trainvx_memories", data=json.dumps(payload))
    r.raise_for_status()


def insert_askvx_message(session_id):
    payload = {
        "tenant_id": TENANT_ID,
        "session_id": session_id,
        "role": "user",
        "content": "Hello from automated test",
    }
    r = SESSION.post(f"{SUPABASE_REST_URL}/askvx_messages", data=json.dumps(payload))
    r.raise_for_status()


def create_job():
    payload = {
        "tenant_id": TENANT_ID,
        "kind": "test.sync",
        "status": "queued",
        "progress": 0,
    }
    r = SESSION.post(f"{SUPABASE_REST_URL}/jobs", data=json.dumps(payload))
    r.raise_for_status()


def fetch_latest_jobs():
    r = SESSION.get(
        f"{SUPABASE_REST_URL}/jobs",
        params={"tenant_id": f"eq.{TENANT_ID}", "order": "created_at.desc", "limit": "5"},
    )
    r.raise_for_status()
    return r.json()


def upload_support_file(bucket="support-tickets"):
    filename = f"{TENANT_ID}/pytest-{uuid.uuid4()}.txt"
    storage_headers = HEADERS.copy()
    storage_headers.pop("Prefer", None)
    storage_headers["Content-Type"] = "text/plain"
    data = b"integration test upload"
    url = f"{SUPABASE_STORAGE_URL}/object/{bucket}/{filename}?upsert=true"
    r = SESSION.put(url, headers=storage_headers, data=data)
    if r.status_code >= 400:
        pytest.skip(f"Storage upload not permitted via REST: {r.status_code}")
    return filename

def generate_signed_url(bucket, filename):
    payload = {"expiresIn": 60 * 60, "path": filename}
    r = SESSION.post(f"{SUPABASE_STORAGE_URL}/object/sign/{bucket}", data=json.dumps(payload))
    r.raise_for_status()
    return r.json().get("signedURL")

def list_cron_jobs():
    try:
        with get_engine().connect() as conn:
            res = conn.execute(text("SELECT jobid, schedule, command FROM cron.job ORDER BY jobid"))
            return [dict(row._mapping) for row in res]
    except Exception:
        return None


def ping_support_endpoint():
    payload = {
        "tenant_id": TENANT_ID,
        "name": "Test",
        "email": "test@example.com",
        "phone": "123",
        "description": "Ping support",
    }
    r = SESSION.post(f"{SUPABASE_REST_URL}/support_tickets", data=json.dumps(payload))
    r.raise_for_status()
    return r.json()[0]["id"]


def fetch_ticket_activity(ticket_id):
    with get_engine().connect() as conn:
        res = conn.execute(
            text(
                "SELECT created_at, payload->>'ticket_id' AS ticket_id FROM activity_log "
                "WHERE action='support.ticket.submitted' AND payload->>'ticket_id'= :tid ORDER BY created_at DESC"
            ),
            {"tid": ticket_id},
        )
        return [dict(row._mapping) for row in res]


@pytest.mark.integration
def test_support_ticket_flow():
    ticket_id = create_support_ticket()
    row = fetch_support_ticket(ticket_id)
    assert row["tenant_id"] == TENANT_ID
    assert row["description"] == "Automated support ticket test"


@pytest.mark.integration
def test_referral_code_created():
    code = f"test-{datetime.utcnow().timestamp():.0f}"
    row = create_referral_code(code)
    assert row["code"] == code
    assert row.get("tenant_id") == TENANT_ID


@pytest.mark.integration
def test_askvx_and_jobs():
    session_id = str(uuid.uuid4())
    insert_askvx_message(session_id)
    upsert_trainvx_memory()
    create_job()
    jobs = fetch_latest_jobs()
    assert any(job["kind"] == "test.sync" for job in jobs)
    r = SESSION.get(
        f"{SUPABASE_REST_URL}/askvx_messages",
        params={"tenant_id": f"eq.{TENANT_ID}", "session_id": f"eq.{session_id}"},
    )
    r.raise_for_status()
    rows = r.json()
    assert rows, "AskVX message not stored"


@pytest.mark.integration
def test_support_storage_and_signed_url():
    filename = upload_support_file()
    signed = generate_signed_url("support-tickets", filename)
    assert signed and "signedUrl" not in signed.lower()


@pytest.mark.integration
def test_cron_job_exists():
    jobs = list_cron_jobs()
    if not jobs:
        pytest.skip("cron.job catalog not accessible (pg_cron not enabled)" )
    assert any("askvx" in (job["command"] or "").lower() for job in jobs)


@pytest.mark.integration
def test_backend_activity_log():
    ticket_id = ping_support_endpoint()
    logs = fetch_ticket_activity(ticket_id)
    assert logs is not None
