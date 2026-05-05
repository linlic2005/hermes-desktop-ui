import asyncio
import os
import asyncssh
import logging
from .config import settings
from .pty_manager import pty_manager
from .models import UiSession
from .db import SessionLocal
from .session_manager import session_manager

logger = logging.getLogger(__name__)

class HermesSSHServer(asyncssh.SSHServer):
    def __init__(self):
        self._auth_attempts = 0

    def begin_auth(self, username):
        # 仅允许配置的用户名
        return username == settings.hermes_ssh_user

    def password_auth_supported(self):
        return True

    def validate_password(self, username, password):
        if username == settings.hermes_ssh_user and password == settings.hermes_ssh_password:
            return True
        self._auth_attempts += 1
        if self._auth_attempts >= 3:
            logger.warning(f"Too many SSH auth attempts for user {username}")
        return False

    def session_requested(self):
        return HermesSSHSession()

class HermesSSHSession(asyncssh.SSHServerSession):
    def __init__(self):
        self._chan = None
        self._proc = None
        self._running = None
        self._ui_session_id = None

    def connection_made(self, chan):
        self._chan = chan

    def pty_requested(self, term_type, term_size, term_modes):
        return True

    def terminal_size_changed(self, width, height, pixwidth, pixheight):
        if self._running:
            asyncio.create_task(pty_manager.resize(self._running, width, height))

    def shell_requested(self):
        asyncio.create_task(self._start_session())
        return True

    async def _start_session(self):
        # 启动一个虚拟的 UI Session
        self._ui_session_id = f"ssh-{os.urandom(4).hex()}"
        
        # 创建一个模拟的 UiSession 对象
        ui_session = UiSession(
            id=self._ui_session_id,
            title=f"SSH Session ({self._chan.get_extra_info('peername')[0]})"
        )
        
        # 将会话写入数据库（可选，但为了保持一致性建议写入）
        with SessionLocal() as db:
            db.add(ui_session)
            db.commit()
            db.refresh(ui_session)

        try:
            # 启动 PTY 进程
            self._running = await pty_manager.start(ui_session)
            
            # 设置初始窗口大小
            width, height, _, _ = self._chan.get_terminal_size()
            await pty_manager.resize(self._running, width, height)
            
            # 订阅输出
            output_queue = pty_manager.subscribe(self._running)
            
            # 启动双向转发
            await self._forward_output(output_queue)
        except Exception as e:
            logger.error(f"Failed to start PTY for SSH session: {e}")
            self._chan.write(f"Error: Failed to start Hermes TUI: {e}\r\n")
            self._chan.exit(1)

    async def _forward_output(self, queue):
        try:
            while True:
                data = await queue.get()
                if data == "__HERMES_TUI_EXITED__":
                    self._chan.exit(0)
                    break
                self._chan.write(data)
        except Exception:
            pass
        finally:
            self._chan.close()

    def data_received(self, data, datatype):
        if self._running:
            asyncio.create_task(pty_manager.write(self._running, data))

    def connection_lost(self, exc):
        if self._running:
            # 停止 PTY 进程（或 detach）
            asyncio.create_task(pty_manager.stop(self._ui_session_id))

async def start_ssh_server():
    if not settings.hermes_ssh_enabled:
        return None

    # 检查或生成主机密钥
    host_key_path = settings.hermes_ssh_host_key_path
    if not os.path.exists(host_key_path):
        logger.info(f"Generating SSH host key at {host_key_path}...")
        key = asyncssh.generate_private_key('ssh-rsa')
        key.write_private_key(host_key_path)
        os.chmod(host_key_path, 0o600)

    logger.info(f"Starting SSH server on port {settings.hermes_ssh_port}...")
    server = await asyncssh.create_server(
        HermesSSHServer,
        '',
        settings.hermes_ssh_port,
        server_host_keys=[host_key_path]
    )
    return server
