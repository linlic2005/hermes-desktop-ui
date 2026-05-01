from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter

from app import __version__
from app.config import command_available, settings
from app.local_manager import local_manager
from app.schemas import HealthResponse


router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health() -> dict:
    dashboard_available = local_manager.dashboard_available()
    message = "Gateway is running"
    if not settings.pty_supported:
        message = settings.pty_message
    return HealthResponse(
        ok=True,
        gateway="running",
        mode=settings.hermes_ui_mode,
        local_mode=settings.local_mode,
        hermes_dashboard="available" if dashboard_available else "unavailable",
        hermes_command_available=command_available(settings.hermes_command),
        pty_supported=settings.pty_supported,
        native_windows_experimental=settings.native_windows_experimental,
        ssh_enabled=settings.hermes_ssh_enabled,
        ssh_port=settings.hermes_ssh_port if settings.hermes_ssh_enabled else None,
        version=__version__,
        time=datetime.now(timezone.utc).isoformat(),
        message=message,
    ).model_dump(by_alias=True)
