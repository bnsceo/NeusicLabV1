# Cyvora deployment target and supervisor sketch

## Deployment target

Primary target: Fly.io

Why this target fits Cyvora right now:

- Cyvora currently uses SQLite on disk.
- The app spawns an execution worker process for mission runs.
- The current architecture is not a good match for stateless serverless hosting.
- Fly.io can run a long-lived app container with a persistent volume, which keeps the SQLite model and worker-style execution intact.

### Why not start with Vercel

Vercel is good for pure Next.js frontends, but Cyvora still needs:

- a writable local database file
- durable execution state
- a worker/orchestrator path that can run deterministically

Moving to Vercel first would force a bigger storage and worker rewrite before auth and billing.

## Implementation order

1. Deploy the Next.js app as a long-running container.
2. Attach persistent storage for the SQLite database and tenant files.
3. Expose the first production auth boundary.
4. Add billing and usage ceilings.
5. Attach one real agent runtime backend.
6. Turn on production mode behind a flag.

## What I think about the proposed `supervisor_router.py`

The draft is structurally good. It has the right overall shape:

- claim one task
- resolve one persona
- call one model
- validate one JSON response
- write one result
- stop on mismatch

That is exactly the right starting point for Cyvora.

## Corrections I would make before using it

### 1. Require approval snapshot input before task claim

The worker should receive:

- `tenant`
- approved request id
- exact runtime plan hash or snapshot path

Then it should verify the approved snapshot before it touches any task rows.

### 2. Claim inside a transaction

Use a transaction boundary like `BEGIN IMMEDIATE` so two workers cannot claim the same task at the same time.

### 3. Write outputs atomically

If the output row does not exist yet, create it.
If it does exist, update it.
Do not assume the row is already there.

### 4. Do not default to mock mode in production

Mock mode is fine for local or demo mode, but production should require an explicit opt-in flag.

### 5. Persist failure state cleanly

If a task is blocked, the worker should record the reason once and stop. No partial success state should survive.

## Minimal Node equivalent shape

If you want to keep everything in the Next.js stack, the worker can be a Node script instead of Python.

Pseudo-flow:

```ts
load env
open sqlite db
verify approved harness snapshot
begin transaction
claim one approved task
resolve exactly one persona file
build system + user prompt
call model
validate JSON response
write outputs + activity event
commit
```

## Recommended first production implementation

Use the app as the control plane and a small Node worker as the first runtime integration.
That keeps the production stack consistent with the rest of Cyvora and avoids introducing a second language unless the Python worker becomes necessary later.

