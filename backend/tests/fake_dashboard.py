from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, PlainTextResponse, Response


app = FastAPI(title="Fake Hermes Dashboard", version="fake-0.0.1")

NOW = datetime(2026, 4, 1, 12, 0, tzinfo=timezone.utc)


def iso(minutes_ago: int = 0) -> str:
    return (NOW - timedelta(minutes=minutes_ago)).isoformat()


SESSIONS: list[dict[str, Any]] = [
    {
        "id": "session-live",
        "title": "Live planning session",
        "platform": "cli",
        "source": "TUI",
        "model": "gpt-5.2",
        "messageCount": 6,
        "toolCallCount": 2,
        "tokenCount": 9240,
        "lastActive": iso(2),
        "preview": "Review dashboard parity and open tool calls.",
        "live": True,
    },
    {
        "id": "session-tools",
        "title": "Tool heavy automation",
        "platform": "telegram",
        "source": "Telegram",
        "model": "gpt-5.4",
        "messageCount": 9,
        "toolCallCount": 4,
        "tokenCount": 15120,
        "lastActive": iso(45),
        "preview": "Collected logs and restarted the gateway.",
        "live": False,
    },
    {
        "id": "session-docs",
        "title": "Docs cleanup",
        "platform": "cli",
        "source": "CLI",
        "model": "gpt-5.4-mini",
        "messageCount": 4,
        "toolCallCount": 0,
        "tokenCount": 4200,
        "lastActive": iso(180),
        "preview": "Document local and LAN mode diagnostics.",
        "live": False,
    },
]

MESSAGES: dict[str, list[dict[str, Any]]] = {
    "session-live": [
        {"id": "m1", "role": "user", "content": "Check status", "timestamp": iso(8)},
        {
            "id": "m2",
            "role": "assistant",
            "content": "Gateway is running and cli is connected.",
            "timestamp": iso(7),
            "tool_calls": [
                {"id": "tc1", "type": "function", "function": {"name": "get_status", "arguments": "{}"}},
                {"id": "tc2", "type": "function", "function": {"name": "list_sessions", "arguments": "{}"}},
            ],
        },
        {"id": "m3", "role": "tool", "content": "{\"status\":\"running\"}", "timestamp": iso(6)},
    ],
    "session-tools": [
        {"id": "m4", "role": "user", "content": "Restart gateway", "timestamp": iso(48)},
        {"id": "m5", "role": "assistant", "content": "Restart queued.", "timestamp": iso(47)},
    ],
    "session-docs": [
        {"id": "m6", "role": "user", "content": "Write docs", "timestamp": iso(181)},
        {"id": "m7", "role": "assistant", "content": "Drafted local mode notes.", "timestamp": iso(180)},
    ],
}

CONFIG = {
    "model": {"provider": "openai", "default": "gpt-5.2"},
    "terminal": {"backend": "pty", "scrollback": 5000},
    "display": {"theme": "default", "tui_colors": True},
    "agent": {"max_iterations": 12},
    "delegation": {"enabled": True},
    "memory": {"enabled": False},
    "approvals": {"dangerous_actions": "ask"},
    "dashboard": {"theme": "default"},
}

CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "model": {
            "type": "object",
            "properties": {
                "provider": {"type": "string", "enum": ["openai", "anthropic", "google"]},
                "default": {"type": "string"},
            },
        },
        "terminal": {
            "type": "object",
            "properties": {
                "backend": {"type": "string", "enum": ["pty", "pipe"]},
                "scrollback": {"type": "number"},
            },
        },
        "display": {
            "type": "object",
            "properties": {
                "theme": {"type": "string", "enum": ["default", "midnight", "ember", "mono", "cyberpunk", "rose"]},
                "tui_colors": {"type": "boolean"},
            },
        },
        "agent": {"type": "object", "properties": {"max_iterations": {"type": "number"}}},
        "delegation": {"type": "object", "properties": {"enabled": {"type": "boolean"}}},
        "memory": {"type": "object", "properties": {"enabled": {"type": "boolean"}}},
        "approvals": {"type": "object", "properties": {"dangerous_actions": {"type": "string", "enum": ["ask", "deny", "allow"]}}},
        "dashboard": {"type": "object", "properties": {"theme": {"type": "string"}}},
    },
}

