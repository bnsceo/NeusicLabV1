export class PcmRecorder {
  constructor(workspace) {
    this.workspace = workspace;
    this.context = workspace.context;
    this.node = null;
    this.sink = null;
    this.left = [];
    this.right = [];
    this.recording = false;
    this.mode = 'none';
  }

  async ensure() {
    await this.workspace.initMic();
    if (this.node) return;
    const context = this.workspace.context;
    this.context = context;
    this.sink = context.createGain();
    this.sink.gain.value = 0;
    this.sink.connect(context.destination);

    if (context.audioWorklet && window.AudioWorkletNode) {
      try {
        await context.audioWorklet.addModule(new URL('./LoopCaptureWorklet.js', import.meta.url));
        const node = new AudioWorkletNode(context, 'neusic-loop-capture', {numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2]});
        node.port.onmessage = event => {
          if (event.data?.type !== 'pcm' || !this.recording) return;
          this.left.push(event.data.left);
          this.right.push(event.data.right);
        };
        this.workspace.micSource.connect(node);
        node.connect(this.sink);
        this.node = node;
        this.mode = 'audio-worklet';
        return;
      } catch (error) {
        console.warn('AudioWorklet loop capture unavailable; using compatibility recorder.', error);
      }
    }

    const processor = context.createScriptProcessor?.(2048, 2, 2);
    if (!processor) throw new Error('This browser cannot create a live PCM recorder.');
    processor.onaudioprocess = event => {
      if (!this.recording) return;
      const input = event.inputBuffer;
      const left = new Float32Array(input.getChannelData(0));
      const right = new Float32Array(input.getChannelData(Math.min(1,input.numberOfChannels-1)));
      this.left.push(left);
      this.right.push(right);
    };
    this.workspace.micSource.connect(processor);
    processor.connect(this.sink);
    this.node = processor;
    this.mode = 'script-processor';
  }

  async start() {
    await this.ensure();
    await this.workspace.init();
    this.left = [];
    this.right = [];
    this.recording = true;
    this.node?.port?.postMessage?.({type:'start'});
    return this.mode;
  }

  async stop() {
    if (!this.recording) return null;
    this.node?.port?.postMessage?.({type:'stop'});
    this.recording = false;
    await new Promise(resolve => setTimeout(resolve, 36));
    const frames = this.left.reduce((total,chunk) => total + chunk.length, 0);
    if (!frames) throw new Error('No microphone audio reached the selected loop lane. Check microphone permission and try again.');
    const buffer = this.context.createBuffer(2, frames, this.context.sampleRate);
    let offset = 0;
    for (let index=0; index<this.left.length; index++) {
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
    this.recording = false;
    this.left = [];
    this.right = [];
  }
}
