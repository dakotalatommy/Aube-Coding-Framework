import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from contextvars import ContextVar
from typing import Optional


# Ensure local development loads environment from project root by default
try:
    load_dotenv(dotenv_path=os.getenv("ENV_FILE", ".env"), override=False)
except Exception:
    pass

# Choose SQLite automatically for pytest runs unless explicitly forced
_is_pytest = bool(os.getenv("PYTEST_CURRENT_TEST")) or os.getenv("TESTING") == "1" or bool(os.getenv("PYTEST_RUNNING"))
_force_pg_tests = os.getenv("FORCE_POSTGRES_TESTS") == "1"
if _is_pytest and not _force_pg_tests:
    DATABASE_URL = "sqlite:///./test_brandvx.db"
else:
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./brandvx.db")
    # Normalize Render's postgres URL if needed for SQLAlchemy 2.x
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)
LOVABLE_DATABASE_URL = os.getenv("LOVABLE_DATABASE_URL", "")


class Base(DeclarativeBase):
    pass


engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Optional low-level (L) data source — read-only adapter
engine_l = create_engine(
    LOVABLE_DATABASE_URL, echo=False
) if LOVABLE_DATABASE_URL else None
SessionLow = sessionmaker(autocommit=False, autoflush=False, bind=engine_l) if engine_l else None


def get_l_db():
    if SessionLow is None:
        yield None
        return
    db = SessionLow()
    try:
        yield db
    finally:
        db.close()

# Per-request tenant scoping for RLS policies using a session GUC
# The FastAPI app will set CURRENT_TENANT_ID in middleware before DB use
CURRENT_TENANT_ID: ContextVar[Optional[str]] = ContextVar("CURRENT_TENANT_ID", default=None)
CURRENT_ROLE: ContextVar[Optional[str]] = ContextVar("CURRENT_ROLE", default=None)


def _apply_rls_settings(session, transaction, connection):
    try:
        # Only attempt Postgres RLS GUCs when explicitly enabled. Some Postgres
        # installations will error on unknown GUCs and abort the transaction.
        if connection.dialect.name != "postgresql":
            return
        if os.getenv("ENABLE_PG_RLS", "0") != "1":
            return
        tenant_id = CURRENT_TENANT_ID.get()
        if tenant_id:
            connection.exec_driver_sql("SET LOCAL app.tenant_id = :t", {"t": tenant_id})
        role = CURRENT_ROLE.get()
        if role:
            connection.exec_driver_sql("SET LOCAL app.role = :r", {"r": role})
    except Exception:
        # Non-fatal; skip GUCs entirely to avoid leaving transaction in failed state
        try:
            connection.rollback()
        except Exception:
            pass


event.listen(SessionLocal, "after_begin", _apply_rls_settings)



# Only auto-create tables for ad-hoc local dev when not using Alembic
try:
    if os.getenv("TESTING") == "1" and DATABASE_URL.startswith("sqlite") and os.getenv("USE_ALEMBIC") != "1":
        from . import models  # noqa: F401
        Base.metadata.create_all(engine)
except Exception:
    pass