THEMES = [
    {"name": "default", "label": "Hermes Teal", "description": "Default Hermes teal theme", "definition": {"palette": {"accent": "#14b8a6"}}},
    {"name": "midnight", "label": "Midnight", "description": "Low contrast dark theme", "definition": {"palette": {"accent": "#6366f1"}}},
    {"name": "ember", "label": "Ember", "description": "Warm dark theme", "definition": {"palette": {"accent": "#f97316"}}},
    {"name": "mono", "label": "Mono", "description": "Monochrome theme", "definition": {"palette": {"accent": "#71717a"}}},
    {"name": "cyberpunk", "label": "Cyberpunk", "description": "High contrast neon theme", "definition": {"palette": {"accent": "#e879f9"}}},
    {"name": "rose", "label": "Rosé", "description": "Rose accent theme", "definition": {"palette": {"accent": "#fb7185"}}},
]

PLUGINS = [
    {
        "id": "demo-plugin",
        "name": "demo-plugin",
        "label": "Demo Plugin",
        "description": "Tab plugin with assets and backend routes",
        "version": "1.0.0",
        "source": "user",
        "status": "active",
        "tabs": [{"id": "demo", "label": "Demo", "path": "/plugins/demo", "hidden": False, "override": False}],
        "slots": [{"name": "sessions:top", "component": "DemoSessionsTop"}],
        "manifest": {"name": "demo-plugin", "dashboard": {"assets": ["dist/index.js", "dist/style.css"]}},
    },
    {
        "id": "slot-only",
        "name": "slot-only",
        "label": "Slot Only",
        "description": "Plugin without visible tab",
        "version": "1.0.0",
        "source": "user",
        "status": "active",
        "tabs": [{"id": "hidden", "label": "Hidden", "hidden": True, "override": False}],
        "slots": [{"name": "chat:bottom", "component": "SlotOnlyFooter"}],
        "manifest": {"name": "slot-only", "dashboard": {"tab": {"hidden": True}}},
    },
    {
        "id": "replacement",
        "name": "replacement",
        "label": "Replacement",
        "description": "Demonstrates tab override warning",
        "version": "1.0.0",
        "source": "project",
        "status": "active",
        "tabs": [{"id": "sessions", "label": "Sessions", "hidden": False, "override": True}],
        "slots": [],
        "manifest": {"name": "replacement", "dashboard": {"tab": {"override": True}}},
    },
]


@app.get("/api/status")
def status() -> dict[str, Any]:
    return {
        "version": "fake-0.0.1",
        "releaseDate": "2026-04-01",
        "gateway": {
            "status": "running",
            "pid": 12345,
            "mode": "local",
            "host": "127.0.0.1",
            "port": 9788,
            "platforms": [
                {"name": "cli", "state": "connected", "configured": True},
                {"name": "telegram", "state": "disconnected", "configured": False},
            ],
        },
        "activeSessions": 1,
        "recentSessions": deepcopy(SESSIONS),
    }


@app.get("/api/sessions")
def sessions() -> dict[str, Any]:
    return {"sessions": deepcopy(SESSIONS)}


@app.get("/api/sessions/search")
def search_sessions(q: str = "") -> dict[str, Any]:
    lower = q.lower()
    items = [s for s in SESSIONS if lower in s["title"].lower() or lower in s["preview"].lower()]
    return {"sessions": deepcopy(items), "query": q, "snippets": {s["id"]: f"...{q or s['title']}..." for s in items}}


@app.get("/api/sessions/{session_id}")
def session(session_id: str) -> dict[str, Any]:
    for item in SESSIONS:
        if item["id"] == session_id:
            return deepcopy(item)
    raise HTTPException(status_code=404, detail="Session not found")


@app.get("/api/sessions/{session_id}/messages")
def session_messages(session_id: str) -> dict[str, Any]:
    return {"messages": deepcopy(MESSAGES.get(session_id, []))}


@app.delete("/api/sessions/{session_id}")
def delete_session(session_id: str) -> dict[str, Any]:
    return {"status": "deleted", "id": session_id}


@app.get("/api/config")
def config() -> dict[str, Any]:
    return deepcopy(CONFIG)


@app.get("/api/config/defaults")
def config_defaults() -> dict[str, Any]:
    return deepcopy(CONFIG)


@app.get("/api/config/schema")
def config_schema() -> dict[str, Any]:
    return deepcopy(CONFIG_SCHEMA)


