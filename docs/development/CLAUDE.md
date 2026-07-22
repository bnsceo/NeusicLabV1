# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

NeusicLab is a browser-based music production suite built with dependency-free vanilla JavaScript, Web Audio API, and IndexedDB. There is **no bundler, no framework, and no build step** for the frontend — HTML pages load numbered CSS/JS files directly with `<link>`/`<script>` tags. The site deploys to GitHub Pages; optional Python (FastAPI) backends add AI-agent features when run locally.

The suite contains three apps plus a landing page (`index.html`):

- **Studio / Neusic DAW** — `studio/index.html` is the canonical route. It uses `<base href="../app/">` so all assets actually live in `app/` (`app/css/`, `app/js/`). `App/index.html` is only a redirect to `../studio/`.
- **Wave Loom** — `wave-loom/`, a sampling/capture workspace (AudioWorklet recording, sample chopping, transfer to Studio).
- **Live Loop Lab** — `live-loop/`, a loop performance app.

## Commands

```bash
npm install                     # only dev dependency is @playwright/test

# Node-based source tests (fast, no browser)
npm run test:wave-core          # wave-loom source integrity
npm run test:suite-core         # studio/app source integrity
npm run test:restoration        # restoration checks
npm run test:wave               # all three of the above

# Browser smoke tests (Playwright, desktop + mobile Chromium)
npm run test:browser

npm test                        # everything

# Run a single node test file
node --test tests/neusic-suite/mobile-lanes.test.mjs

# Run a single Playwright spec / test
npx playwright test --config tests/wave-loom/playwright.config.mjs wave-loom.spec.mjs
npx playwright test --config tests/wave-loom/playwright.config.mjs -g "test name"
```

Serving locally: any static server from the repo root works (`python3 -m http.server 4173`). The Playwright config auto-starts `python3 -m http.server 4173` and runs against `http://127.0.0.1:4173` with fake media devices and mic permission granted.

Python components (each optional, all local-first):

```bash
python3 start_neusic.py                                   # one-command Studio + Hermes bridge at http://127.0.0.1:8787/studio/
uvicorn app.main:app --reload --port 8000                 # from backend/ — Agent Backend (Hermes/Ollama/memory API)
uvicorn agents.neusic_agent_server:app --port 8765        # from repo root — shared AGENT panel bridge (Hermes/CrewAI)
python3 scripts/build_pages.py                            # regenerate Pages metadata, social cards, shared chrome
```

## Architecture

### Numbered load-order convention (the core convention of this codebase)

The DAW is built as ~45 incremental, numbered modules: `app/js/01-state.js` through `app/js/45-nw-demo-gate.js`, with matching numbered CSS in `app/css/`. Files are loaded in numeric order by `studio/index.html` and communicate through `window`-scoped globals — later modules extend or harden earlier ones (e.g. `39-studio-workspace-v4.js` then `40-studio-v4-hardening.js`). When adding a feature, add a new numbered file and register it in `studio/index.html` in the right position rather than rewriting an existing module. Wave Loom follows the same pattern without number prefixes; its required script order is asserted by tests.

### Source-integrity tests

`tests/wave-loom/source-integrity.test.mjs` and `tests/neusic-suite/*.test.mjs` are **static assertions on source code**, not runtime tests. They verify that files parse (`node --check`), that HTML loads scripts in the required dependency order, and that specific identifiers/patterns exist in specific files (e.g. one shared `AudioContext`, the PCM ring buffer in `neucapture-worklet.js`, IndexedDB store names in `wave-project-store.js`). If you rename a file, reorder scripts, or refactor a guarded pattern, these tests will fail — update the assertions deliberately, don't weaken them.

### Shared product state

Per `docs/NEUSIC_PRODUCT_BLUEPRINT.md`, the product promise is one journey (capture → chop → perform → arrange → mix → export) sharing one project state, one transport, one timeline. Key layers:

- Project layer: versioned project schema, IndexedDB autosave/recovery, portable `.neusic` export, audio-buffer registry with stable IDs.
- Cross-app transfer: Wave Loom → Studio via `wave-loom/studio-transfer.js` and `app/js/34-wave-transfer-receiver.js`; Live Loop → Wave Loom via `live-loop-receiver-v3.js`.
- Audio: exactly one browser `AudioContext`, shared through `wave-loom/audio-workspace.js`; capture runs in an AudioWorklet (`neucapture-worklet.js`) with a Float32 ring buffer.

