#!/usr/bin/env bash

set -uo pipefail

./scripts/worker-loop.sh &
WORKER_PID=$!

npm run start &
APP_PID=$!

echo "[entrypoint] worker pid=${WORKER_PID} app pid=${APP_PID}"

wait -n "$WORKER_PID" "$APP_PID"
EXIT_CODE=$?
echo "[entrypoint] a process exited (code ${EXIT_CODE}), shutting down container"
kill "$WORKER_PID" "$APP_PID" 2>/dev/null
exit "$EXIT_CODE"
