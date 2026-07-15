# Wave Loom Production Upgrade

## Scope

Wave Loom now behaves as a practical offline-first instrument and sampler rather than a disposable prototype. The upgrade preserves the existing bioluminescent, hyper-real hardware aesthetic and browser-native audio architecture.

## Production features

### Audio export

- Renders four complete loop passes plus the current effect tail.
- Produces a stereo, 16-bit, 44.1 kHz WAV.
- Downloads the WAV locally with tempo and timestamp in the filename.
- Adds the rendered bounce back into The Forge as a new Sample Block.
- Stores lightweight export metadata locally for future Classic DAW transfer work.

The exported WAV can be imported into the Classic DAW through its normal audio workflow. Wave Loom does not claim a direct cross-page binary transfer until the Classic DAW has a dedicated Loom import adapter.

### Reversible editing

Undo and redo cover:

- wave sculpting
- node creation, deletion and movement
- loop-boundary movement
- preset changes
- macro changes
- Sample Block creation, deletion, manual slicing and transient slicing
- sample unfolding
- rendered bounces

History is memory-only and capped at 60 states. Patch autosave remains independent.

### Starting waves

The preset bank includes:

1. Neusic Default
2. Pure Sine
3. Soft Saw
4. Formant Voice
5. Glass Harmonics
6. Noise Texture

Any direct sculpt changes the active preset label to Custom.

### Node timing

- Snap can be enabled or disabled.
- Grid choices are 1/8, 1/16 and 1/32.
- Holding `Alt` while dragging temporarily bypasses snap.
- Hovering or selecting a node shows its node number, pitch and grid position.
- Node dragging previews the note and current timbre.

### Harmonic feedback

A real-time spectrum panel displays:

- geometry-derived harmonic energy while stopped
- analyzer data from the live audio output while playing

The visualizer stays entirely local and uses Web Audio and Canvas.

## The Forge

### Detailed slicing

- Waveforms support 1× through 8× horizontal zoom.
- The zoomed waveform scrolls horizontally.
- Manual slices use the full zoomed canvas width for precise placement.

### Transient slicing

- A local RMS/energy-flux detector identifies transient peaks.
- Closely spaced detections are consolidated.
- A Sample Block can be split into up to 16 transient-based blocks.
- Each generated block remains previewable, draggable, unfoldable and manually sliceable.

## Patch persistence

Wave Loom continuously autosaves its current patch in `localStorage`.

Portable patch files include:

- 96-point wave geometry
- trigger nodes and velocities
- loop boundaries
- tempo, root and scale
- harmonic, density, space and morph macros
- percussion and live-preview settings
- node snap state and grid
- active preset metadata

Patch files use versioned JSON with the type:

```text
neusic-wave-loom-patch
```

Captured audio and Sample Block PCM are not embedded in patch JSON because that would make patch files unexpectedly large. Audio remains exportable as WAV.

## Keyboard controls

- `Space` — Play or stop
- `Ctrl/Cmd + Z` — Undo
- `Ctrl/Cmd + Shift + Z` — Redo
- `Ctrl/Cmd + Y` — Redo
- `Ctrl/Cmd + Shift + E` — Export WAV
- Arrow keys — Move the selected node
- `Delete` / `Backspace` — Delete the selected node
- `Alt + drag` — Temporarily bypass node snap

## Public API

The page exposes `window.NeusicWaveLoom` for future integration:

- `getPatch()`
- `applyPatch(patch)`
- `savePatch()`
- `exportWav()`
- `undo()`
- `redo()`
- `applyPreset(name)`
- `autoSliceSelected()`

This API is the intended bridge point for a future Classic DAW Loom-import adapter.
