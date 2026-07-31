# NeusicWave

NeusicWave is a three-part browser music environment. Each part has a different job and is released independently:

| App | Path | Role | Release status |
| --- | --- | --- | --- |
| **Neusic Live Loop** | `/live-loop/` | Capture voice, instruments, and loops; perform and export a mix. | Current release |
| **Wave Loom** | `/wave-loom/` | Transform and continue sound from Live Loop. | Future release |
| **Neusic Studio** | `/studio/` | Arrange and develop songs in a fuller studio workflow. | Future release |

## Live Loop

Open the local app through an HTTP server so ES modules and the AudioWorklet can load:

```bash
cd NeusicLabV1
python3 -m http.server 4174
```

Then visit `http://127.0.0.1:4174/live-loop/`.

Current Live Loop features:

- five synchronized loop lanes
- microphone capture and Capture Last Phrase
- scenes A/B/C
- piano key and scale highlighting
- level, pan, delay, space, and Auto-Tune mode controls
- Undo/Redo
- local WAV mix export
- AudioWorklet pitch detection foundation

## Planned handoff

The future workflow is:

`Neusic Live Loop → Wave Loom → Neusic Studio`

Live Loop will pass a recorded or imported sound to Wave Loom for transformation. Wave Loom will pass developed material to Studio for arrangement and song continuation. Those transfers should remain explicit, local-first, and versioned; this release does not activate that cross-app workflow yet.

## Deployment

GitHub Pages publishes each app under its own path. This release updates the Live Loop path only; Wave Loom and Studio remain future-release surfaces.
