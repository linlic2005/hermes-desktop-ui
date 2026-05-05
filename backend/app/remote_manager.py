from __future__ import annotations

import asyncio
import io
import logging
import shlex
from typing import Any

import asyncssh

from .errors import raise_error
from .schemas import (
    RemoteDiscoverRequest,
    RemoteDiscoverResponse,
    RemoteServiceActionRequest,
    RemoteServiceActionResponse,
    RemoteServiceStatus,
    RemoteSshConfig,
    RemoteSshTestResponse,
)

logger = logging.getLogger(__name__)


class RemoteHermesManager:
    def __init__(self, config: RemoteSshConfig):
        self.config = config

    async def _connect(self) -> asyncssh.SSHClientConnection:
        import os
        import tempfile
        import shutil
        from contextlib import contextmanager

        @contextmanager
        def isolated_ssh_env():
            """Force asyncssh to look for keys in an empty temp directory."""
            temp_dir = tempfile.mkdtemp()
            # Variables used by os.path.expanduser and asyncssh
            vars_to_isolate = ["HOME", "USERPROFILE", "HOMEDRIVE", "HOMEPATH"]
            old_vars = {v: os.environ.get(v) for v in vars_to_isolate}
            
            try:
                # Redirect everything to temp_dir
                os.environ["HOME"] = temp_dir
                os.environ["USERPROFILE"] = temp_dir
                # Split drive and path for HOMEDRIVE/HOMEPATH
                if ":" in temp_dir:
                    os.environ["HOMEDRIVE"] = temp_dir[:2]
                    os.environ["HOMEPATH"] = temp_dir[2:]
                else:
                    os.environ["HOMEDRIVE"] = ""
                    os.environ["HOMEPATH"] = temp_dir
                    
                yield
            finally:
                # Restore original environment
                for v, val in old_vars.items():
                    if val is not None:
                        os.environ[v] = val
                    else:
                        os.environ.pop(v, None)
                
                try:
                    shutil.rmtree(temp_dir)
                except Exception:
                    pass

        # Base options for all auth types
        options: dict[str, Any] = {
            "host": self.config.host,
            "port": self.config.port,
            "username": self.config.username,
            "login_timeout": self.config.timeout_seconds,
            "known_hosts": None,
            "agent_path": None,
            "config": None,
        }

        if self.config.auth_type == "password":
            options["password"] = self.config.password
            options["client_keys"] = []
        else:
            if not self.config.private_key:
                raise_error("invalid_auth", "Private key is required for privateKey auth type")
            try:
                key = asyncssh.import_private_key(self.config.private_key, self.config.passphrase)
                options["client_keys"] = [key]
            except Exception as e:
                logger.error(f"Failed to import private key: {str(e)}")
                raise_error("invalid_key", f"Failed to import private key: {str(e)}")

        try:
            # We wrap the connect call in our isolation context to block ANY local file access
            with isolated_ssh_env():
                return await asyncssh.connect(**options)
        except (Exception, asyncssh.KeyImportError) as e:
            err_msg = str(e)
            logger.error(f"SSH Connection failed to {self.config.host}: {err_msg}")
            raise_error("ssh_connection_failed", f"Failed to connect to {self.config.host}: {err_msg}")

    async def run_command(
        self, conn: asyncssh.SSHClientConnection, cmd: str, timeout: int = 15
    ) -> tuple[str, str, int]:
        try:
            result = await asyncio.wait_for(conn.run(cmd), timeout=timeout)
            return result.stdout or "", result.stderr or "", result.exit_status or 0
        except asyncio.TimeoutError:
            return "", "Command timed out", -1
        except Exception as e:
            return "", str(e), -1

    async def test_ssh(self) -> RemoteSshTestResponse:
        async with await self._connect() as conn:
            stdout, _, status = await self.run_command(conn, "uname -a && hostname")
            if status != 0:
                return RemoteSshTestResponse(
                    ok=False,
                    host=self.config.host,
                    username=self.config.username,
                    message=f"Connected but failed to run basic commands (exit {status})"
                )
            
            lines = stdout.strip().splitlines()
            os_info = lines[0] if len(lines) > 0 else "Unknown"
            hostname = lines[1] if len(lines) > 1 else "Unknown"
            
            return RemoteSshTestResponse(
                ok=True,
                host=self.config.host,
                username=self.config.username,
                hostname=hostname,
                os=os_info,
                message="SSH connection successful"
            )

    async def discover(self, request: RemoteDiscoverRequest) -> RemoteDiscoverResponse:
        async with await self._connect() as conn:
            # 1. System Info
            sys_cmd = "hostname && uname -s && echo $SHELL && python3 --version && node --version && pwd"
            stdout, _, _ = await self.run_command(conn, sys_cmd)
            sys_lines = stdout.strip().splitlines()
            system = {
                "hostname": sys_lines[0] if len(sys_lines) > 0 else "unknown",
                "os": sys_lines[1] if len(sys_lines) > 1 else "unknown",
                "shell": sys_lines[2] if len(sys_lines) > 2 else "unknown",
                "python": sys_lines[3] if len(sys_lines) > 3 else "not found",
                "node": sys_lines[4] if len(sys_lines) > 4 else "not found",
                "cwd": sys_lines[5] if len(sys_lines) > 5 else "unknown",
            }

            # 2. Hermes Info
            hermes_cmd = f"command -v hermes && hermes --version && test -d {shlex.quote(request.hermes_home)} && find {shlex.quote(request.hermes_home)} -maxdepth 2 -type f -name 'config.yaml' | head -n 1"
            stdout, _, _ = await self.run_command(conn, hermes_cmd)
            h_lines = stdout.strip().splitlines()
            
            hermes_available = len(h_lines) > 0 and h_lines[0].endswith("hermes")
            hermes = {
                "commandAvailable": hermes_available,
                "commandPath": h_lines[0] if hermes_available else None,
                "version": h_lines[1] if len(h_lines) > 1 else "unknown",
                "home": request.hermes_home,
                "configExists": any("config.yaml" in line for line in h_lines),
                "profiles": ["default"]  # Simple default, could be expanded by listing ~/.hermes/profiles
            }

            # 3. Port Checking
            ports = [request.dashboard_port, request.gateway_port, request.hermes_gateway_port]
            ports_str = "|".join(map(str, ports))
            # Use ss, netstat or lsof
            check_port_cmd = f"ss -ltnp | grep -E ':({ports_str}) ' || netstat -ltnp | grep -E ':({ports_str}) ' || true"
            stdout, _, _ = await self.run_command(conn, check_port_cmd)
            
            services = {}
            for target, port in [
                ("dashboard", request.dashboard_port),
                ("uiGateway", request.gateway_port),
                ("hermesGateway", request.hermes_gateway_port)
            ]:
                listening = f":{port} " in stdout
                services[target] = RemoteServiceStatus(
                    port=port,
                    listening=listening,
                    url=f"http://{self.config.host}:{port}" if listening else None
                )

            # 4. Suggestions
            suggestions = [
                f"mkdir -p {request.hermes_home}/logs",
                f"nohup hermes dashboard --host 0.0.0.0 --port {request.dashboard_port} --no-open > {request.hermes_home}/logs/dashboard.log 2>&1 &",
                f"nohup hermes gateway start --host 0.0.0.0 --port {request.hermes_gateway_port} > {request.hermes_home}/logs/gateway.log 2>&1 &",
            ]

            return RemoteDiscoverResponse(
                ok=True,
                system=system,
                hermes=hermes,
                services=services,
                suggested_commands=suggestions,
                warnings=[]
            )

    async def start_service(self, request: RemoteServiceActionRequest) -> RemoteServiceActionResponse:
        async with await self._connect() as conn:
            log_dir = f"{request.hermes_home}/logs"
            await self.run_command(conn, f"mkdir -p {shlex.quote(log_dir)}")
            
            cmd = ""
            if request.target == "dashboard":
                log_file = f"{log_dir}/dashboard-{request.port}.log"
                cmd = f"nohup hermes dashboard --host {shlex.quote(request.host)} --port {request.port} --no-open > {shlex.quote(log_file)} 2>&1 & echo $!"
            elif request.target == "hermesGateway":
                log_file = f"{log_dir}/gateway-{request.port}.log"
                cmd = f"nohup hermes gateway start --host {shlex.quote(request.host)} --port {request.port} > {shlex.quote(log_file)} 2>&1 & echo $!"
            elif request.target == "uiGateway":
                # UI Gateway is the backend of THIS project.
                # Try to find the directory, default to $HOME/hermes-ui/backend
                log_file = f"{log_dir}/ui-gateway-{request.port}.log"
                # Robust start: try to find app/main.py and use python3 -m uvicorn
                cmd = f"cd {shlex.quote(request.hermes_home)}/.. 2>/dev/null || cd $HOME/hermes-ui/backend 2>/dev/null || true; " \
                      f"nohup python3 -m uvicorn app.main:app --host {shlex.quote(request.host)} --port {request.port} > {shlex.quote(log_file)} 2>&1 & echo $!"
            else:
                raise_error("invalid_target", f"Unsupported start target: {request.target}")

            stdout, stderr, status = await self.run_command(conn, cmd)
            if status != 0:
                raise_error("start_failed", f"Failed to start {request.target}: {stderr}")

            pid_str = stdout.strip().splitlines()[-1] if stdout.strip() else None
            pid = int(pid_str) if pid_str and pid_str.isdigit() else None

            # Verify port with multiple retries
            ok = False
            for _ in range(3):
                await asyncio.sleep(2) # Total wait up to 6 seconds
                check_cmd = f"ss -ltnp | grep ':{request.port} ' || netstat -ltnp | grep ':{request.port} ' || lsof -i:{request.port} -t || true"
                check_out, _, _ = await self.run_command(conn, check_cmd)
                if f":{request.port} " in check_out or check_out.strip():
                    ok = True
                    break

            return RemoteServiceActionResponse(
                ok=ok,
                target=request.target,
                pid=pid,
                url=f"http://{self.config.host}:{request.port}",
                message=f"Remote {request.target} started" if ok else f"Remote {request.target} started but port {request.port} not listening yet"
            )

    async def stop_service(self, connection: RemoteSshConfig, target: str, port: int) -> RemoteServiceActionResponse:
        self.config = connection
        async with await self._connect() as conn:
            # Find PID by port
            find_pid_cmd = f"lsof -ti:{port} || ss -ltnp | grep ':{port} ' | grep -oE 'pid=[0-9]+' | cut -d= -f2 | head -n 1"
            stdout, _, _ = await self.run_command(conn, find_pid_cmd)
            pid_str = stdout.strip()
            
            if not pid_str:
                return RemoteServiceActionResponse(
                    ok=False,
                    target=target, # type: ignore
                    message=f"No process found listening on port {port}"
                )
            
            # Use kill -15 for graceful stop
            kill_cmd = f"kill {pid_str}"
            _, stderr, status = await self.run_command(conn, kill_cmd)
            
            if status != 0:
                raise_error("stop_failed", f"Failed to stop process {pid_str}: {stderr}")
                
            return RemoteServiceActionResponse(
                ok=True,
                target=target, # type: ignore
                message=f"Process {pid_str} on port {port} stopped"
            )

    async def get_logs(self, request: Any) -> Any: # Using Any for quick implement, will match schemas
        async with await self._connect() as conn:
            log_file = ""
            if request.target == "dashboard":
                log_file = f"{request.hermes_home}/logs/dashboard.log"
            elif request.target == "hermesGateway":
                log_file = f"{request.hermes_home}/logs/gateway.log"
            elif request.target == "uiGateway":
                log_file = f"{request.hermes_home}/logs/ui-gateway.log"
            elif request.target == "agent":
                log_file = f"{request.hermes_home}/logs/agent.log"
            
            cmd = f"tail -n {request.lines} {shlex.quote(log_file)} 2>/dev/null || echo 'Log file not found: {log_file}'"
            stdout, _, _ = await self.run_command(conn, cmd)
            
            return {
                "ok": True,
                "logs": [], # Could parse if needed, but raw is usually enough for start
                "raw": stdout
            }
