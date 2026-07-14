# Neusic Hermes Agent Bridge

Neusic is a static browser DAW. Hermes Agent is a local or server-side process. The correct integration is a small bridge between them—not installing Hermes inside GitHub Pages and never putting provider keys in browser JavaScript.

## What the bridge does

- Accepts a producer question plus structured Neusic project metadata.
- Never receives raw audio buffers.
- Invokes Hermes in scripted one-shot mode.
- Restricts Hermes to the empty `context_engine` toolset.
- Returns only the final advisory response.
- Applies no DAW changes automatically.

## Requirements

1. Install and configure Hermes Agent.
2. Confirm this works in a terminal:

```bash
hermes -z "Reply READY" --toolsets context_engine
```

3. Start the bridge:

```bash
cd integrations/hermes-bridge
python3 server.py
```

Default endpoint:

```text
http://127.0.0.1:8787/api/hermes
```

For a locally served Neusic build, paste that endpoint into **Copilot → Hermes Bridge**.

## Configuration

```bash
export NEUSIC_HERMES_PROFILE="default"
export NEUSIC_HERMES_MODEL=""
export NEUSIC_HERMES_PROVIDER=""
export NEUSIC_ALLOWED_ORIGINS="http://localhost:8000,https://bnsceo.github.io"
export NEUSIC_HERMES_TIMEOUT="90"
python3 server.py
```

Set provider and model together when overriding the configured Hermes default.

## GitHub Pages

The public Neusic site is HTTPS. A production bridge must also use HTTPS through a reverse proxy, secure tunnel, VPS, or serverless container. Add authentication before exposing the bridge to other users. Never publish an unrestricted Hermes bridge to the public internet.

## Security

Hermes scripted one-shot mode automatically bypasses interactive approvals, so the bridge explicitly selects `context_engine`, an empty toolset. Terminal, file, browser, cron, messaging, computer-control, and automation tools are therefore unavailable to Neusic requests.

A future advanced integration should use a dedicated Neusic MCP server with narrowly defined read tools and confirmation-required write tools.
