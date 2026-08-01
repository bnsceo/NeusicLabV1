'use strict';

const FFT_SIZE = 1024;
const ANALYSIS_HOP = 128;
const BLOCK_SIZE = 16384;
const OVERLAP = 2048;
const STEP = BLOCK_SIZE - OVERLAP;
const MIN_HZ = 75;
const MAX_HZ = 700;
const RMS_GATE = 0.008;
const CLARITY_GATE = 0.45;
const TWO_PI = Math.PI * 2;

function fft(real, imag, inverse = false) {
  const n = real.length;
  let j = 0;
  for (let i = 1; i < n; i++) {
    let bit = n >> 1;
    while (j & bit) {
      j ^= bit;
      bit >>= 1;
    }
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
  }
  for (let length = 2; length <= n; length <<= 1) {
    const angle = (inverse ? TWO_PI : -TWO_PI) / length;
    const wlenCos = Math.cos(angle);
    const wlenSin = Math.sin(angle);
    for (let start = 0; start < n; start += length) {
      let wCos = 1;
      let wSin = 0;
      const half = length >> 1;
      for (let offset = 0; offset < half; offset++) {
        const even = start + offset;
        const odd = even + half;
        const oddReal = real[odd] * wCos - imag[odd] * wSin;
        const oddImag = real[odd] * wSin + imag[odd] * wCos;
        const evenReal = real[even];
        const evenImag = imag[even];
        real[even] = evenReal + oddReal;
        imag[even] = evenImag + oddImag;
        real[odd] = evenReal - oddReal;
        imag[odd] = evenImag - oddImag;
        const nextCos = wCos * wlenCos - wSin * wlenSin;
        wSin = wCos * wlenSin + wSin * wlenCos;
        wCos = nextCos;
      }
    }
  }
  if (inverse) {
    for (let i = 0; i < n; i++) {
      real[i] /= n;
      imag[i] /= n;
    }
  }
}

function wrapPhase(value) {
  while (value > Math.PI) value -= TWO_PI;
  while (value < -Math.PI) value += TWO_PI;
  return value;
}

function rms(samples, start = 0, length = samples.length) {
  const end = Math.min(samples.length, start + length);
  let sum = 0;
  for (let i = start; i < end; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / Math.max(1, end - start));
}

function detectPitchFrame(samples, sampleRate, start, length = 2048) {
  const end = Math.min(samples.length, start + length);
  if (end - start < 512 || rms(samples, start, end - start) < RMS_GATE) return null;
  const minLag = Math.max(2, Math.floor(sampleRate / MAX_HZ));
  const maxLag = Math.min(end - start - 2, Math.ceil(sampleRate / MIN_HZ));
  let bestLag = 0;
  let bestScore = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let cross = 0;
    let a2 = 0;
    let b2 = 0;
    for (let i = start; i < end - lag; i += 2) {
      const a = samples[i];
      const b = samples[i + lag];
      cross += a * b;
      a2 += a * a;
      b2 += b * b;
    }
    const score = cross / Math.sqrt(Math.max(1e-12, a2 * b2));
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }
  if (!bestLag || bestScore < CLARITY_GATE) return null;
  return sampleRate / bestLag;
}

function detectPitch(samples, sampleRate) {
  const window = Math.min(4096, samples.length);
  const starts = [0.18, 0.42, 0.66].map(p => Math.max(0, Math.floor((samples.length - window) * p)));
  const values = starts.map(start => detectPitchFrame(samples, sampleRate, start, window)).filter(Boolean).sort((a, b) => a - b);
  if (!values.length) return null;
  return values[Math.floor(values.length / 2)];
}

function chromaticRatio(frequency) {
  const midi = 69 + 12 * Math.log2(frequency / 440);
  const targetMidi = Math.round(midi);
  const targetHz = 440 * Math.pow(2, (targetMidi - 69) / 12);
  return Math.max(0.89, Math.min(1.12, targetHz / frequency));
}

