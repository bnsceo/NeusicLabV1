# Neusic Product Blueprint

## Product promise

Neusic is a touch-first production environment built around one uninterrupted creative journey:

**capture → analyze → chop → perform → arrange → record → mix → master → export**

Its advantage is not the raw number of features. Its advantage is that recording, sampling, MIDI, arrangement, mixing, and export share one project state, one transport, one timeline, and one set of gestures.

## Primary user journey

1. Create a focused project from a production template.
2. Record or import source audio.
3. Detect tempo and prepare the project grid.
4. Detect transients and create editable slices.
5. Assign up to 64 slices across pad banks A–D.
6. Finger-drum or program a beat.
7. Record lead vocals and additional takes.
8. Add bass, keys, melody, or external MIDI.
9. Build sections on the arrangement timeline.
10. Mix tracks, effects, sends, and returns.
11. Perform a master check for peaks, loudness, width, and translation.
12. Export audio, MIDI, stems, or a complete `.neusic` project.

## Product architecture

### Experience layer

- Producer Flow: progress, next action, templates, and workflow guidance.
- Arrangement: pinned track headers, horizontal timeline, clips, automation, and overview.
- Workspaces: Recording, Sampler, Drum Machine, Piano Roll, Effects, Mixer, Automation, and Browser.
- Mobile shell: safe areas, bottom navigation, off-canvas tracks, action sheet, and touch-sized controls.

### Project layer

- Versioned project schema.
- IndexedDB autosave and recovery.
- Portable `.neusic` project export.
- Audio-buffer registry with stable IDs.
- Undo/redo state for musical and mixer edits.
- Future: content-addressed media, missing-file relinking, project migrations, and version history.

### Musical layer

- Audio tracks and clip editing.
- MIDI tracks and piano roll.
- Pattern-based drum sequencing.
- 16-pad performance and 64-pad banks.
- Velocity, probability, repeats, timing offsets, and pitch metadata.
- Future: articulation maps, MPE, take lanes, folders, groups, buses, and returns.

### Audio layer

- Web Audio graph for live playback and offline rendering.
- Per-track effects, panning, gain, automation, and master output.
- Look-ahead transport scheduling.
- Matching live and offline clip semantics.
- Future: AudioWorklet DSP, WASM time stretching, plugin hosting in a native companion, and hardware-specific low-latency drivers.

## Capability tiers

### Working in the current web application

- Multitrack timeline
- Audio recording
- Audio import
- Sampler waveform and transient slicing
- Equal and transient chop modes
- 16-pad drum performance
- Four pad banks / 64 assignments
- Step sequencing with velocity metadata
- MIDI device input and piano roll
- Clip gain, fades, reverse, pitch, and rate controls
- Track effects and automation
- Mixer with stereo peak and loudness estimates
- IndexedDB autosave and recovery
- WAV bounce and `.neusic` project files
- Guided Producer Flow and project templates

### Next production layer

- Take lanes, punch regions, loop takes, and comping
- Input-device selection and measured latency compensation
- Pattern objects separate from arrangement clips
- Bus, return, folder, and group routing
- Multi-resolution waveform caches and canvas virtualization
- Better pitch/time algorithms and worker-based analysis
- Real stem export and a structured project package
- Formal browser/mobile regression tests

### Native desktop roadmap

- VST3 and Audio Unit hosting
- Kontakt and orchestral articulation workflows
- Native MIDI and audio drivers
- Hardware control-surface protocols
- Plugin sandboxing and crash isolation
- Local collaboration server and multi-device synchronization

## Release roadmap

### Version 1 — Create and finish a song

Recording, sampler, beat maker, MIDI input, arrangement, editing, mixer, project safety, and export.

### Version 2 — Intelligence and collaboration

Optional analysis services, stem separation, noise cleanup, arrangement assistance, cloud projects, version history, and collaboration.

### Version 3 — Native studio platform

Desktop companion, plugin hosting, advanced hardware integration, live performance, multi-device sessions, and marketplace.

## Monetization guardrail

The free plan must still let a producer complete and export a real song. Paid plans should expand scale, intelligence, storage, collaboration, and professional routing rather than locking the basic creative loop.

Suggested future packaging:

- **Free:** 8 tracks, core recording/editing, basic effects, local projects, limited cloud and optional AI credits.
- **Pro:** unlimited tracks/projects, full sampler, advanced automation, MIDI mapping, stem workflows, cloud sync, collaboration, and professional analysis.

## Product quality targets

- Startup under two seconds on a warm cache.
- Project open under three seconds for typical mobile projects.
- Stable audio-clock scheduling independent of animation-frame throttling.
- 60 FPS editing where supported.
- Non-destructive edits and recoverable project state.
- Offline rendering faster than real time where the browser permits.
- No feature should appear “production ready” when it is still a placeholder; experimental tools must be labeled.
