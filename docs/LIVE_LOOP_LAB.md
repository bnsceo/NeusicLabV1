# Neusic Live Loop Lab

A separate five-track performance page at `/live-loop/`. It does not replace the Classic Studio or Wave Loom.

## Core workflow

1. Arm the microphone.
2. Select one of five loop lanes.
3. Press REC to create the master loop.
4. Record or overdub the remaining lanes; they are padded or trimmed to the master duration.
5. Use volume, pan, delay send and reverb send per lane.
6. Reverse or half-speed the selected track.
7. Upload browser-decodable audio into any lane.
8. Send the selected loop to Wave Loom through the local Forge Bridge.

## Audio architecture

- Shared low-latency `AudioContext`
- 25 ms Web Worker look-ahead clock
- Five stereo playback lanes
- Per-track gain, pan, delay send and reverb send
- MediaRecorder microphone capture
- Manual AudioBuffer overdub summing
- Tape-style delay with time ramping, feedback and wet/dry control
- Generated stereo convolution reverb with size, tone and freeze controls
- Polyphonic Web Audio synth
- Web MIDI mapping

## MIDI defaults

- Notes 36–40: record or overdub tracks 1–5
- Notes 41–45: mute or unmute tracks 1–5
- CC 20–24: volume tracks 1–5
- CC 64: start or stop transport
- Other notes: play the synth

## Forge Bridge

The bridge uses same-origin IndexedDB (`neusic-forge-bridge`) to store a WAV blob temporarily. Wave Loom receives the transfer through `?forgeTransfer=<id>`, decodes it locally, and adds it to the Forge transfer shelf. No API or upload server is involved.

## Browser constraints

- Microphone access requires HTTPS or localhost.
- Uploaded formats depend on the browser's `decodeAudioData` codec support.
- Headphones are strongly recommended when microphone monitoring is enabled.
- MediaRecorder timing is normalized to the master loop length after capture.

## Naming and affiliation

The page is designed for improvisational voice-and-loop performance. It does not copy branded hardware artwork and does not imply affiliation with Reggie Watts, Boss, Line 6, Nord, or their manufacturers.
