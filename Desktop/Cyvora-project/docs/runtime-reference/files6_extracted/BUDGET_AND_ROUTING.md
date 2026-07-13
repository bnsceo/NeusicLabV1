# Budget & Model Routing — $20-50/month, tight controls

## Monthly budget breakdown

| Item | Cost | Notes |
|---|---|---|
| Claude API (mixed models) | $5–12 | Hermes + department leads on Sonnet; workers on Haiku; research on Haiku |
| Hosting (Python + DB) | $5–10 | Render or Railway for the CrewAI service; SQLite for Phase 0, Postgres later |
| YouTube API | Free | Free tier is 10k quota units/day; easily covers scanning channels |
| TikTok API | Free-ish | Official API has free tier; limit to 100 requests/day in Phase 0 |
| Gumroad API | Free | Webhooks are free; polling free via public API |
| External services (Mapbox, TTS) | $0 | Defer to Phase 3+; not needed for Phase 0 |
| Buffer | $3–5 | Overages, unexpected API calls |
| **Total** | **$13–27** | Well under $50 |

The $20–50 budget gives you room for: stronger Sonnet usage on Hermes if you want it, or adding a cheap secondary model, or testing new tools. You're not constrained; you're just not wasteful.

---

## Model routing strategy

**Rule:** Every agent declares what model it needs. Routing happens at the task level, not globally.

```python
# In crew definition:
research_agent = Agent(
    role="Market Scout",
    goal="Find monetizable trends in ecommerce",
    model="claude-3-5-haiku",  # Fast, cheap, good enough for trend scanning
    # ...
)

hermes = Agent(
    role="Executive",
    model="claude-3-5-sonnet",  # Best reasoning for strategy
    # ...
)

treasury_agent = Agent(
    role="Ledger",
    model="claude-3-5-haiku",  # Math is simple; Haiku is fine
    # ...
)
```

**Why this works:**
- Haiku costs ~1/3 of Sonnet and is perfectly fine for: scraping summaries, formatting, arithmetic, simple scoring.
- Sonnet is reserved for: strategic reasoning (Hermes), complex tradeoffs (department leads), anything that needs real judgment.
- You'll spend 60% of your API budget on Haiku, 35% on Sonnet, 5% on overhead.

**Cost math:**
- 1000 Haiku tokens in ≈ $0.003
- 1000 Sonnet tokens in ≈ $0.009
- Hermes doing a strategy brief (10k tokens) ≈ $0.09
- Research scanning 5 YouTube channels (5k tokens total) ≈ $0.015
- A typical approval cycle (Hermes → you → decision → logging) ≈ $0.20

At 100 decisions/month, you're at roughly $20–25 on models. This scales linearly, so even 200 decisions/month stays under $40.

---

## Immediate cost controls to enforce in code

**1. Token budgets per agent per task**
```python
# Research agent can't spend more than 5k tokens per weekly scan
research_task = Task(
    description="...",
    agent=research_agent,
    max_tokens=5000,  # CrewAI will truncate or fail gracefully
)
```

**2. API call budgets**
```python
# TikTok: max 100 requests/day
# YouTube: max 500 quota units/day
# Gumroad: max 10 requests/hour
# Enforce via a rate-limit middleware in your API layer
```

**3. Hard spend ceiling in Treasury**
```sql
-- Enforce in database: max uncommitted spend per company
CREATE TABLE budget_ceilings (
    company_id UUID,
    monthly_ceiling DECIMAL(10,2),
    uncommitted_spend DECIMAL(10,2),
    CHECK (uncommitted_spend <= monthly_ceiling)
);
```

**4. A monitoring script that runs hourly**
```python
# Check: YTD API cost vs budget. If we're on pace to exceed $50, 
# Hermes gets an alert and Research enters "low-volume mode"
```

---

## API free tiers (what you're actually using)

| Platform | Free tier | Limit | Phase 0 use |
|---|---|---|---|
| **YouTube** | Official API | 10,000 quota/day | Scan 3–5 channels weekly |
| **TikTok** | Official API | 100 requests/day | Scan trending hashtags weekly |
| **Gumroad** | Webhooks | Unlimited | Listen for sales in real-time |
| **Claude** | (Anthropic API, model-based pricing) | Pay as you go | ~$5–12/month at this scale |

All three are genuinely free to query within reason. Gumroad's webhook means you don't even poll; you just listen for events.

---

## What NOT to do in Phase 0 to save money

- ❌ Don't use Anthropic's Opus (3x the cost of Sonnet for marginal gains)
- ❌ Don't poll APIs on a short interval (batch weekly instead)
- ❌ Don't store raw API responses in the vector store (store summaries)
- ❌ Don't use Mapbox or fancy dashboards yet (Phase 0 is CLI)
- ❌ Don't run Hermes as a continuous agent (run it on trigger: you ask, it responds, then it sleeps)

---

## The actual monthly ceiling

At this scale, you'll hit:
- **Model cost:** $15–20/month (the variable cost)
- **Hosting:** $5–7/month (fixed)
- **Contingency:** $3–5/month
- **Total:** $23–32/month, with headroom to $50

You're under budget from day one. Spend the headroom on: better reasoning for Hermes, adding a second research angle, or scaling the first venture faster (more API calls, more external integrations).
