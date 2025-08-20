#!/usr/bin/env python3
import sys
from typing import List

try:
    # Allow running from repo root
    from src.backend.app.db import engine
except Exception as e:
    print(f"ERROR: failed to import engine: {e}")
    sys.exit(1)


TABLES: List[str] = [
    "contacts",
    "appointments",
    "messages",
    "cadence_states",
    "approvals",
    "connected_accounts",
    "settings",
    "lead_status",
    "metrics",
    "events_ledger",
    "notify_list",
    "share_prompts",
    "embeddings",
    "audit_logs",
    "dead_letters",
    "chat_logs",
]


def quote_ident(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def main() -> int:
    if not engine.url.drivername.startswith("postgresql"):
        print("RLS apply skipped: DATABASE_URL is not PostgreSQL (no-op).")
        return 0

    with engine.begin() as conn:
        # Discover existing tables in public schema
        rows = conn.exec_driver_sql("SELECT tablename FROM pg_tables WHERE schemaname='public'")
        existing_tables = {r[0] for r in rows}

        applied = []
        skipped = []

        for t in TABLES:
            if t not in existing_tables:
                skipped.append(t)
                continue

            # Enable/force RLS
            qt = quote_ident(t)
            conn.exec_driver_sql(f"ALTER TABLE IF EXISTS {qt} ENABLE ROW LEVEL SECURITY;")
            conn.exec_driver_sql(f"ALTER TABLE IF EXISTS {qt} FORCE ROW LEVEL SECURITY;")

            # Drop all existing policies on table to avoid conflicts with legacy ones
            safe_t = t.replace("'", "''")
            policies = conn.exec_driver_sql(
                f"SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='{safe_t}'"
            ).fetchall()
            for (pname,) in policies:
                safe = pname.replace('"', '""')
                conn.exec_driver_sql(f'DROP POLICY IF EXISTS "{safe}" ON {qt};')

            # Create tenant_isolation with explicit cast and WITH CHECK
            conn.exec_driver_sql(
                (
                    "CREATE POLICY tenant_isolation ON {qt} "
                    "USING (tenant_id::text = current_setting('app.tenant_id', true)) "
                    "WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true))"
                ).format(qt=qt)
            )

            # Create admin_bypass with explicit cast and WITH CHECK
            conn.exec_driver_sql(
                (
                    "CREATE POLICY admin_bypass ON {qt} "
                    "USING (current_setting('app.role', true) = 'owner_admin' OR tenant_id::text = current_setting('app.tenant_id', true)) "
                    "WITH CHECK (current_setting('app.role', true) = 'owner_admin' OR tenant_id::text = current_setting('app.tenant_id', true))"
                ).format(qt=qt)
            )

            applied.append(t)

    print("RLS policies applied/enabled for tables:")
    for t in applied:
        print(" -", t)
    if skipped:
        print("Skipped (table not found):")
        for t in skipped:
            print(" -", t)
    return 0


if __name__ == "__main__":
    sys.exit(main())


