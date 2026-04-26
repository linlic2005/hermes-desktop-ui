from __future__ import annotations

import platform
import sys

from fastapi import APIRouter, Depends

from app.config import settings
from app.schemas import ServerInfoResponse
from app.security import auth_dependency


router = APIRouter(dependencies=[Depends(auth_dependency)])


@router.get("/api/server/info", response_model=ServerInfoResponse)
def server_info() -> dict:
    return ServerInfoResponse(
        server_name="Hermes UI Gateway",
        mode=settings.hermes_ui_mode,
        os=platform.system(),
        platform=platform.platform(),
        python=sys.version.split()[0],
        hermes_command=settings.hermes_command,
        dashboard_url=settings.hermes_dashboard_url,
        gateway_url=settings.gateway_url,
        pty_supported=settings.pty_supported,
        native_windows_experimental=settings.native_windows_experimental,
        wsl_detected=settings.wsl_detected,
    ).model_dump(by_alias=True)


@router.get("/api/gateway/summary")
def gateway_summary() -> dict:
    return {
        "gateway": {
            "status": "running",
            "pid": None,
            "uptime": None,
            "mode": settings.hermes_ui_mode,
        },
        "platforms": [],
        "rawStatus": {},
    }
