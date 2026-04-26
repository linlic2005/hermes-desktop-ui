#!/usr/bin/env bash
set -euo pipefail

HOST="${LOCAL_DASHBOARD_HOST:-127.0.0.1}"
PORT="${LOCAL_DASHBOARD_PORT:-9119}"
COMMAND="${HERMES_COMMAND:-hermes}"

exec "$COMMAND" dashboard --host "$HOST" --port "$PORT" --no-open
