# Neusic Recording & Mix Workflow v1

## Release objective

This phase connects recording, take management, routing, returns and offline rendering into one practical workflow. It builds on the existing MediaRecorder capture, Web Audio mixer, typed tracks and offline bounce engine rather than creating parallel systems.

## Shipped in this phase

### Managed recording takes

- Every completed microphone pass on an armed audio track becomes a named take.
- Takes are stored per track and survive autosave, project export, crash recovery and undo/redo through the existing `recOpts` project state.
- The Record workspace lists captured takes with Preview, Use, Rename and Delete controls.
- Choosing **Use** performs a safe quick-comp operation for overlapping takes by making the selected take audible and marking competing passes as alternate takes.
- Alternate takes remain in the project and can be restored later.
- Timeline clips display take badges and visually dim inactive alternatives.

This is quick-comping, not yet full region-based comping. The entire overlapping take is selected as one unit.

### Real bus routing

- Audio, Instrument and Drum tracks can route to Master or any created Bus track.
- Bus tracks process routed sources through their own insert effects, pan, fader, mute, solo and meter path.
- Routing is available directly in the Mixer.
- Bus routing is reproduced in offline export and bounce-in-place.
- Bus tracks themselves stay routed to Master to prevent accidental feedback loops.

### Created Return tracks become send destinations

- A track created as **Return Track** is automatically registered as a real mixer return.
- Existing track sends can feed that Return track.
- The Return track's effects, fader, mute and solo controls affect the returned signal.
- User-created return routing is included in offline rendering.
- Fixed Reverb A, Delay B and Room C returns remain available.

### Bounce to audio

- **Bounce Audio** appears in the selected-track command strip.
- The selected track is rendered through its current effects and routing using the existing OfflineAudioContext engine.
- A new Audio track is created with the rendered result.
- Bouncing a Bus includes tracks routed into that Bus.
- The original source tracks stay intact and editable.

### Mix-state persistence

- Track output routing is stored with the project.
- User-created return registrations are reconstructed from Return tracks.
- Send levels and return on/off state are stored through the project safety layer.
- Undo, autosave and `.neusic` project behavior remain compatible.

## CSS refinement

The visual layer adds:

- more consistent physical button geometry
- stronger top-bar grouping and LCD hierarchy
- improved 12–13px text readability
- clearer track headers and clip labels
- non-overlapping selected-track controls
- premium take cards and quick-comp controls
- a hardware-style mixer routing selector
- improved drawer, modal and mobile layouts
- responsive mixer-strip sizing
- better focus states and reduced-motion support

## Safety rules

- Source tracks can route only to Master or a Bus.
- Bus and Return tracks route to Master.
- Routing cycles are prevented.
- Deleting a Return track removes its dynamic return registration and stale send nodes.
- Muted alternate takes are excluded from live playback and offline rendering.
- Bounce restores every original mute, solo and sequencer state even when rendering fails.
