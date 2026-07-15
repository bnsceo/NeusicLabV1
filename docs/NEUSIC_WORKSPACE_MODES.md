# Neusic Workspace Modes

## Purpose

The Studio no longer uses the bottom drawer and tab strip as its primary navigation system. Existing production panels are promoted into full center workspaces while retaining the same project state, playback engine, recording system, MIDI system, mixer, sampler, effects and automation implementations.

## Desktop layout

- **Top:** Existing transport and project controls.
- **Left:** Persistent hyper-real hardware workspace rail.
- **Center:** One full active workspace.
- **Right:** Context inspector with session status and quick actions.
- **Bottom:** Compact autosave, selection, workspace and engine status.

## Workspaces

1. Arrange
2. Record
3. Piano
4. Drums
5. Sampler
6. Mixer
7. Effects
8. Automation
9. Browser

Arrange displays the existing timeline and tracks. Every other workspace activates the existing matching Neusic panel at full height instead of inside a bottom drawer.

## Mobile navigation

The phone interface uses five primary destinations:

- Arrange
- Create
- Record
- Mix
- More

Create and More open temporary action menus. Piano Roll, Drums, Sampler, Mixer, Recording, Effects, Automation and Browser use the full mobile workspace rather than a compressed bottom drawer.

## Keyboard shortcuts

- `1` Arrange
- `2` Record
- `3` Piano
- `4` Drums
- `5` Sampler
- `6` Mixer
- `7` Effects
- `8` Automation
- `9` Browser
- `Escape` Return to Arrange

## Preservation

The redesign is an additive navigation and layout layer. It does not replace the existing audio, MIDI, recording, arranger, mixer, project-safety or export engines. Existing calls to `openDrawer(panel)` are routed to the corresponding full workspace so older controls remain compatible.
