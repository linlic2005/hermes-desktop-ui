from __future__ import annotations

import asyncio
import os
import shlex
import signal
import subprocess
import threading
import time
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy.orm import Session

from .config import settings
from .db import SessionLocal
from .models import UiSession
from .session_manager import session_manager


@dataclass
class RunningTui:
    ui_session_id: str
    pid: int
    command: list[str]
    output_queue: asyncio.Queue[str] = field(default_factory=asyncio.Queue)
    process: asyncio.subprocess.Process | None = None
    pipe_process: subprocess.Popen | None = None
    pty_process: Any | None = None
    started_at: float = field(default_factory=time.time)
    last_active_at: float = field(default_factory=time.time)
    attached: int = 0
    exit_code: int | None = None
    reader_task: asyncio.Task | None = None
    subscribers: list[asyncio.Queue[str]] = field(default_factory=list)


class PtyManager:
    def __init__(self) -> None:
        self.sessions: dict[str, RunningTui] = {}

    def build_command(self, ui_session: UiSession) -> list[str]:
        if settings.hermes_tui_command:
            return shlex.split(settings.hermes_tui_command, posix=os.name != "nt")
        command = [settings.hermes_command, "--tui"]
        if ui_session.continue_latest:
            command.append("--continue")
        if ui_session.resume_official_session_id:
            command.extend(["--resume", ui_session.resume_official_session_id])
        return command

    def build_env(self) -> dict[str, str]:
        env = os.environ.copy()
        if settings.hermes_home:
            env["HERMES_HOME"] = settings.hermes_home
        return env

    def build_cwd(self, ui_session: UiSession) -> str | None:
        return ui_session.cwd or settings.hermes_workdir

    async def start(self, ui_session: UiSession) -> RunningTui:
        existing = self.sessions.get(ui_session.id)
        if existing and existing.exit_code is None:
            existing.attached += 1
            return existing
        command = self.build_command(ui_session)
        cwd = self.build_cwd(ui_session)
        env = self.build_env()
        if settings.hermes_tui_command:
            running = await self._start_subprocess(ui_session.id, command, cwd, env)
        else:
            running = await self._start_ptyprocess(ui_session.id, command, cwd, env)
        running.attached = 1
        self.sessions[ui_session.id] = running
        with SessionLocal() as db:
            session_manager.update_status(db, ui_session.id, "running", pid=running.pid)
        return running

    async def _start_subprocess(
        self, ui_session_id: str, command: list[str], cwd: str | None, env: dict[str, str]
    ) -> RunningTui:
        process = subprocess.Popen(
            command,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            cwd=cwd,
            env=env,
            shell=False,
        )
        running = RunningTui(
            ui_session_id=ui_session_id,
            pid=process.pid or -1,
            command=command,
            pipe_process=process,
        )
        loop = asyncio.get_running_loop()
        threading.Thread(target=self._read_pipe_thread, args=(running, loop), daemon=True).start()
        return running

    async def _start_ptyprocess(
        self, ui_session_id: str, command: list[str], cwd: str | None, env: dict[str, str]
    ) -> RunningTui:
        try:
            from ptyprocess import PtyProcessUnicode
        except Exception as exc:
            raise RuntimeError("pty_unsupported") from exc
        proc = PtyProcessUnicode.spawn(command, cwd=cwd, env=env, echo=False)
        running = RunningTui(ui_session_id=ui_session_id, pid=proc.pid, command=command, pty_process=proc)
        running.reader_task = asyncio.create_task(self._read_ptyprocess(running))
        return running

    def _read_pipe_thread(self, running: RunningTui, loop: asyncio.AbstractEventLoop) -> None:
        assert running.pipe_process is not None
        try:
            while True:
                chunk = running.pipe_process.stdout.readline()  # type: ignore[union-attr]
                if not chunk:
                    break
                text = chunk.decode("utf-8", errors="replace")
                running.last_active_at = time.time()
                with SessionLocal() as db:
                    session_manager.add_transcript(db, running.ui_session_id, text)
                loop.call_soon_threadsafe(self._broadcast_nowait, running, text)
        finally:
            running.exit_code = running.pipe_process.wait()
            with SessionLocal() as db:
                try:
                    session_manager.update_status(db, running.ui_session_id, "exited", exit_code=running.exit_code)
                except Exception:
                    pass
            loop.call_soon_threadsafe(self._broadcast_nowait, running, "__HERMES_TUI_EXITED__")

    async def _read_ptyprocess(self, running: RunningTui) -> None:
        proc = running.pty_process
        try:
            while proc.isalive():
                try:
                    text = await asyncio.to_thread(proc.read, 4096)
                except EOFError:
                    break
                if text:
                    await self._record_output(running, text)
        finally:
            try:
                running.exit_code = proc.exitstatus
            except Exception:
                running.exit_code = None
            await self._mark_exited(running)

    async def _record_output(self, running: RunningTui, text: str) -> None:
        running.last_active_at = time.time()
        self._broadcast_nowait(running, text)
        with SessionLocal() as db:
            session_manager.add_transcript(db, running.ui_session_id, text)

    async def _mark_exited(self, running: RunningTui) -> None:
        with SessionLocal() as db:
            try:
                session_manager.update_status(db, running.ui_session_id, "exited", exit_code=running.exit_code)
            except Exception:
                pass
        self._broadcast_nowait(running, "__HERMES_TUI_EXITED__")

    def _broadcast_nowait(self, running: RunningTui, item: str) -> None:
        for subscriber in list(running.subscribers):
            subscriber.put_nowait(item)

    def subscribe(self, running: RunningTui) -> asyncio.Queue[str]:
        queue: asyncio.Queue[str] = asyncio.Queue()
        running.subscribers.append(queue)
        return queue

    def unsubscribe(self, running: RunningTui, queue: asyncio.Queue[str] | None) -> None:
        if queue is None:
            return
        try:
            running.subscribers.remove(queue)
        except ValueError:
            pass

    async def write(self, running: RunningTui, data: str) -> None:
        running.last_active_at = time.time()
        if running.pipe_process and running.pipe_process.stdin:
            data = data.replace("\r", "\n")
            running.pipe_process.stdin.write(data.encode("utf-8"))
            running.pipe_process.stdin.flush()
            return
        if running.process and running.process.stdin:
            running.process.stdin.write(data.encode("utf-8"))
            await running.process.stdin.drain()
            return
        if running.pty_process:
            await asyncio.to_thread(running.pty_process.write, data)

    async def resize(self, running: RunningTui, cols: int, rows: int) -> None:
        running.last_active_at = time.time()
        if running.pty_process:
            await asyncio.to_thread(running.pty_process.setwinsize, rows, cols)

    async def interrupt(self, running: RunningTui) -> None:
        running.last_active_at = time.time()
        with SessionLocal() as db:
            session_manager.update_status(db, running.ui_session_id, "interrupted")
        if running.pipe_process:
            try:
                if os.name == "nt":
                    await self.write(running, "\x03\n")
                else:
                    running.pipe_process.send_signal(signal.SIGINT)
            except ProcessLookupError:
                pass
            return
        if running.process:
            try:
                if os.name == "nt":
                    await self.write(running, "\x03\n")
                else:
                    running.process.send_signal(signal.SIGINT)
            except ProcessLookupError:
                pass
            return
        if running.pty_process:
            await asyncio.to_thread(running.pty_process.write, "\x03")

    async def detach(self, running: RunningTui) -> None:
        running.attached = max(0, running.attached - 1)
        running.last_active_at = time.time()

    async def stop(self, ui_session_id: str) -> None:
        running = self.sessions.get(ui_session_id)
        if not running:
            return
        if running.pipe_process and running.exit_code is None:
            running.pipe_process.terminate()
            try:
                running.pipe_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                running.pipe_process.kill()
        if running.process and running.exit_code is None:
            running.process.terminate()
            try:
                await asyncio.wait_for(running.process.wait(), timeout=5)
            except asyncio.TimeoutError:
                running.process.kill()
        if running.pty_process:
            try:
                running.pty_process.terminate(force=True)
            except Exception:
                pass

    async def cleanup_idle(self) -> None:
        now = time.time()
        stale = [
            session_id
            for session_id, running in self.sessions.items()
            if running.attached == 0
            and running.exit_code is None
            and now - running.last_active_at > settings.pty_idle_timeout_seconds
        ]
        for session_id in stale:
            await self.stop(session_id)

    def process_list(self) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        for running in self.sessions.values():
            status = "running" if running.exit_code is None else "exited"
            items.append(
                {
                    "name": "hermes-tui",
                    "pid": running.pid,
                    "uptime": max(0, int(time.time() - running.started_at)),
                    "status": status,
                    "command": " ".join("[REDACTED]" if "token" in part.lower() else part for part in running.command),
                    "uiSessionId": running.ui_session_id,
                }
            )
        return items


pty_manager = PtyManager()