`docs/` holds the phase blueprints/roadmaps that drove each numbered module — check there before redesigning a workspace.

### Current phase: NeusicWave (Phase 2B)

The suite is being rebranded/expanded as **NeusicWave** — see `docs/NEUSICWAVE_PHASE2B_HANDOFF.md` for the full spec. The `nw-` prefixed modules are this phase's shell: `app/css/30-nw-tokens.css` (design tokens), `31-nw-shell.css`, `32-nw-menubar.css`, and `app/js/42-nw-shell.js`, `43-nw-menubar.js`, `44-nw-agent.js` (agent client), `45-nw-demo-gate.js` (Save gated behind Pro; Export stays free).

**Design system (locked)** — defined in `30-nw-tokens.css`, selected via `body[data-product]`:

- Lab / NeusicLab (Studio): gold `#d4a574` — `data-product="lab"`
- Wave / Waveform: silver `#b0b3b2` — `data-product="wave"`
- Live / LiveStudio: copper `#c97d5a` — `data-product="live"`
- Emerald `#07de89` is reserved for meters/signal — never use it as a product accent.
- Industrial hardware aesthetic: recessed/raised inset borders, uppercase condensed labels, reusable classes `.nw-surface`, `.nw-well`, `.nw-label`, `.nw-micro`, `.nw-btn`.

**Phase 2B pages** (built; real engines land in a later phase):

- `waveform/` — sound design page, silver accent (`data-product="wave"`), entry key `nw-entered-wave`. Page-local `css/50-waveform-hero.css`, `css/51-waveform-shell.css`, `js/50-waveform-shell.js`.
- `livestudio/` — loop station page, copper accent (`data-product="live"`), entry key `nw-entered-live`, seeds agent `performanceMode: "live"`. Page-local `css/52-livestudio-hero.css`, `css/53-livestudio-shell.css`, `js/52-livestudio-shell.js`.
- Root `index.html` — the NeusicWave hub landing (tri-accent rule, three product cards, FAQ with the `#pricing` anchor the demo gate targets) styled by `css/60-hub-landing.css`. It keeps footer links to the legacy Wave Loom / Live Loop Lab workspaces, which several restoration tests assert.

Both app pages link the shared modules as `../app/css/30-nw-tokens.css`, `../app/css/32-nw-menubar.css`, `../app/js/44-nw-agent.js`, `../app/js/45-nw-demo-gate.js`, and each page's shell JS provides its own menubar, stub engine functions, and a guarded `NWDialogs` copy. **Deploy caveat**: the Pages workflow deploys `app/` as `/studio/`, so those four shared files are also copied verbatim to `_site/app/…` — keep that list in sync if pages start sharing more NW modules, and remember any new top-level directory must be added to the workflow's copy steps before it will deploy.

### AI agent integrations (privacy boundary)

Three separate Python entry points exist; all are local-first and never receive raw audio:

- `backend/` — FastAPI "Agent Backend" used by the DAW (File → Settings → Backend URL). Provider fallback order: hosted Hermes (`HERMES_API_URL`) → auto-detected local Ollama → built-in offline advisor (always works). SQLite schema in `backend/app/services/memory_service.py` is the migration source of truth.
- `agents/neusic_agent_server.py` — bridge for the shared AGENT panel (Hermes or CrewAI) at `http://127.0.0.1:8765/api/neusic-agent`.
- `integrations/hermes-bridge/` — restricted Hermes bridge launched by `start_neusic.py`.

Only structured metadata (project name, tempo, track/clip/effect state) is ever sent to agents — never `AudioBuffer` data, recordings, sample files, or credentials. Preserve that boundary. The GitHub Pages build must keep working fully offline (deterministic built-in guide) since Pages cannot run the Python bridges.

## CI and deployment

- `.github/workflows/wave-loom-reliability.yml` runs all node tests plus the Playwright browser suite on pushes/PRs touching frontend paths.
- `.github/workflows/deploy-neusic-pages.yml` deploys to GitHub Pages on push to `main` by **copying an explicit list of files** into `_site/`. A new top-level file or directory will not deploy until it is added to that workflow's copy steps.
