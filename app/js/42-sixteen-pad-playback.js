/* 42-sixteen-pad-playback.js — complete 16-pad scheduler patch.
   Loaded after 04-playback.js and 41-sound-kits.js so every visible pad is
   scheduled during live playback, receives visual feedback, and is included
   in offline WAV export. */
(() => {
  'use strict';
  if (window.__neusicSixteenPadPlayback) return;
  window.__neusicSixteenPadPlayback = true;

  window.scheduleSeqSteps = function scheduleSeqSteps(horizonBeat) {
    const stepLenBeat = 0.25;
    while (S.nextSeqStepBeat < horizonBeat) {
      const stepBeat = S.nextSeqStepBeat;
      const stepIndex = Math.round(stepBeat / stepLenBeat) % 16;
      const when = songSecToCtxTime(beatToSec(stepBeat));

      PADS.forEach((pad) => {
        if ((S.seqSteps[pad.id] || [])[stepIndex]) {
          Audio_.synthDrum(pad.n, null, when);
        }
      });

      const delayMs = Math.max(0, (when - Audio_.ctx.currentTime) * 1000);
      setTimeout(() => flashSeqStep(stepIndex), delayMs);
      S.nextSeqStepBeat += stepLenBeat;
    }
  };

  window.flashSeqStep = function flashSeqStep(stepIndex) {
    if (!S.playing) return;
    S.seqStep = stepIndex;

    document.querySelectorAll('.seq-row').forEach((row) => {
      row.querySelectorAll('.step').forEach((step, index) => {
        step.classList.toggle('cur', index === stepIndex);
      });
    });

    PADS.forEach((pad) => {
      if (!(S.seqSteps[pad.id] || [])[stepIndex]) return;
      const button = document.getElementById(`pad-${pad.id}`);
      if (!button) return;
      button.style.filter = 'brightness(2.5)';
      setTimeout(() => {
        if (button) button.style.filter = '';
      }, 80);
    });
  };

  window.scheduleOfflineSequencer = function scheduleOfflineSequencer(
    offlineCtx,
    trackInputs,
    durationSec
  ) {
    const stepLenSec = beatToSec(0.25);
    const totalSteps = Math.ceil(durationSec / stepLenSec);

    for (let step = 0; step < totalSteps; step += 1) {
      const stepIndex = step % 16;
      const when = step * stepLenSec;

      PADS.forEach((pad) => {
        if ((S.seqSteps[pad.id] || [])[stepIndex]) {
          Audio_.synthDrum(pad.n, offlineCtx.__masterGain, when);
        }
      });
    }
  };
})();