@app.put("/api/config")
async def put_config(request: Request) -> dict[str, Any]:
    payload = await request.json()
    return {"status": "saved", "config": payload.get("config", payload)}


@app.get("/api/model/info")
def model_info() -> dict[str, Any]:
    return {"provider": "openai", "model": "gpt-5.2", "available": True}


@app.get("/api/config/raw")
def config_raw() -> PlainTextResponse:
    return PlainTextResponse("model:\n  default: gpt-5.2\n")


@app.put("/api/config/raw")
async def put_config_raw(request: Request) -> dict[str, Any]:
    return {"status": "saved", "bytes": len(await request.body())}


@app.get("/api/env")
def env() -> dict[str, Any]:
    return {
        "items": [
            {"key": "OPENAI_API_KEY", "category": "LLM Providers", "set": True, "redacted": "sk-...1234", "description": "OpenAI API key"},
            {"key": "ANTHROPIC_API_KEY", "category": "LLM Providers", "set": False, "redacted": None, "description": "Anthropic API key"},
            {"key": "GITHUB_TOKEN", "category": "Tool API Keys", "set": True, "redacted": "ghp_...abcd"},
            {"key": "TELEGRAM_BOT_TOKEN", "category": "Messaging Platforms", "set": False},
            {"key": "HERMES_AGENT_MODE", "category": "Agent Settings", "set": True, "redacted": "local"},
            {"key": "EXPERIMENTAL_FLAG", "category": "Advanced", "set": False},
        ]
    }


@app.put("/api/env")
async def put_env(request: Request) -> dict[str, Any]:
    payload = await request.json()
    return {"status": "saved", "key": payload.get("key")}


@app.delete("/api/env")
def delete_env(key: str = "") -> dict[str, Any]:
    return {"status": "deleted", "key": key}


@app.get("/api/logs")
def logs(file: str = "agent", lines: int = 100, level: str = "ALL", component: str = "all") -> dict[str, Any]:
    items = [
        {"timestamp": iso(5), "level": "INFO", "component": "agent", "message": "Agent started"},
        {"timestamp": iso(4), "level": "WARNING", "component": "gateway", "message": "Dashboard latency high"},
        {"timestamp": iso(3), "level": "ERROR", "component": "telegram", "message": "Token missing"},
        {"timestamp": iso(2), "level": "DEBUG", "component": "pty", "message": "Resize 120x32"},
        {"timestamp": iso(1), "level": "INFO", "component": "gateway", "message": f"Serving {file} logs"},
    ]
    if level != "ALL":
        items = [item for item in items if item["level"] == level]
    if component != "all":
        items = [item for item in items if item["component"] == component]
    return {"logs": items[-lines:]}


@app.get("/api/analytics/usage")
def analytics(days: int = 30) -> dict[str, Any]:
    daily = [
        {"date": f"2026-04-{day:02d}", "inputTokens": day * 100, "outputTokens": day * 80, "totalTokens": day * 180, "cost": day / 100}
        for day in range(1, min(days, 7) + 1)
    ]
    return {
        "summary": {"inputTokens": 2800, "outputTokens": 2240, "totalTokens": 5040, "cost": 0.28, "sessions": 3},
        "daily": daily,
        "models": [
            {"model": "gpt-5.2", "inputTokens": 1600, "outputTokens": 1200, "totalTokens": 2800, "cost": 0.18},
            {"model": "gpt-5.4-mini", "inputTokens": 1200, "outputTokens": 1040, "totalTokens": 2240, "cost": 0.10},
        ],
    }


@app.get("/api/cron/jobs")
def cron_jobs() -> dict[str, Any]:
    return {
        "jobs": [
            {"id": "job-enabled", "name": "Morning summary", "prompt": "Summarize", "schedule": "0 9 * * *", "state": "enabled", "nextRun": iso(-60)},
            {"id": "job-paused", "name": "Weekly cleanup", "prompt": "Clean", "schedule": "0 10 * * 1", "state": "paused"},
            {"id": "job-error", "name": "Broken job", "prompt": "Fail", "schedule": "bad cron", "state": "error"},
        ]
    }


@app.post("/api/cron/jobs")
async def create_cron_job(request: Request) -> dict[str, Any]:
    payload = await request.json()
    return {"id": "job-created", "state": "enabled", **payload}


