# Neusic Agent Bridge

The browser applications load a shared **Neusic Agent** panel. On GitHub Pages it always has an offline, deterministic guide. A local or hosted bridge can additionally connect the same panel to Hermes Agent or CrewAI.

## Start the bridge

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r agents/requirements.txt
uvicorn agents.neusic_agent_server:app --host 127.0.0.1 --port 8765
```

Open any Neusic app, open **AGENT**, choose a provider, and keep the endpoint set to:

```text
http://127.0.0.1:8765/api/neusic-agent
```

## CrewAI

CrewAI is invoked directly by the bridge. Configure the LLM environment variables required by your CrewAI installation before selecting **CrewAI**.

The Neusic crew contains three roles:

- Creative Director
- Audio Engineer
- Producer

They receive a compact snapshot of the active product, tracks, lanes, tempo, samples, workspace, and project state.

## Hermes Agent

Hermes remains a separate agent runtime. The bridge supports either:

```bash
export HERMES_AGENT_URL="http://127.0.0.1:YOUR_PORT/YOUR_ENDPOINT"
```

or a command template:

```bash
export HERMES_COMMAND='your-hermes-wrapper --prompt {prompt}'
```

Use a wrapper or gateway endpoint that returns JSON containing `reply`, `result`, or `message`. The bridge deliberately does not guess a Hermes CLI flag because Hermes installations and gateway configurations can differ.

## CORS

By default the bridge allows local Neusic origins. Override them with a comma-separated list:

```bash
export NEUSIC_AGENT_ORIGINS="http://127.0.0.1:8000,http://localhost:8000"
```

A public GitHub Pages site cannot safely start Python, Hermes, CrewAI, or store private model keys. Keep the bridge local, on a private server, or behind authenticated infrastructure.
