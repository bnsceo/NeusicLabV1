# Robinhood Agentic Trading

This folder is the starting point for a future project about using AI agents with Robinhood in a controlled way.

Robinhood currently markets "Agentic Trading" on its homepage and says users can give an agent a dedicated Robinhood account to trade in and monitor activity in the app. That makes this a real product direction, but it is still a high-risk financial workflow.

## Goal

Build a small agent setup that can help with trading decisions without giving up control.

## Rules

- Start with a dedicated account, not the main account.
- Use only money you can afford to lose.
- Keep the first test small, for example $50.
- Prefer stocks or ETFs over options, futures, or leverage.
- No margin.
- No unattended trading at the beginning.
- Require human approval before every order until the workflow is proven safe.
- Log every recommendation, order, and outcome.

## Agent Roles

- Market watcher: collects prices, headlines, and basic movement data.
- Risk checker: rejects trades that violate rules.
- Strategy agent: proposes trades based on the current plan.
- Human approver: makes the final decision.

## Workflow

1. Define the trading universe.
2. Define the risk rules.
3. Generate trade candidates.
4. Score the candidates.
5. Require human approval.
6. Place only approved orders.
7. Review results and adjust the rules.

## What Not To Do

- Do not connect a general browser bot directly to a live Robinhood session unless Robinhood explicitly supports that integration.
- Do not start with options trading.
- Do not try to turn $50 into $1,000 quickly.
- Do not treat an AI agent as a substitute for judgment.

## Notes

- The Robinhood feature is product-dependent and may be limited by account type, eligibility, or rollout status.
- Before implementing anything real, verify Robinhood's current docs, supported APIs, and account-level constraints.
- If no official programmatic trading path is available, keep the agent in a research-only mode.

## Files

- [Strategy](./strategy.md)
- [Risk](./risk.md)
- [Test Plan](./test-plan.md)
- [Agent Prompts](./agent-prompts.md)
- [Execution Flow](./execution-flow.md)
- [Config](./config.yaml)
- [Dry Run](./dry-run.py)
- [Example Log](./logs/example-run.json)
