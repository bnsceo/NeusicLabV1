# Repository structure

The repository root is limited to public entrypoints and project configuration.

- `index.html` — GitHub Pages entrypoint
- `suite.html` — compatibility redirect to `suite/`
- `app/` — shared application shell
- `assets/` — images, icons, and screenshots
- `css/` — landing and shared styles
- `scripts/` — browser scripts, workers, tools, and maintenance utilities
- `live-loop/src/` — maintained Live Loop audio, MIDI, storage, and instrument modules
- `live-loop/`, `wave-loom/`, `waveform/`, `livestudio/`, `studio/`, `suite/` — product entrypoints
- `backend/` — backend services
- `tests/` — automated tests
- `docs/` — product and engineering documentation
- `archive/legacy-root/` — historical root duplicates retained for reference

Do not add feature CSS, JavaScript, audio modules, or screenshots directly to the root.
