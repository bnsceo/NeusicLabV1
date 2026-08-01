(() => {
  'use strict';

  const busy = new WeakSet();
  const handledPointers = new Set();

  const status = message => {
    const output = document.getElementById('statusMessage');
    if (output) output.textContent = message;
    window.dispatchEvent(new CustomEvent('neusic:live-loop-status', {detail:{message}}));
  };

  const waitForApi = async () => {
    if (window.NeusicLiveLoop?.looper) return window.NeusicLiveLoop;

    // The microphone/audio unlock has already started from the trusted REC gesture.
    // Trigger the existing engine initializer, then wait for its public API.
    document.getElementById('playBtn')?.click();

    const started = performance.now();
    while (performance.now() - started < 10000) {
      if (window.NeusicLiveLoop?.looper) return window.NeusicLiveLoop;
      await new Promise(resolve => setTimeout(resolve, 40));
    }
    throw new Error('The Live Loop audio engine did not finish starting. Reload and tap REC again.');
  };

  async function recordFromButton(button) {
    if (!button || busy.has(button)) return;
    busy.add(button);
    button.dataset.recordBusy = '1';

    const card = button.closest('.loop-track');
    const index = Number(card?.dataset.index);
    if (!Number.isInteger(index)) {
      busy.delete(button);
      delete button.dataset.recordBusy;
      return;
    }

    try {
      status(`Preparing LOOP ${index + 1}…`);

      // Start permission and AudioContext unlock immediately from the trusted gesture.
      const microphonePromise = window.NeusicMobileMicPrimer?.prime
        ? window.NeusicMobileMicPrimer.prime()
        : navigator.mediaDevices.getUserMedia({audio:true});

      const live = await waitForApi();
      const stream = await microphonePromise;
      if (stream?.getAudioTracks?.().length) live.workspace.micStream = stream;

      await live.workspace.initMic();
      await live.workspace.resume({required:true});
      live.selectTrack?.(index, {announce:false});
      await live.looper.toggleRecord(index);
    } catch (error) {
      console.error('Unified REC controller failed:', error);
      status(error?.message || 'Recording could not start. Check microphone permission and tap REC again.');
    } finally {
      busy.delete(button);
      delete button.dataset.recordBusy;
    }
  }

  document.addEventListener('pointerdown', event => {
    const button = event.target.closest?.('.loop-track [data-action="record"]');
    if (!button || event.button > 0) return;

    handledPointers.add(event.pointerId);
    event.preventDefault();
    event.stopImmediatePropagation();
    recordFromButton(button);
  }, {capture:true, passive:false});

  document.addEventListener('pointerup', event => {
    handledPointers.delete(event.pointerId);
  }, {capture:true, passive:true});

  document.addEventListener('pointercancel', event => {
    handledPointers.delete(event.pointerId);
  }, {capture:true, passive:true});

  // Suppress the synthetic click produced after pointerdown. Keyboard-generated
  // trusted clicks still work and use the same controller.
  document.addEventListener('click', event => {
    const button = event.target.closest?.('.loop-track [data-action="record"]');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.detail === 0) recordFromButton(button);
  }, true);
})();
