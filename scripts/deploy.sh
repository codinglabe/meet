#!/usr/bin/env bash
set -euo pipefail
APP_DIR="/home/ubuntu/.openclaw/workspace/meeting-app"
LOG_FILE="$APP_DIR/logs/deploy.log"
LOCK_DIR="$APP_DIR/logs/deploy.lock"
mkdir -p "$APP_DIR/logs"

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  exit 0
fi
trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT

cd "$APP_DIR"
{
  echo "---- $(date -Is) deploy check ----"
  git fetch --quiet origin main
  local_rev="$(git rev-parse HEAD)"
  remote_rev="$(git rev-parse origin/main)"
  echo "local=$local_rev remote=$remote_rev"

  if [[ "$local_rev" == "$remote_rev" ]]; then
    echo "No changes. Ensuring app is running."
    "$APP_DIR/scripts/start.sh"
    exit 0
  fi

  if [[ -n "$(git status --porcelain)" ]]; then
    echo "Local changes found; skipping deploy to avoid overwriting files."
    git status --short
    exit 1
  fi

  echo "Deploying new commit..."
  git pull --ff-only origin main
  npm ci
  npm run build
  "$APP_DIR/scripts/stop.sh" || true
  "$APP_DIR/scripts/start.sh"
  curl -fsS http://127.0.0.1:8080/health
  echo
  echo "Deploy complete: $(git rev-parse --short HEAD)"
} >> "$LOG_FILE" 2>&1
