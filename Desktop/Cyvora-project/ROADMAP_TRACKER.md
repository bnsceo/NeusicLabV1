# Cyvora Development Tracker

This is the canonical phase tracker for the zero-cost-first product plan.

| Phase | Focus | Status | API Cost |
|---:|---|---|---:|
| 1 | Runtime Foundation | Complete | $0 |
| 2 | Validation & Approvals | Complete | $0 |
| 3 | Zero-Cost Runtime | Complete | $0 |
| 4 | Application Shell & UX | Complete | $0 |
| 5 | Executive AI (Mock) | Complete | $0 |
| 6 | Company Engine | Complete | $0 |
| 7 | Agent Registry | Complete | $0 |
| 8 | Connector Framework (Mock) | Complete | $0 |
| 9 | Policy Engine | Complete | $0 |
| 10 | Headquarters | Complete | $0 |
| 11 | War Room | Complete | $0 |
| 12 | History | Complete | $0 |
| 13 | Harness Engineering | Planned | $0 |
| 14 | Users & Organizations | Planned | $0 |
| 15 | PostgreSQL | Planned | $0 |
| 16 | Real AI Providers | Optional | Optional |
| 17 | Real Connectors | Optional | Optional |
| 18 | DUH Review Layer | Optional | Optional |
| 19 | Autonomous Companies | Future | Minimal |
| 20 | Monetization | Future | Revenue-funded |

## Phase 6 definition of done

- Typed company-template SDK
- Versioned deterministic template registry
- Reusable templates for content, software, marketplace, investment, and consulting companies
- Template inspection API
- Company-instantiation API
- Departments, teams, agents, tasks, connectors, policies, approvals, KPI metadata, and blueprint output created from one template
- Active Companies and Template Registry combined on the Companies page
- Executive AI creates companies through Company Engine
- Mock provider and connector cost remains $0

## Phase 7 definition of done

- Registry scans core, custom, and vendored library persona files
- Search by name, role, capability, or tag
- Filters by category, risk, and source
- Stable registry IDs and deterministic versions
- Lifecycle, provider, risk, cost profile, capabilities, tags, and source metadata
- Core template assignment mapping
- Registry list API and agent-detail API
- Agent Registry page and individual profile pages
- $0 provider mode retained

## Information architecture adjustment completed with Phases 6 and 7

- Collapsible desktop sidebar defaults to compact mode
- Home is a launchpad
- Command Center contains system mode, founder overview, mission intake, approvals, quick actions, and a hidden-by-default control panel
- Executive Briefing has a separate page
- Active companies and templates live in Companies
- Agent Registry has a first-class navigation destination
- Live operations and runtime posture live in Headquarters

## Phase 8 definition of done

- Shared, versioned connector catalog
- Mock adapters for GitHub, Gmail, Google Drive, YouTube, Etsy, Gumroad, Stripe, Slack, and Discord
- Risk, side-effect, reversibility, and authentication metadata per action
- Deterministic idempotent mock references
- Connector installation state and action ledger
- Connector catalog and simulation APIs
- Connector management and test-bench page
- No external services contacted and no secrets required

## Phase 9 definition of done

- Founder Safe, Balanced, and Locked Down policy packs
- Deterministic decisions using risk, cost, privacy, side effects, reversibility, environment, and actor role
- Allow, simulate, require-approval, and block effects
- Founder approval override for permitted governed actions
- Public demo read-only enforcement
- Policy decision ledger and APIs
- Policy simulator and governance page
- Worker policy selection enriched with pack, effect, and matched rules


## Phase 10 definition of done

- Headquarters API aggregates companies, departments, teams, agents, connectors, tasks, approvals, outputs, execution runs, validations, policy decisions, and connector actions
- Company health score and operational posture per company
- Overview, Organization, Live Operations, and Runtime Health views
- Company and department drill-down
- Worker fleet, queue pressure, and recent activity visibility
- Fifteen-second optional live refresh
- Direct handoff to War Room for recovery
- $0 provider and connector cost retained

## Phase 11 definition of done

- Persistent operational incident and recovery-action ledgers
- Derived incidents for stale or missing workers, blocked runs, blocked tasks, failed validations, connector failures, and policy blocks
- Severity, status, source, target, remediation, and company context
- Founder-controlled acknowledge, resolve, retry-run, and requeue-task actions
- Tenant-scoped recovery checks and demo-mode write protection
- Worker fleet, queue pressure, blocked work, validation failures, connector failures, and policy blocks in one War Room
- Every recovery action records an activity event for History
- No policy bypass and no external API cost

## Phase 12 definition of done

- Unified timeline across missions, activity events, executions, tasks, approvals, outputs, validations, connector actions, policy decisions, usage, incidents, and recoveries
- Search by title, description, company, and status
- Category, status, and company filters
- Date-grouped timeline and event-detail inspector
- Audit metadata for every source record
- JSON export for founder review and troubleshooting
- Summary counters for incidents, approvals, failed executions, and estimated spend
- $0 runtime cost retained
