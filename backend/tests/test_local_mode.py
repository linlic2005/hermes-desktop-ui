def test_local_discover(client, auth_headers):
    response = client.get("/api/local/discover", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["mode"] == "local"
    assert body["gateway"]["available"] is True
    assert "pip install 'hermes-agent[web,pty]'" in body["suggestedCommands"]


def test_dashboard_unavailable_reported_in_discover(client, auth_headers):
    body = client.get("/api/local/discover", headers=auth_headers).json()
    assert body["dashboard"]["available"] is False


def test_hermes_and_node_availability_shapes(client, auth_headers):
    body = client.get("/api/local/discover", headers=auth_headers).json()
    assert "available" in body["hermesCommand"]
    assert "available" in body["node"]


def test_start_dashboard_already_running(client, auth_headers, monkeypatch):
    from app.routers import local as local_router

    monkeypatch.setattr(local_router.local_manager, "dashboard_available", lambda: True)
    response = client.post("/api/local/start-dashboard", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["status"] == "already_running"


def test_stop_dashboard_only_stops_managed_process(client, auth_headers):
    response = client.post("/api/local/stop-dashboard", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["status"] in {"not_running", "stopped"}
