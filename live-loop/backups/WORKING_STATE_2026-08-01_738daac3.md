# Neusic Live Loop — Working Recording State Backup

**Baseline commit:** `738daac3f48c7497bc9046094aa214f7c5db27f8`

**Created:** 2026-08-01

This commit is the confirmed working cross-browser recording baseline reported by the project owner before multi-lane mix stabilization.

## Confirmed state at this backup

- Dry recording works.
- Recording works on iPhone and the other tested devices.
- AutoTune is independent from microphone startup.
- One and two simultaneous loop lanes play acceptably.
- Three to five lanes can overload or interfere with each other.

## Files protected by this rollback point

- `live-loop/index.html`
- `live-loop/app.js`
- `live-loop/mobile-mic-primer.js`
- `live-loop/src/audio/AudioWorkspace.js`
- `live-loop/src/audio/PcmRecorder.js`
- `live-loop/src/audio/Looper.js`
- `live-loop/src/audio/effects/TapeDelay.js`
- `live-loop/src/audio/effects/SpatialReverb.js`
- `live-loop/stage-performance.js`
- AutoTune and scene enhancement scripts loaded by the stage controller

## Restore the entire Live Loop directory

From a local clone:

```bash
git restore --source 738daac3f48c7497bc9046094aa214f7c5db27f8 -- live-loop
git commit -m "Restore confirmed working Live Loop recording baseline"
```

Alternative command for older Git versions:

```bash
git checkout 738daac3f48c7497bc9046094aa214f7c5db27f8 -- live-loop
git commit -m "Restore confirmed working Live Loop recording baseline"
```

## Restore only the recording architecture

```bash
git restore --source 738daac3f48c7497bc9046094aa214f7c5db27f8 -- \
  live-loop/app.js \
  live-loop/mobile-mic-primer.js \
  live-loop/src/audio/AudioWorkspace.js \
  live-loop/src/audio/PcmRecorder.js \
  live-loop/src/audio/Looper.js \
  live-loop/index.html
```

Do not delete this file until the public release has passed the full device test matrix.
