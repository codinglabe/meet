#!/usr/bin/env bash
set -euo pipefail
APP_DIR="/home/ubuntu/.openclaw/workspace/meeting-app"
PID_FILE="$APP_DIR/logs/kreo-meet.pid"
LOG_FILE="$APP_DIR/logs/server.log"
cd "$APP_DIR"

if [[ -f "$PID_FILE" ]]; then
  old_pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -n "${old_pid:-}" ]] && kill -0 "$old_pid" 2>/dev/null; then
    echo "Kreo Meet already running: pid $old_pid"
    exit 0
  fi
fi

# If another old manual server owns port 8080, stop it.
old_port_pids="$(ss -ltnp 2>/dev/null | awk '/:8080 / {print}' | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | sort -u || true)"
if [[ -n "$old_port_pids" ]]; then
  for pid in $old_port_pids; do
    if ps -p "$pid" -o args= | grep -q 'node server.js'; then
      echo "Stopping old server pid $pid"
      kill "$pid" 2>/dev/null || true
      sleep 1
    fi
  done
fi

HOST=127.0.0.1 PORT=8080 NODE_ENV=production nohup /usr/bin/node server.js >> "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"
echo "Started Kreo Meet: pid $(cat "$PID_FILE")"
