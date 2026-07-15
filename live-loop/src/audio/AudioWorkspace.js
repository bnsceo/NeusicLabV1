class AudioWorkspace {
  constructor() {
    this.context = null;
    this.master = null;
    this.analyser = null;
    this.meterData = null;
    this.micStream = null;
    this.micSource = null;
    this.monitor = null;
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
    if (this.context.state === 'suspended') {try {await this.context.resume();} catch (_) {}}
    return this;
  }
  async initMic() {
    await this.init();
    if (this.micStream) return this.micStream;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone capture is not supported in this browser.');
    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false,channelCount:2}
    });
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
    if (!this.analyser) return 0;
    this.analyser.getByteTimeDomainData(this.meterData);
    let sum = 0;
    for (const value of this.meterData) {const sample=(value-128)/128;sum += sample*sample;}
    return Math.min(1,Math.sqrt(sum/this.meterData.length)*3.5);
  }
}
export const workspace = new AudioWorkspace();
