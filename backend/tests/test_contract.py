from __future__ import annotations

from urllib.parse import urlsplit

import httpx
from fastapi.testclient import TestClient

from tests.fake_dashboard import app as fake_dashboard_app


class FakeDashboardAsyncClient:
    calls: list[tuple[str, str, dict]] = []

    def __init__(self, *args, **kwargs):
        self.client = TestClient(fake_dashboard_app)

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        self.client.close()
        return None

    async def request(self, method, url, **kwargs):
        self.calls.append((method, str(url), kwargs))
        parsed = urlsplit(str(url))
        target = parsed.path + (f"?{parsed.query}" if parsed.query else "")
        response = self.client.request(
            method,
            target,
            content=kwargs.get("content"),
            headers=kwargs.get("headers"),
        )
        return httpx.Response(
            response.status_code,
            content=response.content,
            headers=dict(response.headers),
            request=httpx.Request(method, str(url)),
        )


def assert_error_shape(body: dict, error: str | None = None) -> None:
    assert set(["error", "message", "details"]).issubset(body)
    if error:
        assert body["error"] == error


def install_fake_dashboard(monkeypatch) -> None:
    FakeDashboardAsyncClient.calls = []
    monkeypatch.setattr(httpx, "AsyncClient", FakeDashboardAsyncClient)


def test_health_contract(client):
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    for key in [
        "ok",
        "gateway",
        "mode",
        "localMode",
        "hermesDashboard",
        "hermesCommandAvailable",
        "ptySupported",
        "nativeWindowsExperimental",
        "version",
        "time",
        "message",
    ]:
        assert key in body


def test_protected_endpoints_require_token(client):
    protected = [
        "/api/server/info",
        "/api/local/discover",
        "/api/status",
        "/api/sessions",
        "/api/config",
        "/api/env",
        "/api/logs",
        "/api/analytics/usage",
        "/api/cron/jobs",
        "/api/skills",
        "/api/tools/toolsets",
        "/api/dashboard/themes",
        "/api/dashboard/plugins",
        "/api/ui/sessions",
        "/dashboard-plugins/demo-plugin/dist/index.js",
        "/api/plugins/demo-plugin/data",
    ]
    for endpoint in protected:
        response = client.get(endpoint)
        assert response.status_code == 401, endpoint
        assert_error_shape(response.json(), "auth_failed")


def test_local_and_server_contracts(client, auth_headers):
    server = client.get("/api/server/info", headers=auth_headers)
    assert server.status_code == 200
    for key in [
        "serverName",
        "mode",
        "os",
        "platform",
        "python",
        "hermesCommand",
        "dashboardUrl",
        "gatewayUrl",
        "ptySupported",
        "nativeWindowsExperimental",
        "wslDetected",
    ]:
        assert key in server.json()

    discover = client.get("/api/local/discover", headers=auth_headers)
    assert discover.status_code == 200
    assert {"gateway", "dashboard", "hermesCommand", "pty", "node", "suggestedCommands"}.issubset(discover.json())
    assert client.post("/api/local/start-dashboard", headers=auth_headers).status_code == 200
    assert client.post("/api/local/stop-dashboard", headers=auth_headers).status_code == 200
    assert isinstance(client.get("/api/local/processes", headers=auth_headers).json(), list)


