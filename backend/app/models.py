from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return uuid.uuid4().hex


class UiSession(Base):
    __tablename__ = "ui_sessions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=new_id)
    title: Mapped[str] = mapped_column(String(255), default="New Chat")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_active_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    status: Mapped[str] = mapped_column(String(32), default="created")
    cwd: Mapped[str | None] = mapped_column(Text, nullable=True)
    profile: Mapped[str | None] = mapped_column(String(255), nullable=True)
    model: Mapped[str | None] = mapped_column(String(255), nullable=True)
    hermes_session_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    resume_official_session_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    continue_latest: Mapped[bool] = mapped_column(Boolean, default=False)
    pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    favorite: Mapped[bool] = mapped_column(Boolean, default=False)
    archived: Mapped[bool] = mapped_column(Boolean, default=False)
    pid: Mapped[int | None] = mapped_column(Integer, nullable=True)
    exit_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    preview: Mapped[str | None] = mapped_column(Text, nullable=True)

    transcripts: Mapped[list["SessionTranscript"]] = relationship(
        back_populates="session", cascade="all, delete-orphan", order_by="SessionTranscript.chunk_index"
    )


class SessionTranscript(Base):
    __tablename__ = "session_transcripts"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=new_id)
    ui_session_id: Mapped[str] = mapped_column(ForeignKey("ui_sessions.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    chunk_index: Mapped[int] = mapped_column(Integer)
    raw_ansi: Mapped[str] = mapped_column(Text)
    plain_text: Mapped[str] = mapped_column(Text)

    session: Mapped[UiSession] = relationship(back_populates="transcripts")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=new_id)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    action: Mapped[str] = mapped_column(String(255), index=True)
    actor: Mapped[str | None] = mapped_column(String(255), nullable=True)
    target: Mapped[str | None] = mapped_column(Text, nullable=True)
    detail_json: Mapped[str] = mapped_column(Text, default="{}")
    ip_address: Mapped[str | None] = mapped_column(String(128), nullable=True)
