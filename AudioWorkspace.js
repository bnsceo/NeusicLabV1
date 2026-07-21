class AudioWorkspace {
  constructor() {
    this.context = null;
    this.master = null;
    this.analyser = null;
    this.meterData = null;
    this.micStream = null;
    this.micSource = null;
    this.monitor = null;
    this.unlocked = false;
  }

  async init() {
    if (!this.context) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) throw new Error('Web Audio is not supported in this browser.');
      this.context = window.NeusicMobileMicPrimer?.context || new Context({latencyHint:'interactive'});
      window.NeusicMobileMicPrimer?.adoptContext?.(this.context);
      this.master = this.context.createGain();
      this.master.gain.value = .82;
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 256;
      this.meterData = new Uint8Array(this.analyser.fftSize);
      this.master.connect(this.analyser);
      this.analyser.connect(this.context.destination);
    }
    await this.resume();
    return this;
  }

  async resume({required=false}={}) {
    if (!this.context) return this.init();
    try {
      if (this.context.state !== 'running') {
        if (window.NeusicMobileMicPrimer?.context === this.context) await window.NeusicMobileMicPrimer.unlock();
        else await this.context.resume();
      }
      if (this.context.state === 'running' && !this.unlocked) {
        const pulse = this.context.createBufferSource();
        pulse.buffer = this.context.createBuffer(1, 1, this.context.sampleRate);
        pulse.connect(this.context.destination);
        pulse.start(0);
        this.unlocked = true;
      }
    } catch (error) {
      if (required) throw new Error(error?.message || 'Audio is still locked. Tap REC again to unlock it.');
    }
    if (required && this.context.state !== 'running') {
      throw new Error('Audio is still locked. Tap REC again to unlock it.');
    }
    return this;
  }

  micIsLive(stream=this.micStream) {
    return Boolean(stream?.getAudioTracks?.().some(track => track.readyState === 'live' && track.enabled));
  }

  releaseMicGraph() {
    try { this.micSource?.disconnect(); } catch (_) {}
    try { this.monitor?.disconnect(); } catch (_) {}
    this.micSource = null;
    this.monitor = null;
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
      return new Error('The phone interrupted microphone startup. Tap REC again.');
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

  async initMic() {
    if (!window.isSecureContext) {
      throw new Error('Microphone recording requires HTTPS. Open the secure Neusic Live Loop page and tap REC again.');
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone capture is unavailable in this browser. Open Neusic Live Loop in Safari or Chrome.');
    }

    await this.init();
    await this.resume({required:true});

    let stream = this.micIsLive() ? this.micStream : null;
    if (!stream) {
      this.releaseMicGraph();
      this.micStream?.getTracks?.().forEach(track => track.stop());
      stream = await this.requestMicStream();
      if (!this.micIsLive(stream)) {
        stream?.getTracks?.().forEach(item => item.stop());
        throw new Error('The phone granted microphone permission but no live audio reached Neusic.');
      }
      this.micStream = stream;
      const track = stream.getAudioTracks()[0];
      track.enabled = true;
      track.addEventListener('ended', () => {
        this.releaseMicGraph();
        if (this.micStream === stream) this.micStream = null;
      }, {once:true});
    }

    if (this.micSource) return stream;
    this.releaseMicGraph();
    this.micSource = this.context.createMediaStreamSource(stream);
    this.monitor = this.context.createGain();
    this.monitor.gain.value = 0;
    this.micSource.connect(this.monitor);
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