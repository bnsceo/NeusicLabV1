(() => {
  'use strict';

  const mediaDevices = navigator.mediaDevices;
  if (!window.isSecureContext || !mediaDevices?.getUserMedia) return;

  const NativeAudioContext = window.AudioContext || window.webkitAudioContext;
  const nativeGetUserMedia = mediaDevices.getUserMedia.bind(mediaDevices);
  let primedStream = null;
  let primedPromise = null;
  let sharedContext = null;
  let unlockPromise = null;

  const streamIsLive = stream => Boolean(
    stream?.getAudioTracks?.().some(track => track.readyState === 'live' && track.enabled)
  );

  const announce = message => {
    const output = document.getElementById('statusMessage');
    if (output) output.textContent = message;
    window.dispatchEvent(new CustomEvent('neusic:live-loop-status', {detail:{message}}));
  };

  const ensureSharedContext = () => {
    if (!NativeAudioContext) return null;
    if (!sharedContext || sharedContext.state === 'closed') {
      sharedContext = new NativeAudioContext({latencyHint:'interactive'});
      window.__neusicMobileAudioContext = sharedContext;
    }
    return sharedContext;
  };

  // The application and the permission primer must use the same AudioContext.
  // Returning the shared instance prevents mobile Safari from leaving the real
  // recorder context suspended after the permission dialog closes.
  if (NativeAudioContext) {
    const SharedAudioContext = function(...args) {
      if (!sharedContext || sharedContext.state === 'closed') {
        sharedContext = new NativeAudioContext(...args);
        window.__neusicMobileAudioContext = sharedContext;
      }
      return sharedContext;
    };
    SharedAudioContext.prototype = NativeAudioContext.prototype;
    Object.setPrototypeOf?.(SharedAudioContext, NativeAudioContext);
    try { window.AudioContext = SharedAudioContext; } catch (_) {}
    if (window.webkitAudioContext) {
      try { window.webkitAudioContext = SharedAudioContext; } catch (_) {}
    }
  }

  const unlockAudio = () => {
    const context = ensureSharedContext();
    if (!context) return Promise.reject(new Error('Web Audio is unavailable in this browser.'));
    if (context.state === 'running') return Promise.resolve(context);
    if (unlockPromise) return unlockPromise;

    // This function is called synchronously from pointerdown/touchstart so the
    // resume remains attached to the trusted user gesture.
    unlockPromise = Promise.resolve(context.resume())
      .then(() => {
        if (context.state !== 'running') throw new Error('Audio is still locked. Tap REC once more.');
        const pulse = context.createBufferSource();
        pulse.buffer = context.createBuffer(1, 1, context.sampleRate);
        pulse.connect(context.destination);
        pulse.start(0);
        window.__neusicMobileAudioUnlocked = true;
        return context;
      })
      .finally(() => { unlockPromise = null; });
    unlockPromise.catch(() => {});
    return unlockPromise;
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
    const audioRequest = unlockAudio();
    if (streamIsLive(primedStream)) return Promise.all([audioRequest, Promise.resolve(primedStream)]).then(([,stream]) => stream);
    if (primedPromise) return Promise.all([audioRequest, primedPromise]).then(([,stream]) => stream);

    announce('Opening microphone and audio engine… tap Allow when your phone asks.');
    primedPromise = requestNativeMic()
      .then(stream => {
        primedStream = stream;
        window.__neusicPrimedMicStream = stream;
        const track = stream.getAudioTracks()[0];
        if (!track || track.readyState !== 'live') throw new Error('The microphone opened but returned no live audio track.');
        track.enabled = true;
        track.addEventListener('ended', () => {
          if (primedStream === stream) primedStream = null;
          window.__neusicPrimedMicStream = null;
        }, {once:true});
        return audioRequest.then(() => {
          announce('Microphone and audio engine are ready. Recording the selected lane…');
          return stream;
        });
      })
      .catch(error => {
        primedPromise = null;
        const blocked = error?.name === 'NotAllowedError' || error?.name === 'SecurityError';
        announce(blocked
          ? 'Microphone is blocked for this site. Enable it in browser site settings, reload, and tap REC.'
          : (error?.message || 'The microphone or audio engine could not start.'));
        throw error;
      });

    primedPromise.catch(() => {});
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
  window.__neusicUnlockAudio = unlockAudio;
  window.NeusicMobileMicPrimer = {
    prime:primeMic,
    unlock:unlockAudio,
    get context(){return sharedContext;},
    get stream(){return streamIsLive(primedStream) ? primedStream : null;},
    diagnostics:() => ({
      secureContext:window.isSecureContext,
      contextState:sharedContext?.state || 'not-created',
      microphoneLive:streamIsLive(primedStream),
      trackState:primedStream?.getAudioTracks?.()[0]?.readyState || 'none'
    })
  };
})();
