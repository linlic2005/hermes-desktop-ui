# LAN Test

## Architecture

Server runs the official Dashboard on loopback `9119` and exposes only the authenticated Gateway on `9788`.

## Why Not Expose 9119

The official Dashboard is unauthenticated by default. LAN users could read or modify credentials if `9119` is exposed.

## Server

```sh
hermes dashboard --host 127.0.0.1 --port 9119 --no-open
cd backend
HERMES_UI_MODE=remote-server HERMES_UI_REQUIRE_TOKEN=true HERMES_UI_TOKEN="<strong-token>" uvicorn app.main:app --host 0.0.0.0 --port 9788
```

Find server IP:

```sh
hostname -I
ipconfig
```

Open firewall for `9788` only.

## Clients

Windows/macOS Tauri app:

- API Base URL: `http://<server-ip>:9788`
- WebSocket Base URL: `ws://<server-ip>:9788`
- Token: the strong token configured on the server

## Troubleshooting

- WebSocket: verify `ws://` or `wss://`, token query fallback, and firewall.
- CORS: add the frontend origin to `CORS_ALLOW_ORIGINS`.
- Token: wrong token returns `auth_failed`.
- Dashboard unavailable: verify Dashboard is running on server loopback and `HERMES_DASHBOARD_URL`.
