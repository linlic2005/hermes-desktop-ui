from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from ..audit import write_audit
from ..db import get_db
from ..remote_manager import RemoteHermesManager
from ..schemas import (
    RemoteDiscoverRequest,
    RemoteDiscoverResponse,
    RemoteLogsRequest,
    RemoteLogsResponse,
    RemoteServiceActionRequest,
    RemoteServiceActionResponse,
    RemoteSshConfig,
    RemoteSshTestResponse,
)
from ..security import auth_dependency

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/remote", dependencies=[Depends(auth_dependency)])


@router.post("/test-ssh", response_model=RemoteSshTestResponse)
async def test_ssh(config: RemoteSshConfig) -> RemoteSshTestResponse:
    manager = RemoteHermesManager(config)
    return await manager.test_ssh()


@router.post("/discover", response_model=RemoteDiscoverResponse)
async def discover(request: RemoteDiscoverRequest) -> RemoteDiscoverResponse:
    manager = RemoteHermesManager(request)
    return await manager.discover(request)


@router.post("/start", response_model=RemoteServiceActionResponse)
async def start_service(
    request: Request,
    action: RemoteServiceActionRequest,
    db: Session = Depends(get_db)
) -> RemoteServiceActionResponse:
    write_audit(
        db, 
        "remote.start_service", 
        target=f"{action.target}@{action.connection.host}", 
        detail=action.model_dump(), 
        request=request
    )
    manager = RemoteHermesManager(action.connection)
    return await manager.start_service(action)


@router.post("/stop", response_model=RemoteServiceActionResponse)
async def stop_service(
    request: Request,
    action: RemoteServiceActionRequest, # We reuse the same model but port/target/connection are key
    db: Session = Depends(get_db)
) -> RemoteServiceActionResponse:
    write_audit(
        db, 
        "remote.stop_service", 
        target=f"{action.target}@{action.connection.host}", 
        detail=action.model_dump(), 
        request=request
    )
    manager = RemoteHermesManager(action.connection)
    return await manager.stop_service(action.connection, action.target, action.port)


@router.post("/restart", response_model=RemoteServiceActionResponse)
async def restart_service(
    request: Request,
    action: RemoteServiceActionRequest,
    db: Session = Depends(get_db)
) -> RemoteServiceActionResponse:
    write_audit(
        db, 
        "remote.restart_service", 
        target=f"{action.target}@{action.connection.host}", 
        detail=action.model_dump(), 
        request=request
    )
    manager = RemoteHermesManager(action.connection)
    await manager.stop_service(action.connection, action.target, action.port)
    return await manager.start_service(action)


@router.post("/logs", response_model=RemoteLogsResponse)
async def get_logs(request: RemoteLogsRequest) -> RemoteLogsResponse:
    manager = RemoteHermesManager(request.connection)
    return await manager.get_logs(request)
