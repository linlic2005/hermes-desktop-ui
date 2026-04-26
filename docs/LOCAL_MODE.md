# Local Mode

## Architecture

Desktop UI connects to Gateway `9788`. Gateway proxies the official Hermes Dashboard on `127.0.0.1:9119` and owns UI sessions plus `/ws/tui/{uiSessionId}` for xterm.js.

## macOS

```sh
pip install 'hermes-agent[web,pty]'
hermes dashboard --host 127.0.0.1 --port 9119 --no-open
cd backend
uvicorn app.main:app --host 127.0.0.1 --port 9788
npm run dev
```

## Windows + WSL2

Install Hermes inside WSL2, then run Dashboard and Gateway inside WSL2:

```sh
pip install 'hermes-agent[web,pty]'
hermes dashboard --host 127.0.0.1 --port 9119 --no-open
cd backend
uvicorn app.main:app --host 127.0.0.1 --port 9788
```

The Windows Tauri app usually connects to `http://127.0.0.1:9788`. If localhost forwarding fails:

```sh
hostname -I
```

Use `http://<wsl-ip>:9788` and `ws://<wsl-ip>:9788`.

## Native Windows

Native Windows PTY is experimental. By default `ptySupported=false`; use WSL2 unless `pywinpty` support is explicitly enabled and tested.

## Port Checks

macOS/Linux:

```sh
lsof -i :9788
```

Windows:

```bat
netstat -ano | findstr 9788
```

## Troubleshooting

- `127.0.0.1` connection failed: verify Gateway process and firewall, or use WSL IP.
- WebSocket failed: check `ws://` vs `wss://`, token, and LAN firewall.
- PTY unsupported: install `hermes-agent[pty]` or use WSL2.
- Node.js missing: install Node.js 22+ for frontend/Tauri tooling.
- Switch to LAN mode: run Gateway with `HERMES_UI_MODE=remote-server`, bind `0.0.0.0`, and require a strong token.
