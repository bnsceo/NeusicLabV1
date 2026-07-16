(() => {
  'use strict';

  const mediaDevices = navigator.mediaDevices;
  const NativeAudioContext = window.AudioContext || window.webkitAudioContext;
  if (!window.isSecureContext || !mediaDevices?.getUserMedia) return;

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

  const adoptContext = context => {
    if (!context || context.state === 'closed') return sharedContext;
    sharedContext = context;
    window.__neusicMobileAudioContext = context;
    return context;
  };

  const currentAppContext = () => window.NeusicLiveLoop?.workspace?.context || null;

  const ensureContext = () => {
    const appContext = currentAppContext();
    if (appContext?.state !== 'closed') return adoptContext(appContext);
    if (sharedContext?.state !== 'closed') return sharedContext;
    if (!NativeAudioContext) return null;
    return adoptContext(new NativeAudioContext({latencyHint:'interactive'}));
  };

  const unlockAudio = () => {
    const context = ensureContext();
    if (!context) return Promise.reject(new Error('Web Audio is unavailable in this browser.'));
    if (context.state === 'running') return Promise.resolve(context);
    if (unlockPromise) return unlockPromise;

    unlockPromise = Promise.resolve(context.resume())
      .then(() => {
        if (context.state !== 'running') throw new Error('The audio engine is still locked. Tap REC again.');
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
        audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false,channelCount:{ideal:1}}
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

    announce('Opening the microphone and audio engine…');
    primedPromise = requestNativeMic()
      .then(stream => {
        const track = stream.getAudioTracks()[0];
        if (!track || track.readyState !== 'live') {
          stream.getTracks().forEach(item => item.stop());
          throw new Error('The phone granted permission but did not return a live microphone track.');
        }
        track.enabled = true;
        primedStream = stream;
        window.__neusicPrimedMicStream = stream;
        track.addEventListener('ended', () => {
          if (primedStream === stream) primedStream = null;
          if (window.__neusicPrimedMicStream === stream) window.__neusicPrimedMicStream = null;
        }, {once:true});
        return audioRequest.then(() => {
          announce('Microphone active. Starting the selected lane…');
          return stream;
        });
      })
      .catch(error => {
        primedPromise = null;
        const blocked = error?.name === 'NotAllowedError' || error?.name === 'SecurityError';
        announce(blocked ? 'Microphone blocked. Enable it for this site, reload, and tap REC.' : (error?.message || 'The microphone or audio engine could not start.'));
        throw error;
      });

    primedPromise.catch(() => {});
    return primedPromise;
  };

  const activate = event => {
    if (!event.isTrusted) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest('#micBtn, .loop-track [data-action="record"]')) return;
    const appContext = currentAppContext();
    if (appContext) adoptContext(appContext);
    primeMic();
  };

  document.addEventListener('pointerdown', activate, {capture:true, passive:true});
  if (!('PointerEvent' in window)) document.addEventListener('touchstart', activate, {capture:true, passive:true});

  window.__neusicPrimeMic = primeMic;
  window.__neusicUnlockAudio = unlockAudio;
  window.NeusicMobileMicPrimer = {
    prime:primeMic,
    unlock:unlockAudio,
    adoptContext,
    get context(){return sharedContext;},
    get stream(){return streamIsLive(primedStream) ? primedStream : null;},
    diagnostics:() => ({
      secureContext:window.isSecureContext,
      contextState:sharedContext?.state || 'not-created',
      microphoneLive:streamIsLive(primedStream),
      trackState:primedStream?.getAudioTracks?.()[0]?.readyState || 'none',
      appContextState:currentAppContext()?.state || 'not-created'
    })
  };
})();
