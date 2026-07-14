# Neusic — What Remains After Recording & Mix Workflow v1

## Current position

Neusic is now a capable browser-based producer workstation rather than a static UI prototype. The core path works across recording, sampling, drum patterns, MIDI clips, arrangement, mixing, project recovery, AI guidance and WAV export.

Estimated position:

- **Browser producer v1:** approximately 82–86% complete
- **Professional browser DAW:** approximately 62–68% complete
- **Full Neusic vision including native desktop, plug-ins and cloud collaboration:** approximately 40–48% complete

These are product estimates, not test-coverage measurements.

## Working now

- Premium responsive landing page and Studio shell
- Custom accent, console finish and density themes
- Audio, Instrument, Drum, Bus and Return track creation/deletion
- Drum-pattern and piano-roll conversion into timeline tracks
- Dynamic song arrangement with named sections and loop regions
- Clip movement, resizing, multi-select, duplication and ripple time editing
- Microphone recording and audio import
- Managed recording takes with whole-take quick comping
- Real Bus output routing
- Created Return tracks as send destinations
- Insert effects, sends, mixer faders, pan, meters and master analysis
- Bounce selected track or Bus to audio
- Offline WAV export
- Autosave, crash recovery, undo/redo and portable project files
- Local Production Copilot and optional restricted Hermes bridge

## Highest-priority remaining work

### 1. Professional recording workflow

- Punch-in and punch-out regions
- True loop recording with a new take created on every cycle
- Region-level vocal comping instead of whole-take selection
- Take-lane waveform expansion under the parent track
- Input-device selection and channel selection
- Input monitoring modes: off, auto and always-on
- Latency calibration and recorded-clip offset compensation
- Pre-roll and post-roll controls
- Destructive and non-destructive noise cleanup

### 2. Advanced mixer and routing

- Arbitrary nested Bus routing
- Sidechain input selection
- Pre-fader versus post-fader sends
- Send automation
- Return-effect templates
- Bus and Return channel strips visually separated from source tracks
- Phase invert, mono check and channel polarity tools
- Track delay compensation
- Gain staging in dB rather than only normalized fader values

### 3. Audio editing and rendering

- Real-time-stretch modes with quality choices
- Pitch correction and formant controls
- Slip editing with complete playback/export parity
- Crossfade editor with curve control
- Freeze and unfreeze tracks
- Flatten and commit effects
- Render selection and render region
- Stem export by track, Bus and section
- Consolidate clips into one continuous file
- Background waveform generation for long recordings

### 4. MIDI and instruments

- Per-track MIDI recording from connected controllers
- Multiple MIDI clips open in one piano-roll view
- Note expression, pitch bend, modulation and aftertouch lanes
- Chord tools, scale lock and ghost notes
- Arpeggiator and MIDI effects
- Drum note maps and custom pad maps
- Better included instruments and preset browsing
- External MIDI clock send/receive validation

### 5. Sampler and beat workflow

- Non-destructive per-slice envelopes
- Per-slice pitch, filter and effects
- Choke groups
- Round robin and velocity layers
- Time-stretch-to-project for slices
- Pattern chaining and song mode improvements
- Probability, ratchet, flam and micro-timing editing across all pads
- Sample-library indexing and tagging

### 6. Project architecture and performance

- Replace JSON-with-custom-extension with a real packaged `.neusic` archive
- Incremental audio storage instead of embedding every WAV in project exports
- Long-session disk streaming
- Canvas virtualization for hundreds of tracks and long timelines
- Worker-based waveform and analysis processing
- Memory-pressure monitoring and buffer unloading
- Formal project migrations and backward-compatibility tests

### 7. Native desktop layer

The browser cannot provide the complete final product alone. The native layer still needs:

- macOS and Windows desktop wrapper
- VST3 and Audio Unit hosting
- Kontakt and third-party instrument workflows
- Low-latency native audio drivers
- File-system project folders and disk streaming
- Hardware audio-interface routing
- OS-level MIDI and plug-in scanning
- Crash isolation for plug-ins
- Code signing, notarization and auto-update

### 8. Cloud, accounts and collaboration

- Authentication and user profiles
- Encrypted cloud project backup
- Device sync
- Shareable project links
- Comments and review mode
- Version history
- Collaborative editing and conflict handling
- Subscription, plans, storage quotas and billing

### 9. Product hardening

- Automated unit and integration tests
- Golden audio-render tests
- Browser compatibility matrix
- Accessibility audit and keyboard-only operation
- Touch-target and screen-reader improvements
- Performance budgets for startup, playback and export
- Error telemetry with user consent
- Privacy policy, terms and production security review

## Recommended next phase

**Recording Workflow v2: Punch, Loop Takes and Region Comping**

That phase should add:

1. Punch range handles on the arranger.
2. Pre-roll and count-in behavior tied to the punch range.
3. Automatic take creation on every loop cycle.
4. Expandable take lanes below audio tracks.
5. Swipe or paint comp regions that reference source takes.
6. One consolidated comp clip for playback and export.
7. Input latency calibration and recorded-clip alignment.

This is the next highest-value step because it turns the current recording system into a credible vocal-production workflow.
