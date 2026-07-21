# Neusic Studio Native MVP

A separate C++/JUCE foundation for the monetizable native Neusic DAW. This folder does not replace or modify the current web applications.

## Implemented in phase 1

- Native JUCE application shell
- Cross-platform CMake build
- Audio input/output device initialization
- Low-latency microphone monitoring toggle
- 24-bit stereo WAV recording
- Safe handling of mono and stereo input devices
- Mobile-first transport layout
- Four-track arrangement surface
- Bottom workspace tabs for Arrange, Record, Sounds, Mixer, and Export

## Requirements

- CMake 3.22 or newer
- C++20 compiler
- Xcode for macOS/iOS builds
- Android Studio and Android NDK for Android builds
- Internet access during the first configure so CMake can fetch JUCE 8.0.13

## Build on macOS

```bash
cd native/NeusicStudio
cmake -S . -B build -G Xcode
cmake --build build --config Debug
open "build/NeusicStudio_artefacts/Debug/Neusic Studio.app"
```

## Build with Ninja

```bash
cd native/NeusicStudio
cmake -S . -B build -G Ninja -DCMAKE_BUILD_TYPE=Debug
cmake --build build
```

## Recording output

Recordings are written to:

```text
Documents/NeusicStudio/Recordings/
```

Each take is saved as a timestamped 24-bit stereo WAV file.

## Next native milestones

1. Real transport clock and playback engine
2. Audio-file import
3. Editable clip model
4. Four independent track buses
5. Volume, pan, mute, and solo
6. Project save and load
7. Mixdown export
8. iOS and Android project configuration
9. Mixer and effects rack
10. MIDI and piano roll

## Architecture rule

Audio and project state live in C++. Mobile screens are designed for touch from the beginning. The native application must never copy the web DAW's desktop layout directly into a phone viewport.
