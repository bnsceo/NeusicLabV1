class NeusicLoopCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.recording = false;
    this.port.onmessage = event => {
      if (event.data?.type === 'start') this.recording = true;
      if (event.data?.type === 'stop') this.recording = false;
    };
  }
  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (output) output.forEach(channel => channel.fill(0));
    if (!this.recording || !input?.length || !input[0]?.length) return true;
    const left = new Float32Array(input[0]);
    const right = new Float32Array(input[Math.min(1, input.length - 1)] || input[0]);
    this.port.postMessage({type:'pcm',left,right}, [left.buffer,right.buffer]);
    return true;
  }
}
registerProcessor('neusic-loop-capture', NeusicLoopCaptureProcessor);
