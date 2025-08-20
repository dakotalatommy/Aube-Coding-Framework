from sqlalchemy import text
from src.backend.app.db import engine


def dump_table(schema: str, table: str) -> None:
    with engine.begin() as conn:
        rows = conn.execute(
            text(
                """
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_schema=:s AND table_name=:t
                ORDER BY ordinal_position
                """
            ),
            {"s": schema, "t": table},
        ).fetchall()
        print(f"\n{schema}.{table} columns:")
        for r in rows:
            print(" -", r[0], r[1], r[2])


def main() -> int:
    for t in [
        "tenants",
        "contacts",
        "appointments",
        "approvals",
        "cadence_states",
        "lead_status",
        "messages",
    ]:
        dump_table("public", t)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())




