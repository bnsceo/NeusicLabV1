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
      this.context = new Context({latencyHint:'interactive'});
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
      if (this.context.state !== 'running') await this.context.resume();
      if (this.context.state === 'running' && !this.unlocked) {
        const pulse = this.context.createBufferSource();
        pulse.buffer = this.context.createBuffer(1, 1, this.context.sampleRate);
        pulse.connect(this.context.destination);
        pulse.start(0);
        this.unlocked = true;
      }
    } catch (error) {
      if (required) throw new Error('Audio is still locked. Tap REC or MIC again to unlock it.');
    }
    if (required && this.context.state !== 'running') {
      throw new Error('Audio is still locked. Tap REC or MIC again to unlock it.');
    }
    return this;
  }

  micIsLive() {
    return Boolean(this.micStream?.getAudioTracks?.().some(track => track.readyState === 'live' && track.enabled));
  }

  releaseMicGraph() {
    try { this.micSource?.disconnect(); } catch (_) {}
    try { this.monitor?.disconnect(); } catch (_) {}
    this.micSource = null;
    this.monitor = null;
  }

  async initMic() {
    await this.init();
    await this.resume({required:true});
    if (this.micIsLive() && this.micSource) return this.micStream;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone capture is not supported in this browser.');

    this.releaseMicGraph();
    this.micStream?.getTracks?.().forEach(track => track.stop());
    this.micStream = null;

    const preferred = {
      echoCancellation:false,
      noiseSuppression:false,
      autoGainControl:false,
      channelCount:{ideal:1},
      sampleRate:{ideal:this.context.sampleRate}
    };
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({audio:preferred});
    } catch (preferredError) {
      try {
        this.micStream = await navigator.mediaDevices.getUserMedia({audio:true});
      } catch (error) {
        if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') {
          throw new Error('Microphone permission is blocked. Allow microphone access for this site, then tap REC again.');
        }
        if (error?.name === 'NotFoundError') throw new Error('No microphone was found on this device.');
        throw new Error(error?.message || 'The microphone could not be opened.');
      }
    }

    const track = this.micStream.getAudioTracks()[0];
    if (!track) throw new Error('No microphone audio track was returned by this device.');
    track.enabled = true;
    track.addEventListener('ended', () => {
      this.releaseMicGraph();
      this.micStream = null;
    }, {once:true});

    await this.resume({required:true});
    this.micSource = this.context.createMediaStreamSource(this.micStream);
    this.monitor = this.context.createGain();
    this.monitor.gain.value = 0;
    this.micSource.connect(this.monitor);
    this.monitor.connect(this.master);
    return this.micStream;
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
