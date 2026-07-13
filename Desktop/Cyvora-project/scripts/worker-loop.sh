#!/usr/bin/env bash

set -uo pipefail

POLL_INTERVAL_SECONDS="${WORKER_POLL_INTERVAL_SECONDS:-15}"
SUPERVISOR_PATH="${SUPERVISOR_PATH:-/app/worker/execution_worker.py}"
STOP_REQUESTED=0

handle_stop() {
  STOP_REQUESTED=1
  echo "[worker] shutdown requested"
}
trap handle_stop TERM INT

echo "[worker] starting poll loop, interval=${POLL_INTERVAL_SECONDS}s db=${MISSIONS_DB_PATH:-unset} worker=${SUPERVISOR_PATH}"

while [ "$STOP_REQUESTED" -eq 0 ]; do
  python3 "$SUPERVISOR_PATH"
  code=$?
  if [ "$code" -gt 1 ]; then
    echo "[worker] supervisor exited with code ${code} (see activity_events and /api/health)"
  fi
  if [ "$STOP_REQUESTED" -eq 0 ]; then
    sleep "$POLL_INTERVAL_SECONDS" &
    wait $! || true
  fi
done

echo "[worker] poll loop stopped"
