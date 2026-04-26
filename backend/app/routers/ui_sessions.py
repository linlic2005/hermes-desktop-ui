from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.audit import write_audit
from app.db import get_db
from app.pty_manager import pty_manager
from app.schemas import UiSessionCreate, UiSessionPatch
from app.security import auth_dependency
from app.session_manager import serialize_session, session_manager


router = APIRouter(prefix="/api/ui/sessions", dependencies=[Depends(auth_dependency)])


@router.post("")
def create_session(payload: UiSessionCreate, db: Session = Depends(get_db)) -> dict:
    return serialize_session(session_manager.create(db, payload))


@router.get("")
def list_sessions(
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    q: str | None = None,
    status: str | None = None,
    pinned: bool | None = None,
    favorite: bool | None = None,
    archived: bool | None = None,
) -> list[dict]:
    sessions = session_manager.list(db, limit, offset, q, status, pinned, favorite, archived)
    return [serialize_session(session) for session in sessions]


@router.get("/{session_id}")
def get_session(session_id: str, db: Session = Depends(get_db)) -> dict:
    return serialize_session(session_manager.get(db, session_id))


@router.patch("/{session_id}")
def patch_session(session_id: str, payload: UiSessionPatch, db: Session = Depends(get_db)) -> dict:
    return serialize_session(session_manager.patch(db, session_id, payload))


@router.delete("/{session_id}")
async def delete_session(session_id: str, request: Request, db: Session = Depends(get_db)) -> dict:
    await pty_manager.stop(session_id)
    session_manager.delete(db, session_id)
    write_audit(db, "ui_session.delete", target=session_id, request=request)
    return {"status": "deleted"}


@router.get("/{session_id}/transcript")
def transcript(session_id: str, db: Session = Depends(get_db)) -> dict:
    return session_manager.transcript(db, session_id)
