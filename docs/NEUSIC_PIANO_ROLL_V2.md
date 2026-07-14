# Neusic Piano Roll v2

## Objective

This phase completes the practical browser-producer piano-roll workflow and removes the control/text collisions reported in track headers and compact layouts.

## Overlap repairs

- Rename, Duplicate and Delete now occupy a dedicated second row inside each timeline track header.
- Track names, types, clip labels, mixer names and rack labels use constrained grid cells with ellipsis instead of drawing underneath controls.
- Sidebar track actions use equal-width grid columns.
- Selected-track actions, drawer tabs, the main toolbar and Piano Roll toolbars scroll horizontally at narrow widths rather than overlapping.
- Compact density and mobile breakpoints have separate track-header geometry.
- Note popovers, Track Creator fields, theme controls and mobile action rows use minimum-width-safe grids.

## Piano Roll v2 features

### Clip-aware editor

- The editor identifies the linked MIDI clip and displays its name and note count.
- A clip selector switches directly between MIDI clips across Instrument tracks.
- Empty MIDI clips open blank; the former demo-note auto-seeding is bypassed.
- Notes remain stored on their actual timeline clip and continue through live playback and offline export.
- Extending notes beyond the clip automatically extends the clip to the next full bar.

### Multi-note editing

- Shift-click adds or removes notes from the selection.
- Dragging an empty area with the Select tool creates a lasso selection.
- Dragging a selected note moves the entire selected group horizontally and vertically.
- Copy, paste, duplicate, delete and select-all are available from the toolbar and keyboard.
- Arrow keys move selected notes.
- Shift + Up/Down transposes by octaves.
- Alt + Left/Right changes note length.
- Quantize, Legato and Humanize work on the selection, or on the full clip when nothing is selected.

### Musical assistance

- Root-note and scale selection.
- Scale highlighting.
- Optional scale lock for drawing, transposition, chord insertion and MIDI capture.
- Ghost notes from the current Instrument track or all MIDI tracks.
- Chord insertion for Major, Minor, Major 7, Minor 7, Dominant 7, Sus 2, Sus 4 and Diminished chords.
- Configurable chord octave and duration.

### Velocity editing

- The velocity lane is interactive.
- Clicking or dragging changes the selected notes' velocity.
- When no notes are selected, the nearest note becomes the velocity-edit target.

### MIDI controller recording

- MIDI Record is available directly inside the Piano Roll.
- Controller notes are recorded relative to the linked clip rather than as absolute song beats.
- Note-off events determine note duration.
- Quantization and scale lock apply during capture.
- Starting MIDI Record without a clip creates a new MIDI clip on the selected Instrument track.

## Persistence

Piano Roll preferences are stored in `S.recOpts.__pianoRollV2`, so root, scale, scale-lock, ghost-note mode, chord choice, octave and default duration participate in autosave, recovery and project serialization.

## Scope boundary

Piano Roll v2 is complete for Neusic's current browser-producer workflow. The following remain advanced roadmap items rather than blockers for normal MIDI composition:

- per-note MPE expression curves
- editable pitch-bend, modulation and aftertouch lanes
- arpeggiator and MIDI-effect plug-ins
- score notation
- native VST/AU instrument hosting
- advanced multi-clip editing inside one shared grid
