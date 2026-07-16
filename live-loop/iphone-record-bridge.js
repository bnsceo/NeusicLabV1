(() => {
  'use strict';

  const isIPhone = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!isIPhone) return;

  let busy = false;
  let lastTouch = 0;

  const waitForApp = () => {
    if (window.NeusicLiveLoop?.looper) return Promise.resolve(window.NeusicLiveLoop);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Live Loop is still loading. Tap REC again.')), 8000);
      const ready = () => {
        clearTimeout(timeout);
        window.removeEventListener('neusic:live-loop-ready', ready);
        resolve(window.NeusicLiveLoop);
      };
      window.addEventListener('neusic:live-loop-ready', ready, {once:true});
    });
  };

  const announce = message => {
    const output = document.getElementById('statusMessage');
    if (output) output.textContent = message;
  };

  const handleRecordTouch = event => {
    const button = event.target instanceof Element ? event.target.closest('.loop-track [data-action="record"]') : null;
    if (!button || busy) return;

    const now = Date.now();
    if (now - lastTouch < 350) return;
    lastTouch = now;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();

    const card = button.closest('.loop-track');
    const index = Number(card?.dataset.index);
    if (!Number.isInteger(index)) return;

    busy = true;
    button.dataset.iphoneBusy = 'true';
    announce(`Preparing LOOP ${index + 1} on iPhone…`);

    const micPromise = window.__neusicPrimeMic?.() || Promise.resolve(window.__neusicPrimedMicStream);
    Promise.all([micPromise, waitForApp()])
      .then(async ([stream, app]) => {
        if (!stream?.getAudioTracks?.().some(track => track.readyState === 'live')) {
          throw new Error('The iPhone microphone did not return a live audio track.');
        }
        app.workspace.micStream = stream;
        await app.workspace.resume({required:true});
        await app.record(index);
      })
      .catch(error => {
        console.error('iPhone lane recording failed:', error);
        announce(error?.message || 'The iPhone lane recorder could not start.');
      })
      .finally(() => {
        busy = false;
        delete button.dataset.iphoneBusy;
      });
  };

  document.addEventListener('pointerdown', handleRecordTouch, {capture:true, passive:false});
  document.addEventListener('touchstart', handleRecordTouch, {capture:true, passive:false});
  document.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest('.loop-track [data-action="record"]') : null;
    if (!button || Date.now() - lastTouch > 900) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  }, true);
})();
