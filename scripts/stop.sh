#!/usr/bin/env bash
set -euo pipefail
APP_DIR="/home/ubuntu/.openclaw/workspace/meeting-app"
PID_FILE="$APP_DIR/logs/kreo-meet.pid"
if [[ -f "$PID_FILE" ]]; then
  pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    sleep 1
    kill -9 "$pid" 2>/dev/null || true
    echo "Stopped Kreo Meet pid $pid"
  fi
  rm -f "$PID_FILE"
fi
