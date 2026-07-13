# AI COMMAND CENTER — VISION

## Project Vision

Cyvora is a premium, mobile-friendly autonomous business operating system.

The app is not a chat interface. It is the founder’s control plane for turning objectives into companies, departments, teams, agents, tasks, connectors, outputs, approvals, and execution history.

The long-term goal is to support multiple AI-run businesses with clear harness rules, safe execution, and measurable economic output.

---

## What is already real

The repository already has a strong foundation:

- Next.js dashboard and mobile command surface
- Company → Department → Team → Agent hierarchy
- SQLite-backed persistence
- mission history and execution history
- approval records
- runtime plan validation
- local, demo, and production modes
- seeded companies, connectors, tasks, outputs, and approvals
- a worker-oriented supervisor sketch

This means the control plane is real.

---

## What the assessment clarified

The assessment from the other source is useful because it correctly separates the control plane from the execution plane.

The app still needs:

1. A real agent runtime
2. A background worker / job loop
3. Explicit approval gating for task-level execution
4. Real connectors
5. A proper auth boundary
6. Secret management
7. Sandbox isolation
8. Rollback that is more than a status flag
9. Memory architecture
10. Model-provider abstraction
11. Cost and token enforcement

The important conclusion is simple:

Cyvora has the cockpit, but the engine still needs to be fully wired in.

---

## Core operating principle

Harness Engineering is the safety layer.

Loop Engineering is the execution layer.

No irreversible work should run unless:

- the request is approved,
- the exact runtime plan snapshot matches,
- the runtime mode allows it,
- the sandbox scope is explicit,
- and the rollback path is known.

---

## Product philosophy

The founder provides intent.

The Executive AI expands that intent into an operating structure:

- company
- department
- team
- agent
- task
- connector
- approval
- output

The interface should visibly show that growth.

---

## Current gap

The platform still needs a durable execution plane.

The right shape is:

Next.js control plane → approval gate → persistent worker loop → validated task result

The worker should not depend on an HTTP request staying alive.

---

## Institutional-grade enforcement

Cyvora should present itself as an operating system with explicit standards, not a loose dashboard shell.

### Visual precision

- Use the 8px grid everywhere.
- Keep typography restrained and legible.
- Use semantic tokens for colors and borders.
- Keep borders visible on every interactive surface.
- Use extrusion for control surfaces and restrained glass overlays for panels, drawers, and headers.

### Operational clarity

- Show current runtime mode in the top bar.
- Show audit context with timestamps and actor labels.
- Never hide failures behind generic messages.
- Prefer skeletons over spinners.
- Keep empty states actionable.

### Trust signals

- Surface version and build hash in the UI.
- Surface health indicators where they matter.
- Keep compliance language in docs and footer messaging when applicable.

### Documentation as proof

Documentation in Cyvora is not decorative.

It is a trust signal that proves the system can be audited, maintained, and operated safely over time.

- README explains the operating model and runtime modes.
- VISION_AI documents the product contract.
- DEPLOYMENT_FLYIO explains the execution path.
- PRODUCTION_ROADMAP explains the remaining production work.
- SECURITY and compliance pages explain who can use the system and under what conditions.

### Code and runtime discipline

- Validate API input/output.
- Log every state mutation with a run identifier and timestamp.
- Keep execution gated by approval and runtime plan equality.
- Reject unsafe autonomy that bypasses the harness.

---

## Production direction

The best current path is a single persistent container with:

- Next.js app
- SQLite on attached disk
- background worker loop
- task approvals
- persistent tenant files

That gets Cyvora into a real production shape without a premature infra rewrite.

---

## What still needs to be built

- production auth
- billing controls
- real external connectors
- model-provider routing
- secret manager integration
- sandboxed execution
- stronger rollback
- durable queues / retry logic
- tenant isolation beyond a simple selector

---

## Practical rule

Do not optimize for “fully autonomous” before the worker is real and the approval model is trustworthy.

Build the harness first.
Then build the loop.
Then harden the production boundary.
