import {beatsToSeconds, duration, makeAsset, renderSlice} from './model.js';

function bufferFrom(context, asset) {
  const b = context.createBuffer(asset.channels.length, asset.channels[0].length, asset.sampleRate);
  asset.channels.forEach((c, i) => b.copyToChannel(c, i)); return b;
}
function impulse(context) {
  const b = context.createBuffer(2, Math.round(context.sampleRate * 1.4), context.sampleRate);
  let seed = 137;
  for (let c = 0; c < 2; c++) {
    const data = b.getChannelData(c);
    for (let i = 0; i < data.length; i++) { seed = (seed * 16807) % 2147483647; data[i] = (seed / 1073741823.5 - 1) * (1 - i / data.length) ** 3; }
  }
  return b;
}
function createBus(ctx, destination, settings, bpm, ir) {
  const input = ctx.createGain(), tone = ctx.createBiquadFilter(), pan = ctx.createStereoPanner();
  const delay = ctx.createDelay(2), feedback = ctx.createGain(), send = ctx.createGain();
  const reverb = ctx.createConvolver(), wet = ctx.createGain();
  tone.type = 'highshelf'; tone.frequency.value = 2500;
  delay.delayTime.value = beatsToSeconds(.5, bpm); feedback.gain.value = .28; reverb.buffer = ir;
  input.connect(tone); tone.connect(pan); pan.connect(destination);
  pan.connect(send); send.connect(delay); delay.connect(feedback); feedback.connect(delay); delay.connect(destination);
  pan.connect(wet); wet.connect(reverb); reverb.connect(destination);
  const bus = {input, tone, pan, delay, feedback, send, reverb, wet,
    update(s, soloActive = false) {
      const now = ctx.currentTime;
      input.gain.setTargetAtTime(s.muted || (soloActive && !s.solo) ? 0 : s.volume, now, .008);
      pan.pan.setTargetAtTime(s.pan, now, .008); tone.gain.setTargetAtTime(s.tone || 0, now, .008);
      send.gain.setTargetAtTime(s.delay || 0, now, .008); wet.gain.setTargetAtTime(s.reverb || 0, now, .008);
    },
    dispose() { [input, tone, pan, delay, feedback, send, reverb, wet].forEach(n => n.disconnect()); }
  };
  bus.update(settings); return bus;
}
function schedule(ctx, asset, bus, when, seconds, {offset = 0, loop = false, gain = 1} = {}) {
  const source = ctx.createBufferSource(), level = ctx.createGain(); source.buffer = bufferFrom(ctx, asset);
  source.loop = loop; level.gain.value = gain; source.connect(level); level.connect(bus);
  source.start(when, Math.max(0, offset) % duration(asset));
  if (Number.isFinite(seconds)) source.stop(when + seconds);
  source.onended = () => {source.disconnect(); level.disconnect();};
  return source;
}
export class SuiteAudio extends EventTarget {
  constructor() { super(); this.context = null; this.mode = null; this.nodes = []; this.buses = new Map(); this.epoch = 0; this.startBeat = 0; this.captureJob = null; this.padNode = null; this.captureNonce = 0; }
  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, {detail})); }
  async init() {
    if (!this.context) {
      const AudioCtx = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AudioCtx) throw new Error('This browser does not support Web Audio.');
      this.context = new AudioCtx({latencyHint: 'interactive'});
      this.master = this.context.createGain(); this.master.gain.value = .8;
      this.analyser = this.context.createAnalyser(); this.analyser.fftSize = 256;
      this.master.connect(this.analyser); this.analyser.connect(this.context.destination);
      this.ir = impulse(this.context);
      this.context.onstatechange = () => this.emit('state', this.context.state);
    }
    await this.context.resume();
    if (this.context.state !== 'running') throw new Error('Audio is suspended. Tap Play to resume.');
    return this.context;
  }
  async microphone() {
    await this.init();
    if (this.stream?.active) return;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone needs HTTPS or localhost and browser permission.');
    const stream = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1}});
    try {
      await this.context.audioWorklet.addModule(new URL('./capture-worklet.js', import.meta.url));
      this.recorder = new AudioWorkletNode(this.context, 'neusical-suite-capture');
      this.micInput = this.context.createMediaStreamSource(stream);
      this.inputMeter = this.context.createAnalyser(); this.inputMeter.fftSize = 256;
      this.micInput.connect(this.inputMeter); this.micInput.connect(this.recorder); this.recorder.connect(this.context.destination);
      this.stream = stream;
      this.recorder.port.onmessage = ({data}) => {
        const job = this.captureJob;
        if (!job) return;
        if (data.type === 'captured') {
          this.captureJob = null;
          job.resolve(makeAsset(job.name, this.context.sampleRate, [data.pcm]));
        } else if (data.type === 'error') { this.captureJob = null; job.reject(new Error(data.message)); }
      };
      stream.getAudioTracks().forEach(track => track.onended = () => {this.cancelCapture(); this.stream = null; this.emit('mic-ended');});
    } catch (error) {stream.getTracks().forEach(t => t.stop()); throw error;}
  }
  releaseMicrophone() {
    this.cancelCapture(); this.stream?.getTracks().forEach(t => t.stop());
    this.micInput?.disconnect(); this.recorder?.disconnect(); this.inputMeter?.disconnect(); this.stream = null;
  }
  async recordLoop(project, assets, name) {
    if (this.captureJob) throw new Error('Finish or cancel the current take first.');
    const attempt = ++this.captureNonce;
    await this.microphone();
    if (attempt !== this.captureNonce) throw new Error('Microphone arming cancelled; existing takes kept.');
    const ctx = this.context, seconds = beatsToSeconds(project.loopBars * 4, project.bpm);
    if (this.mode !== 'live') this.playLive(project, assets, ctx.currentTime + beatsToSeconds(1, project.bpm));
    let when = this.epoch;
    if (when < ctx.currentTime + .15) when += Math.ceil((ctx.currentTime + .15 - when) / seconds) * seconds;
    const start = Math.round(when * ctx.sampleRate), end = start + Math.round(seconds * ctx.sampleRate);
    const result = new Promise((resolve, reject) => {this.captureJob = {resolve, reject, name, when, end: end / ctx.sampleRate};});
    this.recorder.port.postMessage({type: 'capture', start, end});
    this.emit('capture', {when, end: end / ctx.sampleRate});
    return result;
  }
  cancelCapture() {
    this.captureNonce++;
    if (this.captureJob) {const job = this.captureJob; this.captureJob = null; this.recorder?.port.postMessage({type: 'cancel'}); job.reject(new Error('Take cancelled; previous layers kept.'));}
  }
  stop() {
    this.cancelCapture();
    this.nodes.forEach(n => {try {n.stop();} catch {}}); this.nodes = [];
    if (this.padNode) {try {this.padNode.stop();} catch {}} this.padNode = null;
    this.buses.forEach(b => b.dispose()); this.buses.clear(); this.mode = null; this.emit('transport');
  }
  bus(track, bpm) {
    if (!this.buses.has(track.id)) this.buses.set(track.id, createBus(this.context, this.master, track, bpm, this.ir));
    return this.buses.get(track.id);
  }
  updateMix(tracks) {
    const solo = tracks.some(t => t.solo);
    tracks.forEach(t => this.buses.get(t.id)?.update(t, solo));
  }
  playLive(project, assets, when = this.context.currentTime + .08) {
    this.stop(); this.mode = 'live'; this.epoch = when; this.startBeat = 0;
    project.lanes.forEach(lane => this.addLane(lane, assets, project.bpm)); this.updateMix(project.lanes); this.emit('transport');
  }
  addLane(lane, assets, bpm) {
    const ctx = this.context, when = Math.max(this.epoch, ctx.currentTime + .025), offset = Math.max(0, when - this.epoch);
    const bus = this.bus(lane, bpm);
    lane.layers.forEach(id => {
      if (this.nodes.some(n => n.assetId === id && n.laneId === lane.id)) return;
      const node = schedule(ctx, assets.get(id), bus.input, when, Infinity, {offset, loop: true});
      node.assetId = id; node.laneId = lane.id; this.nodes.push(node);
    });
  }
  playStudio(project, assets, beat = 0) {
    this.stop(); this.mode = 'studio'; this.startBeat = beat; this.epoch = this.context.currentTime + .08;
    project.tracks.forEach(track => {
      const bus = this.bus(track, project.bpm);
      track.clips.forEach(clip => {
        const skip = Math.max(0, beat - clip.beat), remaining = clip.length - skip;
        if (remaining <= 0) return;
        const when = this.epoch + beatsToSeconds(Math.max(0, clip.beat - beat), project.bpm);
        this.nodes.push(schedule(this.context, assets.get(clip.assetId), bus.input, when, beatsToSeconds(remaining, project.bpm),
          {offset: clip.offset + beatsToSeconds(skip, project.bpm), loop: true, gain: clip.gain}));
      });
    });
    this.updateMix(project.tracks); this.emit('transport');
  }
  async previewPad(asset, slice) {
    await this.init();
    if (this.padNode) {try {this.padNode.stop();} catch {}}
    const rendered = renderSlice(asset, slice);
    this.padNode = schedule(this.context, rendered, this.master, this.context.currentTime + .003, duration(rendered));
  }
  playAsset(asset, mode = 'sequence') {
    this.stop(); this.mode = mode; this.epoch = this.context.currentTime + .05; this.startBeat = 0;
    this.nodes.push(schedule(this.context, asset, this.master, this.epoch, duration(asset)));
    this.emit('transport');
  }
  beat(bpm) { return this.mode ? this.startBeat + Math.max(0, this.context.currentTime - this.epoch) * bpm / 60 : this.startBeat; }
  meter(input = false) {
    const analyser = input ? this.inputMeter : this.analyser;
    if (!analyser) return 0;
    const data = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(data);
    return data.reduce((peak, n) => Math.max(peak, Math.abs(n)), 0);
  }
  async decode(file) {
    await this.init(); const b = await this.context.decodeAudioData(await file.arrayBuffer());
    return makeAsset(file.name.replace(/\.[^.]+$/, ''), b.sampleRate, Array.from({length: Math.min(2, b.numberOfChannels)}, (_, i) => b.getChannelData(i)), 'import');
  }
  async render(project, assets, live = false) {
    const tracks = live ? project.lanes.map(l => ({...l, clips: l.layers.map(id => ({assetId: id, beat: 0, length: project.loopBars * 4, offset: 0, gain: 1}))})) : project.tracks;
    const maxBeat = Math.max(0, ...tracks.flatMap(t => t.clips.map(c => c.beat + c.length)));
    if (!maxBeat) throw new Error('Add audio before exporting.');
    const tail = tracks.some(t => t.delay || t.reverb) ? 3 : 0;
    if (beatsToSeconds(maxBeat, project.bpm) + tail > 600) throw new Error('Preview WAV rendering is limited to 10 minutes to protect browser memory.');
    const ctx = new OfflineAudioContext(2, Math.ceil((beatsToSeconds(maxBeat, project.bpm) + tail) * 48000), 48000);
    const master = ctx.createGain(); master.gain.value = .8; master.connect(ctx.destination);
    const ir = impulse(ctx), solo = tracks.some(t => t.solo);
    tracks.forEach(track => {
      const bus = createBus(ctx, master, track, project.bpm, ir); bus.update(track, solo);
      track.clips.forEach(clip => schedule(ctx, assets.get(clip.assetId), bus.input, beatsToSeconds(clip.beat, project.bpm),
        beatsToSeconds(clip.length, project.bpm), {offset: clip.offset, loop: true, gain: clip.gain}));
    });
    const b = await ctx.startRendering();
    return makeAsset(project.name, b.sampleRate, [b.getChannelData(0), b.getChannelData(1)], 'export');
  }
  async startPerformance() {
    await this.init();
    if (!globalThis.MediaRecorder) throw new Error('Live performance capture is not supported by this browser. Loop WAV export is still available.');
    const destination = this.context.createMediaStreamDestination(); this.master.connect(destination);
    const chunks = [], recorder = new MediaRecorder(destination.stream);
    recorder.ondataavailable = e => {if (e.data.size) chunks.push(e.data);};
    recorder.start(1000); this.performance = {recorder, destination, chunks};
  }
  async finishPerformance() {
    const {recorder, destination, chunks} = this.performance;
    this.performance = null;
    await new Promise((resolve, reject) => {recorder.onstop = resolve; recorder.onerror = e => reject(e.error); recorder.stop();});
    this.master.disconnect(destination); destination.stream.getTracks().forEach(t => t.stop());
    const blob = new Blob(chunks, {type: recorder.mimeType});
    // Decode the browser's recording format and deliver a standard WAV.
    const buffer = await this.context.decodeAudioData(await blob.arrayBuffer());
    return makeAsset('Live performance', buffer.sampleRate, Array.from({length: buffer.numberOfChannels}, (_, i) => buffer.getChannelData(i)), 'performance');
  }
}
