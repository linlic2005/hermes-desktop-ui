import httpx


class JsonClient:
    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return None

    async def request(self, method, url, **kwargs):
        url = str(url)
        if url.endswith("/api/dashboard/themes"):
            return httpx.Response(200, json={"active": "default", "themes": [{"name": "default", "label": "Hermes Teal", "description": "Dark teal + cream", "definition": None}]})
        if url.endswith("/api/dashboard/plugins"):
            return httpx.Response(200, json={"plugins": [{"name": "my-plugin", "label": "My Plugin", "description": "...", "version": "1.0.0"}]})
        if "dashboard-plugins" in url:
            return httpx.Response(200, text="body{}", headers={"content-type": "text/css"})
        return httpx.Response(200, json={"ok": True})


def test_get_dashboard_themes(client, auth_headers, monkeypatch):
    monkeypatch.setattr(httpx, "AsyncClient", JsonClient)
    response = client.get("/api/dashboard/themes", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["active"] == "default"


def test_put_dashboard_theme(client, auth_headers, monkeypatch):
    monkeypatch.setattr(httpx, "AsyncClient", JsonClient)
    response = client.put("/api/dashboard/theme", headers=auth_headers, json={"name": "midnight"})
    assert response.status_code == 200


def test_get_dashboard_plugins(client, auth_headers, monkeypatch):
    monkeypatch.setattr(httpx, "AsyncClient", JsonClient)
    response = client.get("/api/dashboard/plugins", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["plugins"][0]["name"] == "my-plugin"


def test_get_and_post_plugins_rescan(client, auth_headers, monkeypatch):
    monkeypatch.setattr(httpx, "AsyncClient", JsonClient)
    assert client.get("/api/dashboard/plugins/rescan", headers=auth_headers).status_code == 200
    assert client.post("/api/dashboard/plugins/rescan", headers=auth_headers).status_code == 200


def test_dashboard_plugin_static_asset(client, auth_headers, monkeypatch):
    monkeypatch.setattr(httpx, "AsyncClient", JsonClient)
    response = client.get("/dashboard-plugins/my-plugin/dist/style.css", headers=auth_headers)
    assert response.status_code == 200
    assert response.text == "body{}"


def test_dashboard_plugin_api_route(client, auth_headers, monkeypatch):
    monkeypatch.setattr(httpx, "AsyncClient", JsonClient)
    response = client.post("/api/plugins/my-plugin/do/work", headers=auth_headers, json={"ok": True})
    assert response.status_code == 200
    assert response.json()["ok"] is True
