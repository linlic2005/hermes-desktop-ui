import importlib
import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


@pytest.fixture()
def client(tmp_path, monkeypatch):
    db_path = tmp_path / "gateway.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path}")
    monkeypatch.setenv("HERMES_UI_TOKEN", "test-token")
    monkeypatch.setenv("HERMES_UI_REQUIRE_TOKEN", "true")
    monkeypatch.setenv("HERMES_UI_MODE", "local")
    monkeypatch.setenv("HERMES_UI_HOST", "127.0.0.1")
    monkeypatch.setenv("HERMES_DASHBOARD_URL", "http://127.0.0.1:65530")
    monkeypatch.setenv("HERMES_TUI_COMMAND", "")
    for name in list(sys.modules):
        if name == "app" or name.startswith("app."):
            sys.modules.pop(name)
    from app.main import app

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def auth_headers():
    return {"Authorization": "Bearer test-token"}


@pytest.fixture()
def reload_app(monkeypatch, tmp_path):
    def _reload(**env):
        db_path = tmp_path / "gateway.db"
        defaults = {
            "DATABASE_URL": f"sqlite:///{db_path}",
            "HERMES_UI_TOKEN": "test-token",
            "HERMES_UI_REQUIRE_TOKEN": "true",
            "HERMES_UI_MODE": "local",
            "HERMES_UI_HOST": "127.0.0.1",
            "HERMES_DASHBOARD_URL": "http://127.0.0.1:65530",
        }
        defaults.update(env)
        for key, value in defaults.items():
            monkeypatch.setenv(key, str(value))
        for name in list(sys.modules):
            if name == "app" or name.startswith("app."):
                sys.modules.pop(name)
        return importlib.import_module("app.main").app

    return _reload
