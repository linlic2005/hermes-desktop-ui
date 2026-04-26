from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.audit import write_audit
from app.db import get_db
from app.local_manager import local_manager
from app.pty_manager import pty_manager
from app.security import auth_dependency


router = APIRouter(prefix="/api/local", dependencies=[Depends(auth_dependency)])


@router.get("/discover")
def discover() -> dict:
    local_manager.local_mode_required()
    return local_manager.discover()


@router.post("/start-dashboard")
def start_dashboard(request: Request, db: Session = Depends(get_db)) -> dict:
    write_audit(db, "local.start_dashboard", target="hermes-dashboard", request=request)
    return local_manager.start_dashboard()


@router.post("/stop-dashboard")
def stop_dashboard(request: Request, db: Session = Depends(get_db)) -> dict:
    write_audit(db, "local.stop_dashboard", target="hermes-dashboard", request=request)
    return local_manager.stop_dashboard()


@router.get("/processes")
def processes() -> list[dict]:
    return local_manager.managed_processes() + pty_manager.process_list()
