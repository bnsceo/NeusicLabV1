# Phases 6 and 7 — Company Engine and Agent Registry

## Company Engine

The Company Engine converts deterministic Executive AI blueprints into reusable, versioned operating-company templates. The templates are not model-generated at runtime and require no paid API.

### Core files

- `lib/companyEngine.ts`
- `app/api/company-templates/route.ts`
- `app/api/company-templates/[id]/route.ts`
- `app/api/company-engine/instantiate/route.ts`
- `app/companies/page.tsx`

### Included templates

- Content Studio
- Software Lab
- Marketplace Division
- Investment Company
- Consulting Group

Each template includes company identity, departments, teams, agents, mock connectors, tasks, approvals, workflows, SOP-derived outputs, KPIs, risks, and roadmap metadata.

## Agent Registry

The Agent Registry scans the repository's core personas, custom agents, and vendored agent library. It normalizes them into a searchable workforce catalog.

### Core files

- `lib/agentRegistry.ts`
- `app/api/agents/route.ts`
- `app/api/agents/[slug]/route.ts`
- `app/agents/page.tsx`
- `app/agents/[slug]/page.tsx`

Each registry record contains a stable ID, deterministic version, lifecycle state, mock provider, risk profile, capabilities, tags, source, source file, cost profile, and company-template assignments.

## UI information architecture

- `/` — compact launchpad
- `/command-center` — founder workflow, mission intake, and approvals
- `/briefing` — Executive Briefing
- `/executive-ai` — blueprint generation and planning
- `/companies` — active companies and company templates
- `/agents` — reusable agent workforce
- `/headquarters` — organization tree, live operations, and runtime posture

The control panel is hidden by default, and the desktop sidebar starts in compact icon mode.
