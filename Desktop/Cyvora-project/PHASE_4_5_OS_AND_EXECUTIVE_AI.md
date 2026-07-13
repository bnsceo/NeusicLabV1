# Cyvora Phase 4 and Phase 5

## Phase 4 — Application Shell and UX

Implemented:

- Global command palette with `Cmd/Ctrl + K`
- Global navigation search
- Keyboard shortcuts (`/`, `?`, `Esc`)
- Notification center
- Recent activity drawer
- Workspace switcher
- Breadcrumb navigation
- Theme manager
- Comfortable and compact density modes
- Browser-local saved layouts
- Customizable three-to-five item mobile dock
- Executive AI pinned as a first-class application destination

All preferences are stored in browser `localStorage`. No external service or paid API is required.

## Phase 5 — Executive AI (Mocked)

Implemented:

- Dedicated `/executive-ai` workspace
- Deterministic `POST /api/executive-ai/blueprint` endpoint
- Mock-only provider and connector declaration
- Stable deterministic blueprint IDs
- Investment, content, software, marketplace, and consulting templates
- Structured companies, departments, teams, agents, tasks, approvals, KPIs, risks, connectors, and roadmaps
- Investment company template with Research, Portfolio, Compliance, Risk, Finance, Operations, and Legal
- Company creation handoff to the existing `/api/execute-vision` route
- Explicit `$0` estimated model cost

## Safe defaults

```env
CYVORA_MODEL_PROVIDER=mock
CYVORA_CONNECTOR_MODE=mock
MOCK_MODE=true
ALLOW_PAID_AI=false
```

## Validation performed

- Deterministic blueprint smoke tests passed for all five archetypes.
- Stable blueprint ID checks passed.
- Python worker/provider/connector syntax checks passed.
- Zero-cost runtime smoke tests passed.
- Shell scripts passed `bash -n`.

A complete Next.js build still requires running `npm ci`, `npm run lint`, and `npm run build` in an environment with the repository dependencies installed.
