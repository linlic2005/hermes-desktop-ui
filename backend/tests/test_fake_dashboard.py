from fastapi.testclient import TestClient

from tests.fake_dashboard import app


def test_fake_dashboard_status_contains_realistic_data():
    with TestClient(app) as client:
        body = client.get("/api/status").json()
    assert body["version"] == "fake-0.0.1"
    assert body["gateway"]["status"] == "running"
    assert body["gateway"]["pid"] == 12345
    assert len(body["gateway"]["platforms"]) >= 2
    assert body["activeSessions"] == 1
    assert len(body["recentSessions"]) >= 3
    assert any(session["live"] for session in body["recentSessions"])


def test_fake_dashboard_sessions_include_tool_calls():
    with TestClient(app) as client:
        sessions = client.get("/api/sessions").json()["sessions"]
        messages = client.get("/api/sessions/session-live/messages").json()["messages"]
    assert len(sessions) >= 3
    assert any(session["toolCallCount"] > 0 for session in sessions)
    assert any(message.get("tool_calls") for message in messages)


def test_fake_dashboard_themes_and_plugins_match_official_baseline():
    with TestClient(app) as client:
        themes = client.get("/api/dashboard/themes").json()["themes"]
        plugins = client.get("/api/dashboard/plugins").json()["plugins"]
        js = client.get("/dashboard-plugins/demo-plugin/dist/index.js")
        data = client.get("/api/plugins/demo-plugin/data").json()
    assert [theme["name"] for theme in themes] == ["default", "midnight", "ember", "mono", "cyberpunk", "rose"]
    assert any(plugin["tabs"][0].get("hidden") for plugin in plugins)
    assert any(plugin["tabs"][0].get("override") for plugin in plugins)
    assert js.status_code == 200
    assert data["items"]
