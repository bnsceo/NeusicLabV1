# Cyvora Phases 10–12 — Operations and Observability

## Status

- Phase 10 — Headquarters: Complete
- Phase 11 — War Room: Complete
- Phase 12 — History: Complete
- External API cost: $0

## Phase 10 — Headquarters

Headquarters is now the canonical organization and live-operations surface. It exposes four focused views:

1. **Overview** — company health, system totals, worker status, queue pressure, and recent activity.
2. **Organization** — company → department → team → agent drill-down.
3. **Live Operations** — execution runs, tasks, founder approvals, connector actions, and policy flow.
4. **Runtime Health** — worker heartbeats, leases, current assignments, and queue pressure.

The API aggregates real local database records. Company health is deterministic and penalizes blocked tasks, failed runs, pending approvals, and policy blocks.

## Phase 11 — War Room

War Room now creates a governed reliability layer around the runtime. It derives incidents from:

- missing or stale worker heartbeats
- blocked or failed execution runs
- blocked or failed tasks
- failed validations and blocking findings
- connector failures
- policy-engine blocks

Incidents are persisted with fingerprints so repeated scans update the same record. The founder can acknowledge or resolve incidents. Eligible blocked execution runs can be returned to the queue, and eligible blocked tasks can be returned to active status. Recovery actions do not bypass approvals, policies, validation, or connector governance.

Demo mode remains read-only.

## Phase 12 — History

History now merges operational records into one normalized timeline:

- missions
- activity events
- execution runs
- tasks
- approvals
- outputs
- validation runs
- connector action runs
- policy decisions
- usage events
- incidents
- recovery actions

The workspace supports full-text search, category/status/company filters, date grouping, record details, metadata inspection, and JSON export.

## New persistence

Two tables were added:

- `operations_incidents`
- `recovery_actions`

Indexes were added for incident status, recovery chronology, activity chronology, and execution-run status.

## Routes

- `/headquarters`
- `/war-room`
- `/history`
- `/security` redirects to `/war-room` for backward compatibility

## APIs

- `GET /api/headquarters`
- `GET /api/warroom`
- `POST /api/warroom`
- `GET /api/history`

## Validation commands

```bash
npm run lint
npm run typecheck
npm run build
python3 scripts/test-zero-cost-runtime.py
python3 scripts/test-phase8-9-runtime.py
python3 scripts/test-phase10-12-operations.py
```
