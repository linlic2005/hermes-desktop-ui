#!/usr/bin/env bash
set -euo pipefail

HOST="${HERMES_UI_HOST:-127.0.0.1}"
PORT="${HERMES_UI_PORT:-9788}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "${ROOT_DIR}/backend"
exec uvicorn app.main:app --host "$HOST" --port "$PORT"
