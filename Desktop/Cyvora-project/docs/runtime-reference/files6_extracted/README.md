# The Autonomous AI Holding Company

A system where you set business objectives and AI agents build, run, and scale ventures for you. You approve major decisions; everything else runs autonomously.

**Current version:** Phase 0 (Research + Treasury, text-only interface)
**First venture:** Ecommerce (Gumroad, YouTube, TikTok)
**Tech stack:** CrewAI, Claude (Haiku + Sonnet), SQLite (→ Postgres in Phase 1)

---

## What is this?

You set an objective like "Find me a profitable ecommerce niche." Hermes (the Executive AI Core) proposes a company:
- Market thesis
- Go-to-market strategy
- Budget
- Department structure (Research, Treasury, Product/Ops, etc.)

You approve. Hermes spins it up:
- Creates the company in the database
- Spins up the Research crew to scan YouTube, TikTok, Gumroad for trends
- Creates departments with lead agents
- Maintains a live "operating picture" — one dashboard showing what every company is doing

Everything flows back to you. No decision crosses a threshold without your approval. No company spends beyond its budget. Research runs weekly, automatically.

---

## Files in this kit

| File | Purpose |
|---|---|
| `MASTER_PLAN.md` | The full architecture and strategy (read this first for context) |
| `BUDGET_AND_ROUTING.md` | How to stay under $20–50/month and route models for cost control |
| `PHASE_0_QUICKSTART.md` | Step-by-step to run your first loop in 30 minutes |
| `schema.py` | SQLite database schema — companies, departments, budgets, approvals |
| `crews.py` | CrewAI crew definitions — Research (Scout), Treasury (Ledger), Hermes |
| `hermes.py` | The orchestrator — state machine, decision loop, CEO operations |
| `cli.py` | Text interface — your command line to Hermes |
| `requirements.txt` | Python dependencies |

---

## Quick start

1. **Read MASTER_PLAN.md** (5 min) — understand the system
2. **Read PHASE_0_QUICKSTART.md** (5 min) — setup and first loop
3. **Run Phase 0** (30 min) — actually execute it

```bash
python schema.py      # Initialize database
python cli.py         # Start the CLI
> objective Find me an ecommerce niche on Gumroad and YouTube
> approve 500
> research company_id
> status
```

---

## The chain of command

```
You (human)
  └─ Hermes (Executive AI Core)
       ├─ Research & Trends (Scout, Scraper, Analyst)
       ├─ Treasury (Ledger)
       ├─ Product & Ops (Forge) — added Phase 1
       ├─ Growth & Marketing (Signal) — added Phase 1
       ├─ UX/UI (Atelier) — added Phase 1
       └─ Incident Management & IT (Sentinel) — added Phase 1
```

You set objectives. Hermes translates them to companies. Companies have departments. Departments have crews. Crews have agents. Agents do the work.

---

## Governance

**Requires your approval:**
- Launching a new company
- Spending above threshold per company (default: $500 uncommitted)
- New department creation
- Pricing changes, UX redesigns
- Anything Treasury flags as off-plan
- Killing or pausing a company

**Autonomous (no approval needed):**
- Weekly research scans
- Routine marketing experiments within budget
- Minor UX iteration
- Incident triage and war-room formation (approval needed only for resolution)

---

## Cost control

Phase 0 is designed to run on $20–50/month:
- Haiku ($0.003/1k tokens) for high-volume work (scraping, formatting, analysis)
- Sonnet ($0.009/1k tokens) for reasoning (Hermes, department leads)
- Free APIs (YouTube, TikTok, Gumroad have free tiers)
- SQLite locally (no database costs)

A full loop (objective → propose → approve → research) costs ~$0.15 and takes 30 seconds.

---

## What Phase 0 does

✅ **Propose companies** — Hermes turns your objective into a structured company proposal with thesis, go-to-market, budget, timeline.

✅ **Approval flow** — You approve or reject. Hermes spins up the company (database records, budgets, departments).

✅ **Research cycles** — The Research crew scans YouTube, TikTok, Gumroad for ecommerce trends, analyzes them, and returns a brief with top opportunities.

