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

/* Phase 2B/3 asset bootstrap. Kept here so the static Pages app loads the new
   shell, menubar, Agent settings, and demo gate without replacing the full HTML. */
(() => {
  const styles = ['css/30-nw-tokens.css','css/31-nw-shell.css','css/32-nw-menubar.css'];
  styles.forEach(href => {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = href;
    document.head.appendChild(link);
  });
  const scripts = ['js/42-nw-shell.js','js/43-nw-menubar.js','js/44-nw-agent.js','js/45-nw-demo-gate.js'];
  const load = i => {
    if (i >= scripts.length) return;
    if (document.querySelector(`script[src="${scripts[i]}"]`)) { load(i + 1); return; }
    const script = document.createElement('script'); script.src = scripts[i]; script.onload = () => load(i + 1);
    document.body.appendChild(script);
  };
  load(0);
})();
