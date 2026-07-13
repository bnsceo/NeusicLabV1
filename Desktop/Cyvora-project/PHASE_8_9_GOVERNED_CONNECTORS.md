# Cyvora Phases 8 and 9 — Governed Connectors

## Phase 8: Mock Connector Framework

Cyvora now exposes one shared connector catalog for GitHub, Gmail, Google Drive, YouTube, Etsy, Gumroad, Stripe, Slack, and Discord. Each action declares its risk, side-effect class, and reversibility. Mock adapters generate deterministic references, never contact external services, never require credentials, and always report `$0` cost.

Core surfaces:

- `/connectors`
- `GET /api/connectors`
- `POST /api/connectors`
- `POST /api/connectors/simulate`
- `config/connectors.json`

## Phase 9: Policy Engine

Every connector action can now be evaluated against Founder Safe, Balanced, or Locked Down policy packs. Decisions consider risk, privacy, side effects, reversibility, runtime mode, actor role, provider cost, and founder approval.

Effects:

- `simulate`
- `require_approval`
- `allow` (reserved for future real adapters)
- `block`

Core surfaces:

- `/policies`
- `GET /api/policies`
- `POST /api/policies/evaluate`
- `config/policy-packs.json`

## Safety guarantees

- Paid AI is disabled by default.
- Real connector actions are disabled.
- Mock connector cost is always `$0`.
- Public demo writes are blocked.
- High-risk, critical, sensitive, financial, publishing, destructive, or irreversible operations are approval-gated or blocked according to the selected pack.
- Every simulated action and policy decision is written to the governance ledger.
