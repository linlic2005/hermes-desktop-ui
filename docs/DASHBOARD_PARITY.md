# Dashboard Parity

## Implemented Parity

- Status: version, release date, gateway, PID, platforms, active and recent sessions.
- Chat: xterm.js over Gateway `/ws/tui/{uiSessionId}`, resume and continue payloads.
- Config: schema-driven tabs and save/reset/import/export flow.
- API Keys / Env: redaction, set/delete/reveal handling, `not_supported` reveal state.
- Sessions: list, search, messages, tool calls, resume, delete.
- Logs: file, level, component, lines, auto-refresh, copy, download.
- Analytics: 7/30/90 day summary, chart, daily table, per-model table.
- Cron: list, create, validate, pause, resume, trigger, delete.
- Skills: list, search, filters, toggle, detail drawer.
- Toolsets: read-only active/configured/setup state and tools list.
- Themes: six built-in themes and apply endpoint.
- Plugins: list, manifest, slots, rescan, static asset/API probes.
- Gateway/Platforms: mode, bind, status, platforms, restart capability.

## Known Deviations

- Desktop UI does not execute untrusted plugin JavaScript by default.
- Native Windows PTY is experimental and disabled by default.
- Official `/api/pty` differs from Gateway `/ws/tui/{uiSessionId}`; Gateway returns `not_supported` for compatibility `/api/pty`.

## Not Implemented

- Secure OS keychain storage for tokens is reserved for a future Tauri integration.
- Signed macOS release automation is not included.
