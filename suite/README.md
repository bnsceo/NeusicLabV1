# Neusical Suite — isolated development preview

Implements the Live Loop → optional Wave Loom → Studio direction approved on September 25, 2026. This is an additive development workspace, not a replacement for the current site and not a production-ready release.

## Run

From the repository root:

```sh
python3 -m http.server 4174
```

Open `http://localhost:4174/suite/`. Microphone access requires HTTPS or localhost. Opening the HTML as a `file://` URL will not work. There are no production dependencies or build steps.

## Implemented paths

- One project and one Web Audio context across the three workspaces.
- Five loop lanes; choose tempo and 1/2/4/8 bars before recording. Capture is scheduled at AudioWorklet sample-frame boundaries, with monitoring off.
- Each overdub is an independent immutable audio asset, not mixed destructively into the prior take.
- Mute, solo, volume, pan, high-shelf EQ, delay and reverb sends; scenes snapshot the lane mix.
- Send an individual take or a derived lane mix to Wave Loom. Original takes remain available.
- Transient slicing, manual boundaries and trim, optional 16 equal slices, gain and rate-based pitch.
- 16 sample pads, keyboard/touch/mouse input and monophonic choke; record a quantized pad pattern.
- Send all live takes straight to Studio or send edited slices/pad patterns from Wave Loom. Repeat transfers are additive.
- Audio timeline with seek, clip dragging, cross-track moves, start/length/source-offset edits, split, duplicate, delete, undo/redo, mixer and effects.
- Offline stereo 48 kHz / 16-bit WAV mix export, plus browser-encoded live performance capture decoded to WAV when supported.
- IndexedDB autosave in a new database namespace; local session picker; portable `.neusic` files containing PCM and metadata.
- Responsive layouts and a clearly labeled synthesized demo. No fake recorded audio is preloaded.

## Explicit limitations / not yet verified

- **Browser rendering and live Web Audio tests have not run in this environment.** Playwright is present but its browser executable is absent; the download endpoint returns HTML “Site Unavailable.” `tests/browser.mjs` is a prepared test suite, not passing evidence.
- Physical microphone latency, headphone routing, iOS/Safari capture, backgrounding, and real-device touch behavior remain untested. Sample-frame scheduling does not by itself compensate hardware input latency.
- Tempo and loop length lock once recorded material exists. Pitch-preserving time-stretch is not implemented. Sample pitch changes playback rate and duration.
- Fixed-length loop capture only; no free-time first-loop length detection, count-in metronome, punch-in, or latency calibration yet.
- Scene changes are immediate with gain ramps, not bar-quantized.
- Multiple raw takes on one Studio track can overlap; individual take-lane visualization/comping remains to be implemented.
- No MIDI/instrument tracks, plug-in hosting, MP3 encoder, commercial mastering/loudness checks or automatic normalization.
- Live performance capture uses browser MediaRecorder; encoder availability and decode support vary. Source takes remain independent.
- WAV render limit is 10 minutes; file import 100 MB; portable JSON project 250 MB. JSON PCM backups are intentionally simple, not a compressed archive format.
- Older app projects are not automatically migrated. Legacy apps and databases are untouched.
- There is no cloud sync or account system. Browser storage can be evicted; export project backups.

## Tests

```sh
cd suite
npm test
```

The unit suite covers the shared data model, non-destructive transfers, transient detection, choke rendering, WAV encoding, and capture-worklet frame boundaries. These are **unit tests**, not real-device audio tests.

To run browser integration tests on a machine with Playwright and Chromium installed, serve the repo as above, then:

```sh
node suite/tests/browser.mjs
```

`SUITE_TEST_URL` may override the local URL; include `?test=1` on localhost to enable the test-only inspection hook. The suite uses a browser-provided fake microphone and tests actual Web Audio, reload/portable persistence, transfers, timeline editing, downloads and responsive widths. It writes screenshots into `suite/tests/evidence/`.

## Deployment boundary

The existing `live-loop/`, `wave-loom/`, `app/`, landing page, CNAME and GitHub Pages workflow are unchanged. The new `suite/` is not included by the production packaging workflow. No merge or deployment is part of this branch. Canonical routing/migration must be reviewed separately after real browser and device verification.
