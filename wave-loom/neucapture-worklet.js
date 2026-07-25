class NeusicNeuCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.maxSeconds = 30;
    this.capacity = Math.max(128, Math.ceil(sampleRate * this.maxSeconds));
    this.channels = [new Float32Array(this.capacity), new Float32Array(this.capacity)];
    this.writeIndex = 0;
    this.written = 0;
    this.recording = false;
    this.recorded = [[], []];
    this.recordedFrames = 0;
    this.maxRecordFrames = Math.ceil(sampleRate * 60 * 12);
    this.meterCounter = 0;
    this.port.onmessage = event => this.onCommand(event.data || {});
  }

  resetRing(seconds = this.maxSeconds) {
    this.maxSeconds = Math.max(1, Math.min(120, Number(seconds) || 30));
    this.capacity = Math.max(128, Math.ceil(sampleRate * this.maxSeconds));
    this.channels = [new Float32Array(this.capacity), new Float32Array(this.capacity)];
    this.writeIndex = 0;
    this.written = 0;
  }

  onCommand(message) {
    if (message.type === 'configure') {
      this.resetRing(message.maxSeconds);
      this.port.postMessage({type:'configured', maxSeconds:this.maxSeconds, sampleRate});
      return;
    }
    if (message.type === 'clear') {
      this.channels.forEach(channel => channel.fill(0));
      this.writeIndex = 0;
      this.written = 0;
      this.port.postMessage({type:'cleared'});
      return;
    }
    if (message.type === 'capture') {
      this.capture(message.seconds, message.requestId);
      return;
    }
    if (message.type === 'start-record') {
      this.recording = true;
      this.recorded = [[], []];
      this.recordedFrames = 0;
      this.port.postMessage({type:'record-started', requestId:message.requestId});
      return;
    }
    if (message.type === 'stop-record') {
      this.finishRecording(message.requestId);
      return;
    }
  }

  capture(seconds = 5, requestId = '') {
    const requested = Math.max(1, Math.min(this.maxSeconds, Number(seconds) || 5));
    const count = Math.min(this.written, Math.floor(sampleRate * requested));
    if (!count) {
      this.port.postMessage({type:'capture', requestId, sampleRate, frames:0, channels:[]});
      return;
    }
    const output = [new Float32Array(count), new Float32Array(count)];
    const start = (this.writeIndex - count + this.capacity) % this.capacity;
    for (let channel = 0; channel < output.length; channel++) {
      const source = this.channels[channel];
      const first = Math.min(count, this.capacity - start);
      output[channel].set(source.subarray(start, start + first), 0);
      if (first < count) output[channel].set(source.subarray(0, count - first), first);
    }
    const buffers = output.map(channel => channel.buffer);
    this.port.postMessage({type:'capture', requestId, sampleRate, frames:count, channels:buffers}, buffers);
  }

  finishRecording(requestId = '') {
    const count = this.recordedFrames;
    this.recording = false;
    if (!count) {
      this.port.postMessage({type:'recording', requestId, sampleRate, frames:0, channels:[]});
      return;
    }
    const output = [new Float32Array(count), new Float32Array(count)];
    for (let channel = 0; channel < output.length; channel++) {
      let offset = 0;
      for (const block of this.recorded[channel]) {
        output[channel].set(block, offset);
        offset += block.length;
      }
    }
    this.recorded = [[], []];
    this.recordedFrames = 0;
    const buffers = output.map(channel => channel.buffer);
    this.port.postMessage({type:'recording', requestId, sampleRate, frames:count, channels:buffers}, buffers);
  }

  process(inputs, outputs) {
    const input = inputs[0] || [];
    const output = outputs[0] || [];
    const left = input[0];
    const right = input[1] || left;
    const frameCount = left?.length || output[0]?.length || 128;
    let squareTotal = 0;

    for (let frame = 0; frame < frameCount; frame++) {
      const l = left?.[frame] || 0;
      const r = right?.[frame] ?? l;
      this.channels[0][this.writeIndex] = l;
      this.channels[1][this.writeIndex] = r;
      this.writeIndex = (this.writeIndex + 1) % this.capacity;
      this.written = Math.min(this.capacity, this.written + 1);
      squareTotal += (l * l + r * r) * .5;
      if (output[0]) output[0][frame] = 0;
      if (output[1]) output[1][frame] = 0;
    }

    if (this.recording && this.recordedFrames < this.maxRecordFrames) {
      const remaining = this.maxRecordFrames - this.recordedFrames;
      const take = Math.min(frameCount, remaining);
      const lBlock = new Float32Array(take);
      const rBlock = new Float32Array(take);
      for (let frame = 0; frame < take; frame++) {
        lBlock[frame] = left?.[frame] || 0;
        rBlock[frame] = right?.[frame] ?? lBlock[frame];
      }
      this.recorded[0].push(lBlock);
      this.recorded[1].push(rBlock);
      this.recordedFrames += take;
      if (this.recordedFrames >= this.maxRecordFrames) this.finishRecording('maximum-length');
    }

    this.meterCounter++;
    if (this.meterCounter >= 8) {
      this.meterCounter = 0;
      this.port.postMessage({
        type:'meter',
        level:Math.sqrt(squareTotal / Math.max(1, frameCount)),
        availableSeconds:this.written / sampleRate,
        recording:this.recording,
        recordedSeconds:this.recordedFrames / sampleRate
      });
    }
    return true;
  }
}

registerProcessor('neusic-neucapture', NeusicNeuCaptureProcessor);