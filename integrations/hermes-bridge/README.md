# Neusic Hermes Agent Runtime

Neusic is a browser DAW and Hermes Agent is a local or server-side process. This integration keeps those boundaries separate while making local use a one-command experience.

## One-command local launch

From the Neusic repository root:

```bash
python3 start_neusic.py
```

The launcher will:

1. Verify that the `hermes` command is installed and configured.
2. Start the restricted Hermes bridge.
3. Serve the Neusic landing page and Studio from the same local origin.
4. Open `http://127.0.0.1:8787/studio/` in the default browser.
5. Let the Production Copilot detect and connect to Hermes automatically.

Stop it with `Ctrl+C` in the terminal.

## Required Hermes setup

Hermes must already have a working provider or OAuth session. Confirm or repair that separately with:

```bash
hermes model
hermes doctor
```

A direct bridge check is available with:

```bash
python3 integrations/hermes-bridge/server.py --check-only
```

## What is exposed to Hermes

Neusic sends structured metadata only:

- project name and tempo
- track names, types, instruments and fader values
- mute, solo and record-arm state
- active effect names
- clip types, positions and lengths
- arranger section names and lengths

Raw `AudioBuffer` data, recordings, sample files and provider credentials are never included.

## Security model

Hermes is invoked in scripted one-shot mode with the empty `context_engine` toolset. Neusic requests therefore receive no terminal, file, browser, cron, messaging or computer-control tools.

The local runtime binds to `127.0.0.1` by default. A non-local bind is refused unless `NEUSIC_HERMES_TOKEN` is set.

For a protected bridge:

```bash
export NEUSIC_HERMES_TOKEN="use-a-long-random-secret"
python3 integrations/hermes-bridge/server.py --host 0.0.0.0
```

Enter the same token in **Copilot → Hermes Bridge → Bridge Token**. The browser keeps that token in `sessionStorage`, not persistent project data.

A public deployment also requires HTTPS, a reverse proxy or secure tunnel, authentication and an exact `NEUSIC_ALLOWED_ORIGINS` allowlist.

## Configuration

```bash
export NEUSIC_HERMES_PROFILE="default"
export NEUSIC_HERMES_MODEL=""
export NEUSIC_HERMES_PROVIDER=""
export NEUSIC_HERMES_TIMEOUT="90"
export NEUSIC_ALLOWED_ORIGINS="https://bnsceo.github.io"
```

Set provider and model together when overriding Hermes's configured default.

## Manual bridge-only mode

```bash
python3 integrations/hermes-bridge/server.py
```

Default API endpoint:

```text
http://127.0.0.1:8787/api/hermes
```

## Local URLs

When using `python3 start_neusic.py`:

- Landing page: `http://127.0.0.1:8787/`
- Studio: `http://127.0.0.1:8787/studio/`
- Health check: `http://127.0.0.1:8787/health`
- Hermes endpoint: `http://127.0.0.1:8787/api/hermes`

Hermes remains advisory-only. DAW changes still require explicit Neusic controls and remain subject to undo/autosave.
