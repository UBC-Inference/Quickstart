#!/usr/bin/env bash
set -euo pipefail

PREVIEW_MARKER=".quickstart-preview"

if [[ "${1:-}" == "--preview" ]]; then
  : > "$PREVIEW_MARKER"
elif [[ $# -gt 0 ]]; then
  printf 'Usage: %s [--preview]\n' "$0" >&2
  exit 1
fi

cleanup() {
  rm -f "$PREVIEW_MARKER"
  kill "$SERVER_PID" 2>/dev/null || true
}

python3 -m http.server 8000 &
SERVER_PID=$!
trap cleanup EXIT SIGINT SIGTERM
wait $SERVER_PID
