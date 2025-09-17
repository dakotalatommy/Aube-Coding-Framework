import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, event, text as _sa_text
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


pool_size = int(os.getenv("DB_POOL_SIZE", os.getenv("SQL_POOL_SIZE", "5")))
max_overflow = int(os.getenv("DB_MAX_OVERFLOW", os.getenv("SQL_MAX_OVERFLOW", "5")))
pool_timeout = int(os.getenv("DB_POOL_TIMEOUT", os.getenv("SQL_POOL_TIMEOUT", "10")))
pool_recycle = int(os.getenv("DB_POOL_RECYCLE_SECONDS", os.getenv("SQL_POOL_RECYCLE", "900")))
pool_pre_ping = os.getenv("DB_POOL_PRE_PING", "0") == "1"

# Per-connection defaults (can be overridden by PGOPTIONS or role settings)
pg_statement_timeout_ms = int(os.getenv("PG_STATEMENT_TIMEOUT_MS", "12000"))
pg_lock_timeout_ms = int(os.getenv("PG_LOCK_TIMEOUT_MS", "3000"))
pg_idle_txn_timeout_ms = int(os.getenv("PG_IDLE_IN_TXN_TIMEOUT_MS", "10000"))
db_app_name = os.getenv("DB_APP_NAME", "brandvx")
db_connect_timeout = int(os.getenv("DB_CONNECT_TIMEOUT", "5"))

_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
if not DATABASE_URL.startswith("sqlite"):
    # Pass through libpq options for faster fail and observability
    _connect_args.update({
        "connect_timeout": db_connect_timeout,
        "application_name": db_app_name,
    })

engine = create_engine(
    DATABASE_URL,
    connect_args=_connect_args,
    pool_size=pool_size if not DATABASE_URL.startswith("sqlite") else None,
    max_overflow=max_overflow if not DATABASE_URL.startswith("sqlite") else None,
    pool_timeout=pool_timeout if not DATABASE_URL.startswith("sqlite") else None,
    pool_recycle=pool_recycle if not DATABASE_URL.startswith("sqlite") else None,
    pool_pre_ping=pool_pre_ping if not DATABASE_URL.startswith("sqlite") else None,
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
            connection.execute(_sa_text("SET LOCAL app.tenant_id = :t"), {"t": tenant_id})
        role = CURRENT_ROLE.get()
        if role:
            connection.execute(_sa_text("SET LOCAL app.role = :r"), {"r": role})
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


# Apply Postgres per-connection timeouts defensively at DBAPI connect
def _on_connect(dbapi_connection, connection_record):  # type: ignore
    try:
        if DATABASE_URL.startswith("postgres"):
            cur = dbapi_connection.cursor()
            try:
                cur.execute("SET statement_timeout TO %s", (pg_statement_timeout_ms,))
                cur.execute("SET lock_timeout TO %s", (pg_lock_timeout_ms,))
                cur.execute(
                    "SET idle_in_transaction_session_timeout TO %s",
                    (pg_idle_txn_timeout_ms,),
                )
                cur.execute("SET application_name TO %s", (db_app_name,))
            finally:
                try:
                    cur.close()
                except Exception:
                    pass
    except Exception:
        # Non-fatal; allow connection to proceed even if SET fails
        pass


event.listen(engine, "connect", _on_connect)

