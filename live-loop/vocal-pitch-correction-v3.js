(() => {
  'use strict';

  const FRAME = 2048;
  const HOP = 512;
  const MIN_HZ = 70;
  const MAX_HZ = 1000;
  const RMS_GATE = 0.009;
  const CLARITY_GATE = 0.48;
  const windowFn = new Float32Array(FRAME);
  for (let i = 0; i < FRAME; i++) windowFn[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FRAME - 1));

  const status = message => {
    const node = document.getElementById('statusMessage');
    if (node) node.textContent = message;
    dispatchEvent(new CustomEvent('neusic:live-loop-status', {detail:{message}}));
  };

  function detectPitch(samples, sampleRate) {
    let energy = 0;
    for (const sample of samples) energy += sample * sample;
    if (Math.sqrt(energy / samples.length) < RMS_GATE) return null;
    const minLag = Math.max(2, Math.floor(sampleRate / MAX_HZ));
    const maxLag = Math.min(samples.length - 2, Math.ceil(sampleRate / MIN_HZ));
    let bestLag = 0;
    let best = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let cross = 0, a2 = 0, b2 = 0;
      const count = samples.length - lag;
      for (let i = 0; i < count; i++) {
        const a = samples[i], b = samples[i + lag];
        cross += a * b; a2 += a * a; b2 += b * b;
      }
      const score = cross / Math.sqrt(Math.max(1e-12, a2 * b2));
      if (score > best) { best = score; bestLag = lag; }
    }
    return bestLag && best >= CLARITY_GATE ? sampleRate / bestLag : null;
  }

  function targetRatio(frequency) {
    const midi = 69 + 12 * Math.log2(frequency / 440);
    const targetHz = 440 * Math.pow(2, (Math.round(midi) - 69) / 12);
    return Math.max(0.75, Math.min(1.334, targetHz / frequency));
  }

  function interpolate(data, position) {
    const left = Math.floor(position);
    const fraction = position - left;
    const a = data[left] || 0;
    const b = data[Math.min(data.length - 1, left + 1)] || 0;
    return a + (b - a) * fraction;
  }

  function tuneChannel(input, sampleRate) {
    const output = new Float32Array(input.length);
    const weights = new Float32Array(input.length);
    const frame = new Float32Array(FRAME);
    const pitchFrame = new Float32Array(FRAME);
    const center = (FRAME - 1) / 2;
    for (let start = 0; start < input.length; start += HOP) {
      for (let i = 0; i < FRAME; i++) {
        frame[i] = input[start + i] || 0;
        pitchFrame[i] = frame[i] * windowFn[i];
      }
      const frequency = detectPitch(pitchFrame, sampleRate);
      const ratio = frequency ? targetRatio(frequency) : 1;
      for (let i = 0; i < FRAME; i++) {
        const destination = start + i;
        if (destination >= output.length) break;
        const sourcePosition = center + (i - center) * ratio;
        const value = sourcePosition >= 0 && sourcePosition < FRAME - 1 ? interpolate(frame, sourcePosition) : 0;
        const weight = windowFn[i];
        output[destination] += value * weight;
        weights[destination] += weight;
      }
    }
    for (let i = 0; i < output.length; i++) {
      if (weights[i] > 1e-6) output[i] /= weights[i];
      output[i] = Math.max(-1, Math.min(1, output[i]));
    }
    return output;
  }

  async function tuneBuffer(context, input) {
    const output = context.createBuffer(input.numberOfChannels, input.length, input.sampleRate);
    for (let channel = 0; channel < input.numberOfChannels; channel++) {
      output.copyToChannel(tuneChannel(input.getChannelData(channel), input.sampleRate), channel);
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    return output;
  }

  function publish(looper, index) {
    looper.restartTrack(looper.tracks[index]);
    looper.emit('track', {index});
    looper.emit('change');
  }

  async function setEnabled(looper, index, enabled) {
    const track = looper.tracks[index];
    if (!track) return;
    track.autotune = enabled ? 'chromatic' : 'off';
    if (!track.buffer && !track.dryBuffer) return;

    if (!enabled) {
      if (track.dryBuffer) track.buffer = track.dryBuffer;
      publish(looper, index);
      status(`${track.name} AutoTune off · dry audio restored.`);
      return;
    }

    if (track.tunedBuffer && track.tunedFromDry === track.dryBuffer) {
      track.buffer = track.tunedBuffer;
      publish(looper, index);
      status(`${track.name} AutoTune on.`);
      return;
    }

    if (track.pitchCorrectionBusy) return;
    track.pitchCorrectionBusy = true;
    const card = document.querySelector(`.loop-track[data-index="${index}"]`);
    card?.classList.add('pitch-correcting');
    status(`Applying chromatic AutoTune to ${track.name}…`);
    try {
      const dry = track.dryBuffer || track.buffer;
      track.dryBuffer = dry;
      track.tunedBuffer = await tuneBuffer(looper.context, dry);
      track.tunedFromDry = dry;
      if (track.autotune === 'chromatic') track.buffer = track.tunedBuffer;
      publish(looper, index);
      status(`${track.name} chromatic AutoTune on.`);
    } catch (error) {
      console.error(error);
      track.autotune = 'off';
      if (track.dryBuffer) track.buffer = track.dryBuffer;
      status(`${track.name} AutoTune failed: ${error.message || 'processing error'}`);
    } finally {
      track.pitchCorrectionBusy = false;
      card?.classList.remove('pitch-correcting');
    }
  }

  function install() {
    const api = window.NeusicLiveLoop;
    const looper = api?.looper;
    if (!looper || looper.__pitchCorrectionV3) return Boolean(looper?.__pitchCorrectionV3);
    looper.__pitchCorrectionV3 = true;

    const finish = looper.finishRecording.bind(looper);
    looper.finishRecording = async (session, decoded) => {
      const track = looper.tracks[session.index];
      if (session.mode === 'overdub' && track.dryBuffer) track.buffer = track.dryBuffer;
      await finish(session, decoded);
      track.dryBuffer = track.buffer;
      track.tunedBuffer = null;
      track.tunedFromDry = null;
      if (track.autotune === 'chromatic') await setEnabled(looper, session.index, true);
    };

    const importFile = looper.importFile.bind(looper);
    looper.importFile = async (index, file) => {
      await importFile(index, file);
      const track = looper.tracks[index];
      track.dryBuffer = track.buffer;
      track.tunedBuffer = null;
      track.tunedFromDry = null;
      if (track.autotune === 'chromatic') await setEnabled(looper, index, true);
    };

    document.addEventListener('change', event => {
      const select = event.target.closest?.('.loop-track [data-control="autotune"]');
      if (!select) return;
      const index = Number(select.closest('.loop-track')?.dataset.index);
      setTimeout(() => setEnabled(looper, index, select.value === 'chromatic'), 0);
    }, true);

    window.NeusicPitchCorrection = {
      setEnabled:(index, enabled) => setEnabled(looper, index, enabled),
      apply:index => setEnabled(looper, index, true),
      tuneBuffer
    };
    return true;
  }

  addEventListener('neusic:live-loop-ready', install);
  const timer = setInterval(() => { if (install()) clearInterval(timer); }, 100);
  setTimeout(() => clearInterval(timer), 30000);
})();