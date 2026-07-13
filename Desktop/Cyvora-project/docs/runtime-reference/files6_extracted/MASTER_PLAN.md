# Master plan: the autonomous AI holding company

**Owner:** You (final approval authority on all strategic and financial decisions)
**Coordinator:** Hermes (Executive AI Core)
**Orchestration layer:** CrewAI
**Status:** v0.1 draft — architecture and roadmap

---

## 1. Vision

You set a business objective in plain language. Hermes turns it into a company: it stands up departments, assigns agents to run them, launches research, builds pipelines, and reports results back through a single command center. Nothing ships, spends money, or changes direction without your sign-off. You are not doing the work — you are commanding an organization that does the work, and you can see the entire operating picture at any moment from one place.

This is not "a chatbot with plugins." It's an organizational structure — a real chain of command — where the layers happen to be AI agents instead of employees, and the CEO's desk is a dashboard.

---

## 2. The chain of command

```
You (human) — sets objectives, approves major decisions, holds the kill switch
   │
Hermes — Executive AI Core, the only agent you talk to directly
   │
Department Crews — CrewAI crews, one per function, each with a lead agent
   │
Worker Agents — the individuals inside each crew doing the actual task
   │
Tools & Data — APIs, scrapers, databases, payment rails, deploy pipelines
```

**Why this shape matters:** you should never have to talk to a worker agent directly, the same way a CEO doesn't personally email an intern. Hermes is your one point of contact. It abstracts the org chart away from you and only surfaces what needs your attention — decisions, risks, and results.

### 2.1 You
- Set the objective ("enter the pet-supplements market," "find an underpriced SaaS niche and launch a competitor," "cut cloud spend 20%").
- Approve or reject every decision that crosses a defined threshold (see §7, Governance).
- Can override, pause, or shut down any company, department, or agent at any time.
- Never manages agents directly — you manage Hermes, Hermes manages everything else.

### 2.2 Hermes — the Executive AI Core
Hermes is a standing agent (not a CrewAI crew member — it sits above the crews) whose job is:
- Interpret your objective and produce a strategy brief (market thesis, target department structure, resourcing plan, risk flags).
- Spin up new "companies" as CrewAI crew groups when you approve a new venture.
- Create departments inside a company as it grows, and assign lead agents to each.
- Continuously pull status from every department and maintain **one current operating picture** — a live state object, not a stale report.
- Escalate to you the moment something needs approval, hits a risk threshold, or a war room is triggered.
- Talk to you in whichever mode you're in — typed, voice, or by narrating what's changed on the dashboard.

Practically, Hermes is a long-running orchestrator process with a persistent memory store, not a single prompt. It reads a state file (or database — see §6) on every turn, so it always knows: what companies exist, what stage each is in, what's pending your approval, and what just broke.

### 2.3 Department crews (CrewAI)
Each department is a CrewAI **crew**: a lead agent (the department head) plus 2–6 worker agents with narrow roles, a shared goal, and a defined process (sequential or hierarchical, CrewAI supports both — hierarchical fits you best since Hermes needs to delegate and collect).

**Standing departments every company gets by default:**

| Department | Lead agent role | What it does |
|---|---|---|
| Research & Trends | Scout | Weekly scans for market trends, gaps, and monetizable signals across any industry you point it at |
| Treasury | Ledger | Tracks revenue, spend, ROI; enforces budget caps; flags Hermes if burn exceeds targets |
| Growth & Marketing | Signal | Runs acquisition experiments, content, positioning |
| Product & Ops | Forge | Builds the actual pipelines, workflows, and product surface |
| UX/UI | Atelier | Owns the product's interface and expands it as the company grows, subject to your approval |
| Incident Management & IT | Sentinel | Monitors uptime, security, infra health; stands up the war room when something breaks (see §8) |

Departments beyond these are created on demand — e.g., a company entering e-commerce might spin up a **Fulfillment & Logistics** department; one selling a SaaS tool might spin up a **Customer Success** department. Hermes proposes new departments, you approve them, CrewAI instantiates the crew.

### 2.4 Worker agents
Narrow-scope agents inside a crew — e.g., inside Research & Trends: a Scraper agent, a Signal-Scoring agent, and a Brief-Writer agent. They don't talk to you. They report to their department lead, which reports to Hermes.

---

## 3. The command center (the dashboard)

One interface, three ways in, unified: type, speak, or just look at the screen. All three write to and read from the same state, so switching between them mid-task is seamless — you can type a question, get a spoken answer, and see the dashboard update in real time.

### 3.1 Home / Operating picture
The default view. At a glance:
- All active companies, their stage (research → validated → building → live → scaling), and headline metrics
- Hermes's current top-of-mind items — a short list, not a wall of logs
- A single **approval queue** — everything waiting on you, ranked by urgency
- Global burn rate and revenue roll-up across every company

