from sqlalchemy import String, Boolean, Integer, JSON, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .db import Base


class Contact(Base):
    __tablename__ = "contacts"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(String(64), index=True)
    contact_id: Mapped[str] = mapped_column(String(64), index=True)
    email_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    phone_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    consent_sms: Mapped[bool] = mapped_column(Boolean, default=False)
    consent_email: Mapped[bool] = mapped_column(Boolean, default=False)


class CadenceState(Base):
    __tablename__ = "cadence_states"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(String(64), index=True)
    contact_id: Mapped[str] = mapped_column(String(64), index=True)
    cadence_id: Mapped[str] = mapped_column(String(64))
    step_index: Mapped[int] = mapped_column(Integer, default=0)


class Metrics(Base):
    __tablename__ = "metrics"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(String(64), index=True)
    time_saved_minutes: Mapped[int] = mapped_column(Integer, default=0)
    messages_sent: Mapped[int] = mapped_column(Integer, default=0)


class ConsentLog(Base):
    __tablename__ = "consent_logs"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(String(64), index=True)
    contact_id: Mapped[str] = mapped_column(String(64), index=True)
    channel: Mapped[str] = mapped_column(String(16))
    consent: Mapped[str] = mapped_column(String(16))
    reason: Mapped[str | None] = mapped_column(String(128), nullable=True)


class NotifyListEntry(Base):
    __tablename__ = "notify_list"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(String(64), index=True)
    contact_id: Mapped[str] = mapped_column(String(64), index=True)
    preference: Mapped[str] = mapped_column(String(16))  # soonest|anytime


class SharePrompt(Base):
    __tablename__ = "share_prompts"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(String(64), index=True)
    kind: Mapped[str] = mapped_column(String(64))  # milestone type
    surfaced: Mapped[bool] = mapped_column(Boolean, default=False)


