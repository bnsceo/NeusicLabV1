# Strategy

This document defines the decision style for the first version of the project.

## Objective

Use AI to help identify small, repeatable trades while keeping the process simple enough to inspect by hand.

## Constraints

- Focus on liquid stocks or broad ETFs.
- Avoid highly volatile names at the start.
- Prefer one-signal or low-signal-count strategies.
- Do not use leverage.
- Do not use options for the first version.

## Decision Inputs

- Recent price movement
- Basic news or catalyst summary
- Position sizing limits
- Existing portfolio exposure

## Candidate Outputs

- Buy
- Hold
- Skip

## Success Criteria

- Trade ideas are explainable in one paragraph.
- Each trade has a clear reason to exist.
- Each trade can be rejected by a risk rule.
- The strategy can be reviewed manually.

