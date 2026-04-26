import logging

import pytest
from fastapi.testclient import TestClient


def test_remote_mode_cannot_disable_token(reload_app):
    with pytest.raises(RuntimeError, match="remote_mode_token_required"):
        reload_app(HERMES_UI_MODE="remote-server", HERMES_UI_REQUIRE_TOKEN="false")


def test_host_any_cannot_disable_token(reload_app):
    with pytest.raises(RuntimeError, match="unsafe_bind_without_token"):
        reload_app(HERMES_UI_MODE="local", HERMES_UI_HOST="0.0.0.0", HERMES_UI_REQUIRE_TOKEN="false")


def test_remote_or_lan_bind_rejects_default_token(reload_app):
    with pytest.raises(RuntimeError, match="weak_token_not_allowed"):
        reload_app(HERMES_UI_MODE="remote-server", HERMES_UI_TOKEN="change-me")
    with pytest.raises(RuntimeError, match="weak_token_not_allowed"):
        reload_app(HERMES_UI_MODE="local", HERMES_UI_HOST="0.0.0.0", HERMES_UI_TOKEN="change-me")


def test_local_token_disabled_only_allowed_on_loopback(reload_app):
    app = reload_app(HERMES_UI_MODE="local", HERMES_UI_HOST="127.0.0.1", HERMES_UI_REQUIRE_TOKEN="false")
    with TestClient(app) as client:
        response = client.get("/api/server/info")
    assert response.status_code == 200


def test_no_token_leakage_in_audit_logs(client, auth_headers, caplog):
    caplog.set_level(logging.INFO)
    response = client.post("/api/local/start-dashboard", headers={**auth_headers, "X-Api-Key": "super-secret"})
    assert response.status_code in {200, 500}
    assert "test-token" not in caplog.text
    assert "super-secret" not in caplog.text


def test_plugin_path_traversal_blocked(client, auth_headers):
    response = client.get("/dashboard-plugins/good/%2e%2e/secret.js", headers=auth_headers)
    assert response.status_code == 400
    assert response.json()["error"] == "plugin_path_invalid"


def test_arbitrary_proxy_url_blocked(client, auth_headers):
    response = client.get("/api/proxy?url=http://example.com", headers=auth_headers)
    assert response.status_code == 403
    assert response.json()["error"] == "proxy_path_not_allowed"


def test_documented_dev_origin_allowed_by_default(client):
    response = client.options(
        "/api/server/info",
        headers={
            "Origin": "http://127.0.0.1:3000",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:3000"
