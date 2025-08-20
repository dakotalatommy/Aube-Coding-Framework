from sqlalchemy import text
from src.backend.app.db import engine


def run_with_ctx(tenant_id: str, role: str, sql: str, params=None):
    with engine.begin() as conn:
        conn.execute(text("SET LOCAL app.tenant_id = :tid"), {"tid": tenant_id})
        conn.execute(text("SET LOCAL app.role = :role"), {"role": role})
        return conn.execute(text(sql), params or {})


def main() -> int:
    # Cleanup any prior demo rows
    for tid in ("00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000002"):
        try:
            run_with_ctx(tid, "owner_admin", "DELETE FROM contacts WHERE contact_id like 'rls_demo_%'")
        except Exception:
            pass

    # Insert per-tenant rows
    run_with_ctx(
        "00000000-0000-0000-0000-000000000001",
        "owner_admin",
        "INSERT INTO contacts (tenant_id, contact_id, consent_sms, consent_email) VALUES (:tid, 'rls_demo_1', false, false)",
        {"tid": "00000000-0000-0000-0000-000000000001"},
    )
    run_with_ctx(
        "00000000-0000-0000-0000-000000000002",
        "owner_admin",
        "INSERT INTO contacts (tenant_id, contact_id, consent_sms, consent_email) VALUES (:tid, 'rls_demo_2', false, false)",
        {"tid": "00000000-0000-0000-0000-000000000002"},
    )

    # Verify reads
    rows_t1 = run_with_ctx(
        "00000000-0000-0000-0000-000000000001",
        "member",
        "SELECT contact_id, tenant_id FROM contacts WHERE contact_id like 'rls_demo_%' ORDER BY contact_id",
    ).fetchall()
    print("t1 sees:", rows_t1)

    rows_t2 = run_with_ctx(
        "00000000-0000-0000-0000-000000000002",
        "member",
        "SELECT contact_id, tenant_id FROM contacts WHERE contact_id like 'rls_demo_%' ORDER BY contact_id",
    ).fetchall()
    print("t2 sees:", rows_t2)

    rows_admin = run_with_ctx(
        "00000000-0000-0000-0000-000000000001",
        "owner_admin",
        "SELECT contact_id, tenant_id FROM contacts WHERE contact_id like 'rls_demo_%' ORDER BY contact_id",
    ).fetchall()
    print("admin sees:", rows_admin)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