function phaseVocoderStretch(input, alpha) {
  if (Math.abs(alpha - 1) < 0.0005) return new Float32Array(input);
  const n = FFT_SIZE;
  const half = n >> 1;
  const synthesisHop = Math.max(1, Math.round(ANALYSIS_HOP * alpha));
  const frames = Math.max(1, 1 + Math.ceil(Math.max(0, input.length - n) / ANALYSIS_HOP));
  const outputLength = (frames - 1) * synthesisHop + n;
  const output = new Float32Array(outputLength);
  const weights = new Float32Array(outputLength);
  const previousPhase = new Float64Array(half + 1);
  const synthesisPhase = new Float64Array(half + 1);
  const real = new Float64Array(n);
  const imag = new Float64Array(n);
  const window = new Float64Array(n);
  const omega = new Float64Array(half + 1);
  for (let i = 0; i < n; i++) window[i] = 0.5 - 0.5 * Math.cos(TWO_PI * i / (n - 1));
  for (let k = 0; k <= half; k++) omega[k] = TWO_PI * k / n;

  for (let frameIndex = 0; frameIndex < frames; frameIndex++) {
    const inputStart = frameIndex * ANALYSIS_HOP;
    real.fill(0);
    imag.fill(0);
    for (let i = 0; i < n; i++) real[i] = (input[inputStart + i] || 0) * window[i];
    fft(real, imag, false);

    for (let k = 0; k <= half; k++) {
      const magnitude = Math.hypot(real[k], imag[k]);
      const phase = Math.atan2(imag[k], real[k]);
      if (frameIndex === 0) {
        synthesisPhase[k] = phase;
      } else {
        const delta = wrapPhase(phase - previousPhase[k] - omega[k] * ANALYSIS_HOP);
        const trueFrequency = omega[k] + delta / ANALYSIS_HOP;
        synthesisPhase[k] += trueFrequency * synthesisHop;
      }
      previousPhase[k] = phase;
      real[k] = magnitude * Math.cos(synthesisPhase[k]);
      imag[k] = magnitude * Math.sin(synthesisPhase[k]);
      if (k > 0 && k < half) {
        real[n - k] = real[k];
        imag[n - k] = -imag[k];
      }
    }
    fft(real, imag, true);
    const outputStart = frameIndex * synthesisHop;
    for (let i = 0; i < n; i++) {
      const destination = outputStart + i;
      const w = window[i];
      output[destination] += real[i] * w;
      weights[destination] += w * w;
    }
  }
  for (let i = 0; i < output.length; i++) {
    if (weights[i] > 1e-8) output[i] /= weights[i];
  }
  return output.subarray(0, Math.max(1, Math.round(input.length * alpha)));
}

function resampleToLength(input, ratio, outputLength) {
  const output = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i++) {
    const position = Math.min(input.length - 1.001, i * ratio);
    const left = Math.max(0, Math.floor(position));
    const right = Math.min(input.length - 1, left + 1);
    const fraction = position - left;
    output[i] = input[left] * (1 - fraction) + input[right] * fraction;
  }
  return output;
}

function pitchShiftBlock(input, ratio) {
  if (Math.abs(ratio - 1) < 0.002) return new Float32Array(input);
  const stretched = phaseVocoderStretch(input, ratio);
  return resampleToLength(stretched, ratio, input.length);
}

function blockWindow(index, length, isFirst, isLast) {
  if (!isFirst && index < OVERLAP) {
    const x = index / OVERLAP;
    return Math.sin(x * Math.PI / 2) ** 2;
  }
  if (!isLast && index >= length - OVERLAP) {
    const x = (length - 1 - index) / OVERLAP;
    return Math.sin(Math.max(0, x) * Math.PI / 2) ** 2;
  }
  return 1;
}

function processChannels(channelArrays, sampleRate, onProgress) {
  const length = channelArrays[0]?.length || 0;
  const outputs = channelArrays.map(() => new Float32Array(length));
  const weights = new Float32Array(length);
  const totalBlocks = Math.max(1, Math.ceil(Math.max(1, length - OVERLAP) / STEP));
  let blockIndex = 0;
  for (let start = 0; start < length; start += STEP) {
    const blockLength = Math.min(BLOCK_SIZE, length - start);
    const mono = new Float32Array(blockLength);
    for (let i = 0; i < blockLength; i++) {
      let sum = 0;
      for (const channel of channelArrays) sum += channel[start + i] || 0;
      mono[i] = sum / channelArrays.length;
    }
    const frequency = detectPitch(mono, sampleRate);
    const ratio = frequency ? chromaticRatio(frequency) : 1;
    const isFirst = start === 0;
    const isLast = start + blockLength >= length;
    const shifted = channelArrays.map(channel => pitchShiftBlock(channel.subarray(start, start + blockLength), ratio));
    for (let i = 0; i < blockLength; i++) {
      const destination = start + i;
      const w = blockWindow(i, blockLength, isFirst, isLast);
      for (let channel = 0; channel < outputs.length; channel++) outputs[channel][destination] += shifted[channel][i] * w;
      weights[destination] += w;
    }
    blockIndex++;
    onProgress(blockIndex / totalBlocks);
  }
  for (let i = 0; i < length; i++) {
    const weight = weights[i] || 1;
    for (const output of outputs) output[i] = Math.max(-1, Math.min(1, output[i] / weight));
  }
  return outputs;
}

self.onmessage = event => {
  const {id, sampleRate, channels} = event.data || {};
  try {
    const arrays = (channels || []).map(buffer => new Float32Array(buffer));
    if (!arrays.length || !arrays[0].length) throw new Error('No audio samples were supplied.');
    const outputs = processChannels(arrays, sampleRate, progress => self.postMessage({id, type:'progress', progress}));
    const transfers = outputs.map(array => array.buffer);
    self.postMessage({id, type:'complete', channels:transfers}, transfers);
  } catch (error) {
    self.postMessage({id, type:'error', message:error?.message || 'AutoTune processing failed.'});
  }
};
