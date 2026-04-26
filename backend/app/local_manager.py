from __future__ import annotations

import os
import platform
import shutil
import subprocess
import time
from dataclasses import dataclass
from typing import Any

import httpx

from .config import command_path, command_version, settings


@dataclass
class ManagedProcess:
    process: subprocess.Popen
    command: list[str]
    started_at: float


class LocalManager:
    def __init__(self) -> None:
        self.dashboard_process: ManagedProcess | None = None

    def dashboard_available(self) -> bool:
        try:
            with httpx.Client(timeout=2.0, trust_env=False) as client:
                response = client.get(settings.hermes_dashboard_url)
            return response.status_code < 500
        except Exception:
            return False

    def local_mode_required(self) -> None:
        from .errors import APIError

        if settings.hermes_ui_mode != "local":
            raise APIError("local_mode_required", "This endpoint is only available in local mode", status_code=403)

    def discover(self) -> dict[str, Any]:
        hermes_path = command_path(settings.hermes_command)
        node_path = command_path("node")
        return {
            "mode": settings.hermes_ui_mode,
            "gateway": {"available": True, "url": settings.gateway_url},
            "dashboard": {"available": self.dashboard_available(), "url": settings.hermes_dashboard_url},
            "hermesCommand": {
                "available": hermes_path is not None,
                "path": hermes_path,
                "version": command_version(settings.hermes_command),
            },
            "pty": {
                "available": settings.pty_supported,
                "kind": settings.pty_kind,
                "message": settings.pty_message,
            },
            "node": {
                "available": node_path is not None,
                "version": command_version("node"),
            },
            "suggestedCommands": [
                "pip install 'hermes-agent[web,pty]'",
                "hermes dashboard --host 127.0.0.1 --port 9119 --no-open",
                "uvicorn app.main:app --host 127.0.0.1 --port 9788",
            ],
        }

    def start_dashboard(self) -> dict[str, Any]:
        self.local_mode_required()
        if self.dashboard_available():
            return {"status": "already_running", "message": "Hermes Dashboard is already available"}
        if self.dashboard_process and self.dashboard_process.process.poll() is None:
            return {"status": "already_running", "pid": self.dashboard_process.process.pid}
        command = [
            settings.hermes_command,
            "dashboard",
            "--host",
            "127.0.0.1",
            "--port",
            str(settings.local_dashboard_port),
            "--no-open",
        ]
        env = os.environ.copy()
        if settings.hermes_home:
            env["HERMES_HOME"] = settings.hermes_home
        try:
            process = subprocess.Popen(
                command,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                stdin=subprocess.DEVNULL,
                shell=False,
                env=env,
            )
        except Exception as exc:
            return {"status": "error", "error": "dashboard_start_failed", "message": str(exc)}
        self.dashboard_process = ManagedProcess(process=process, command=command, started_at=time.time())
        return {"status": "started", "pid": process.pid}

    def stop_dashboard(self) -> dict[str, Any]:
        self.local_mode_required()
        managed = self.dashboard_process
        if not managed or managed.process.poll() is not None:
            return {"status": "not_running"}
        managed.process.terminate()
        try:
            managed.process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            managed.process.kill()
        return {"status": "stopped", "pid": managed.process.pid}

    def managed_processes(self) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        managed = self.dashboard_process
        if managed:
            status = "running" if managed.process.poll() is None else "exited"
            items.append(
                {
                    "name": "hermes-dashboard",
                    "pid": managed.process.pid,
                    "uptime": max(0, int(time.time() - managed.started_at)),
                    "status": status,
                    "command": "hermes dashboard --host 127.0.0.1 --port ***** --no-open",
                }
            )
        return items


local_manager = LocalManager()
