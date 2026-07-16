const isIOSWebKit = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

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
    if (this.sink && this.sink.context === context) return;
    try { this.sink?.disconnect(); } catch (_) {}
    this.sink = context.createGain();
    this.sink.gain.value = 1;
    this.sink.connect(context.destination);
  }

  attachScriptProcessor(context) {
    const processor = context.createScriptProcessor?.(1024, 1, 1);
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

  async ensure({forceCompatibility=false}={}) {
    await this.workspace.initMic();
    await this.workspace.resume({required:true});
    const context = this.workspace.context;
    this.context = context;
    this.ensureSink(context);
    if (this.node && this.source === this.workspace.micSource) return;
    this.disconnectNode();

    const useCompatibility = forceCompatibility || isIOSWebKit() || !context.audioWorklet || !window.AudioWorkletNode;
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

  async switchToCompatibility() {
    if (!this.recording || this.mode === 'script-processor') return;
    this.disconnectNode();
    await this.ensure({forceCompatibility:true});
  }

  async start() {
    await this.ensure();
    await this.workspace.resume({required:true});
    this.left = [];
    this.right = [];
    this.recording = true;
    this.node?.port?.postMessage?.({type:'start'});
    clearTimeout(this.watchdog);
    this.watchdog = setTimeout(() => {
      if (!this.recording || this.left.length || this.mode !== 'audio-worklet') return;
      this.switchToCompatibility().catch(error => console.warn('PCM compatibility fallback failed.', error));
    }, 650);
    return this.mode;
  }

  async stop() {
    if (!this.recording) return null;
    this.node?.port?.postMessage?.({type:'stop'});
    clearTimeout(this.watchdog);
    await new Promise(resolve => setTimeout(resolve, 80));
    this.recording = false;
    const frames = this.left.reduce((total, chunk) => total + chunk.length, 0);
    if (!frames) {
      throw new Error('No microphone audio arrived. Check the site microphone permission, turn off Bluetooth audio temporarily, and tap REC again.');
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
    this.left = [];
    this.right = [];
  }
}