@app.post("/api/cron/jobs/{job_id}/pause")
def pause_job(job_id: str) -> dict[str, Any]:
    return {"id": job_id, "state": "paused"}


@app.post("/api/cron/jobs/{job_id}/resume")
def resume_job(job_id: str) -> dict[str, Any]:
    return {"id": job_id, "state": "enabled"}


@app.post("/api/cron/jobs/{job_id}/trigger")
def trigger_job(job_id: str) -> dict[str, Any]:
    return {"id": job_id, "status": "triggered"}


@app.delete("/api/cron/jobs/{job_id}")
def delete_job(job_id: str) -> dict[str, Any]:
    return {"id": job_id, "status": "deleted"}


@app.get("/api/skills")
def skills() -> dict[str, Any]:
    return {
        "skills": [
            {"id": "code-review", "name": "code-review", "description": "Review code", "category": "Engineering", "enabled": True, "source": "bundled"},
            {"id": "docs", "name": "docs", "description": "Write docs", "category": "Writing", "enabled": True, "source": "bundled"},
            {"id": "deploy", "name": "deploy", "description": "Deploy services", "category": "Operations", "enabled": False, "source": "user"},
        ]
    }


@app.put("/api/skills/toggle")
async def toggle_skill(request: Request) -> dict[str, Any]:
    payload = await request.json()
    return {"name": payload.get("name"), "enabled": payload.get("enabled")}


@app.get("/api/tools/toolsets")
def toolsets() -> dict[str, Any]:
    return {
        "toolsets": [
            {"id": "core", "name": "Core", "label": "Core", "description": "Core tools", "tools": ["read", "write"], "active": True, "configured": True},
            {"id": "github", "name": "GitHub", "label": "GitHub", "description": "GitHub tools", "tools": ["issues", "pulls"], "active": False, "configured": False, "setupRequirements": ["GITHUB_TOKEN"]},
            {"id": "messaging", "name": "Messaging", "label": "Messaging", "description": "Platform tools", "tools": ["telegram"], "active": True, "configured": False, "setupRequirements": ["TELEGRAM_BOT_TOKEN"]},
        ]
    }


@app.post("/api/gateway/restart")
def restart_gateway() -> dict[str, Any]:
    return {"status": "not_supported", "error": "not_supported", "message": "Restart is not supported by fake dashboard"}


@app.get("/api/actions/{name}/status")
def action_status(name: str) -> dict[str, Any]:
    return {"name": name, "status": "idle", "supported": name != "gateway.restart"}


@app.get("/api/dashboard/themes")
def dashboard_themes() -> dict[str, Any]:
    return {"active": "default", "themes": deepcopy(THEMES)}


@app.put("/api/dashboard/theme")
async def dashboard_theme(request: Request) -> dict[str, Any]:
    payload = await request.json()
    return {"active": payload.get("name", "default"), "status": "saved"}


@app.get("/api/dashboard/plugins")
def dashboard_plugins() -> dict[str, Any]:
    return {"plugins": deepcopy(PLUGINS)}


@app.get("/api/dashboard/plugins/rescan")
@app.post("/api/dashboard/plugins/rescan")
def rescan_plugins() -> dict[str, Any]:
    return {"status": "rescanned", "plugins": deepcopy(PLUGINS)}


@app.get("/dashboard-plugins/demo-plugin/dist/index.js")
def plugin_js() -> Response:
    return Response("window.__demoPlugin = true;", media_type="application/javascript")


@app.get("/dashboard-plugins/demo-plugin/dist/style.css")
def plugin_css() -> Response:
    return Response(".demo-plugin{color:#14b8a6}", media_type="text/css")


@app.api_route("/api/plugins/demo-plugin/data", methods=["GET"])
def plugin_data() -> dict[str, Any]:
    return {"items": [{"id": "demo", "value": 1}]}


@app.api_route("/api/plugins/demo-plugin/action", methods=["POST"])
async def plugin_action(request: Request) -> JSONResponse:
    return JSONResponse({"status": "ok", "payload": await request.json()})


@app.api_route("/api/plugins/{plugin_name}/{plugin_path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def plugin_fallback(plugin_name: str, plugin_path: str, request: Request) -> dict[str, Any]:
    return {"plugin": plugin_name, "path": plugin_path, "method": request.method}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=9119)
