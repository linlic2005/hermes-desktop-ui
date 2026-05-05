import pytest
from app.schemas import RemoteSshConfig, RemoteDiscoverRequest, RemoteServiceActionRequest

def test_remote_ssh_config_validation():
    # Test valid config
    config = {
        "host": "1.2.3.4",
        "port": 22,
        "username": "user",
        "authType": "password",
        "password": "pass"
    }
    obj = RemoteSshConfig(**config)
    assert obj.host == "1.2.3.4"
    assert obj.auth_type == "password"

    # Test invalid port
    with pytest.raises(ValueError):
        RemoteSshConfig(host="1.2.3.4", port="invalid", username="u", authType="password")

def test_discover_request_camel_alias():
    req = {
        "host": "1.2.3.4",
        "username": "u",
        "authType": "password",
        "hermesHome": "/tmp/hermes",
        "dashboardPort": 8080
    }
    obj = RemoteDiscoverRequest(**req)
    assert obj.hermes_home == "/tmp/hermes"
    assert obj.dashboard_port == 8080

def test_action_request_validation():
    req = {
        "connection": {
            "host": "1.2.3.4",
            "username": "u",
            "authType": "password"
        },
        "target": "dashboard",
        "port": 9119
    }
    obj = RemoteServiceActionRequest(**req)
    assert obj.target == "dashboard"
    assert obj.connection.host == "1.2.3.4"

def test_target_whitelist():
    # Test valid target
    RemoteServiceActionRequest(
        connection={"host": "h", "username": "u", "authType": "password"},
        target="hermesGateway",
        port=8642
    )
    
    # Test invalid target
    with pytest.raises(ValueError):
        RemoteServiceActionRequest(
            connection={"host": "h", "username": "u", "authType": "password"},
            target="malicious_cmd",
            port=8642
        )
