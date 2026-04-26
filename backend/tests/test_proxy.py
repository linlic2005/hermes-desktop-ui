import httpx


class StubAsyncClient:
    calls = []

    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return None

    async def request(self, method, url, **kwargs):
        self.calls.append((method, str(url), kwargs))
        content = b'{"ok":true}'
        headers = {"content-type": "application/json"}
        if "dashboard-plugins" in str(url):
            content = b"console.log('plugin')"
            headers = {"content-type": "application/javascript"}
        return httpx.Response(200, content=content, headers=headers)


def test_official_dashboard_endpoints_are_whitelisted(client, auth_headers, monkeypatch):
    StubAsyncClient.calls = []
    monkeypatch.setattr(httpx, "AsyncClient", StubAsyncClient)
    endpoints = [
        "/api/status",
        "/api/sessions",
        "/api/sessions/search?q=a",
        "/api/sessions/s1",
        "/api/sessions/s1/messages",
        "/api/config",
        "/api/config/defaults",
        "/api/config/schema",
        "/api/model/info",
        "/api/config/raw",
        "/api/env",
        "/api/logs?lines=10&level=INFO",
        "/api/analytics/usage?days=7",
        "/api/cron/jobs",
        "/api/skills",
        "/api/tools/toolsets",
        "/api/dashboard/themes",
        "/api/dashboard/plugins",
        "/api/dashboard/plugins/rescan",
    ]
    for endpoint in endpoints:
        response = client.get(endpoint, headers=auth_headers)
        assert response.status_code == 200, endpoint


def test_unknown_api_path_rejected(client, auth_headers):
    response = client.get("/api/unknown/path", headers=auth_headers)
    assert response.status_code == 403
    assert response.json()["error"] == "proxy_path_not_allowed"


def test_dashboard_unavailable_returns_dashboard_unavailable(client, auth_headers):
    response = client.get("/api/status", headers=auth_headers)
    assert response.status_code == 503
    assert response.json()["error"] == "dashboard_unavailable"


def test_query_body_and_content_type_forwarded(client, auth_headers, monkeypatch):
    StubAsyncClient.calls = []
    monkeypatch.setattr(httpx, "AsyncClient", StubAsyncClient)
    response = client.post(
        "/api/cron/jobs?dryRun=true",
        headers={**auth_headers, "Content-Type": "application/json"},
        json={"prompt": "hi", "schedule": "0 9 * * *"},
    )
    assert response.status_code == 200
    method, url, kwargs = StubAsyncClient.calls[-1]
    assert method == "POST"
    assert "dryRun=true" in url
    assert kwargs["content"]
    assert kwargs["headers"]["content-type"] == "application/json"


def test_authorization_header_not_forwarded(client, auth_headers, monkeypatch):
    StubAsyncClient.calls = []
    monkeypatch.setattr(httpx, "AsyncClient", StubAsyncClient)
    client.get("/api/status", headers=auth_headers)
    headers = StubAsyncClient.calls[-1][2]["headers"]
    assert "authorization" not in headers
    assert "x-hermes-ui-token" not in headers
    assert "host" not in headers


def test_non_json_plugin_asset_response_works(client, auth_headers, monkeypatch):
    monkeypatch.setattr(httpx, "AsyncClient", StubAsyncClient)
    response = client.get("/dashboard-plugins/demo/dist/index.js", headers=auth_headers)
    assert response.status_code == 200
    assert response.text == "console.log('plugin')"
    assert "javascript" in response.headers["content-type"]
