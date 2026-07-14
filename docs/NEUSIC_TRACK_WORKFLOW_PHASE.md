# Neusic Track Workflow and Hyper-Real Console

## Objective

This phase makes tracks intentional, editable, and musically functional. The previous Add Track command created a rotating random track type with a placeholder clip. The new Track Rack asks what the producer wants to create and configures that lane accordingly.

## Track operations

- Create Audio, Instrument, Drum, Bus, and Return tracks.
- Rename tracks.
- Duplicate tracks and their clips.
- Delete tracks with clip-count confirmation.
- Prevent deletion of an armed track while recording.
- Keep at least one track in every project.
- Clean mixer, automation, effects, meters, and Web Audio nodes when a track is deleted.
- Keep undo, autosave, recovery, and `.neusic` project persistence.

## Source-to-track workflows

### Drum pattern to track

Pattern to Track copies the active drum pattern into a dedicated pattern identity, creates a Drum track, and places a four-beat pattern clip at the current bar. The new pattern remains editable and is included in arranger playback and offline export.

### Piano roll to track

Piano Roll to Track copies the notes currently visible in the piano roll, creates an Instrument track, sizes a MIDI clip to the musical phrase, and places it at the current bar.

### New MIDI clip

Selecting an Instrument track enables New MIDI Clip. This creates an empty four-bar clip and opens it directly in the piano roll.

## MIDI timeline engine

Instrument clips now produce sound from the arrangement timeline. The engine supports:

- Live transport playback.
- Playback from the middle of a sustained note.
- Per-note velocity.
- Track gain, mute, solo, effects, pan, and automation through the normal channel path.
- Offline WAV export.
- Studio Piano, Analog Bass, Warm Pad, Poly Synth, Mono Lead, and Glass Keys starter instruments.
- Real note previews inside MIDI clips instead of decorative placeholder graphics.

## Workspace reassembly

- A selected-track command strip now sits above the arranger.
- The sidebar is rebuilt as a Track Rack with track number, type, clip count, arm LED, rename, duplicate, and delete controls.
- Track headers include compact hardware-style management controls.
- The Piano Roll includes a Create Track command.
- Cmd/Ctrl + Shift + T opens the Track Creator.

## Hyper-real visual system

The final CSS layer uses a restrained physical-console metaphor:

- Brushed graphite and steel surfaces.
- Recessed LCD transport displays.
- Machined buttons with physical press states.
- Track-rack cards and channel rails.
- Hardware LEDs, edge highlights, screws, grooves, shadows, and restrained amber status lighting.
- Rubberized MPC pads and recessed sequencer switches.
- Equipment-chassis drawer styling.
- Responsive simplification on tablets and phones.

## Current boundaries

Bus and Return tracks are available as channel types, but complete user-configurable routing matrices are still a later audio-engine phase. The included instruments are lightweight Web Audio instruments; VST3 and Audio Unit hosting remain part of the native desktop roadmap.
