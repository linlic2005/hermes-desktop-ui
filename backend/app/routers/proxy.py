from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from app.audit import write_audit
from app.db import SessionLocal
from app.errors import APIError
from app.hermes_proxy import hermes_proxy
from app.security import auth_dependency


router = APIRouter(dependencies=[Depends(auth_dependency)])


@router.api_route("/api/pty", methods=["GET", "POST"])
def pty_compatibility() -> None:
    raise APIError(
        "not_supported",
        "Compatibility endpoint /api/pty is not implemented; use /ws/tui/{uiSessionId}.",
        status_code=404,
    )


@router.api_route("/dashboard-plugins/{plugin_name}/{asset_path:path}", methods=["GET"])
async def plugin_asset(request: Request, plugin_name: str, asset_path: str):
    return await hermes_proxy.proxy_plugin_asset(request, plugin_name, asset_path)


@router.api_route(
    "/api/plugins/{plugin_name}/{plugin_path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
)
async def plugin_api(request: Request, plugin_name: str, plugin_path: str):
    if request.method.upper() != "GET":
        with SessionLocal() as db:
            write_audit(db, "plugin.api", target=f"{plugin_name}/{plugin_path}", request=request)
    return await hermes_proxy.proxy_plugin_api(request, plugin_name, plugin_path)


@router.api_route("/api/{api_path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def proxy_api(request: Request, api_path: str):
    method = request.method.upper()
    dangerous_paths = {
        "config",
        "config/raw",
        "env",
        "env/reveal",
        "skills/toggle",
        "dashboard/theme",
        "dashboard/plugins/rescan",
        "gateway/restart",
        "hermes/update",
    }
    dangerous = method != "GET" and (
        api_path in dangerous_paths
        or api_path.startswith("cron/jobs")
        or api_path.startswith("sessions/")
    )
    if dangerous:
        with SessionLocal() as db:
            write_audit(db, f"proxy.{request.method.lower()}", target=f"/api/{api_path}", request=request)
    return await hermes_proxy.proxy_api(request, api_path)
