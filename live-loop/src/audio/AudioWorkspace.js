class AudioWorkspace {
  constructor() {
    this.context = null;
    this.master = null;
    this.analyser = null;
    this.limiter = null;
    this.outputGain = null;
    this.meterData = null;
    this.micStream = null;
    this.micSource = null;
    this.monitor = null;
    this.pitchNode = null;
    this.pitchFrequency = 0;
    this.pitchConfidence = 0;
    this.unlocked = false;
    this.pitchWorkletLoaded = false;
  }

  trace(stage, detail = {}) {
    window.__neusicCaptureTrace?.(stage, detail);
  }

  createContext() {
    if (this.context && this.context.state !== 'closed') return this.context;
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return null;
    this.context = window.NeusicMobileMicPrimer?.context || new Context({latencyHint:'interactive'});
    window.NeusicMobileMicPrimer?.adoptContext?.(this.context);
    this.trace('context-created', {state:this.context.state, sampleRate:this.context.sampleRate});
    return this.context;
  }

  unlockFromGesture() {
    const context = this.createContext();
    if (!context) return null;
    this.trace('gesture-unlock-requested', {state:context.state});
    if (context.state !== 'running') {
      const result = context.resume();
      result?.then?.(() => this.trace('context-running', {state:context.state}));
      result?.catch?.(error => this.trace('context-resume-failed', {message:error?.message || String(error)}));
    }
    return context;
  }

  async ensureGraph() {
    const context = this.createContext();
    if (!context) throw new Error('Web Audio is not supported in this browser.');

    if (!this.master) {
      this.master = context.createGain();
      this.master.gain.value = .82;
    }
    if (!this.analyser) {
      this.analyser = context.createAnalyser();
      this.analyser.fftSize = 256;
      this.meterData = new Uint8Array(this.analyser.fftSize);
    }
    if (!this.limiter) {
      this.limiter = context.createDynamicsCompressor();
      this.limiter.threshold.value = -6;
      this.limiter.knee.value = 0;
      this.limiter.ratio.value = 20;
      this.limiter.attack.value = .003;
      this.limiter.release.value = .14;
    }
    if (!this.outputGain) {
      this.outputGain = context.createGain();
      this.outputGain.gain.value = .93;
      this.master.connect(this.analyser);
      this.analyser.connect(this.limiter);
      this.limiter.connect(this.outputGain);
      this.outputGain.connect(context.destination);
      this.trace('master-protection-ready', {threshold:-6, ratio:20, outputGain:.93});
    }
    if (context.audioWorklet && !this.pitchWorkletLoaded) {
      try {
        await context.audioWorklet.addModule(new URL('./worklets/pitch-detector.js', import.meta.url));
        this.pitchWorkletLoaded = true;
      } catch (error) {
        this.trace('pitch-worklet-skipped', {message:error?.message || String(error)});
      }
    }
    return this;
  }

  async init() {
    await this.ensureGraph();
    await this.resume();
    return this;
  }

  async resume({required=false}={}) {
    const context = this.createContext();
    if (!context) throw new Error('Web Audio is not supported in this browser.');
    try {
      if (context.state !== 'running') await context.resume();
      if (context.state === 'running' && !this.unlocked) {
        const pulse = context.createBufferSource();
        pulse.buffer = context.createBuffer(1, 1, context.sampleRate);
        pulse.connect(context.destination);
        pulse.start(0);
        this.unlocked = true;
      }
    } catch (error) {
      this.trace('context-resume-failed', {message:error?.message || String(error)});
      if (required) throw new Error(error?.message || 'Audio is still locked. Tap REC again to unlock it.');
    }
    if (required && context.state !== 'running') {
      throw new Error('Audio is still locked. Tap REC again to unlock it.');
    }
    return this;
  }

  micIsLive(stream=this.micStream) {
    return Boolean(stream?.getAudioTracks?.().some(track => track.readyState === 'live' && track.enabled));
  }

  releaseMonitorGraph() {
    try { this.monitor?.disconnect(); } catch (_) {}
    try { this.pitchNode?.disconnect(); } catch (_) {}
    if (this.pitchNode?.port) this.pitchNode.port.onmessage = null;
    this.monitor = null;
    this.pitchNode = null;
  }

  releaseMicSource() {
    this.releaseMonitorGraph();
    try { this.micSource?.disconnect(); } catch (_) {}
    this.micSource = null;
  }

  microphoneError(error) {
    if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') {
      return new Error('Microphone permission is blocked. Allow microphone access for this site, reload, and tap REC again.');
    }
    if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
      return new Error('No microphone was found on this device.');
    }
    if (error?.name === 'NotReadableError' || error?.name === 'TrackStartError') {
      return new Error('The microphone is busy in another app. Close the other app and tap REC again.');
    }
    if (error?.name === 'AbortError') {
      return new Error('The browser interrupted microphone startup. Tap REC again.');
    }
    return new Error(error?.message || 'The microphone could not be opened.');
  }

  async requestMicStream() {
    const primed = window.NeusicMobileMicPrimer?.stream || window.__neusicPrimedMicStream;
    if (this.micIsLive(primed)) return primed;
    if (window.NeusicMobileMicPrimer?.prime) {
      try {
        const stream = await window.NeusicMobileMicPrimer.prime();
        if (this.micIsLive(stream)) return stream;
      } catch (error) {
        throw this.microphoneError(error);
      }
    }

    const preferred = {
      echoCancellation:false,
      noiseSuppression:false,
      autoGainControl:false,
      channelCount:{ideal:1}
    };
    try {
      return await navigator.mediaDevices.getUserMedia({audio:preferred});
    } catch (preferredError) {
      if (preferredError?.name === 'NotAllowedError' || preferredError?.name === 'SecurityError') {
        throw this.microphoneError(preferredError);
      }
      try {
        return await navigator.mediaDevices.getUserMedia({audio:true});
      } catch (error) {
        throw this.microphoneError(error);
      }
    }
  }

  // Minimal recording path. It intentionally does not initialize effects,
  // instruments, MIDI, pitch detection, or the full output graph.
  async prepareCapture(stream=null) {
    if (!window.isSecureContext) {
      throw new Error('Microphone recording requires HTTPS. Open the secure Neusic Live Loop page and tap REC again.');
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone capture is unavailable in this browser. Open Neusic Live Loop in Safari, Chrome, Edge, or Firefox.');
    }

    const context = this.createContext();
    if (!context) throw new Error('Web Audio is not supported in this browser.');
    await this.resume({required:true});

    let nextStream = this.micIsLive(stream) ? stream : (this.micIsLive() ? this.micStream : null);
    if (!nextStream) {
      this.trace('microphone-requested');
      nextStream = await this.requestMicStream();
    }
    if (!this.micIsLive(nextStream)) {
      nextStream?.getTracks?.().forEach(item => item.stop());
      throw new Error('The browser granted microphone permission but no live audio track reached Neusic.');
    }

    const changed = this.micStream !== nextStream;
    this.micStream = nextStream;
    const track = nextStream.getAudioTracks()[0];
    track.enabled = true;
    if (changed || !this.micSource) {
      this.releaseMicSource();
      this.micSource = context.createMediaStreamSource(nextStream);
      track.addEventListener?.('ended', () => {
        if (this.micStream === nextStream) {
          this.releaseMicSource();
          this.micStream = null;
        }
      }, {once:true});
    }
    this.trace('microphone-live', {readyState:track.readyState, label:track.label || ''});
    return nextStream;
  }

  async initMic() {
    const stream = await this.prepareCapture();
    await this.ensureGraph();
    this.releaseMonitorGraph();

    if (this.context.audioWorklet && this.pitchWorkletLoaded) {
      try {
        this.pitchNode = new AudioWorkletNode(this.context, 'neusic-pitch-detector');
        this.pitchNode.port.onmessage = event => {
          this.pitchFrequency = event.data?.frequency || 0;
          this.pitchConfidence = event.data?.confidence || 0;
        };
      } catch (_) {
        this.pitchNode = null;
      }
    }
    this.monitor = this.context.createGain();
    this.monitor.gain.value = 0;
    if (this.pitchNode) {
      this.micSource.connect(this.pitchNode);
      this.pitchNode.connect(this.monitor);
    } else {
      this.micSource.connect(this.monitor);
    }
    this.monitor.connect(this.master);
    return stream;
  }

  setMonitor(enabled) {
    if (!this.monitor || !this.context) return;
    this.monitor.gain.setTargetAtTime(enabled ? .7 : 0, this.context.currentTime, .02);
  }

  meterLevel() {
    if (!this.analyser || !this.meterData) return 0;
    this.analyser.getByteTimeDomainData(this.meterData);
    let sum = 0;
    for (const value of this.meterData) {
      const sample = (value - 128) / 128;
      sum += sample * sample;
    }
    return Math.min(1, Math.sqrt(sum / this.meterData.length) * 3.5);
  }
}

export const workspace = new AudioWorkspace();
