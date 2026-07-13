#!/usr/bin/env bash
set -euo pipefail

OLLAMA_HOST="${OLLAMA_HOST:-127.0.0.1:11434}"
OLLAMA_URL="http://${OLLAMA_HOST}"
LOG_FILE="${OLLAMA_LOG_FILE:-/tmp/ollama-codex-free.log}"
CODEX_FREE_MODEL="${CODEX_FREE_MODEL:-gpt-oss:20b}"

if ! curl -fsS "${OLLAMA_URL}/api/tags" >/dev/null 2>&1; then
  nohup ollama serve >"${LOG_FILE}" 2>&1 &
fi

for _ in $(seq 1 30); do
  if curl -fsS "${OLLAMA_URL}/api/tags" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -fsS "${OLLAMA_URL}/api/tags" >/dev/null 2>&1; then
  echo "Ollama did not become ready at ${OLLAMA_URL}. Check ${LOG_FILE}." >&2
  exit 1
fi

if [ -t 0 ] && [ "$#" -eq 0 ]; then
  exec codex --oss --local-provider ollama --model "${CODEX_FREE_MODEL}"
fi

exec codex exec --oss --local-provider ollama --model "${CODEX_FREE_MODEL}" "$@"
