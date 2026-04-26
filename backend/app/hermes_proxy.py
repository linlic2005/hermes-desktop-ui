from __future__ import annotations

import posixpath
import re
from typing import Iterable
from urllib.parse import unquote

import httpx
from fastapi import Request
from fastapi.responses import Response

from .config import settings
from .errors import APIError, error_payload


PLUGIN_NAME_RE = re.compile(r"^[a-zA-Z0-9_-]+$")


def _decode_path(value: str) -> str:
    decoded = value
    for _ in range(3):
        new_value = unquote(decoded)
        if new_value == decoded:
            break
        decoded = new_value
    return decoded


def validate_plugin_name(plugin_name: str) -> str:
    if not PLUGIN_NAME_RE.fullmatch(plugin_name):
        raise APIError("plugin_path_invalid", "Invalid plugin name", status_code=400)
    return plugin_name


def validate_plugin_path(path: str) -> str:
    decoded = _decode_path(path).replace("\\", "/")
    if decoded.startswith("/") or decoded.startswith("~") or ":" in decoded.split("/", 1)[0]:
        raise APIError("plugin_path_invalid", "Invalid plugin path", status_code=400)
    normalized = posixpath.normpath(decoded)
    if normalized in {".", ""}:
        raise APIError("plugin_path_invalid", "Invalid plugin path", status_code=400)
    if normalized.startswith("../") or normalized == ".." or "/../" in f"/{normalized}/":
        raise APIError("plugin_path_invalid", "Invalid plugin path", status_code=400)
    if any(part in {"", ".", ".."} for part in normalized.split("/")):
        raise APIError("plugin_path_invalid", "Invalid plugin path", status_code=400)
    return normalized


def _clean_request_headers(request: Request) -> dict[str, str]:
    blocked = {"host", "authorization", "x-hermes-ui-token", "cookie"}
    headers: dict[str, str] = {}
    for key, value in request.headers.items():
        lowered = key.lower()
        if lowered in blocked:
            continue
        if lowered == "content-length":
            continue
        headers[lowered] = value
    return headers


def _api_allowed(method: str, path: str) -> bool:
    method = method.upper()
    parts = [part for part in path.strip("/").split("/") if part]
    if not parts:
        return False

    exact = {
        ("GET", "status"),
        ("GET", "sessions"),
        ("GET", "sessions/search"),
        ("GET", "config"),
        ("GET", "config/defaults"),
        ("GET", "config/schema"),
        ("PUT", "config"),
        ("GET", "model/info"),
        ("GET", "config/raw"),
        ("PUT", "config/raw"),
        ("GET", "env"),
        ("PUT", "env"),
        ("DELETE", "env"),
        ("POST", "env/reveal"),
        ("GET", "logs"),
        ("GET", "analytics/usage"),
        ("GET", "cron/jobs"),
        ("POST", "cron/jobs"),
        ("GET", "skills"),
        ("PUT", "skills/toggle"),
        ("GET", "tools/toolsets"),
        ("POST", "gateway/restart"),
        ("POST", "hermes/update"),
        ("GET", "dashboard/themes"),
        ("PUT", "dashboard/theme"),
        ("GET", "dashboard/plugins"),
        ("GET", "dashboard/plugins/rescan"),
        ("POST", "dashboard/plugins/rescan"),
    }
    joined = "/".join(parts)
    if (method, joined) in exact:
        return True

    if len(parts) == 2 and parts[0] == "sessions" and method in {"GET", "DELETE"}:
        return True
    if len(parts) == 3 and parts[0] == "sessions" and parts[2] == "messages" and method == "GET":
        return True
    if len(parts) == 4 and parts[:2] == ["cron", "jobs"] and parts[3] in {"pause", "resume", "trigger"}:
        return method == "POST"
    if len(parts) == 3 and parts[:2] == ["cron", "jobs"] and method == "DELETE":
        return True
    if len(parts) == 3 and parts[0] == "actions" and parts[2] == "status" and method == "GET":
        return True
    return False


def _response_from_httpx(response: httpx.Response) -> Response:
    excluded_headers = {"content-encoding", "transfer-encoding", "connection"}
    headers = {k: v for k, v in response.headers.items() if k.lower() not in excluded_headers}
    return Response(content=response.content, status_code=response.status_code, headers=headers)


class HermesProxy:
    async def proxy_api(self, request: Request, api_path: str) -> Response:
        if not _api_allowed(request.method, api_path):
            raise APIError(
                "proxy_path_not_allowed",
                f"Proxy path is not allowed: /api/{api_path}",
                status_code=403,
            )
        forward_path = api_path
        forward_method = request.method.upper()
        if api_path == "dashboard/plugins/rescan" and forward_method == "POST":
            forward_method = "GET"
        return await self._proxy(request, f"/api/{forward_path}", method=forward_method)

    async def proxy_plugin_asset(self, request: Request, plugin_name: str, asset_path: str) -> Response:
        if not settings.plugin_static_proxy_enabled:
            raise APIError("not_supported", "Plugin static proxy is disabled", status_code=404)
        name = validate_plugin_name(plugin_name)
        path = validate_plugin_path(asset_path)
        return await self._proxy(request, f"/dashboard-plugins/{name}/{path}", method="GET")

    async def proxy_plugin_api(self, request: Request, plugin_name: str, plugin_path: str) -> Response:
        if not settings.plugin_route_proxy_enabled:
            raise APIError("not_supported", "Plugin route proxy is disabled", status_code=404)
        name = validate_plugin_name(plugin_name)
        path = validate_plugin_path(plugin_path)
        return await self._proxy(request, f"/api/plugins/{name}/{path}", method=request.method)

    async def _proxy(self, request: Request, path: str, method: str | None = None) -> Response:
        url = f"{settings.hermes_dashboard_url}{path}"
        if request.url.query:
            url = f"{url}?{request.url.query}"
        body = await request.body()
        headers = _clean_request_headers(request)
        try:
            async with httpx.AsyncClient(timeout=settings.proxy_timeout_seconds, trust_env=False) as client:
                upstream = await client.request(
                    method or request.method,
                    url,
                    content=body if body else None,
                    headers=headers,
                )
        except httpx.RequestError:
            return Response(
                status_code=503,
                media_type="application/json",
                content=__import__("json").dumps(
                    error_payload(
                        "dashboard_unavailable",
                        f"Cannot connect to Hermes Dashboard at {settings.hermes_dashboard_url}",
                    )
                ),
            )
        if upstream.status_code == 404 and path in {"/api/env/reveal"}:
            return Response(
                status_code=404,
                media_type="application/json",
                content=__import__("json").dumps(error_payload("not_supported", "Endpoint is not supported")),
            )
        return _response_from_httpx(upstream)


hermes_proxy = HermesProxy()
