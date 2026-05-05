from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class CamelModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class HealthResponse(CamelModel):
    ok: bool
    gateway: str
    mode: Literal["local", "remote-server"]
    local_mode: bool = Field(alias="localMode")
    hermes_dashboard: str = Field(alias="hermesDashboard")
    hermes_command_available: bool = Field(alias="hermesCommandAvailable")
    pty_supported: bool = Field(alias="ptySupported")
    native_windows_experimental: bool = Field(alias="nativeWindowsExperimental")
    ssh_enabled: bool = Field(alias="sshEnabled")
    ssh_port: int | None = Field(alias="sshPort")
    version: str
    time: str
    message: str


class ServerInfoResponse(CamelModel):
    server_name: str = Field(alias="serverName")
    mode: Literal["local", "remote-server"]
    os: str
    platform: str
    python: str
    hermes_command: str = Field(alias="hermesCommand")
    dashboard_url: str = Field(alias="dashboardUrl")
    gateway_url: str = Field(alias="gatewayUrl")
    pty_supported: bool = Field(alias="ptySupported")
    native_windows_experimental: bool = Field(alias="nativeWindowsExperimental")
    ssh_enabled: bool = Field(alias="sshEnabled")
    ssh_port: int | None = Field(alias="sshPort")
    wsl_detected: bool = Field(alias="wslDetected")


class UiSessionCreate(CamelModel):
    title: str = "New Chat"
    cwd: str | None = None
    profile: str | None = None
    model: str | None = None
    pinned: bool = False
    favorite: bool = False
    resume_official_session_id: str | None = Field(default=None, alias="resumeOfficialSessionId")
    continue_latest: bool = Field(default=False, alias="continueLatest")


class UiSessionPatch(CamelModel):
    title: str | None = None
    pinned: bool | None = None
    favorite: bool | None = None
    cwd: str | None = None
    profile: str | None = None
    archived: bool | None = None
    resume_official_session_id: str | None = Field(default=None, alias="resumeOfficialSessionId")
    continue_latest: bool | None = Field(default=None, alias="continueLatest")


class UiSessionResponse(CamelModel):
    id: str
    title: str
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")
    last_active_at: datetime = Field(alias="lastActiveAt")
    status: str
    cwd: str | None = None
    profile: str | None = None
    model: str | None = None
    hermes_session_id: str | None = Field(default=None, alias="hermesSessionId")
    resume_official_session_id: str | None = Field(default=None, alias="resumeOfficialSessionId")
    continue_latest: bool = Field(alias="continueLatest")
    pinned: bool
    favorite: bool
    archived: bool
    pid: int | None = None
    exit_code: int | None = Field(default=None, alias="exitCode")
    preview: str | None = None


class TranscriptChunk(CamelModel):
    id: str
    created_at: datetime = Field(alias="createdAt")
    chunk_index: int = Field(alias="chunkIndex")
    raw_ansi: str = Field(alias="rawAnsi")
    plain_text: str = Field(alias="plainText")


class TranscriptResponse(CamelModel):
    ui_session_id: str = Field(alias="uiSessionId")
    raw_ansi: str = Field(alias="rawAnsi")
    plain_text: str = Field(alias="plainText")
    chunks: list[TranscriptChunk]


class ThemeSetRequest(CamelModel):
    name: str


class EnvSetRequest(CamelModel):
    key: str
    value: str


class SkillToggleRequest(CamelModel):
    name: str
    enabled: bool


class CronJobCreate(CamelModel):
    prompt: str
    schedule: str
    name: str | None = None
    deliver: str = "local"


class LocalDiscoverResponse(CamelModel):
    mode: str
    gateway: dict[str, Any]
    dashboard: dict[str, Any]
    hermes_command: dict[str, Any] = Field(alias="hermesCommand")
    pty: dict[str, Any]
    node: dict[str, Any]
    suggested_commands: list[str] = Field(alias="suggestedCommands")


# Remote SSH Management Models

RemoteAuthType = Literal["password", "privateKey"]


class RemoteSshConfig(CamelModel):
    host: str
    port: int = 22
    username: str
    auth_type: RemoteAuthType = Field(alias="authType")
    password: str | None = None
    private_key: str | None = Field(default=None, alias="privateKey")
    passphrase: str | None = None
    timeout_seconds: int = Field(default=10, alias="timeoutSeconds")


class RemoteSshTestResponse(CamelModel):
    ok: bool
    host: str
    username: str
    hostname: str | None = None
    os: str | None = None
    message: str


class RemoteDiscoverRequest(RemoteSshConfig):
    hermes_home: str = Field(default="~/.hermes", alias="hermesHome")
    dashboard_port: int = Field(default=9119, alias="dashboardPort")
    gateway_port: int = Field(default=9788, alias="gatewayPort")
    hermes_gateway_port: int = Field(default=8642, alias="hermesGatewayPort")


class RemoteServiceStatus(CamelModel):
    port: int
    listening: bool
    url: str | None = None


class RemoteDiscoverResponse(CamelModel):
    ok: bool
    system: dict[str, Any]
    hermes: dict[str, Any]
    services: dict[str, RemoteServiceStatus]
    suggested_commands: list[str] = Field(alias="suggestedCommands")
    warnings: list[str]


RemoteServiceTarget = Literal["dashboard", "uiGateway", "hermesGateway"]


class RemoteServiceActionRequest(CamelModel):
    connection: RemoteSshConfig
    target: RemoteServiceTarget
    host: str = "0.0.0.0"
    port: int
    profile: str = "default"
    hermes_home: str = Field(default="~/.hermes", alias="hermesHome")


class RemoteServiceActionResponse(CamelModel):
    ok: bool
    target: RemoteServiceTarget
    pid: int | None = None
    url: str | None = None
    message: str


class RemoteLogsRequest(CamelModel):
    connection: RemoteSshConfig
    target: Literal["dashboard", "uiGateway", "hermesGateway", "agent"]
    lines: int = 200
    hermes_home: str = Field(default="~/.hermes", alias="hermesHome")


class RemoteLogsResponse(CamelModel):
    ok: bool
    logs: list[dict[str, Any]] = []
    raw: str
