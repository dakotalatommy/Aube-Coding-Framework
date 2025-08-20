from sqlalchemy import text
from src.backend.app.db import engine

TENANT_ID = "00000000-0000-0000-0000-000000000001"


def main() -> int:
    with engine.begin() as conn:
        conn.execute(text("SET LOCAL app.tenant_id = :t"), {"t": TENANT_ID})
        conn.execute(text("SET LOCAL app.role = 'owner_admin'"))
        rows = conn.execute(
            text("SELECT id, contact_id, status FROM appointments WHERE tenant_id = :t LIMIT 5"),
            {"t": TENANT_ID},
        ).fetchall()
        print("appointments:", rows)
        rows2 = conn.execute(
            text("SELECT id, tool_name, status FROM approvals WHERE tenant_id = :t ORDER BY id DESC LIMIT 5"),
            {"t": TENANT_ID},
        ).fetchall()
        print("approvals:", rows2)
        rows3 = conn.execute(
            text("SELECT id FROM settings WHERE tenant_id = :t LIMIT 1"),
            {"t": TENANT_ID},
        ).fetchall()
        print("settings:", rows3)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


