# Execution Flow

## Sequence

1. Market watcher collects context.
2. Strategy agent proposes a trade.
3. Risk checker validates the idea.
4. Human approver makes the final decision.
5. If approved, the trade is entered manually or through an officially supported integration.
6. The result is logged and reviewed.

## Logging

Each run should record:

- Timestamp
- Symbols considered
- Proposed action
- Risk check result
- Human decision
- Final outcome

## Operating Principle

If the workflow becomes hard to explain, pause and simplify it.

