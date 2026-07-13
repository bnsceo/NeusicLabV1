"""
CrewAI crew definitions for the autonomous holding company.
Phase 0: Research + Treasury only.
"""

from crewai import Agent, Task, Crew, Process
from typing import Optional

# Cost-optimized model assignments
HERMES_MODEL = "claude-3-5-sonnet-20241022"  # Strategic reasoning
LEAD_MODEL = "claude-3-5-sonnet-20241022"    # Department heads use Sonnet
WORKER_MODEL = "claude-3-5-haiku-20241022"   # Scouts, formatters use cheaper Haiku


def create_research_crew(company_id: str) -> Crew:
    """
    Research & Trends department crew.
    Scans YouTube, TikTok, Gumroad for ecommerce trends and monetization angles.
    """
    
    scout = Agent(
        role="Market Scout",
        goal=f"Find monetizable ecommerce trends across YouTube, TikTok, and Gumroad. Report to Hermes weekly.",
        backstory="""You are an expert at spotting emerging markets and consumer behavior shifts.
        You scan publicly available data from creator platforms and product marketplaces,
        identify patterns that signal demand, and propose new ventures.
        You're cost-conscious and accurate — no hallucinations, only data-backed insights.""",
        model=WORKER_MODEL,
        verbose=True,
    )
    
    scraper = Agent(
        role="Data Scraper",
        goal="Fetch and summarize data from YouTube, TikTok, and Gumroad APIs.",
        backstory="""You are careful with API quotas. You fetch only what's needed,
        cache results, and hand off clean summaries to the Scout.""",
        model=WORKER_MODEL,
    )
    
    analyst = Agent(
        role="Trend Analyst",
        goal="Score trends by growth velocity, audience size, and monetization potential.",
        backstory="""You take the Scout's raw findings and apply scoring frameworks.
        You rank trends, flag false signals, and highlight the top 3–5 actionable angles.""",
        model=WORKER_MODEL,
    )

    # Task 1: Scrape
    scrape_task = Task(
        description="""
        Fetch the latest data from:
        1. Top 5 ecommerce-related YouTube channels (e.g., "Honest Reviews", "Unboxing", product reviews)
        2. Top trending hashtags on TikTok in shopping/lifestyle (#TikTokShop, #ProductReview, #HaulVideo)
        3. Top-selling products on Gumroad in the last 7 days (digital + physical)
        
        Return a clean JSON summary:
        {
            "youtube": [{"channel": "...", "trending_topics": [...], "view_count_trend": "..."}],
            "tiktok": [{"hashtag": "...", "trend_direction": "rising/stable/falling", "avg_views": "..."}],
            "gumroad": [{"category": "...", "top_product": "...", "sales_momentum": "..."}]
        }
        """,
        agent=scraper,
        expected_output="Clean JSON summary of trending topics across YouTube, TikTok, Gumroad.",
    )
    
    # Task 2: Analyze
    analyze_task = Task(
        description="""
        Given the scraped data, score each trend by:
        1. Growth velocity (is it accelerating?)
        2. Audience size and engagement (how many people care?)
        3. Monetization potential (can this be a business?)
        4. Saturation (how many competitors already exist?)
        
        Output a ranked list of top 5 trends and the one you'd recommend launching.
        Example:
        1. "DIY organic pet supplements" — 3.2x growth, 40k monthly searches, low competition. **RECOMMEND LAUNCH**
        2. "Sustainable packaging for small businesses" — steady, 12k searches, medium competition.
        ...
        """,
        agent=analyst,
        context=[scrape_task],
        expected_output="Ranked trend analysis with top 5 opportunities and 1 launch recommendation.",
    )
    
    # Task 3: Scout brief
    scout_brief_task = Task(
        description="""
        Summarize your findings into a 300-word brief for Hermes:
        - The trend you recommend
        - Why it's happening now (cultural, economic, technical shifts)
        - Estimated market size (searches, audience, revenue potential)
        - Go-to-market angle (who do you target first? How do you reach them?)
        - Budget estimate to launch and validate (assume $500–2000 for testing)
        - Risk flags (saturation, regulatory, supply chain)
        
        End with a single recommendation: LAUNCH or DEFER.
        """,
        agent=scout,
        context=[scrape_task, analyze_task],
        expected_output="Executive brief on the top ecommerce trend and launch recommendation.",
    )

    research_crew = Crew(
        agents=[scout, scraper, analyst],
        tasks=[scrape_task, analyze_task, scout_brief_task],
        process=Process.hierarchical,  # Scout leads; others report to scout
        manager_agent=scout,
        verbose=True,
    )

    return research_crew


def create_treasury_crew(company_id: str) -> "Agent":
    """
    Treasury department (simplified for Phase 0).
    Single agent, no crew — just tracks spend and enforces ceilings.
    """
    
    ledger = Agent(
        role="Ledger",
        goal=f"Track spending and enforce budget ceilings for {company_id}.",
        backstory="""You are the financial guardian. You know every dollar spent,
        enforce hard spending limits, and alert Hermes the moment burn exceeds plan.""",
        model=WORKER_MODEL,
    )
    
    return ledger


def create_hermes_agent() -> Agent:
    """
    Hermes: Executive AI Core.
    Interprets your objectives, proposes companies, maintains operating picture.
    """
    
    hermes = Agent(
        role="Executive AI Core",
        goal="""
        Interpret the human's business objective and turn it into a company.
        Propose a strategy (market thesis, departments, budget, timeline).
        Maintain the operating picture — always know what every company is doing.
        Escalate decisions to the human only when they cross a threshold.
        Stay under budget constraints. Be cost-conscious in every token spent.
        """,
        backstory="""
        You are the CEO's assistant and the organization's command center.
        You don't do work — you delegate to departments and collect results.
        You think strategically, reason clearly, and only ask the human for approval
        when something is genuinely ambiguous or risky.
        You have perfect memory of every decision and can recall context instantly.
        """,
        model=HERMES_MODEL,
    )
    
    return hermes


# Task templates for the main loop

def propose_company_task(objective: str) -> Task:
    """Task for Hermes to propose a new company based on objective."""
    return Task(
        description=f"""
        The human has set this objective: "{objective}"
        
        Propose a company to pursue it:
        1. Name (catchy, memorable)
        2. Market thesis (why this now?)
        3. Go-to-market (who are the first customers? how do you reach them?)
        4. Department structure (which of the standing depts do you need? Research, Treasury, Product, UX, Growth?)
        5. Budget estimate (total cost to validate, cost to launch if validated)
        6. Timeline (research phase → validation → launch → scale)
        7. Success metrics (what does "win" look like?)
        8. Risk flags (what could go wrong?)
        
        Output: A structured proposal the human can approve or redirect.
        """,
        agent=create_hermes_agent(),
        expected_output="Structured company proposal with thesis, go-to-market, budget, and timeline.",
    )


def maintain_operating_picture_task() -> Task:
    """Task for Hermes to read the database and summarize current state."""
    return Task(
        description="""
        Read the database and generate the current operating picture:
        1. How many companies are active? What stage are they in?
        2. What decisions are pending the human's approval?
        3. What's the monthly burn rate? Revenue? Profitability?
        4. Are any departments off-plan or stalled?
        5. Is anything approaching a risk threshold?
        
        Output a one-page summary the human can scan in 30 seconds.
        """,
        agent=create_hermes_agent(),
        expected_output="One-page operating picture summary.",
    )


if __name__ == "__main__":
    # Test: create research crew and print structure
    crew = create_research_crew("ecommerce-v1")
    print(f"✓ Research crew created with {len(crew.agents)} agents and {len(crew.tasks)} tasks")
