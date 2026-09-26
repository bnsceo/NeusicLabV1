# Approved Neusical Suite direction

Source of truth: user requirements and approved Live Loop / Wave Loom / Studio mock-ups in the September 25, 2026 discussion. Those supersede older touch-first or strictly sequential product notes.

## Locked requirements

- Desktop first, mobile responsive.
- Live Loop is a complete one-person improvisation/performance workspace, not merely an upload screen. Voice, beatboxing and instruments form synchronized independent layers. Reggie Watts is the performance reference.
- Wave Loom is optional. Send one sound or performance to sample, edit and chop it; automatic transient slices map to 16 pads with monophonic choke. DJ Premier and J Dilla are the creative references.
- Studio is a conventional linear arrangement workspace inspired by FL Studio: raw audio and pad performances, song sections, faders, effects, final audio export.
- Live Loop can go directly to Studio. All three spaces share one project. Repeated capture → sample → arrange cycles must remain possible.
- Preserve raw recordings and independent takes. Never silently flatten the user's only originals.
- Approved visual language: graphite surfaces, restrained cyan highlights, color-coded audio, compact horizontal loop lanes, one focused inspector, persistent top transport, clear destination actions.
- Mock-up corrections: one shared project tempo and waveforms for raw audio rather than misleading MIDI-note graphics.

## Authorization / isolation

The user authorized beginning implementation in a separate branch **with no deployment**. This implementation starts from main commit `2161310f4d9d25bb8c19ff804d4a5c66fb5ae94b` on `codex/neusical-suite-approved-v1`. Existing routes, production packaging, and previous attempts are preserved.

## Source inspection

- Current repository README, product blueprint, main Pages workflow, Live Loop looper/PCM/worklet, legacy app state/project IO, Wave Loom sample playback and Studio transfer code.
- `NeusicAi.zip`: earlier Live Loop modules, Wave Loom modules and a separate Tone.js/Vite studio experiment.
- `02 NeusicWave Projects.zip`: DAW/desktop material and historical Live Loop release-review patches/evidence paths. These were not treated as newer than current main.
- Main's looper merges overdubs with `mixBuffers`, and the apps carry separate state/transfer conventions. The additive preview isolates a new non-destructive project model instead of importing all legacy UI patches.

## First implementation boundary

See `suite/README.md` for implemented code paths, test commands, and exact limitations. The work is a development implementation and must not be presented as a finished or verified DAW. Browser and device checks are the next gate before canonical route integration.
