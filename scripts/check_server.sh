#!/usr/bin/env bash
set -euo pipefail

echo "== Platform =="
uname -a || true
if grep -qi microsoft /proc/version 2>/dev/null; then
  echo "WSL: detected"
else
  echo "WSL: not detected"
fi

echo "== Python =="
python --version

echo "== Hermes =="
if command -v "${HERMES_COMMAND:-hermes}" >/dev/null 2>&1; then
  command -v "${HERMES_COMMAND:-hermes}"
  "${HERMES_COMMAND:-hermes}" --version || true
else
  echo "hermes command: missing"
fi

echo "== Node =="
if command -v node >/dev/null 2>&1; then
  node --version
else
  echo "node: missing"
fi

echo "== PTY dependency =="
python - <<'PY'
try:
    import ptyprocess
    print("ptyprocess: available")
except Exception as exc:
    print(f"ptyprocess: missing ({exc})")
PY

echo "== Dashboard 9119 =="
python - <<'PY'
import urllib.request
try:
    with urllib.request.urlopen("http://127.0.0.1:9119", timeout=2) as r:
        print(f"dashboard: HTTP {r.status}")
except Exception as exc:
    print(f"dashboard: unavailable ({exc})")
PY

echo "== Gateway 9788 =="
python - <<'PY'
import urllib.request
try:
    with urllib.request.urlopen("http://127.0.0.1:9788/health", timeout=2) as r:
        print(f"gateway: HTTP {r.status}")
except Exception as exc:
    print(f"gateway: unavailable ({exc})")
PY

echo "== Token =="
if [ -n "${HERMES_UI_TOKEN:-}" ] && [ "${HERMES_UI_TOKEN:-}" != "change-me" ]; then
  echo "token: configured"
else
  echo "token: missing or default"
fi
