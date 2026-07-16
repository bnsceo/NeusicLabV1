const isMobileBrowser = () => /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1;

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
  }

  disconnectNode() {
    clearTimeout(this.watchdog);
    try { this.source?.disconnect(this.node); } catch (_) {}
    try { this.node?.disconnect(); } catch (_) {}
    if (this.node && 'onaudioprocess' in this.node) this.node.onaudioprocess = null;
    if (this.node?.port) this.node.port.onmessage = null;
    this.node = null;
    this.source = null;
    if (!this.mediaRecorder) this.mode = 'none';
  }

  ensureSink(context) {
    if (this.sink && this.sink.context === context) return;
    try { this.sink?.disconnect(); } catch (_) {}
    this.sink = context.createGain();
    this.sink.gain.value = 0;
    this.sink.connect(context.destination);
  }

  preferredMimeType() {
    if (!window.MediaRecorder) return '';
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/mp4',
      'audio/webm',
      'audio/ogg;codecs=opus'
    ];
    return candidates.find(type => MediaRecorder.isTypeSupported?.(type)) || '';
  }

  canUseMediaRecorder() {
    const stream = this.workspace.micStream;
    return Boolean(window.MediaRecorder && stream?.getAudioTracks?.().some(track => track.readyState === 'live'));
  }

  async startMediaRecorder() {
    const stream = this.workspace.micStream;
    if (!stream) throw new Error('The microphone stream is unavailable.');
    const mimeType = this.preferredMimeType();
    const options = mimeType ? {mimeType, audioBitsPerSecond:128000} : {audioBitsPerSecond:128000};
    const recorder = new MediaRecorder(stream, options);
    this.mediaChunks = [];
    this.mediaRecorder = recorder;
    this.mode = 'media-recorder';
    recorder.addEventListener('dataavailable', event => {
      if (event.data?.size) this.mediaChunks.push(event.data);
    });
    this.mediaStopPromise = new Promise((resolve, reject) => {
      recorder.addEventListener('stop', resolve, {once:true});
      recorder.addEventListener('error', event => reject(event.error || new Error('Mobile recorder failed.')), {once:true});
    });
    recorder.start(100);
  }

  attachScriptProcessor(context) {
    const processor = context.createScriptProcessor?.(2048, 1, 1);
    if (!processor) throw new Error('This browser cannot create a compatible live PCM recorder.');
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
    await context.audioWorklet.addModule(new URL('./LoopCaptureWorklet.js', import.meta.url));
    const node = new AudioWorkletNode(context, 'neusic-loop-capture', {
      numberOfInputs:1,
      numberOfOutputs:1,
      outputChannelCount:[1]
    });
    node.port.onmessage = event => {
      if (event.data?.type !== 'pcm' || !this.recording) return;
      this.left.push(event.data.left);
      this.right.push(event.data.right || event.data.left);
    };
    this.workspace.micSource.connect(node);
    node.connect(this.sink);
    this.node = node;
    this.source = this.workspace.micSource;
    this.mode = 'audio-worklet';
  }

  async ensurePcm({forceCompatibility=false}={}) {
    const context = this.workspace.context;
    this.context = context;
    this.ensureSink(context);
    if (this.node && this.source === this.workspace.micSource) return;
    this.disconnectNode();
    const useCompatibility = forceCompatibility || !context.audioWorklet || !window.AudioWorkletNode;
    if (!useCompatibility) {
      try {
        await this.attachWorklet(context);
        return;
      } catch (error) {
        console.warn('AudioWorklet loop capture unavailable; using compatibility recorder.', error);
        this.disconnectNode();
      }
    }
    this.attachScriptProcessor(context);
  }

  async start() {
    await this.workspace.initMic();
    await this.workspace.resume({required:true});
    this.context = this.workspace.context;
    this.left = [];
    this.right = [];
    this.recording = true;

    if (isMobileBrowser() && this.canUseMediaRecorder()) {
      try {
        await this.startMediaRecorder();
        return this.mode;
      } catch (error) {
        console.warn('MediaRecorder unavailable; falling back to PCM capture.', error);
        this.mediaRecorder = null;
        this.mediaChunks = [];
      }
    }

    await this.ensurePcm();
    this.node?.port?.postMessage?.({type:'start'});
    clearTimeout(this.watchdog);
    this.watchdog = setTimeout(async () => {
      if (!this.recording || this.left.length || this.mode !== 'audio-worklet') return;
      try {
        this.disconnectNode();
        await this.ensurePcm({forceCompatibility:true});
      } catch (error) {
        console.warn('PCM compatibility fallback failed.', error);
      }
    }, 700);
    return this.mode;
  }

  async stopMediaRecorder() {
    const recorder = this.mediaRecorder;
    if (!recorder) return null;
    if (recorder.state !== 'inactive') {
      try { recorder.requestData(); } catch (_) {}
      recorder.stop();
    }
    await this.mediaStopPromise;
    const chunks = this.mediaChunks.slice();
    const mimeType = recorder.mimeType || chunks[0]?.type || 'audio/webm';
    this.mediaRecorder = null;
    this.mediaStopPromise = null;
    this.mediaChunks = [];
    this.mode = 'none';
    if (!chunks.length) throw new Error('The phone recorder stopped without producing audio data.');
    const blob = new Blob(chunks, {type:mimeType});
    const arrayBuffer = await blob.arrayBuffer();
    try {
      return await this.context.decodeAudioData(arrayBuffer.slice(0));
    } catch (error) {
      throw new Error('The phone captured audio, but this browser could not decode the recording.');
    }
  }

  async stop() {
    if (!this.recording) return null;
    clearTimeout(this.watchdog);
    this.recording = false;

    if (this.mode === 'media-recorder') return this.stopMediaRecorder();

    this.node?.port?.postMessage?.({type:'stop'});
    await new Promise(resolve => setTimeout(resolve, 100));
    const frames = this.left.reduce((total, chunk) => total + chunk.length, 0);
    if (!frames) {
      throw new Error('Permission is enabled, but no microphone samples reached the lane recorder. Close Bluetooth audio and retry in Safari or Chrome.');
    }
    const buffer = this.context.createBuffer(2, frames, this.context.sampleRate);
    let offset = 0;
    for (let index = 0; index < this.left.length; index++) {
      buffer.getChannelData(0).set(this.left[index], offset);
      buffer.getChannelData(1).set(this.right[index] || this.left[index], offset);
      offset += this.left[index].length;
    }
    this.left = [];
    this.right = [];
    return buffer;
  }

  cancel() {
    this.node?.port?.postMessage?.({type:'stop'});
    clearTimeout(this.watchdog);
    this.recording = false;
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try { this.mediaRecorder.stop(); } catch (_) {}
    }
    this.mediaRecorder = null;
    this.mediaStopPromise = null;
    this.mediaChunks = [];
    this.left = [];
    this.right = [];
    this.mode = 'none';
  }
}
