# NeusicWave

NeusicWave is a browser music environment with a live performance instrument, sound design tools, and a multitrack audio studio.

| App | Path | Role | Release status |
| --- | --- | --- | --- |
| **Neusic Live Loop** | `/live-loop/` | Capture voice, instruments, and loops; perform and export a mix. | Current release |
| **Wave Loom** | `/wave-loom/` | Transform and continue sound from Live Loop. | Future release |
| **Neusic Studio** | `/studio/` | Arrange, record, mix, save, and export multitrack audio. | Desktop prototype on review branch |

## Neusic Studio prototype

The first Studio build is an audio-first browser workstation. It currently supports:

- multiple audio tracks with import and microphone recording
- waveform clips that can be moved along the arrangement
- playback transport, tempo display, track volume, pan, mute, and solo
- portable `.neusic` project save and open
- WAV mix export

This is a review build, not a complete DAW release. MIDI editing, plug-in hosting, clip trimming, time stretching, and mobile layout are not implemented in this Studio prototype. The existing Live Loop app remains the current release.

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

The intended workflow remains:

`Neusic Live Loop → Wave Loom → Neusic Studio`

Live Loop will pass a recorded or imported sound to Wave Loom for transformation. Wave Loom will pass developed material to Studio for arrangement and song continuation. Those transfers should remain explicit, local-first, and versioned; the current Studio prototype does not activate that cross-app workflow.

## Deployment

GitHub Pages publishes each app under its own path. The Studio prototype is isolated on its review branch; this update has not been merged or deployed to `neusicwave.com`.