### 3.2 Company view
Drill into one company: its org chart (departments, agent count, what each is doing right now), its pipeline stage, its live metrics, its recent decisions and the reasoning behind them (every agent decision should log a one-line rationale — this is your audit trail).

### 3.3 The map
A live geographic view of sales, signups, or engagement — whatever the company's core metric is — plotted by region. Use it to see where a product is landing, where a marketing push is working, and where a launch is flat. This is a genuine "see it all" surface: heatmap of activity, not just a metrics table.

### 3.4 The war room
Only appears when Incident Management triggers it (see §8). A dedicated, focused view — what broke, who's on it, current status, timeline, and the one decision (if any) that needs your approval to resolve it (e.g., "roll back to previous deploy — approve?").

### 3.5 Talk to it
- **Typed:** command-line style or chat — "Hermes, status on the supplements company" or "kill the ad spend on Project Anchor."
- **Voice:** same commands, spoken. Voice in, voice or text out depending on context (a wall of numbers should render on screen, not be read aloud).
- **Ambient:** the dashboard narrates state changes as they happen if you're watching it live — a small, unobtrusive activity feed, not a chat transcript you have to parse.

This is genuinely three UIs on one backend event stream — building all three at once is a real engineering commitment (see §9 for a phased approach so you're not blocked waiting for voice to be perfect before you get a usable dashboard).

---

## 4. The operating loop (how a company actually gets built)

1. **You set an objective.** Plain language, no structure required.
2. **Hermes + Research & Trends produce a brief.** Market thesis, evidence, a monetization angle, estimated resourcing.
3. **You approve, reject, or redirect.** This is gate #1.
4. **Hermes stands up the company.** Creates the CrewAI crew group, assigns standing departments, sets initial budget in Treasury.
5. **Departments run their pipelines.** Research keeps scanning weekly even after launch — markets move. Product builds. Growth experiments. UX ships iterations.
6. **Hermes maintains the operating picture continuously** — not on a report cadence, but as a live state that's always current when you look.
7. **Anything crossing a threshold escalates to you** — new spend, new department, pricing change, UX overhaul, anything Treasury flags as off-plan.
8. **Weekly, Research re-scans** the space the company is in for new trends, threats, and adjacent opportunities, and can propose either doubling down or spinning up a related company.
9. **If something breaks, Incident Management takes over** and the war room opens (§8) — this pipeline pre-empts the normal loop until resolved.

---

## 5. Recommended tech stack

You picked CrewAI, so the plan is built around it. Concrete stack:

| Layer | Recommendation | Why |
|---|---|---|
| Agent orchestration | **CrewAI** (hierarchical process for Hermes → departments) | Matches the org-chart mental model directly; hierarchical process lets Hermes delegate and collect without hand-rolling a state machine |
| Reasoning model | **Claude** (via API) for Hermes and department leads; a cheaper/faster model for high-volume worker agents (e.g. scraping, formatting) | Cost control — you don't need your most expensive model reading raw scraped HTML |
| Backend | Python service running CrewAI, exposed via a REST/WebSocket API | WebSocket is what makes the "live" dashboard actually live instead of polling |
| State/memory | Postgres for structured state (companies, departments, budgets, approvals) + a vector store (pgvector or Chroma) for agent memory and research corpora | Structured state must be queryable and auditable; vector store is for semantic recall ("what did we learn about this market three weeks ago") |
| Frontend | Next.js/React dashboard, WebSocket-fed, server-sent events for the activity feed | Real-time updates without a rebuild-heavy polling architecture |
| Voice | Browser speech-to-text in, a TTS voice out (ElevenLabs or similar) for spoken responses; route through the same command parser as text | One command parser, three input modes — don't build separate logic per modality |
| Maps | Mapbox or Google Maps JS SDK, fed by the same metrics pipeline that populates the dashboard | Standard, well-documented, handles heatmaps out of the box |
| Monitoring / incident triggers | Uptime and error-rate webhooks (e.g. a status-check service) feeding directly into the Incident Management crew's trigger condition | The war room should open itself — Hermes shouldn't have to notice a problem, it should be told |
| Task/queue | Redis or a lightweight job queue for scheduling the weekly research cycle and async agent tasks | Keeps long-running agent work off the request/response path |

---

## 6. Persistent state — the "one operating picture"

A single source of truth, not a prompt re-read from a JSON file each session (that pattern breaks down fast — no history, no auditability, no concurrent writes). Recommend:

- **Postgres tables:** `companies`, `departments`, `agents`, `approvals`, `budgets`, `incidents`, `decisions_log`.
- Every agent decision writes a row to `decisions_log` with a rationale string — this is both your audit trail and what Hermes reads to avoid re-litigating settled decisions.
- Hermes's "current operating picture" is a live query over this schema, not a cached document — so the dashboard is never stale.

---

## 7. Governance — what needs your approval

Draw this line explicitly now, before you build, or Hermes will either bottleneck on you for everything or run away with too much. A starting cut:

**Requires your approval:**
- Launching a new company / entering a new market
- Any single spend or cumulative burn crossing a threshold you set per company (e.g. $500 uncommitted)
- New department creation
- Pricing changes, UX/UI redesigns beyond minor iteration
- Anything Treasury flags as off-plan
- Killing or pausing a company

**Autonomous, no approval needed:**
- Weekly research scans
- Routine content/marketing experiments within an approved budget envelope
- Minor UX iteration (copy, layout tweaks) within a design system already approved
- Incident triage and war-room formation (speed matters more than sign-off here — but resolution actions like a rollback or spend increase still need you, unless you pre-authorize specific playbooks)

You'll tune this over time. Start conservative — more approval gates than you think you need — and loosen them as you trust specific department leads.

---

## 8. Incident Management & IT — the war room

This department runs standing monitoring on every live company (uptime, error rates, security signals) and is the one department that's allowed to act before you approve, because speed is the point.

**Trigger conditions:** outage, elevated error rate, security alert, anomalous traffic pattern.

**On trigger:**
1. Sentinel (the department lead) opens the war room view on your dashboard automatically.
2. A cross-functional pickup crew assembles — pulls in whichever agents are relevant (Product/Ops for a bad deploy, IT for infra, Treasury if there's revenue impact) into a temporary shared workspace.
3. Triage happens autonomously: identify blast radius, likely cause, current impact.
4. You get pinged immediately with a one-line summary and a severity rating — not a wall of logs.
5. If resolution requires an action above the autonomy line (rollback, disabling a feature, spend to fix), that's the one decision routed to you, framed as a single approve/deny.
6. Post-incident, a summary gets written to `decisions_log` and a retro brief is generated — what broke, why, what changes to prevent recurrence.

Pre-authorizing a few common playbooks (e.g. "auto-rollback on error rate >5% for 3 minutes") is worth doing early so the war room isn't blocked waiting on you for the most common, lowest-risk fix.

---

## 9. Build roadmap — phased, so you have something usable fast

**Phase 0 — Skeleton (2–4 weeks):**
Postgres schema, one CrewAI hierarchical crew (Hermes + one department: Research), text-only command interface. Goal: prove the loop — objective in, brief out, approval, one department runs.

**Phase 1 — Multi-department, dashboard v1:**
Add Treasury and Product/Ops. Build the web dashboard (Home + Company view) reading live from Postgres over WebSocket. Still text-only interface.

**Phase 2 — Incident Management + war room:**
Add Sentinel, monitoring webhooks, the war room view. This is a self-contained module — good place to prove autonomous-with-escalation actually works before trusting it elsewhere.

**Phase 3 — Map + UX/UI department:**
Add the geographic view and let Atelier start proposing UX changes (gated by your approval).

**Phase 4 — Voice:**
Layer voice in and out onto the existing command parser. Do this last — it's the least structurally important and the easiest to bolt on once the command parser already handles typed input cleanly.

**Phase 5 — Multi-company scaling:**
Once one company runs cleanly end-to-end, generalize to spin up a second, then N companies, and stress-test Hermes's ability to actually maintain one coherent operating picture across all of them.

---

## 10. Guardrails worth deciding now, not later

- **Hard spend ceilings** per company and globally, enforced in code (not just as an agent instruction — agents can be talked out of soft rules).
- **Rate limits on autonomous actions** so a bad decision loop can't compound before you notice.
- **A real kill switch** — one command that freezes every agent across every company immediately, independent of Hermes.
- **Legal/compliance review** as a standing checklist Hermes runs before any company goes live in a regulated space (financial products, health claims, data collection) — flag for your explicit sign-off, don't let an agent quietly decide something is fine.

---

## Open questions to sharpen this further

1. **First venture:** what's the actual first objective you want to feed this system once Phase 0 is running? Picking a real, bounded first market (not "everything") will surface the gaps in this plan fast.
2. **Budget reality:** what's your actual spend ceiling per company while you're validating this — both cloud/API cost and any real capital you're willing to risk on a venture the AI picks?
3. **Model cost:** are you optimizing for the strongest reasoning (Hermes and leads on Claude's top-tier model) with cost as a secondary concern, or do you want tight cost controls from day one?
4. **Solo build vs help:** are you building all of this yourself, or will there be engineers helping — because that changes whether Phase 0–5 is a multi-month solo effort or something you can parallelize?

Happy to go deep on any single section next — the CrewAI crew/task definitions in code, the Postgres schema, the war-room trigger logic, or the dashboard's actual component layout.
