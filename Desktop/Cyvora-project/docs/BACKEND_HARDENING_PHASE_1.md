# Backend Hardening Phase 1

This update adds the first reliability and deployment-hardening package:

- Worker identity and heartbeat records
- Execution-run and task leases
- Stale claim recovery
- Bounded attempt counts
- Public `/api/health` endpoint for Fly health checks
- Persistent tenant snapshots under `/app/data/tenants`
- Removal of automatic Git commit/push from mission approval
- One canonical GitHub Pages showcase source

## New environment variables

```text
WORKER_LEASE_SECONDS=180
WORKER_STALE_SECONDS=90
WORKER_MAX_ATTEMPTS=3
CYVORA_WORKER_ID=<optional stable id>
CYVORA_WORKER_VERSION=1
```

## Health endpoint

```text
GET /api/health
```

The endpoint reports runtime mode, database status, worker heartbeat, queue counts, and tenant-snapshot storage.

## Remaining limitations

This phase does not replace SQLite, split the web and worker services, add a sandbox, or add user accounts/RBAC. Those remain later production milestones.
