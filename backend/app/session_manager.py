from __future__ import annotations

import re
from datetime import datetime, timezone

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from .errors import APIError
from .models import SessionTranscript, UiSession, utcnow
from .schemas import TranscriptResponse, UiSessionCreate, UiSessionPatch, UiSessionResponse


ANSI_RE = re.compile(r"\x1b\[[0-?]*[ -/]*[@-~]")


def strip_ansi(value: str) -> str:
    return ANSI_RE.sub("", value)


def serialize_session(session: UiSession) -> dict:
    return UiSessionResponse.model_validate(session).model_dump(by_alias=True)


class SessionManager:
    def create(self, db: Session, payload: UiSessionCreate) -> UiSession:
        now = utcnow()
        session = UiSession(
            title=payload.title or "New Chat",
            cwd=payload.cwd,
            profile=payload.profile,
            model=payload.model,
            pinned=payload.pinned,
            favorite=payload.favorite,
            resume_official_session_id=payload.resume_official_session_id,
            continue_latest=payload.continue_latest,
            created_at=now,
            updated_at=now,
            last_active_at=now,
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        return session

    def list(
        self,
        db: Session,
        limit: int = 50,
        offset: int = 0,
        q: str | None = None,
        status: str | None = None,
        pinned: bool | None = None,
        favorite: bool | None = None,
        archived: bool | None = None,
    ) -> list[UiSession]:
        stmt = select(UiSession)
        conditions = []
        if archived is None:
            conditions.append(UiSession.archived.is_(False))
        else:
            conditions.append(UiSession.archived.is_(archived))
        if q:
            like = f"%{q}%"
            conditions.append(or_(UiSession.title.like(like), UiSession.preview.like(like)))
        if status:
            conditions.append(UiSession.status == status)
        if pinned is not None:
            conditions.append(UiSession.pinned.is_(pinned))
        if favorite is not None:
            conditions.append(UiSession.favorite.is_(favorite))
        if conditions:
            stmt = stmt.where(and_(*conditions))
        stmt = stmt.order_by(UiSession.updated_at.desc()).offset(offset).limit(min(limit, 200))
        return list(db.scalars(stmt))

    def get(self, db: Session, session_id: str) -> UiSession:
        session = db.get(UiSession, session_id)
        if not session:
            raise APIError("session_not_found", "UI session not found", status_code=404)
        return session

    def patch(self, db: Session, session_id: str, payload: UiSessionPatch) -> UiSession:
        session = self.get(db, session_id)
        values = payload.model_dump(exclude_unset=True, by_alias=False)
        for key, value in values.items():
            setattr(session, key, value)
        if payload.archived is True:
            session.status = "archived"
        elif payload.archived is False and session.status == "archived":
            session.status = "created"
        session.updated_at = utcnow()
        db.commit()
        db.refresh(session)
        return session

    def delete(self, db: Session, session_id: str) -> None:
        session = self.get(db, session_id)
        db.delete(session)
        db.commit()

    def update_status(
        self,
        db: Session,
        session_id: str,
        status: str,
        pid: int | None = None,
        exit_code: int | None = None,
        hermes_session_id: str | None = None,
    ) -> UiSession:
        session = self.get(db, session_id)
        session.status = status
        session.last_active_at = utcnow()
        session.updated_at = utcnow()
        if pid is not None:
            session.pid = pid
        if exit_code is not None:
            session.exit_code = exit_code
        if hermes_session_id is not None:
            session.hermes_session_id = hermes_session_id
        db.commit()
        db.refresh(session)
        return session

    def add_transcript(self, db: Session, session_id: str, raw_ansi: str) -> SessionTranscript:
        session = self.get(db, session_id)
        plain_text = strip_ansi(raw_ansi)
        next_index = len(session.transcripts)
        chunk = SessionTranscript(
            ui_session_id=session_id,
            chunk_index=next_index,
            raw_ansi=raw_ansi,
            plain_text=plain_text,
        )
        if plain_text.strip():
            session.preview = plain_text.strip()[-500:]
        session.last_active_at = utcnow()
        session.updated_at = utcnow()
        db.add(chunk)
        db.commit()
        db.refresh(chunk)
        return chunk

    def transcript(self, db: Session, session_id: str) -> dict:
        session = self.get(db, session_id)
        chunks = list(session.transcripts)
        raw = "".join(chunk.raw_ansi for chunk in chunks)
        plain = "".join(chunk.plain_text for chunk in chunks)
        return TranscriptResponse(
            ui_session_id=session_id,
            raw_ansi=raw,
            plain_text=plain,
            chunks=chunks,
        ).model_dump(by_alias=True)


session_manager = SessionManager()
