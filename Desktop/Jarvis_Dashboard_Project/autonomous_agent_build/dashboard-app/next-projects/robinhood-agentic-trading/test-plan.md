# Test Plan

This plan assumes a safe first experiment.

## Phase 1: Research Only

- Use agents to summarize market context.
- Do not send orders.
- Review all output manually.

## Phase 2: Paper-Style Workflow

- Generate fake trade candidates.
- Score each candidate.
- Verify the risk rules catch bad ideas.
- Confirm the prompts produce stable output.

## Phase 3: Tiny Live Test

- Use a dedicated account.
- Use a small dollar amount.
- Use only one or two symbols.
- Require manual approval before every order.
- Keep the session short and logged.

## Exit Criteria

- Any unclear trade explanation
- Any unexpected order suggestion
- Any rule violation
- Any loss of control over the workflow

