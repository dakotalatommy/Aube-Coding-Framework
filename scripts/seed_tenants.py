from sqlalchemy import text
from src.backend.app.db import engine


def main() -> int:
    ids = [
        "00000000-0000-0000-0000-000000000001",
        "00000000-0000-0000-0000-000000000002",
    ]
    with engine.begin() as conn:
        for tid in ids:
            conn.execute(
                text(
                    """
                    INSERT INTO public.tenants (id, name)
                    VALUES (:tid, :name)
                    ON CONFLICT (id) DO NOTHING
                    """
                ),
                {"tid": tid, "name": f"Seed Tenant {tid[-4:]}"},
            )
            print("Ensured tenant row:", tid)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())




