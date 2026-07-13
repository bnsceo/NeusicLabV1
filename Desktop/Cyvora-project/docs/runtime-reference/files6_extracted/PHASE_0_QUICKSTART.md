# Phase 0 Quickstart — Running your first autonomous company loop

**Goal:** Hermes proposes an ecommerce venture, you approve it, Research scans for trends, and you see the results. All in ~30 minutes.

**What's included:**
- `schema.py` — SQLite database setup
- `crews.py` — CrewAI crew definitions (Research, Treasury, Hermes)
- `hermes.py` — The orchestrator state machine
- `cli.py` — Your command-line interface
- `requirements.txt` — All Python dependencies

---

## 1. Setup (5 minutes)

### Prerequisites
- Python 3.10+
- An Anthropic API key (you already have Codex Plus, so you're set)
- ~$0.10 of API credits (Phase 0 uses minimal tokens)

### Install

```bash
# Clone or download the files above into a directory:
# schema.py, crews.py, hermes.py, cli.py, requirements.txt

cd /path/to/your/station

# Create a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set your Anthropic API key
export ANTHROPIC_API_KEY="your-key-here"
# Or create a .env file:
# ANTHROPIC_API_KEY=your-key-here
```

### Initialize the database
```bash
python schema.py
# Output: ✓ Database initialized at station.db
```

---

## 2. Run your first loop (10 minutes)

```bash
python cli.py
```

You'll see the Hermes banner and the current operating picture (empty for Phase 0).

### Step 1: Set an objective
```
> objective Find an underpriced ecommerce niche on Gumroad, YouTube, and TikTok

[Hermes] Processing objective...
```

Hermes will call Claude (via CrewAI) to generate a proposal. This takes ~20 seconds and costs ~$0.05. You'll see:

```
[Hermes] Company proposal:

Company name: "Niche Essentials"
Market thesis: Small-batch, premium ecommerce products are trending on TikTok and YouTube 
(audience growth 3.2x year-over-year). Underserved niches: pet supplements, artisanal kitchen tools, 
sustainable packaging.

Go-to-market:
- Launch with 2–3 curated products on Gumroad
- Run YouTube review/unboxing content
- TikTok influencer seeding ($200–400 budget)

Budget: $1500 to launch, $500/month runway
Timeline: Research (1 week) → Validation (2 weeks) → Launch (1 week)

[Status: Pending your approval]
```

### Step 2: Approve
```
> approve 500

[Hermes] ✓ Company approved and spun up.

Company: Niche Essentials
ID: abc12345
Budget: $500.00/month
Status: research

Departments created:
  • Research & Trends (Scout)
  • Treasury (Ledger)
```

The company is now in the database. Hermes has created the standing departments (Research and Treasury).

### Step 3: Run research
```
> research abc12345

[Hermes] Running research cycle...
```

The Research crew will:
1. Scrape YouTube (trending ecommerce channels)
2. Check TikTok trending hashtags
3. Scan Gumroad top sellers
4. Analyze and score trends
5. Return a brief with the top 3–5 monetizable angles

Output (sample):
```
[Hermes] ✓ Research cycle complete.

Findings:
  1. DIY organic pet supplements — 3.2x growth, 40k monthly searches, **RECOMMEND LAUNCH**
  2. Sustainable packaging for small biz — steady, 12k searches, medium competition
  3. Handmade bath products — 2.1x growth, niche audience, high margins
  
  Top angle: Pet supplements targeting dog owners aged 25–40 on YouTube and TikTok.
  Estimated market size: $2B+ in US alone.
  Risk: High competition from established brands, regulatory (FDA).
```

### Step 4: Check status
```
> status

[Hermes] Operating Picture
═════════════════════════════════════════

Companies: 1 total, 1 active
Pending approvals: 0
Monthly burn rate: $0.00
Monthly revenue: $0.00

Status: IDLE
```

---

## 3. Understand the cost

Phase 0 one full loop (objective → approve → research):

| Step | Tokens | Cost |
|---|---|---|
| Propose company | ~5,000 | $0.05 |
| Run research (3 APIs + analysis) | ~8,000 | $0.08 |
| Status/logging | ~1,000 | $0.01 |
| **Total** | **~14,000** | **~$0.14** |

You can run 100+ full loops in a month for $14, well under your $20–50 budget.

---

## 4. What's next (scaling Phase 0 → Phase 1)

**Once Phase 0 is stable (all commands working, research runs weekly without error):**

- **Phase 1:** Add web dashboard (Home view, Company view, live WebSocket updates)
- **Add:** Product/Ops department (the "Forge" — this is where ideas become real products)
- **Add:** Real API integrations (actually pulling from YouTube, TikTok, Gumroad instead of mocking)

For now, Phase 0 validates:
1. ✅ Hermes can propose coherent companies
2. ✅ You can approve/reject (governance works)
3. ✅ Research crew can scan trends (multi-agent delegation works)
4. ✅ Cost is under control (token usage is tracked and minimal)

---

## 5. Troubleshooting

**"ModuleNotFoundError: No module named 'crewai'"**
→ Did you install requirements.txt? Try `pip install -r requirements.txt` again.

**"Anthropic API key not found"**
→ Set `ANTHROPIC_API_KEY` env var: `export ANTHROPIC_API_KEY="your-key"` or add it to a `.env` file.

**"Research crew hangs / takes too long"**
→ First run of CrewAI can be slow. Check that your API key has enough credits.

**"Database locked" error**
→ You probably have two CLI instances running. Close one.

**Hermes proposal seems low-quality / hallucinated**
→ This is expected with Haiku for the worker agents. Phase 1: upgrade to Sonnet for a specific high-value task, or add more specific examples to the prompt.

---

## 6. The real first venture: ecommerce on Gumroad/YouTube/TikTok

Once Phase 0 is proven, your actual first venture proposal will look like:

```
Company: [Your name] Ecommerce
Objective: Find a small, profitable ecommerce niche on Gumroad + YouTube + TikTok

Budget: $500/month
Timeline: 
  Week 1: Research scans trends (DIY, pets, sustainability, etc.)
  Week 2-3: You pick a trend; Product/Ops team builds a landing page + Gumroad store
  Week 4: Growth runs $200 test on YouTube/TikTok influencer seeding
  Week 5+: Validate. If working, scale. If not, pivot.

Success metric: 10+ sales in the first month; if hit, allocate $2k to scale.
Kill condition: <3 sales by week 4; shut down, use budget for next venture.
```

Hermes will propose this. You approve. Then the loop becomes real.

---

## 7. File structure recap

```
station/
  station.db          ← SQLite database (created on first run)
  schema.py           ← Database schema definitions
  crews.py            ← CrewAI crew definitions
  hermes.py           ← Hermes orchestrator (state machine)
  cli.py              ← Your text interface
  requirements.txt    ← Python dependencies
  .env                ← Your API key (create this, don't commit it)
  README.md           ← This file
```

---

## 8. From here

1. **Run Phase 0 end-to-end:** objective → approve → research → status
2. **Let it sit for a week:** Schedule the research crew to run weekly (add a cron job: `python -c "from hermes import Hermes; Hermes().run_research('company_id')" weekly`)
3. **Watch costs:** Keep an eye on your API usage. Phase 0 should burn $0.50–2.00/week.
4. **Prepare Phase 1:** While Phase 0 is running, start sketching the web dashboard and Product/Ops crew. Phase 1 is where ideas become real products.

Happy building. Hermes is waiting for your first objective.
