(() => {
  'use strict';

  const FRAME = 1024;
  const HOP = 512;
  const MIN_HZ = 75;
  const MAX_HZ = 700;
  const RMS_GATE = 0.012;
  const CLARITY_GATE = 0.42;
  const windowFn = new Float32Array(FRAME);
  for (let i = 0; i < FRAME; i++) windowFn[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FRAME - 1));

  const pause = () => new Promise(resolve => setTimeout(resolve, 0));
  const status = message => {
    const node = document.getElementById('statusMessage');
    if (node) node.textContent = message;
    dispatchEvent(new CustomEvent('neusic:live-loop-status', {detail:{message}}));
  };

  function rms(samples) {
    let sum = 0;
    for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
    return Math.sqrt(sum / Math.max(1, samples.length));
  }

  function detectPitch(samples, sampleRate) {
    if (rms(samples) < RMS_GATE) return null;
    const minLag = Math.max(2, Math.floor(sampleRate / MAX_HZ));
    const maxLag = Math.min(samples.length - 2, Math.ceil(sampleRate / MIN_HZ));
    let bestLag = 0;
    let bestScore = 0;

    for (let lag = minLag; lag <= maxLag; lag += 2) {
      let cross = 0;
      let a2 = 0;
      let b2 = 0;
      const count = samples.length - lag;
      for (let i = 0; i < count; i += 2) {
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

  function chromaticRatio(frequency) {
    const midi = 69 + 12 * Math.log2(frequency / 440);
    const target = Math.round(midi);
    const targetHz = 440 * Math.pow(2, (target - 69) / 12);
    return Math.max(0.82, Math.min(1.22, targetHz / frequency));
  }

  function interpolate(data, position) {
    const left = Math.floor(position);
    const right = Math.min(data.length - 1, left + 1);
    const fraction = position - left;
    return (data[left] || 0) * (1 - fraction) + (data[right] || 0) * fraction;
  }

  async function tuneChannel(input, sampleRate, onProgress) {
    const output = new Float32Array(input.length);
    const weights = new Float32Array(input.length);
    const frame = new Float32Array(FRAME);
    const analysis = new Float32Array(FRAME);
    const center = (FRAME - 1) / 2;
    const total = Math.max(1, Math.ceil(input.length / HOP));
    let block = 0;

    for (let start = 0; start < input.length; start += HOP) {
      for (let i = 0; i < FRAME; i++) {
        frame[i] = input[start + i] || 0;
        analysis[i] = frame[i] * windowFn[i];
      }

      const frequency = detectPitch(analysis, sampleRate);
      const ratio = frequency ? chromaticRatio(frequency) : 1;

      for (let i = 0; i < FRAME; i++) {
        const destination = start + i;
        if (destination >= output.length) break;
        const sourcePosition = center + (i - center) * ratio;
        if (sourcePosition < 0 || sourcePosition >= FRAME - 1) continue;
        const weight = windowFn[i];
        output[destination] += interpolate(frame, sourcePosition) * weight;
        weights[destination] += weight;
      }

      block++;
      if (block % 12 === 0) {
        onProgress?.(block / total);
        await pause();
      }
    }

    for (let i = 0; i < output.length; i++) {
      if (weights[i] > 1e-6) output[i] /= weights[i];
      output[i] = Math.max(-1, Math.min(1, output[i]));
    }
    return output;
  }

  async function tuneBuffer(context, input, onProgress) {
    const channels = Math.min(2, Math.max(1, input.numberOfChannels));
    const output = context.createBuffer(channels, input.length, input.sampleRate);
    for (let channel = 0; channel < channels; channel++) {
      const tuned = await tuneChannel(input.getChannelData(channel), input.sampleRate, progress => {
        const combined = (channel + progress) / channels;
        onProgress?.(combined);
      });
      output.copyToChannel(tuned, channel);
      await pause();
    }
    onProgress?.(1);
    return output;
  }

  function publish(looper, index) {
    const track = looper.tracks[index];
    looper.restartTrack(track);
    looper.emit('track', {index});
    looper.emit('change');
  }

  async function setEnabled(looper, index, enabled) {
    const track = looper.tracks[index];
    if (!track) return;
    track.autotune = enabled ? 'chromatic' : 'off';

    if (!track.buffer && !track.dryBuffer) {
      status(`${track.name} AutoTune ${enabled ? 'armed' : 'off'}. Record whenever ready.`);
      return;
    }

    if (!enabled) {
      if (track.dryBuffer) track.buffer = track.dryBuffer;
      publish(looper, index);
      status(`${track.name} AutoTune off · dry recording restored.`);
      return;
    }

    const dry = track.dryBuffer || track.buffer;
    track.dryBuffer = dry;
    if (track.tunedBuffer && track.tunedFromDry === dry) {
      track.buffer = track.tunedBuffer;
      publish(looper, index);
      status(`${track.name} AutoTune on.`);
      return;
    }

    if (track.pitchCorrectionBusy) return;
    track.pitchCorrectionBusy = true;
    const card = document.querySelector(`.loop-track[data-index="${index}"]`);
    card?.classList.add('pitch-correcting');

    try {
      track.tunedBuffer = await tuneBuffer(looper.context, dry, progress => {
        status(`Applying AutoTune to ${track.name} · ${Math.round(progress * 100)}%`);
      });
      track.tunedFromDry = dry;
      if (track.autotune === 'chromatic') track.buffer = track.tunedBuffer;
      else track.buffer = dry;
      publish(looper, index);
      status(track.autotune === 'chromatic'
        ? `${track.name} chromatic AutoTune on.`
        : `${track.name} dry recording active.`);
    } catch (error) {
      console.error('AutoTune v4 failed:', error);
      track.autotune = 'off';
      track.buffer = dry;
      publish(looper, index);
      status(`${track.name} AutoTune failed; dry recording restored.`);
    } finally {
      track.pitchCorrectionBusy = false;
      card?.classList.remove('pitch-correcting');
    }
  }

  function install() {
    const api = window.NeusicLiveLoop;
    const looper = api?.looper;
    if (!looper || looper.__pitchCorrectionV4) return Boolean(looper?.__pitchCorrectionV4);
    looper.__pitchCorrectionV4 = true;

    const originalFinish = looper.finishRecording.bind(looper);
    looper.finishRecording = async (session, decoded) => {
      const track = looper.tracks[session.index];
      if (session.mode === 'overdub' && track.dryBuffer) track.buffer = track.dryBuffer;
      await originalFinish(session, decoded);
      track.dryBuffer = track.buffer;
      track.tunedBuffer = null;
      track.tunedFromDry = null;
      if (track.autotune === 'chromatic') await setEnabled(looper, session.index, true);
    };

    const originalImport = looper.importFile.bind(looper);
    looper.importFile = async (index, file) => {
      await originalImport(index, file);
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
      setEnabled(looper, index, select.value === 'chromatic');
    }, true);

    window.NeusicPitchCorrection = {
      setEnabled:(index, enabled) => setEnabled(looper, index, enabled),
      tuneBuffer
    };
    return true;
  }

  addEventListener('neusic:live-loop-ready', install);
  const timer = setInterval(() => { if (install()) clearInterval(timer); }, 100);
  setTimeout(() => clearInterval(timer), 30000);
})();