# Security

## Threat Model

The Gateway protects an unauthenticated local Hermes Dashboard from LAN clients. Attackers may be on the same LAN, may guess weak tokens, and may attempt plugin path traversal or secret leakage.

## Token Policy

Remote-server mode and `0.0.0.0` binds require a token. Default weak tokens such as `change-me` are rejected for LAN-facing modes.

## Dashboard 9119 Risk

The official Dashboard defaults to no authentication. Keep `9119` bound to `127.0.0.1`.

## Gateway 9788 Exposure

Expose only Gateway `9788` to LAN clients and require a strong token. Do not expose Gateway directly to the public internet without an HTTPS reverse proxy and network allow-list.

## Plugin Static/API Risk

`/dashboard-plugins/*` and `/api/plugins/*` are authenticated. Plugin names and paths are validated to block traversal. Desktop UI displays plugin metadata and assets but does not execute plugin JavaScript by default.

## Secret Redaction

Audit logs redact token, secret, password, API key, and authorization-like keys. Env values are redacted in UI unless reveal is supported and explicitly confirmed.

## Audit Log

Dangerous Gateway mutations, plugin API mutations, local dashboard start/stop, and UI session deletes are audited.

## CORS

Use `CORS_ALLOW_ORIGINS` to restrict browser origins. Include Tauri and local dev origins only as needed.

## HTTPS Reverse Proxy

For untrusted networks, place Gateway behind HTTPS and use `wss://` WebSocket URLs. Keep upstream Dashboard on loopback.

## WSL2

Prefer WSL2 for Windows PTY/TUI. If localhost forwarding fails, connect to the WSL IP from `hostname -I`.