✅ **Operating picture** — Hermes maintains a live snapshot of state: how many companies, what stage, burn rate, pending approvals.

✅ **Governance** — Treasury enforces budget ceilings. Every decision is logged with rationale (audit trail).

---

## What's NOT in Phase 0 (coming in Phase 1+)

❌ **Web dashboard** — Phase 1. Text CLI only for now.

❌ **Voice interface** — Phase 4. Text CLI only for now.

❌ **Real API integrations** — Phase 0 mocks YouTube/TikTok/Gumroad. Phase 1 adds real API calls with caching and quota management.

❌ **Product building** — Phase 1. Adds the "Forge" (Product/Ops crew) that actually builds landing pages, Gumroad stores, etc.

❌ **Maps & geo tracking** — Phase 3. For now, no geographic analytics.

❌ **War room & incident management** — Phase 2. For now, no monitoring or auto-escalation.

---

## Roadmap

| Phase | What | Timeline | Budget |
|---|---|---|---|
| **0** | Research + Treasury, text CLI | Now | Baseline |
| **1** | Web dashboard, Product/Ops crew, real APIs | 2–3 weeks | +$5/mo (hosting) |
| **2** | Incident Management + war room | 3–4 weeks | +$0 (included) |
| **3** | Maps + UX/UI department | 4–5 weeks | +$5/mo (Mapbox) |
| **4** | Voice interface | 5–6 weeks | +$5/mo (TTS) |
| **5** | Multi-company scaling | 6–8 weeks | Scales linearly |

Each phase is additive — Phase 0 stays usable while you build Phase 1.

---

## Database schema highlights

**Key tables:**

- `companies` — ventures you've approved
- `departments` — Research, Treasury, Product, UX, Growth, Incident Management
- `budgets` — spending caps per company
- `decisions_log` — every agent decision with rationale (audit trail)
- `approvals` — things awaiting your sign-off
- `incidents` — war room triggers
- `research_results` — Scout's weekly findings
- `operating_picture` — snapshot of current state

---

## CrewAI crew structure

**Research crew** (hierarchical process):
- **Scout** (lead): Interprets scraped data, generates brief
- **Scraper**: Fetches from YouTube, TikTok, Gumroad APIs
- **Analyst**: Scores trends by growth, audience, monetization potential

**Treasury** (single agent for Phase 0):
- **Ledger**: Tracks spend, enforces ceilings

**Hermes** (standalone orchestrator):
- Not a crew member; sits above all departments
- Interprets your objectives
- Delegates to crews
- Maintains operating picture

---

## How to extend this

### Add a new department in Phase 1

```python
# In crews.py
def create_product_crew(company_id: str) -> Crew:
    forge = Agent(
        role="Product Lead",
        goal="Build landing page, Gumroad store, and product listings",
        model=LEAD_MODEL,
    )
    # ... add worker agents (HTML builder, Gumroad integrator, etc.)
    return Crew(...)

# In hermes.py, in approve_company():
c.execute("""
    INSERT INTO departments (id, company_id, name, lead_agent, crew_type)
    VALUES (?, ?, ?, ?, ?)
""", (str(uuid.uuid4())[:8], company_id, "Product & Ops", "Forge", "product"))
```

### Add a new objective trigger

```python
# In cli.py
elif command == "pause":
    company_id = args
    hermes.pause_company(company_id)
```

### Change the model routing

Edit `crews.py`:
```python
WORKER_MODEL = "claude-3-5-sonnet-20241022"  # Upgrade if budget allows
```

---

## Troubleshooting

See **PHASE_0_QUICKSTART.md** § Troubleshooting.

---

## Support & next steps

1. **Run Phase 0 end-to-end** (1 hour)
2. **Schedule weekly research** (add cron job or task scheduler)
3. **Start Phase 1 design** (web dashboard mockup)
4. **Report results** — in a month, tell me how many trends Research found and if any are worth pursuing

---

## License & attribution

This is your proprietary system. Build on it, modify it, scale it.

Hermes is standing by.
