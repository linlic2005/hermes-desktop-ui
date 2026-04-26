from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import Request
from sqlalchemy.orm import Session

from .models import AuditLog


logger = logging.getLogger("hermes_ui_gateway.audit")
SENSITIVE_PARTS = ("token", "secret", "password", "api_key", "apikey", "authorization", "x-hermes-ui-token")


def redact(value: Any) -> Any:
    if isinstance(value, dict):
        redacted: dict[str, Any] = {}
        for key, item in value.items():
            lowered = str(key).lower()
            if any(part in lowered for part in SENSITIVE_PARTS):
                redacted[key] = "[REDACTED]"
            else:
                redacted[key] = redact(item)
        return redacted
    if isinstance(value, list):
        return [redact(item) for item in value]
    return value


def actor_from_request(request: Request | None) -> str:
    if not request:
        return "system"
    return request.headers.get("X-Hermes-UI-Actor") or "gateway-user"


def ip_from_request(request: Request | None) -> str | None:
    if not request or not request.client:
        return None
    return request.client.host


def write_audit(
    db: Session,
    action: str,
    target: str | None = None,
    detail: dict[str, Any] | None = None,
    request: Request | None = None,
) -> None:
    clean_detail = redact(detail or {})
    entry = AuditLog(
        action=action,
        actor=actor_from_request(request),
        target=target,
        detail_json=json.dumps(clean_detail, ensure_ascii=False, default=str),
        ip_address=ip_from_request(request),
    )
    db.add(entry)
    db.commit()
    logger.info("audit action=%s target=%s detail=%s", action, target, clean_detail)
