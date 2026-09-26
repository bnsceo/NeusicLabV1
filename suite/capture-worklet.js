// Capture boundaries are audio frames, never setTimeout/animation timestamps.
class SuiteCapture extends AudioWorkletProcessor {
  constructor() {
    super(); this.job = null;
    this.port.onmessage = ({data}) => {
      if (data.type === 'capture') {
        if (data.start < currentFrame) { this.port.postMessage({type: 'error', message: 'Capture boundary missed. Please record again.'}); return; }
        this.job = {...data, pcm: new Float32Array(data.end - data.start)};
      }
      if (data.type === 'cancel') this.job = null;
    };
  }
  process(inputs, outputs) {
    outputs[0]?.forEach(c => c.fill(0)); // Monitoring is deliberately off to prevent feedback.
    const job = this.job;
    if (!job) return true;
    const input = inputs[0]?.[0];
    const quantum = outputs[0]?.[0]?.length ?? 128;
    const start = Math.max(currentFrame, job.start), end = Math.min(currentFrame + quantum, job.end);
    if (input && end > start) job.pcm.set(input.subarray(start - currentFrame, end - currentFrame), start - job.start);
    if (currentFrame + quantum >= job.end) {
      this.port.postMessage({type: 'captured', pcm: job.pcm}, [job.pcm.buffer]); this.job = null;
    }
    return true;
  }
}
registerProcessor('neusical-suite-capture', SuiteCapture);
