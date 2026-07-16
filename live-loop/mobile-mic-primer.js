(() => {
  'use strict';

  const mediaDevices = navigator.mediaDevices;
  if (!window.isSecureContext || !mediaDevices?.getUserMedia) return;

  const nativeGetUserMedia = mediaDevices.getUserMedia.bind(mediaDevices);
  let primedStream = null;
  let primedPromise = null;

  const streamIsLive = stream => Boolean(
    stream?.getAudioTracks?.().some(track => track.readyState === 'live' && track.enabled)
  );

  const announce = message => {
    const output = document.getElementById('statusMessage');
    if (output) output.textContent = message;
    window.dispatchEvent(new CustomEvent('neusic:live-loop-status', {detail:{message}}));
  };

  const requestNativeMic = async () => {
    try {
      return await nativeGetUserMedia({
        audio:{
          echoCancellation:false,
          noiseSuppression:false,
          autoGainControl:false,
          channelCount:{ideal:1}
        }
      });
    } catch (preferredError) {
      if (preferredError?.name === 'NotAllowedError' || preferredError?.name === 'SecurityError') throw preferredError;
      return nativeGetUserMedia({audio:true});
    }
  };

  const primeMic = () => {
    if (streamIsLive(primedStream)) return Promise.resolve(primedStream);
    if (primedPromise) return primedPromise;

    announce('Opening microphone… tap Allow when your phone asks.');
    primedPromise = requestNativeMic()
      .then(stream => {
        primedStream = stream;
        window.__neusicPrimedMicStream = stream;
        announce('Microphone permission granted. Starting the selected lane…');
        return stream;
      })
      .catch(error => {
        primedPromise = null;
        const blocked = error?.name === 'NotAllowedError' || error?.name === 'SecurityError';
        announce(blocked
          ? 'Microphone is blocked for this site. Enable it in your browser site settings, reload, and tap REC.'
          : (error?.message || 'The microphone could not be opened.'));
        throw error;
      });

    // The app click handler consumes this promise. This catch prevents a
    // rejected permission request from becoming an unhandled browser error.
    primedPromise.catch(() => {});
    window.__neusicPrimeMic = primeMic;
    return primedPromise;
  };

  const routedGetUserMedia = constraints => {
    const audioOnly = Boolean(constraints?.audio) && !constraints?.video;
    if (audioOnly) {
      if (streamIsLive(primedStream)) return Promise.resolve(primedStream);
      if (primedPromise) return primedPromise;
    }
    return nativeGetUserMedia(constraints);
  };

  try {
    mediaDevices.getUserMedia = routedGetUserMedia;
  } catch (_) {
    try {
      Object.defineProperty(mediaDevices, 'getUserMedia', {
        configurable:true,
        value:routedGetUserMedia
      });
    } catch (_) {}
  }

  const activate = event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest('#micBtn, .loop-track [data-action="record"]')) return;
    primeMic();
  };

  document.addEventListener('pointerdown', activate, {capture:true, passive:true});
  if (!('PointerEvent' in window)) {
    document.addEventListener('touchstart', activate, {capture:true, passive:true});
  }

  window.__neusicPrimeMic = primeMic;
})();
