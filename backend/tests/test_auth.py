from fastapi.testclient import TestClient


def test_health_does_not_require_auth(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["gateway"] == "running"


def test_missing_token_returns_401(client):
    response = client.get("/api/server/info")
    assert response.status_code == 401
    assert response.json()["error"] == "auth_failed"


def test_wrong_token_returns_401(client):
    response = client.get("/api/server/info", headers={"Authorization": "Bearer wrong"})
    assert response.status_code == 401
    assert response.json()["error"] == "auth_failed"


def test_correct_token_returns_200(client, auth_headers):
    response = client.get("/api/server/info", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["mode"] == "local"
