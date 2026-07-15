(() => {
  'use strict';
  if (window.NeusicAudioWorkspace) return;

  const NativeAudioContext = window.AudioContext || window.webkitAudioContext;
  if (!NativeAudioContext) {
    window.NeusicAudioWorkspace = { supported:false, ensure(){ throw new Error('Web Audio is not supported in this browser.'); } };
    return;
  }

  let sharedContext = null;
  const createSharedContext = (...args) => {
    if (!sharedContext || sharedContext.state === 'closed') sharedContext = new NativeAudioContext(...args);
    return sharedContext;
  };

  // Every Wave Loom script that calls `new AudioContext()` now receives the same
  // hardware context. The native context remains the actual returned object.
  function SharedAudioContext(...args) { return createSharedContext(...args); }
  SharedAudioContext.prototype = NativeAudioContext.prototype;
  Object.setPrototypeOf(SharedAudioContext, NativeAudioContext);
  try { window.AudioContext = SharedAudioContext; } catch (_) {}
  try { if (window.webkitAudioContext) window.webkitAudioContext = SharedAudioContext; } catch (_) {}

  const state = {
    context:null,
    buses:null,
    workletReady:false,
    workletPromise:null,
    input:null,
    inputAnalyser:null,
    inputData:null,
    activeSources:new Set()
  };

  function makeImpulse(ctx, seconds = 1.8, decay = 2.4) {
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
    return buffer;
  }

  function buildBuses(ctx) {
    const master = ctx.createGain();
    const limiter = ctx.createDynamicsCompressor();
    const loom = ctx.createGain();
    const samples = ctx.createGain();
    const preview = ctx.createGain();
    const capture = ctx.createGain();
    const delayInput = ctx.createGain();
    const delay = ctx.createDelay(4);
    const feedback = ctx.createGain();
    const delayWet = ctx.createGain();
    const reverbInput = ctx.createGain();
    const convolver = ctx.createConvolver();
    const reverbWet = ctx.createGain();
    const analyser = ctx.createAnalyser();

    master.gain.value = .82;
    loom.gain.value = 1;
    samples.gain.value = 1;
    preview.gain.value = .82;
    capture.gain.value = 0;
    delay.delayTime.value = .28;
    feedback.gain.value = .32;
    delayWet.gain.value = .28;
    reverbWet.gain.value = .24;
    convolver.buffer = makeImpulse(ctx);
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = .78;
    limiter.threshold.value = -7;
    limiter.knee.value = 8;
    limiter.ratio.value = 10;
    limiter.attack.value = .003;
    limiter.release.value = .18;

    loom.connect(master);
    samples.connect(master);
    preview.connect(master);
    capture.connect(master);
    delayInput.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(delayWet);
    delayWet.connect(master);
    reverbInput.connect(convolver);
    convolver.connect(reverbWet);
    reverbWet.connect(master);
    master.connect(limiter);
    limiter.connect(analyser);
    analyser.connect(ctx.destination);

    return {master, limiter, loom, samples, preview, capture, delayInput, delay, feedback, delayWet, reverbInput, convolver, reverbWet, analyser};
  }

  function ensure() {
    const ctx = createSharedContext({latencyHint:'interactive'});
    if (state.context !== ctx || !state.buses) {
      state.context = ctx;
      state.buses = buildBuses(ctx);
    }
    return ctx;
  }

  async function resume() {
    const ctx = ensure();
    if (ctx.state === 'suspended') await ctx.resume();
    return ctx;
  }

  async function loadCaptureWorklet() {
    const ctx = await resume();
    if (state.workletReady) return true;
    if (!ctx.audioWorklet) throw new Error('AudioWorklet is unavailable in this browser.');
    if (!state.workletPromise) {
      state.workletPromise = ctx.audioWorklet.addModule('./neucapture-worklet.js').then(() => {
        state.workletReady = true;
        return true;
      }).catch(error => {
        state.workletPromise = null;
        throw error;
      });
    }
    return state.workletPromise;
  }

  async function decode(source) {
    const ctx = await resume();
    const arrayBuffer = source instanceof ArrayBuffer ? source : await source.arrayBuffer();
    return ctx.decodeAudioData(arrayBuffer.slice(0));
  }

  function bufferFromChannels(channels, sampleRate) {
    const ctx = ensure();
    const arrays = channels.map(channel => channel instanceof Float32Array ? channel : new Float32Array(channel));
    const length = Math.max(1, ...arrays.map(channel => channel.length));
    const buffer = ctx.createBuffer(Math.max(1, arrays.length), length, sampleRate || ctx.sampleRate);
    arrays.forEach((channel, index) => buffer.copyToChannel(channel.subarray(0, length), index));
    return buffer;
  }

  function serializeBuffer(buffer) {
    return {
      sampleRate:buffer.sampleRate,
      length:buffer.length,
      duration:buffer.duration,
      numberOfChannels:buffer.numberOfChannels,
      channels:Array.from({length:buffer.numberOfChannels}, (_, index) => buffer.getChannelData(index).slice().buffer)
    };
  }

  function deserializeBuffer(record) {
    if (!record?.channels?.length) throw new Error('Stored sample has no PCM channels.');
    return bufferFromChannels(record.channels.map(channel => new Float32Array(channel)), record.sampleRate);
  }

  function trackSource(node) {
    state.activeSources.add(node);
    node.addEventListener?.('ended', () => state.activeSources.delete(node), {once:true});
    return node;
  }

  function stopAllSources() {
    state.activeSources.forEach(source => { try { source.stop(); } catch (_) {} });
    state.activeSources.clear();
  }

  function connectInput(stream) {
    const ctx = ensure();
    disconnectInput();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = .65;
    source.connect(analyser);
    state.input = source;
    state.inputAnalyser = analyser;
    state.inputData = new Float32Array(analyser.fftSize);
    return {source, analyser};
  }

  function disconnectInput() {
    try { state.input?.disconnect(); } catch (_) {}
    try { state.inputAnalyser?.disconnect(); } catch (_) {}
    state.input = null;
    state.inputAnalyser = null;
    state.inputData = null;
  }

  function inputLevel() {
    if (!state.inputAnalyser || !state.inputData) return 0;
    state.inputAnalyser.getFloatTimeDomainData(state.inputData);
    let total = 0;
    for (const value of state.inputData) total += value * value;
    return Math.sqrt(total / state.inputData.length);
  }

  function setEffects({delayTime, feedback, delayMix, reverbMix} = {}) {
    const ctx = ensure();
    const now = ctx.currentTime;
    if (Number.isFinite(delayTime)) state.buses.delay.delayTime.setTargetAtTime(Math.max(.01, Math.min(3.8, delayTime)), now, .02);
    if (Number.isFinite(feedback)) state.buses.feedback.gain.setTargetAtTime(Math.max(0, Math.min(.92, feedback)), now, .02);
    if (Number.isFinite(delayMix)) state.buses.delayWet.gain.setTargetAtTime(Math.max(0, Math.min(1, delayMix)), now, .02);
    if (Number.isFinite(reverbMix)) state.buses.reverbWet.gain.setTargetAtTime(Math.max(0, Math.min(1, reverbMix)), now, .02);
  }

  window.NeusicAudioWorkspace = {
    supported:true,
    state,
    ensure,
    resume,
    loadCaptureWorklet,
    decode,
    bufferFromChannels,
    serializeBuffer,
    deserializeBuffer,
    trackSource,
    stopAllSources,
    connectInput,
    disconnectInput,
    inputLevel,
    setEffects,
    get context(){ return ensure(); },
    get buses(){ ensure(); return state.buses; }
  };
})();