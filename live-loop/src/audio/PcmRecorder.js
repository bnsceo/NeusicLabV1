export class PcmRecorder {
  constructor(workspace) {
    this.workspace = workspace;
    this.context = workspace.context;
    this.node = null;
    this.source = null;
    this.sink = null;
    this.left = [];
    this.right = [];
    this.recording = false;
    this.mode = 'none';
    this.watchdog = 0;
    this.mediaRecorder = null;
    this.mediaChunks = [];
    this.mediaStopPromise = null;
    this.mediaStopResolve = null;
    this.mediaStopReject = null;
  }

  trace(stage, detail = {}) {
    window.__neusicCaptureTrace?.(stage, {backend:this.mode, ...detail});
  }

  disconnectNode() {
    clearTimeout(this.watchdog);
    try { this.source?.disconnect(this.node); } catch (_) {}
    try { this.node?.disconnect(); } catch (_) {}
    if (this.node && 'onaudioprocess' in this.node) this.node.onaudioprocess = null;
    if (this.node?.port) this.node.port.onmessage = null;
    this.node = null;
    this.source = null;
  }

  resetBackend() {
    this.disconnectNode();
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try { this.mediaRecorder.stop(); } catch (_) {}
    }
    this.mediaRecorder = null;
    this.mediaChunks = [];
    this.mediaStopPromise = null;
    this.mediaStopResolve = null;
    this.mediaStopReject = null;
    this.mode = 'none';
  }

  ensureSink(context) {
    if (this.sink?.context === context) return;
    try { this.sink?.disconnect(); } catch (_) {}
    this.sink = context.createGain();
    this.sink.gain.value = 0;
    this.sink.connect(context.destination);
  }

  attachScriptProcessor(context) {
    const processor = context.createScriptProcessor?.(4096, 1, 1);
    if (!processor) throw new Error('This browser cannot create a compatible live recorder.');
    processor.onaudioprocess = event => {
      const output = event.outputBuffer;
      for (let channel = 0; channel < output.numberOfChannels; channel++) output.getChannelData(channel).fill(0);
      if (!this.recording) return;
      const input = event.inputBuffer;
      if (!input?.length) return;
      const left = new Float32Array(input.getChannelData(0));
      const right = new Float32Array(input.getChannelData(Math.min(1, input.numberOfChannels - 1)));
      this.left.push(left);
      this.right.push(right);
    };
    this.workspace.micSource.connect(processor);
    processor.connect(this.sink);
    this.node = processor;
    this.source = this.workspace.micSource;
    this.mode = 'script-processor';
  }

  async attachWorklet(context) {
    await context.audioWorklet.addModule(new URL('./LoopCaptureWorklet.js?v=20', import.meta.url));
    const node = new AudioWorkletNode(context, 'neusic-loop-capture', {
      numberOfInputs:1,
      numberOfOutputs:1,
      outputChannelCount:[1]
    });
    node.port.onmessage = event => {
      if (event.data?.type !== 'pcm' || !this.recording) return;
      const left = event.data.left instanceof Float32Array ? event.data.left : new Float32Array(event.data.left || []);
      const rightData = event.data.right || event.data.left;
      const right = rightData instanceof Float32Array ? rightData : new Float32Array(rightData || []);
      if (left.length) {
        this.left.push(left);
        this.right.push(right.length ? right : left);
        if (this.left.length === 1) this.trace('first-pcm-samples', {frames:left.length});
      }
    };
    this.workspace.micSource.connect(node);
    node.connect(this.sink);
    this.node = node;
    this.source = this.workspace.micSource;
    this.mode = 'audio-worklet';
  }

  preferredMediaMime() {
    if (!window.MediaRecorder) return '';
    const choices = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4'
    ];
    return choices.find(type => !MediaRecorder.isTypeSupported || MediaRecorder.isTypeSupported(type)) || '';
  }

  attachMediaRecorder(stream) {
    if (!window.MediaRecorder) throw new Error('MediaRecorder is unavailable.');
    const mimeType = this.preferredMediaMime();
    const recorder = mimeType ? new MediaRecorder(stream, {mimeType}) : new MediaRecorder(stream);
    this.mediaChunks = [];
    this.mediaStopPromise = new Promise((resolve, reject) => {
      this.mediaStopResolve = resolve;
      this.mediaStopReject = reject;
    });
    recorder.ondataavailable = event => {
      if (event.data?.size) {
        this.mediaChunks.push(event.data);
        if (this.mediaChunks.length === 1) this.trace('first-media-chunk', {bytes:event.data.size, mimeType:recorder.mimeType});
      }
    };
    recorder.onerror = event => {
      this.mediaStopReject?.(event.error || new Error('MediaRecorder failed.'));
    };
    recorder.onstop = () => this.mediaStopResolve?.();
    recorder.start(200);
    this.mediaRecorder = recorder;
    this.mode = 'media-recorder';
  }

  isWebKitFamily() {
    const ua = navigator.userAgent || '';
    return /AppleWebKit/i.test(ua) && !/(Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS)/i.test(ua);
  }

  async chooseBackend(context, stream) {
    this.resetBackend();
    this.ensureSink(context);

    const attempts = this.isWebKitFamily()
      ? ['audio-worklet', 'media-recorder', 'script-processor']
      : ['media-recorder', 'audio-worklet', 'script-processor'];

    const errors = [];
    for (const backend of attempts) {
      try {
        if (backend === 'audio-worklet') {
          if (!context.audioWorklet || !window.AudioWorkletNode) throw new Error('AudioWorklet unavailable.');
          await this.attachWorklet(context);
        } else if (backend === 'media-recorder') {
          this.attachMediaRecorder(stream);
        } else {
          this.attachScriptProcessor(context);
        }
        this.trace('recorder-backend-selected', {backend:this.mode});
        return this.mode;
      } catch (error) {
        errors.push(`${backend}: ${error?.message || error}`);
        this.resetBackend();
      }
    }
    throw new Error(`No compatible recorder backend could start. ${errors.join(' | ')}`);
  }

  async start(stream=null) {
    const liveStream = await this.workspace.prepareCapture(stream);
    await this.workspace.resume({required:true});
    this.context = this.workspace.context;
    this.left = [];
    this.right = [];
    this.recording = true;
    try {
      await this.chooseBackend(this.context, liveStream);
      if (this.mode === 'audio-worklet') this.node?.port?.postMessage?.({type:'start'});
      this.trace('recording-started');
      return this.mode;
    } catch (error) {
      this.recording = false;
      this.resetBackend();
      throw error;
    }
  }

  applyEdgeFade(buffer) {
    const fadeFrames = Math.min(Math.round(buffer.sampleRate * 0.012), Math.floor(buffer.length / 4));
    if (fadeFrames < 2) return buffer;
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const data = buffer.getChannelData(channel);
      for (let index = 0; index < fadeFrames; index++) {
        const amount = index / fadeFrames;
        data[index] *= amount;
        data[data.length - 1 - index] *= amount;
      }
    }
    return buffer;
  }

  async stopMediaRecorder() {
    const recorder = this.mediaRecorder;
    if (!recorder) return null;
    if (recorder.state !== 'inactive') recorder.stop();
    await this.mediaStopPromise;
    const blob = new Blob(this.mediaChunks, {type:recorder.mimeType || this.mediaChunks[0]?.type || 'audio/webm'});
    if (!blob.size) throw new Error('The browser recorder returned no audio data.');
    const arrayBuffer = await blob.arrayBuffer();
    const decoded = await this.context.decodeAudioData(arrayBuffer.slice(0));
    this.trace('recording-decoded', {frames:decoded.length, duration:decoded.duration, bytes:blob.size});
    return decoded;
  }

  async stopPcm() {
    if (this.mode === 'audio-worklet') this.node?.port?.postMessage?.({type:'stop'});
    await new Promise(resolve => setTimeout(resolve, 80));
    const frames = this.left.reduce((total, chunk) => total + chunk.length, 0);
    if (!frames) throw new Error('Microphone permission is enabled, but no audio samples reached the recorder.');
    const buffer = this.context.createBuffer(2, frames, this.context.sampleRate);
    let offset = 0;
    for (let index = 0; index < this.left.length; index++) {
      buffer.getChannelData(0).set(this.left[index], offset);
      buffer.getChannelData(1).set(this.right[index] || this.left[index], offset);
      offset += this.left[index].length;
    }
    this.trace('recording-buffer-created', {frames, duration:buffer.duration});
    return buffer;
  }

  async stop() {
    if (!this.recording) return null;
    this.recording = false;
    const activeMode = this.mode;
    try {
      const buffer = activeMode === 'media-recorder' ? await this.stopMediaRecorder() : await this.stopPcm();
      return this.applyEdgeFade(buffer);
    } finally {
      this.left = [];
      this.right = [];
      this.resetBackend();
      this.trace('recording-stopped', {backend:activeMode});
    }
  }

  cancel() {
    this.recording = false;
    this.left = [];
    this.right = [];
    this.resetBackend();
    this.trace('recording-cancelled');
  }

  diagnostics() {
    return {
      mode:this.mode,
      recording:this.recording,
      pcmChunks:this.left.length,
      pcmFrames:this.left.reduce((total, chunk) => total + chunk.length, 0),
      mediaChunks:this.mediaChunks.length,
      mediaState:this.mediaRecorder?.state || 'none'
    };
  }
}