def test_official_dashboard_contract_endpoints_success(client, auth_headers, monkeypatch):
    install_fake_dashboard(monkeypatch)
    calls = [
        ("GET", "/api/status", None, ["version", "gateway", "activeSessions", "recentSessions"]),
        ("GET", "/api/sessions", None, ["sessions"]),
        ("GET", "/api/sessions/session-live", None, ["id", "title", "model"]),
        ("GET", "/api/sessions/session-live/messages", None, ["messages"]),
        ("GET", "/api/sessions/search?q=tool", None, ["sessions"]),
        ("DELETE", "/api/sessions/session-docs", None, ["status", "id"]),
        ("GET", "/api/config", None, ["model", "terminal"]),
        ("GET", "/api/config/defaults", None, ["model"]),
        ("GET", "/api/config/schema", None, ["properties"]),
        ("PUT", "/api/config", {"config": {"model": {"default": "gpt-5.2"}}}, ["status", "config"]),
        ("GET", "/api/model/info", None, ["provider", "model"]),
        ("PUT", "/api/config/raw", "model: test", ["status", "bytes"]),
        ("GET", "/api/env", None, ["items"]),
        ("PUT", "/api/env", {"key": "OPENAI_API_KEY", "value": "secret"}, ["status", "key"]),
        ("DELETE", "/api/env?key=OPENAI_API_KEY", None, ["status", "key"]),
        ("GET", "/api/logs?file=agent&lines=100&level=ALL&component=all", None, ["logs"]),
        ("GET", "/api/analytics/usage?days=30", None, ["summary", "daily", "models"]),
        ("GET", "/api/cron/jobs", None, ["jobs"]),
        ("POST", "/api/cron/jobs", {"name": "test", "prompt": "hi", "schedule": "0 9 * * *"}, ["id", "state"]),
        ("POST", "/api/cron/jobs/job-enabled/pause", None, ["id", "state"]),
        ("POST", "/api/cron/jobs/job-paused/resume", None, ["id", "state"]),
        ("POST", "/api/cron/jobs/job-enabled/trigger", None, ["id", "status"]),
        ("DELETE", "/api/cron/jobs/job-enabled", None, ["id", "status"]),
        ("GET", "/api/skills", None, ["skills"]),
        ("PUT", "/api/skills/toggle", {"name": "deploy", "enabled": True}, ["name", "enabled"]),
        ("GET", "/api/tools/toolsets", None, ["toolsets"]),
        ("POST", "/api/gateway/restart", None, ["status"]),
        ("GET", "/api/actions/gateway.restart/status", None, ["name", "status", "supported"]),
        ("GET", "/api/dashboard/themes", None, ["active", "themes"]),
        ("PUT", "/api/dashboard/theme", {"name": "midnight"}, ["active", "status"]),
        ("GET", "/api/dashboard/plugins", None, ["plugins"]),
        ("GET", "/api/dashboard/plugins/rescan", None, ["status", "plugins"]),
        ("POST", "/api/dashboard/plugins/rescan", None, ["status", "plugins"]),
        ("GET", "/api/plugins/demo-plugin/data", None, ["items"]),
        ("POST", "/api/plugins/demo-plugin/action", {"ok": True}, ["status", "payload"]),
    ]
    for method, endpoint, payload, required_keys in calls:
        response = client.request(method, endpoint, headers=auth_headers, json=payload if isinstance(payload, dict) else None, content=payload if isinstance(payload, str) else None)
        assert response.status_code == 200, f"{method} {endpoint}: {response.text}"
        body = response.json()
        for key in required_keys:
            assert key in body, f"{method} {endpoint} missing {key}"


def test_non_json_official_responses_and_plugin_assets(client, auth_headers, monkeypatch):
    install_fake_dashboard(monkeypatch)
    raw = client.get("/api/config/raw", headers=auth_headers)
    assert raw.status_code == 200
    assert "model:" in raw.text
    assert raw.headers["content-type"].startswith("text/plain")

    js = client.get("/dashboard-plugins/demo-plugin/dist/index.js", headers=auth_headers)
    assert js.status_code == 200
    assert "demoPlugin" in js.text
    assert "javascript" in js.headers["content-type"]

    css = client.get("/dashboard-plugins/demo-plugin/dist/style.css", headers=auth_headers)
    assert css.status_code == 200
    assert ".demo-plugin" in css.text
    assert "text/css" in css.headers["content-type"]


def test_dashboard_unavailable_contract_shape(client, auth_headers):
    response = client.get("/api/status", headers=auth_headers)
    assert response.status_code == 503
    assert_error_shape(response.json(), "dashboard_unavailable")


def test_not_supported_contract_shape(client, auth_headers, monkeypatch):
    install_fake_dashboard(monkeypatch)
    reveal = client.post("/api/env/reveal", headers=auth_headers, json={"key": "OPENAI_API_KEY"})
    assert reveal.status_code == 404
    assert_error_shape(reveal.json(), "not_supported")

    pty = client.get("/api/pty", headers=auth_headers)
    assert pty.status_code == 404
    assert_error_shape(pty.json(), "not_supported")


def test_ui_sessions_contract(client, auth_headers):
    created = client.post(
        "/api/ui/sessions",
        headers=auth_headers,
        json={"title": "Contract", "resumeOfficialSessionId": "session-live", "continueLatest": True},
    )
    assert created.status_code == 200
    body = created.json()
    for key in ["id", "title", "status", "resumeOfficialSessionId", "continueLatest"]:
        assert key in body

    session_id = body["id"]
    assert isinstance(client.get("/api/ui/sessions", headers=auth_headers).json(), list)
    assert client.get(f"/api/ui/sessions/{session_id}", headers=auth_headers).json()["id"] == session_id
    patched = client.patch(f"/api/ui/sessions/{session_id}", headers=auth_headers, json={"favorite": True})
    assert patched.json()["favorite"] is True
    transcript = client.get(f"/api/ui/sessions/{session_id}/transcript", headers=auth_headers)
    assert {"uiSessionId", "rawAnsi", "plainText", "chunks"}.issubset(transcript.json())
    assert client.delete(f"/api/ui/sessions/{session_id}", headers=auth_headers).status_code == 200


def test_network_error_does_not_crash_gateway(client, auth_headers):
    response = client.get("/api/analytics/usage?days=30", headers=auth_headers)
    assert response.status_code == 503
    assert_error_shape(response.json(), "dashboard_unavailable")
