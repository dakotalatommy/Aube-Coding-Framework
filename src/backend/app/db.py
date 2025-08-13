import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase


DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./brandvx.db")
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


