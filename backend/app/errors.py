from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field


class ErrorResponse(BaseModel):
    error: str
    message: str
    details: dict[str, Any] = Field(default_factory=dict)


class APIError(Exception):
    def __init__(
        self,
        error: str,
        message: str,
        status_code: int = 400,
        details: dict[str, Any] | None = None,
    ) -> None:
        self.error = error
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(message)


def error_payload(error: str, message: str, details: dict[str, Any] | None = None) -> dict[str, Any]:
    return ErrorResponse(error=error, message=message, details=details or {}).model_dump()


def raise_error(error: str, message: str, status_code: int = 400, details: dict[str, Any] | None = None) -> None:
    raise APIError(error=error, message=message, status_code=status_code, details=details)


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(APIError)
    async def api_error_handler(request: Request, exc: APIError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=error_payload(exc.error, exc.message, exc.details),
        )

    @app.exception_handler(HTTPException)
    async def http_error_handler(request: Request, exc: HTTPException) -> JSONResponse:
        detail = exc.detail
        if isinstance(detail, dict) and {"error", "message"}.issubset(detail):
            return JSONResponse(status_code=exc.status_code, content=detail)
        code = "not_found" if exc.status_code == 404 else "invalid_request"
        return JSONResponse(
            status_code=exc.status_code,
            content=error_payload(code, str(detail or "Request failed")),
        )
