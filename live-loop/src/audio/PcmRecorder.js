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
  }

  disconnectNode() {
    clearTimeout(this.watchdog);
    try { this.source?.disconnect(this.node); } catch (_) {}
    try { this.node?.disconnect(); } catch (_) {}
    if (this.node && 'onaudioprocess' in this.node) this.node.onaudioprocess = null;
    if (this.node?.port) this.node.port.onmessage = null;
    this.node = null;
    this.source = null;
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
    await context.audioWorklet.addModule(new URL('./LoopCaptureWorklet.js', import.meta.url));
    const node = new AudioWorkletNode(context, 'neusic-loop-capture', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1]
    });
    node.port.onmessage = event => {
      if (event.data?.type !== 'pcm' || !this.recording) return;
      const left = event.data.left instanceof Float32Array ? event.data.left : new Float32Array(event.data.left || []);
      const rightData = event.data.right || event.data.left;
      const right = rightData instanceof Float32Array ? rightData : new Float32Array(rightData || []);
      if (left.length) {
        this.left.push(left);
        this.right.push(right.length ? right : left);
      }
    };
    this.workspace.micSource.connect(node);
    node.connect(this.sink);
    this.node = node;
    this.source = this.workspace.micSource;
    this.mode = 'audio-worklet';
  }

  async ensurePcm({forceCompatibility = false} = {}) {
    const context = this.workspace.context;
    this.context = context;
    this.ensureSink(context);
    if (this.node && this.source === this.workspace.micSource) return;
    this.disconnectNode();
    if (!forceCompatibility && context.audioWorklet && window.AudioWorkletNode) {
      try {
        await this.attachWorklet(context);
        return;
      } catch (error) {
        console.warn('AudioWorklet capture unavailable; using compatibility PCM.', error);
        this.disconnectNode();
      }
    }
    this.attachScriptProcessor(context);
  }

  async start() {
    await this.workspace.initMic();
    await this.workspace.resume({required: true});
    this.context = this.workspace.context;
    this.left = [];
    this.right = [];
    this.recording = true;
    await this.ensurePcm();
    this.node?.port?.postMessage?.({type: 'start'});
    clearTimeout(this.watchdog);
    this.watchdog = setTimeout(async () => {
      if (!this.recording || this.left.length || this.mode !== 'audio-worklet') return;
      try {
        this.disconnectNode();
        await this.ensurePcm({forceCompatibility: true});
      } catch (error) {
        console.warn('PCM compatibility fallback failed.', error);
      }
    }, 650);
    return this.mode;
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

  async stop() {
    if (!this.recording) return null;
    clearTimeout(this.watchdog);
    this.recording = false;
    this.node?.port?.postMessage?.({type: 'stop'});
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
    this.left = [];
    this.right = [];
    return this.applyEdgeFade(buffer);
  }

  cancel() {
    this.node?.port?.postMessage?.({type: 'stop'});
    clearTimeout(this.watchdog);
    this.recording = false;
    this.left = [];
    this.right = [];
  }
}
