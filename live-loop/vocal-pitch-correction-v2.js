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
    for (let i = 0; i < samples.length; i++) energy += samples[i] * samples[i];
    if (Math.sqrt(energy / samples.length) < RMS_GATE) return null;

    const minLag = Math.max(2, Math.floor(sampleRate / MAX_HZ));
    const maxLag = Math.min(samples.length - 2, Math.ceil(sampleRate / MIN_HZ));
    let bestLag = 0;
    let best = 0;

    for (let lag = minLag; lag <= maxLag; lag++) {
      let cross = 0;
      let a2 = 0;
      let b2 = 0;
      const count = samples.length - lag;
      for (let i = 0; i < count; i++) {
        const a = samples[i];
        const b = samples[i + lag];
        cross += a * b;
        a2 += a * a;
        b2 += b * b;
      }
      const score = cross / Math.sqrt(Math.max(1e-12, a2 * b2));
      if (score > best) {
        best = score;
        bestLag = lag;
      }
    }
    if (!bestLag || best < CLARITY_GATE) return null;
    return sampleRate / bestLag;
  }

  function targetRatio(frequency) {
    const midi = 69 + 12 * Math.log2(frequency / 440);
    const target = Math.round(midi);
    const targetHz = 440 * Math.pow(2, (target - 69) / 12);
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
    const center = (FRAME - 1) / 2;

    for (let start = 0; start < input.length; start += HOP) {
      for (let i = 0; i < FRAME; i++) frame[i] = input[start + i] || 0;
      const pitchFrame = new Float32Array(FRAME);
      for (let i = 0; i < FRAME; i++) pitchFrame[i] = frame[i] * windowFn[i];
      const frequency = detectPitch(pitchFrame, sampleRate);
      const ratio = frequency ? targetRatio(frequency) : 1;

      for (let i = 0; i < FRAME; i++) {
        const destination = start + i;
        if (destination >= output.length) break;
        // Moving through the source faster raises pitch; slower lowers it.
        const sourcePosition = center + (i - center) * ratio;
        const value = sourcePosition >= 0 && sourcePosition < FRAME - 1
          ? interpolate(frame, sourcePosition)
          : 0;
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

  async function apply(looper, index, {refreshDry = false} = {}) {
    const track = looper.tracks[index];
    if (!track?.buffer || track.pitchCorrectionBusy) return;
    if (refreshDry || !track.dryBuffer) track.dryBuffer = track.buffer;

    if (track.autotune !== 'chromatic') {
      if (track.dryBuffer && track.buffer !== track.dryBuffer) {
        track.buffer = track.dryBuffer;
        looper.restartTrack(track);
        looper.emit('track', {index});
        looper.emit('change');
      }
      return;
    }

    track.pitchCorrectionBusy = true;
    const card = document.querySelector(`.loop-track[data-index="${index}"]`);
    card?.classList.add('pitch-correcting');
    status(`Hard chromatic tuning ${track.name}…`);
    try {
      track.buffer = await tuneBuffer(looper.context, track.dryBuffer);
      looper.restartTrack(track);
      looper.emit('track', {index});
      looper.emit('change');
      status(`${track.name} chromatic AutoTune applied.`);
    } catch (error) {
      console.error(error);
      status(`${track.name} AutoTune failed: ${error.message || 'processing error'}`);
    } finally {
      track.pitchCorrectionBusy = false;
      card?.classList.remove('pitch-correcting');
    }
  }

  function install() {
    const api = window.NeusicLiveLoop;
    const looper = api?.looper;
    if (!looper || looper.__pitchCorrectionV2) return Boolean(looper?.__pitchCorrectionV2);
    looper.__pitchCorrectionV2 = true;

    const finish = looper.finishRecording.bind(looper);
    looper.finishRecording = async (session, decoded) => {
      await finish(session, decoded);
      await apply(looper, session.index, {refreshDry:true});
    };

    const importFile = looper.importFile.bind(looper);
    looper.importFile = async (index, file) => {
      await importFile(index, file);
      await apply(looper, index, {refreshDry:true});
    };

    document.addEventListener('change', event => {
      const select = event.target.closest?.('.loop-track [data-control="autotune"]');
      if (!select) return;
      const index = Number(select.closest('.loop-track')?.dataset.index);
      const track = looper.tracks[index];
      if (!track) return;
      track.autotune = select.value;
      setTimeout(() => apply(looper, index), 0);
    }, true);

    window.NeusicPitchCorrection = {apply:index => apply(looper, index), tuneBuffer};
    return true;
  }

  addEventListener('neusic:live-loop-ready', install);
  const timer = setInterval(() => { if (install()) clearInterval(timer); }, 100);
  setTimeout(() => clearInterval(timer), 30000);
})();