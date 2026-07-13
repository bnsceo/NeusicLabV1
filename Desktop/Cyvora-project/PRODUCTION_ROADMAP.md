# Cyvora Production Roadmap

This file tracks the remaining work needed to move Cyvora from local/demo mode into a real production launch.

## Status key

- `done` — completed
- `in progress` — actively being worked on
- `pending` — not started yet

## Production milestones

| Milestone | Status | Notes |
| --- | --- | --- |
| Production deployment for real external access | in progress | Target chosen: Fly.io with persistent storage. |
| Production auth | in progress | Signed session cookie, unlock gate, logout, and protected routes are now in place. |
| Billing controls | in progress | Runtime plan ceilings and execution blocking are now enforced. |
| One real agent runtime integration | in progress | Worker loop now claims queued execution runs, verifies approved snapshots, and resolves a persona bundle. |
| Long-term production mode | pending | Needs a stable mode flag, safeguards, and rollout rules. |

## Current product posture

- Local mode: available
- Free demo mode: available
- Production mode: scaffolded, but not yet live

## Working rule

Nothing irreversible should run unless:

1. the request is approved,
2. the runtime plan snapshot matches,
3. the mode allows the action,
4. and the rollback path is explicit.

## Suggested next implementation order

1. Choose the production deployment target.
2. Add auth and session protection.
3. Add billing and usage ceilings.
4. Integrate one runtime backend.
5. Turn on production mode behind a flag.

## Chosen deployment target

- Fly.io

## Current worker direction

- persistent container
- SQLite on volume
- background worker loop
- approval-gated execution runs and task execution
