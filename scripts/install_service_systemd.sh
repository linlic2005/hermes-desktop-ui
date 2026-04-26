#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="${SERVICE_NAME:-hermes-ui-gateway}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="${ROOT_DIR}/backend"
USER_NAME="${USER:-$(id -un)}"
HOST="${HERMES_UI_HOST:-127.0.0.1}"
PORT="${HERMES_UI_PORT:-9788}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run with sudo to install a systemd service." >&2
  exit 1
fi

cat >"/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=Hermes UI Gateway
After=network.target

[Service]
Type=simple
User=${USER_NAME}
WorkingDirectory=${APP_DIR}
EnvironmentFile=-${ROOT_DIR}/.env
ExecStart=$(command -v uvicorn) app.main:app --host ${HOST} --port ${PORT}
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "${SERVICE_NAME}"
echo "Installed ${SERVICE_NAME}. Start with: systemctl start ${SERVICE_NAME}"
