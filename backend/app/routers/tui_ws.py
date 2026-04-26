from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.config import settings
from app.db import SessionLocal
from app.errors import error_payload
from app.pty_manager import pty_manager
from app.security import require_websocket_auth
from app.session_manager import session_manager


router = APIRouter()


async def send_json(websocket: WebSocket, payload: dict) -> bool:
    try:
        await websocket.send_text(json.dumps(payload, ensure_ascii=False))
    except WebSocketDisconnect:
        return False
    except RuntimeError as exc:
        if "disconnect" in str(exc).lower() or "closed" in str(exc).lower():
            return False
        raise
    return True


@router.websocket("/ws/tui/{ui_session_id}")
async def tui_websocket(websocket: WebSocket, ui_session_id: str) -> None:
    if not await require_websocket_auth(websocket):
        await websocket.accept()
        await send_json(websocket, {"type": "status", "state": "error", "message": "auth_failed"})
        await websocket.close(code=1008)
        return
    await websocket.accept()
    if not settings.pty_supported:
        await send_json(websocket, {"type": "status", "state": "error", "message": "pty_unsupported"})
        await websocket.close(code=1011)
        return

    with SessionLocal() as db:
        try:
            ui_session = session_manager.get(db, ui_session_id)
        except Exception:
            await send_json(websocket, {"type": "status", "state": "error", "message": "session_not_found"})
            await websocket.close(code=1008)
            return

    await send_json(websocket, {"type": "status", "state": "starting", "message": "Starting Hermes TUI"})
    try:
        running = await pty_manager.start(ui_session)
    except Exception:
        with SessionLocal() as db:
            try:
                session_manager.update_status(db, ui_session_id, "error")
            except Exception:
                pass
        await send_json(websocket, {"type": "status", "state": "error", "message": "pty_start_failed"})
        await websocket.close(code=1011)
        return

    await send_json(
        websocket,
        {
            "type": "session",
            "uiSessionId": ui_session_id,
            "pid": running.pid,
            "hermesSessionId": ui_session.hermes_session_id,
        },
    )
    output_queue = pty_manager.subscribe(running)
    with SessionLocal() as db:
        replay = session_manager.transcript(db, ui_session_id)
    if replay.get("rawAnsi"):
        await send_json(websocket, {"type": "output", "data": replay["rawAnsi"], "replay": True})
    try:
        startup_output = await asyncio.wait_for(output_queue.get(), timeout=0.5)
        if startup_output != "__HERMES_TUI_EXITED__":
            chunks = [startup_output]
            while True:
                try:
                    item = await asyncio.wait_for(output_queue.get(), timeout=0.05)
                except asyncio.TimeoutError:
                    break
                if item == "__HERMES_TUI_EXITED__":
                    await send_json(websocket, {"type": "status", "state": "exited", "message": "Hermes TUI exited"})
                    return
                chunks.append(item)
            await send_json(websocket, {"type": "output", "data": "".join(chunks)})
    except asyncio.TimeoutError:
        pass
    await send_json(websocket, {"type": "status", "state": "ready", "message": "Hermes TUI ready"})

    receive_task: asyncio.Task | None = None
    output_task: asyncio.Task | None = None
    try:
        while True:
            receive_task = asyncio.create_task(websocket.receive_text())
            output_task = asyncio.create_task(output_queue.get())
            done, pending = await asyncio.wait(
                {receive_task, output_task}, return_when=asyncio.FIRST_COMPLETED
            )
            for task in pending:
                task.cancel()
            if output_task in done:
                data = output_task.result()
                if data == "__HERMES_TUI_EXITED__":
                    await send_json(websocket, {"type": "status", "state": "exited", "message": "Hermes TUI exited"})
                    break
                await send_json(websocket, {"type": "output", "data": data})
            if receive_task in done:
                try:
                    payload = json.loads(receive_task.result())
                except json.JSONDecodeError:
                    await send_json(websocket, {"type": "status", "state": "error", "message": "invalid_request"})
                    continue
                message_type = payload.get("type")
                if message_type == "input":
                    await pty_manager.write(running, str(payload.get("data", "")))
                elif message_type == "resize":
                    await pty_manager.resize(running, int(payload.get("cols", 80)), int(payload.get("rows", 24)))
                elif message_type == "interrupt":
                    await pty_manager.interrupt(running)
                    await send_json(websocket, {"type": "status", "state": "interrupted", "message": "Interrupted"})
                elif message_type == "close":
                    break
                else:
                    await send_json(websocket, {"type": "status", "state": "error", "message": "invalid_request"})
    except WebSocketDisconnect:
        pass
    finally:
        if receive_task and not receive_task.done():
            receive_task.cancel()
        if output_task and not output_task.done():
            output_task.cancel()
        pty_manager.unsubscribe(running, output_queue)
        await pty_manager.detach(running)
