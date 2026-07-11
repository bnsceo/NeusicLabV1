# Harness Engineering Manual

This project is built as a local-first AI command center with three runtime modes:

- Local mode: fully local execution, mock-safe fallbacks, no paid APIs.
- Free demo mode: read-only public demo behavior with isolated tenant data.
- Production mode: later paid runtime, disabled unless explicitly enabled.

## Core idea

The app uses `Harness Engineering` as the approval layer and `Loop Engineering` as the execution layer.

The important rule is:

> A request may not execute unless the founder has approved the exact runtime plan snapshot attached to that request.

## Main flow

1. Write or receive a founder request.
2. Generate a runtime plan.
3. Review the plan in Harness Engineering.
4. Approve or hold the request.
5. If approved, execution starts only with the approved request id and matching runtime plan.
6. The system stores the result in mission history and company data.

## What gets checked before execution

The approved runtime plan is checked for:

- sandbox scope
- permissions
- validation checks
- rollback path
- token/cost ceiling

If the plan does not match the approved snapshot, execution is blocked.

## Runtime modes

### Local mode

Use this when you want to test without spending money.

Behavior:

- local toolchain only
- mock-safe fallbacks
- no paid API calls

### Free demo mode

Use this for a public or shareable demo.

Behavior:

- read-only posture
- isolated demo tenant
- tenant creation disabled
- no paid APIs

### Production mode

Use this later when you are ready for paid runtime.

Behavior:

- explicitly opt-in only
- paid API usage must be enabled
- still respects approval gates

## Important files

- `app/page.tsx` — dashboard, mission launch, and hierarchy view
- `app/harness-engineering/page.tsx` — approval and harness review
- `app/api/execution-runs/route.ts` — execution history feed
- `app/api/harness-engineering/requests/route.ts` — create and list harness requests
- `app/api/harness-engineering/requests/[id]/approve/route.ts` — approve or hold requests
- `app/api/start-mission/route.ts` — execution entry point
- `lib/runtimeMode.ts` — mode detection and mode labels
- `lib/harnessPlan.ts` — runtime plan generator
- `lib/harnessApproval.ts` — approved plan snapshot storage and validation
- `lib/db.ts` — persistence for missions, approvals, and execution runs

## Execution control panel

The dashboard now shows an approved execution history panel.

Each execution run records:

- the approved request id
- the exact runtime plan snapshot
- runtime mode
- status
- rollback state
- whether paid AI was allowed
- whether the run was still mock-safe

You can inspect one run at a time and roll it back from the control panel.

The safe rule is:

- if the run does not have an approved plan snapshot, it should not start
- if the runtime plan does not match the approved snapshot, it should stop
- if the execution fails, rollback should be marked required
- if you roll a run back, the run is marked rolled back and the related mission is abandoned

## How to run safely

- Review the runtime plan first.
- Do not approve anything that changes state unless the sandbox, permissions, and rollback path make sense.
- Start execution only from an approved request.
- If you are testing, stay in local mode or free demo mode.

## Local HTTPS for iPhone testing

If your phone is set to HTTPS-only, use the secure dev server:

```bash
npm run dev:https
```

Then open the Mac’s LAN address from the phone using `https://<mac-ip>:3000`.
You may need to trust the local certificate once on the phone before the page loads cleanly.

## Practical rule of thumb

If a change is irreversible, expensive, or touches production state, it should be blocked until:

- the harness plan is approved,
- the snapshot matches,
- and the runtime mode is appropriate.
