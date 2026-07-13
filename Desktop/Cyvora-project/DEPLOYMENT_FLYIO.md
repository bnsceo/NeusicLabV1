# Cyvora Fly.io deployment runbook

This is the current production path for Cyvora.

## Why this path

- SQLite stays on disk.
- The app runs as one persistent container.
- The worker loop runs beside the Next.js server.
- The control plane and execution plane stay in the same runtime for now.

## What the repo now includes

- `Dockerfile` — container build for the Next.js app and Python worker
- `fly.toml` — Fly app configuration and persistent volume mount
- `worker/execution_worker.py` — queued execution-run worker loop
- `scripts/entrypoint.sh` — starts the app and worker together
- `scripts/worker-loop.sh` — polls for queued execution runs
- `personas/` — minimal agent prompts for worker resolution
- `lib/db.ts` — SQLite resolves under the mounted workspace root

## Required Fly resources

Create a volume before the first deploy:

```bash
fly volumes create cyvora_data --region ewr --size 1
```

## First deploy

```bash
fly deploy
```

## Required environment

The container expects:

- `JARVIS_WORKSPACE_ROOT=/app`
- `MISSIONS_DB_PATH=/app/data/missions.db`
- `AGENCY_AGENTS_DIR=/app/personas`
- `CYVORA_BILLING_MODE=enforce`
- `CYVORA_MAX_RUN_COST_USD=0.25`
- `CYVORA_MAX_DAILY_COST_USD=1.00`
- `CYVORA_AUTH_REQUIRED=true`

## Operational note

The worker first claims a queued execution run, verifies the approved harness snapshot, and then claims the first approved task for that run's company.

That means the approval button in the company dashboard is now part of the execution path, not just a visual cue.

The unlock route now sets a signed session cookie, and the proxy middleware uses that cookie to protect the app in production and tunnel mode.

Billing controls now block queued execution when the approved runtime plan exceeds the configured per-run or daily ceiling.

## Important warning

The app is still on the local-first side of production readiness.

Auth, billing, connector secrets, and sandboxing still need to be added before Cyvora should be exposed as a real multi-tenant production system.
