# Neusic Studio v2 — Hybrid Wave-Native Shell

## Purpose

Studio v2 combines Neusic's Wave Loom interaction model with the existing working DAW without replacing or forking the production engine.

## Routes

- `/studio/` — current working Neusic Studio
- `/wave-loom/` — standalone Wave Loom Lab
- `/studio-v2/` — hybrid contextual interface

## Architecture

Studio v2 is a same-origin orchestration shell with two isolated frames:

1. The existing Wave Loom Lab.
2. The existing production Studio wrapper and core engine.

The shell does not duplicate project state. Arrange, Perform, Piano, Record and Mix modes call the original Studio's public functions and open its real workspaces. Loom mode activates the separate Wave Loom environment.

## Focus modes

- **Loom:** Wave sculpting, nodes, NeuCapture and Forge.
- **Arrange:** The real multitrack timeline and song-structure workflow.
- **Perform:** The real drums and pattern workspace.
- **Piano:** Piano Roll v2 and MIDI clip workflow.
- **Record:** Microphone recording, takes and MIDI input.
- **Mix:** Mixer, buses, returns, sends, effects and bounce.

## Connected production actions

The Studio v2 shell delegates the following operations to the working Studio:

- play, pause, rewind and record
- save project and export WAV
- undo and redo
- create Audio, Instrument, Drum, Bus and Return tracks
- open themes, Copilot and effects
- read project name, tempo, position, track count and clip count

## Preservation rule

The current `/studio/` implementation remains available and unchanged as the stable Studio. Studio v2 is an additional page and can evolve independently until it is ready for a future product decision.

## Creator signature

Public HTML pages and local-runtime HTML responses display `Made by Anderson Paulino` in small fixed type at the top-left and bottom-right. The injection is duplicate-safe through the `data-neusic-creator` marker.
