# Backend Hardening Phase 2

Implemented:

- Candidate output lifecycle
- Deterministic validation records
- Result-acceptance approvals for high/critical risk work
- Automatic finalization for low/medium schema-validated work
- Actual provider token usage capture
- Estimated provider cost records
- Validation API endpoint
- Revision counters and validation-policy fields

## State flow

```text
agent output -> candidate -> schema validation -> policy
  -> low/medium: final
  -> high/critical: awaiting_result_approval -> founder approval -> final
```

Consensus review remains a later provider behind the validation interface.
