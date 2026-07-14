# Neusic Professional Arranger

## Product objective

The arranger turns Neusic from a collection of production tools into a song-building environment. Producers should be able to move from a four-bar idea to a structured record without exporting stems or switching applications.

## Implemented in Professional Arranger v1

### Song structure
- Dedicated structure lane above the ruler.
- Named, color-coded sections.
- Drag sections to reposition them.
- Resize section boundaries.
- Double-click to rename.
- Starter song map: Intro, Verse, Pre-Chorus, Chorus, Bridge, Final Chorus, Outro.
- Duplicate a selected section with its clips.

### Timeline scale
- Dynamic project length instead of the former fixed 128-beat ceiling.
- Default 256-beat workspace.
- Automatic 16-bar extension near the right edge.
- Manual 16-bar extension.
- Fit-project command.
- Overview and seeking use the dynamic project length.

### Looping
- Loop region rendered in the structure lane.
- Loop the selected section or a four-bar range from the playhead.
- Drag and resize the loop region.
- Playback returns to the loop start using the audio clock.

### Clip editing
- Shift/Cmd/Ctrl-click clip multi-selection.
- Internal copy and paste.
- Duplicate selected clips.
- Delete selected clips.
- Dedicated clip grip for moving a selected group horizontally and between tracks.
- Existing snapping, fade, slip, stretch, pitch, trim, and waveform systems remain intact.

### Ripple song editing
- Insert time at the playhead.
- Delete time at the playhead.
- Sections and later clips move with the edit.
- Audio clips crossing a deleted range are divided and source offsets are preserved where possible.

### Drum pattern arrangement
- Pattern bank A–H.
- Place four-beat pattern clips on beat tracks.
- Double-click a pattern clip to load it in the drum editor.
- Pattern clips determine which sequencer data plays at each song position.
- Live playback and offline export use arranged pattern clips.

### Persistence
Arranger state is stored with project metadata and inside the existing recovery state, including:
- timeline length
- section map
- loop region
- drum pattern bank
- active pattern

The same state is also included in `.neusic` project exports.

## Keyboard commands

| Command | Action |
|---|---|
| Shift/Cmd/Ctrl + click | Toggle clip selection |
| Cmd/Ctrl + C | Copy selected clips |
| Cmd/Ctrl + V | Paste at playhead |
| Cmd/Ctrl + D | Duplicate selected clips |
| Delete / Backspace | Delete selected clips |
| L | Toggle/set loop |
| Escape | Clear clip and section selection |

## Next arranger layer

1. Lasso selection and range selection.
2. Dedicated MIDI clip data per track and clip.
3. Automation clips and tempo automation.
4. Track folders, groups, and folder comping.
5. Take lanes and vocal comping.
6. Freeze, flatten, and bounce-in-place.
7. Section-level arrangement alternatives.
8. Time-signature and tempo markers.
9. Track-height controls and vertical zoom.
10. Native desktop disk streaming for very large sessions.
