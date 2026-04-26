from __future__ import annotations

from fastapi import Depends, Request, WebSocket
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db
from .errors import APIError


def extract_token_from_headers(headers) -> str | None:
    authorization = headers.get("authorization")
    if authorization and authorization.lower().startswith("bearer "):
        return authorization.split(" ", 1)[1].strip()
    return headers.get("x-hermes-ui-token")


def validate_token(token: str | None) -> bool:
    if not settings.hermes_ui_require_token:
        return True
    return bool(token) and token == settings.hermes_ui_token


def require_http_auth(request: Request) -> None:
    if not validate_token(extract_token_from_headers(request.headers)):
        raise APIError("auth_failed", "Invalid or missing token", status_code=401)


def websocket_token(websocket: WebSocket) -> str | None:
    header_token = extract_token_from_headers(websocket.headers)
    if header_token:
        return header_token
    return websocket.query_params.get("token")


async def require_websocket_auth(websocket: WebSocket) -> bool:
    return validate_token(websocket_token(websocket))


def auth_dependency(_: None = Depends(require_http_auth)) -> None:
    return None
