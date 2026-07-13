# Zero-Cost Runtime Phase 3

## Purpose

Cyvora can now run its complete execution workflow without spending money on model tokens or contacting external services.

The runtime no longer needs to know whether a provider or connector is mocked or real. It calls a stable interface, and configuration selects the implementation.

## Model provider architecture

```text
Execution Worker
    ↓
Provider Registry
    ├── MockProvider (enabled now)
    └── AnthropicProvider (disabled unless explicitly allowed)
```

Environment switches:

```env
CYVORA_MODEL_PROVIDER=mock
MOCK_MODE=true
ALLOW_PAID_AI=false
```

The Anthropic provider refuses to start unless:

```env
CYVORA_MODEL_PROVIDER=anthropic
ALLOW_PAID_AI=true
ANTHROPIC_API_KEY=...
```

This prevents accidental paid execution.

## Connector architecture

```text
Worker / Future Tool Registry
    ↓
Connector Registry
    ├── Mock GitHub
    ├── Mock Gmail
    ├── Mock YouTube
    └── Future real connectors
```

Current setting:

```env
CYVORA_CONNECTOR_MODE=mock
```

Mock connector actions:

- Do not contact external services
- Return a deterministic mock reference
- Preserve the requested action and payload
- Are marked `simulated=true`
- Are considered reversible

## Policy engine

`worker/policy.py` decides:

- Provider mode
- Validation policy
- Whether result approval is required
- Whether external actions are allowed
- Connector mode

Current guarantees:

```text
Mock provider selected
Mock connectors selected
External side effects disabled
High and critical risk results require founder approval
```

## Public runtime status

A new endpoint is available:

```text
GET /api/runtime/providers
```

It reports only safe configuration status:

- Selected provider
- Whether paid AI is allowed
- Whether credentials are configured
- Connector mode
- Whether external effects are disabled

It never returns secret values.

## Tests

Run:

```bash
python3 scripts/test-zero-cost-runtime.py
python3 scripts/test-phase2-worker.py
```

Both tests pass in the supplied package.

## Turning on real mode later

Turning on real model execution will eventually be a configuration change:

```env
CYVORA_MODEL_PROVIDER=anthropic
ALLOW_PAID_AI=true
ANTHROPIC_API_KEY=your-key
MOCK_MODE=false
```

Real connectors are intentionally not enabled yet. Each must be implemented behind the same connector interface with secure credentials, permissions, audit logs, and approval policies.

## Important clarification

The goal is not literally “add keys and every external service becomes real.”

The architecture makes that possible without rewriting the worker, but every real provider and connector still needs its adapter implemented and tested once.

After an adapter exists, switching between mock and real mode is configuration-driven.
