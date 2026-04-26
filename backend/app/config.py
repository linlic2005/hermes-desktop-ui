from __future__ import annotations

import importlib.util
import os
import platform
import shutil
import socket
import subprocess
import sys
from functools import lru_cache
from typing import Literal

from pydantic import AnyHttpUrl, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


Mode = Literal["local", "remote-server"]


def _to_bool(value: str | bool | None, default: bool = False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return value.strip().lower() in {"1", "true", "yes", "on"}


def is_wsl() -> bool:
    if platform.system().lower() != "linux":
        return False
    try:
        release = platform.uname().release.lower()
        with open("/proc/version", "r", encoding="utf-8", errors="ignore") as fh:
            version = fh.read().lower()
        return "microsoft" in release or "microsoft" in version or "wsl" in release
    except OSError:
        return False


def is_native_windows() -> bool:
    return platform.system().lower() == "windows"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    hermes_ui_mode: Mode = Field(default="local", alias="HERMES_UI_MODE")
    hermes_ui_host: str | None = Field(default=None, alias="HERMES_UI_HOST")
    hermes_ui_port: int = Field(default=9788, alias="HERMES_UI_PORT")
    hermes_ui_token: str = Field(default="change-me", alias="HERMES_UI_TOKEN")
    hermes_ui_require_token: bool | None = Field(default=None, alias="HERMES_UI_REQUIRE_TOKEN")

    hermes_dashboard_url: str = Field(default="http://127.0.0.1:9119", alias="HERMES_DASHBOARD_URL")
    hermes_command: str = Field(default="hermes", alias="HERMES_COMMAND")
    hermes_home: str | None = Field(default=None, alias="HERMES_HOME")
    hermes_profile: str | None = Field(default=None, alias="HERMES_PROFILE")
    hermes_workdir: str | None = Field(default=None, alias="HERMES_WORKDIR")

    local_dashboard_autostart: bool = Field(default=False, alias="LOCAL_DASHBOARD_AUTOSTART")
    local_dashboard_host: str = Field(default="127.0.0.1", alias="LOCAL_DASHBOARD_HOST")
    local_dashboard_port: int = Field(default=9119, alias="LOCAL_DASHBOARD_PORT")

    gateway_bind_local_only: bool | None = Field(default=None, alias="GATEWAY_BIND_LOCAL_ONLY")
    cors_allow_origins: str = Field(
        default="http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173,tauri://localhost",
        alias="CORS_ALLOW_ORIGINS",
    )
    database_url: str = Field(default="sqlite:///./hermes_ui_gateway.db", alias="DATABASE_URL")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    proxy_timeout_seconds: int = Field(default=60, alias="PROXY_TIMEOUT_SECONDS")
    pty_idle_timeout_seconds: int = Field(default=1800, alias="PTY_IDLE_TIMEOUT_SECONDS")
    hermes_tui_command: str | None = Field(default=None, alias="HERMES_TUI_COMMAND")
    plugin_route_proxy_enabled: bool = Field(default=True, alias="PLUGIN_ROUTE_PROXY_ENABLED")
    plugin_static_proxy_enabled: bool = Field(default=True, alias="PLUGIN_STATIC_PROXY_ENABLED")
    hermes_allow_windows_pty_experimental: bool = Field(
        default=False, alias="HERMES_ALLOW_WINDOWS_PTY_EXPERIMENTAL"
    )
    hermes_force_pty_supported_for_tests: bool | None = Field(
        default=None, alias="HERMES_FORCE_PTY_SUPPORTED_FOR_TESTS"
    )

    @field_validator("hermes_dashboard_url")
    @classmethod
    def validate_dashboard_url(cls, value: str) -> str:
        if not value.startswith(("http://", "https://")):
            raise ValueError("HERMES_DASHBOARD_URL must be an http(s) URL")
        return value.rstrip("/")

    @model_validator(mode="after")
    def apply_defaults_and_security(self) -> "Settings":
        if self.hermes_ui_host is None:
            self.hermes_ui_host = "0.0.0.0" if self.hermes_ui_mode == "remote-server" else "127.0.0.1"

        if self.gateway_bind_local_only is None:
            self.gateway_bind_local_only = self.hermes_ui_mode == "local"

        if self.hermes_ui_require_token is None:
            self.hermes_ui_require_token = True

        if self.hermes_ui_mode == "remote-server" and not self.hermes_ui_require_token:
            raise RuntimeError("remote_mode_token_required")

        if self.hermes_ui_host in {"0.0.0.0", "::"} and not self.hermes_ui_require_token:
            raise RuntimeError("unsafe_bind_without_token")

        if self.hermes_ui_mode == "local" and not self.hermes_ui_require_token:
            if self.hermes_ui_host not in {"127.0.0.1", "localhost", "::1"}:
                raise RuntimeError("unsafe_bind_without_token")

        if self.hermes_ui_require_token and not self.hermes_ui_token:
            raise RuntimeError("auth_failed")

        weak_tokens = {"change-me", "changeme", "default", "password", "token", "secret"}
        if (
            self.hermes_ui_require_token
            and self.hermes_ui_token.strip().lower() in weak_tokens
            and (self.hermes_ui_mode == "remote-server" or self.hermes_ui_host in {"0.0.0.0", "::"})
        ):
            raise RuntimeError("weak_token_not_allowed")

        if self.hermes_tui_command == "":
            self.hermes_tui_command = None

        return self

    @property
    def cors_origins(self) -> list[str]:
        return [item.strip() for item in self.cors_allow_origins.split(",") if item.strip()]

    @property
    def local_mode(self) -> bool:
        return self.hermes_ui_mode == "local"

    @property
    def gateway_url(self) -> str:
        return f"http://{self.hermes_ui_host}:{self.hermes_ui_port}"

    @property
    def dashboard_url(self) -> str:
        return self.hermes_dashboard_url

    @property
    def wsl_detected(self) -> bool:
        return is_wsl()

    @property
    def native_windows_experimental(self) -> bool:
        return is_native_windows()

    @property
    def pty_kind(self) -> str:
        forced = self.hermes_force_pty_supported_for_tests
        if forced is True:
            return "posix"
        if forced is False:
            return "unsupported"
        if is_native_windows():
            has_pywinpty = importlib.util.find_spec("winpty") is not None
            if self.hermes_allow_windows_pty_experimental and has_pywinpty:
                return "windows-experimental"
            return "unsupported"
        if is_wsl():
            return "wsl"
        return "posix"

    @property
    def pty_supported(self) -> bool:
        return self.pty_kind in {"posix", "wsl", "windows-experimental"}

    @property
    def pty_message(self) -> str:
        if self.pty_kind == "unsupported" and is_native_windows():
            return "Native Windows PTY/TUI is experimental; run Hermes + Gateway inside WSL2."
        if self.pty_kind == "windows-experimental":
            return "Native Windows PTY/TUI enabled experimentally with pywinpty."
        return "PTY/TUI is available."


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()


def command_available(command: str) -> bool:
    return shutil.which(command) is not None


def command_path(command: str) -> str | None:
    return shutil.which(command)


def command_version(command: str) -> str | None:
    path = shutil.which(command)
    if not path:
        return None
    try:
        result = subprocess.run(
            [path, "--version"],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            timeout=5,
            check=False,
        )
        return (result.stdout or "").strip() or None
    except Exception:
        return None
