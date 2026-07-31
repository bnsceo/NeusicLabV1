# Neusic Live Loop

Neusic Live Loop is the capture/performance instrument in the NeusicWave ecosystem.

## Run locally

From the repository root:

```bash
python3 -m http.server 4174
```

Open:

`http://127.0.0.1:4174/live-loop/`

Do not open `index.html` directly as `file://`; browser module and AudioWorklet loading can be blocked in that mode.

## Workflow

1. Open **Sound tools** to reveal the piano and processors.
2. Enable **MIC** and grant microphone permission.
3. Select a lane and press **REC**, or press **CAPTURE** twice to capture the latest phrase.
4. Save and launch arrangements with scenes **A**, **B**, and **C**.
5. Use **EXPORT MIX** to download the current five-lane arrangement as WAV.

## Audio boundary

The lane `TUNE` control currently stores `OFF`, `CHROMATIC`, or `KEY` mode. The AudioWorklet currently measures pitch and confidence without altering audio. Time-preserving pitch correction is intentionally not advertised as complete; see the Neusic Memory Vault `AUTOTUNE-RESEARCH.md` before extending it.

## Future handoff

Live Loop is designed to send a captured sound to Wave Loom, which will later send developed material to Neusic Studio. The transfer contract is not part of this release.
