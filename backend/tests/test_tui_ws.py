import json
import sys
from pathlib import Path

from fastapi.testclient import TestClient


def receive_until(ws, expected: str, max_messages: int = 8) -> str:
    collected = ""
    for _ in range(max_messages):
        msg = json.loads(ws.receive_text())
        collected += msg.get("data", "") + msg.get("message", "")
        if expected in collected:
            return collected
    return collected


def test_fake_tui_starts_and_transcript_saved(reload_app):
    fake = Path(__file__).with_name("fake_tui.py")
    app = reload_app(HERMES_TUI_COMMAND=f"{sys.executable} {fake}", HERMES_FORCE_PTY_SUPPORTED_FOR_TESTS="true")
    with TestClient(app) as client:
        created = client.post("/api/ui/sessions", headers={"Authorization": "Bearer test-token"}, json={"title": "WS"}).json()
        with client.websocket_connect(f"/ws/tui/{created['id']}?token=test-token") as ws:
            first = json.loads(ws.receive_text())
            assert first["type"] == "status"
            assert first["state"] == "starting"
            messages = [json.loads(ws.receive_text()) for _ in range(3)]
            assert any(msg["type"] == "session" for msg in messages)
            assert any("Hermes Fake TUI" in msg.get("data", "") for msg in messages)
            ws.send_text(json.dumps({"type": "input", "data": "hello\n"}))
            output = json.loads(ws.receive_text())
            assert output["type"] == "output"
            assert "You said: hello" in output["data"]
            ws.send_text(json.dumps({"type": "input", "data": "/help\n"}))
            assert "Commands" in receive_until(ws, "Commands")
            ws.send_text(json.dumps({"type": "input", "data": "/usage\n"}))
            assert "Usage" in receive_until(ws, "Usage")
            ws.send_text(json.dumps({"type": "input", "data": "/skills\n"}))
            assert "Skills" in receive_until(ws, "Skills")
            ws.send_text(json.dumps({"type": "input", "data": "/model\n"}))
            assert "Models" in receive_until(ws, "Models")
            ws.send_text(json.dumps({"type": "input", "data": "/sessions\n"}))
            assert "Sessions" in receive_until(ws, "Sessions")
            ws.send_text(json.dumps({"type": "input", "data": "longrun\n"}))
            longrun = receive_until(ws, "stream line 9", max_messages=20)
            assert "stream line 9" in longrun
            ws.send_text(json.dumps({"type": "resize", "cols": 120, "rows": 32}))
            ws.send_text(json.dumps({"type": "interrupt"}))
            interrupt_messages = [json.loads(ws.receive_text()) for _ in range(2)]
            assert any("interrupted" in (msg.get("message", "") + msg.get("data", "")).lower() for msg in interrupt_messages)
            ws.send_text(json.dumps({"type": "input", "data": "first line\nsecond line\n"}))
            first = json.loads(ws.receive_text())
            second = json.loads(ws.receive_text())
            assert "You said: first line" in (first.get("data", "") + second.get("data", ""))
            ws.send_text(json.dumps({"type": "close"}))
        transcript = client.get(f"/api/ui/sessions/{created['id']}/transcript", headers={"Authorization": "Bearer test-token"}).json()
        assert "Hermes Fake TUI" in transcript["plainText"]
        assert "You said: hello" in transcript["plainText"]


def test_tui_websocket_replays_transcript_on_reattach(reload_app):
    fake = Path(__file__).with_name("fake_tui.py")
    app = reload_app(HERMES_TUI_COMMAND=f"{sys.executable} {fake}", HERMES_FORCE_PTY_SUPPORTED_FOR_TESTS="true")
    with TestClient(app) as client:
        created = client.post("/api/ui/sessions", headers={"Authorization": "Bearer test-token"}, json={"title": "Replay"}).json()
        with client.websocket_connect(f"/ws/tui/{created['id']}?token=test-token") as ws:
            assert "Hermes Fake TUI" in receive_until(ws, "Hermes Fake TUI")
        with client.websocket_connect(f"/ws/tui/{created['id']}?token=test-token") as ws:
            replay = receive_until(ws, "Hermes Fake TUI")
            assert "Hermes Fake TUI" in replay


def test_unsupported_platform_returns_pty_unsupported(reload_app):
    app = reload_app(HERMES_FORCE_PTY_SUPPORTED_FOR_TESTS="false")
    with TestClient(app) as client:
        created = client.post("/api/ui/sessions", headers={"Authorization": "Bearer test-token"}, json={}).json()
        with client.websocket_connect(f"/ws/tui/{created['id']}?token=test-token") as ws:
            status = json.loads(ws.receive_text())
            assert status["type"] == "status"
            assert status["state"] == "error"
            assert status["message"] == "pty_unsupported"


def test_broadcast_only_enqueues_active_subscribers():
    from app.pty_manager import PtyManager, RunningTui

    manager = PtyManager()
    running = RunningTui(ui_session_id="session-1", pid=1, command=["fake"])
    subscriber = manager.subscribe(running)

    manager._broadcast_nowait(running, "hello")

    assert subscriber.get_nowait() == "hello"
    assert running.output_queue.empty()
