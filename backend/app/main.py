from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import init_db
from .errors import install_error_handlers
from .pty_manager import pty_manager
from .ssh_server import start_ssh_server
from .routers import health, local, proxy, server, tui_ws, ui_sessions


logging.basicConfig(level=getattr(logging, settings.log_level.upper(), logging.INFO))


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    stop_event = asyncio.Event()

    async def cleanup_loop() -> None:
        while not stop_event.is_set():
            await pty_manager.cleanup_idle()
            try:
                await asyncio.wait_for(stop_event.wait(), timeout=30)
            except asyncio.TimeoutError:
                continue

    task = asyncio.create_task(cleanup_loop())
    
    ssh_server = None
    if settings.hermes_ssh_enabled:
        ssh_server = await start_ssh_server()

    try:
        yield
    finally:
        if ssh_server:
            ssh_server.close()
            await ssh_server.wait_closed()
        stop_event.set()
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


app = FastAPI(title="Hermes UI Gateway", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

install_error_handlers(app)

app.include_router(health.router)
app.include_router(server.router)
app.include_router(local.router)
app.include_router(ui_sessions.router)
app.include_router(tui_ws.router)
app.include_router(proxy.router)
