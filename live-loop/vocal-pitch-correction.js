(() => {
  'use strict';

  const FRAME_SIZE = 2048;
  const HOP_SIZE = 512;
  const MIN_FREQUENCY = 70;
  const MAX_FREQUENCY = 1000;
  const RMS_GATE = 0.012;
  const CLARITY_GATE = 0.62;

  const hann = length => {
    const window = new Float32Array(length);
    for (let i = 0; i < length; i++) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (length - 1));
    return window;
  };

  const analysisWindow = hann(FRAME_SIZE);

  function detectPitch(frame, sampleRate) {
    let energy = 0;
    for (let i = 0; i < frame.length; i++) energy += frame[i] * frame[i];
    const rms = Math.sqrt(energy / frame.length);
    if (rms < RMS_GATE) return null;

    const minLag = Math.max(2, Math.floor(sampleRate / MAX_FREQUENCY));
    const maxLag = Math.min(frame.length - 2, Math.ceil(sampleRate / MIN_FREQUENCY));
    let bestLag = 0;
    let bestCorrelation = -1;

    for (let lag = minLag; lag <= maxLag; lag++) {
      let sum = 0;
      let normA = 0;
      let normB = 0;
      const limit = frame.length - lag;
      for (let i = 0; i < limit; i++) {
        const a = frame[i];
        const b = frame[i + lag];
        sum += a * b;
        normA += a * a;
        normB += b * b;
      }
      const correlation = sum / Math.sqrt(Math.max(1e-12, normA * normB));
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestLag = lag;
      }
    }

    if (!bestLag || bestCorrelation < CLARITY_GATE) return null;

    let refinedLag = bestLag;
    if (bestLag > minLag && bestLag < maxLag) {
      const correlationAt = lag => {
        let sum = 0;
        let normA = 0;
        let normB = 0;
        const limit = frame.length - lag;
        for (let i = 0; i < limit; i++) {
          const a = frame[i];
          const b = frame[i + lag];
          sum += a * b;
          normA += a * a;
          normB += b * b;
        }
        return sum / Math.sqrt(Math.max(1e-12, normA * normB));
      };
      const left = correlationAt(bestLag - 1);
      const center = bestCorrelation;
      const right = correlationAt(bestLag + 1);
      const denominator = left - 2 * center + right;
      if (Math.abs(denominator) > 1e-6) refinedLag += 0.5 * (left - right) / denominator;
    }

    return {
      frequency: sampleRate / refinedLag,
      clarity: bestCorrelation,
      rms
    };
  }

  function nearestSemitone(frequency) {
    const midi = 69 + 12 * Math.log2(frequency / 440);
    const targetMidi = Math.round(midi);
    return 440 * Math.pow(2, (targetMidi - 69) / 12);
  }

  function sampleLinear(data, position) {
    const left = Math.floor(position);
    const right = Math.min(data.length - 1, left + 1);
    const fraction = position - left;
    return (data[left] || 0) * (1 - fraction) + (data[right] || 0) * fraction;
  }

  function correctChannel(input, sampleRate) {
    const output = new Float32Array(input.length);
    const weights = new Float32Array(input.length);
    const frame = new Float32Array(FRAME_SIZE);

    for (let start = 0; start < input.length; start += HOP_SIZE) {
      frame.fill(0);
      for (let i = 0; i < FRAME_SIZE; i++) frame[i] = (input[start + i] || 0) * analysisWindow[i];

      const pitch = detectPitch(frame, sampleRate);
      const ratio = pitch ? nearestSemitone(pitch.frequency) / pitch.frequency : 1;
      const safeRatio = Math.max(0.667, Math.min(1.5, ratio));
      const center = (FRAME_SIZE - 1) / 2;

      for (let i = 0; i < FRAME_SIZE; i++) {
        const destination = start + i;
        if (destination >= output.length) break;
        const sourcePosition = center + (i - center) / safeRatio;
        const value = sourcePosition >= 0 && sourcePosition < FRAME_SIZE - 1
          ? sampleLinear(frame, sourcePosition)
          : 0;
        const weight = analysisWindow[i];
        output[destination] += value * weight;
        weights[destination] += weight * weight;
      }
    }

    for (let i = 0; i < output.length; i++) {
      if (weights[i] > 1e-6) output[i] /= weights[i];
      output[i] = Math.max(-1, Math.min(1, output[i]));
    }

    const fade = Math.min(Math.floor(sampleRate * 0.008), Math.floor(output.length / 2));
    for (let i = 0; i < fade; i++) {
      const gain = i / Math.max(1, fade - 1);
      output[i] *= gain;
      output[output.length - 1 - i] *= gain;
    }
    return output;
  }

  async function correctBuffer(context, buffer) {
    await new Promise(resolve => setTimeout(resolve, 0));
    const output = context.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      output.copyToChannel(correctChannel(buffer.getChannelData(channel), buffer.sampleRate), channel);
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    return output;
  }

  function status(message) {
    const output = document.getElementById('statusMessage');
    if (output) output.textContent = message;
    window.dispatchEvent(new CustomEvent('neusic:live-loop-status', {detail:{message}}));
  }

  async function applyCorrection(looper, index, force = false) {
    const track = looper.tracks[index];
    if (!track?.buffer) return;
    if (!track.dryBuffer || force) track.dryBuffer = track.buffer;

    if (track.autotune !== 'chromatic') {
      if (track.dryBuffer) {
        track.buffer = track.dryBuffer;
        looper.restartTrack(track);
        looper.emit('track', {index});
        looper.emit('change');
      }
      return;
    }

    if (track.pitchCorrectionBusy) return;
    track.pitchCorrectionBusy = true;
    status(`Analyzing and correcting ${track.name} to the chromatic scale…`);
    try {
      track.buffer = await correctBuffer(looper.context, track.dryBuffer || track.buffer);
      looper.restartTrack(track);
      looper.emit('track', {index});
      looper.emit('change');
      status(`${track.name} chromatic pitch correction applied.`);
    } catch (error) {
      console.error(error);
      status(`${track.name} pitch correction could not be completed.`);
    } finally {
      track.pitchCorrectionBusy = false;
    }
  }

  function addReverseButtons(api) {
    document.querySelectorAll('.loop-track').forEach((card, index) => {
      const actions = card.querySelector('.track-actions');
      if (!actions || actions.querySelector('[data-action="reverse-lane"]')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.action = 'reverse-lane';
      button.className = 'reverse-lane-action';
      button.textContent = 'REV';
      button.setAttribute('aria-label', `Reverse audio in lane ${index + 1}`);
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        const track = api.looper.tracks[index];
        if (!track?.buffer) {
          status(`Lane ${index + 1} is empty.`);
          return;
        }
        api.looper.reverse(index);
        button.classList.toggle('active', Boolean(track.reverse));
        status(`${track.name} reverse ${track.reverse ? 'enabled' : 'disabled'}.`);
      });
      const editButton = actions.querySelector('[data-action="edit"]');
      actions.insertBefore(button, editButton || null);
    });
  }

  function install() {
    const api = window.NeusicLiveLoop;
    if (!api?.looper || api.looper.__pitchCorrectionInstalled) return false;
    const looper = api.looper;
    looper.__pitchCorrectionInstalled = true;

    const originalFinishRecording = looper.finishRecording.bind(looper);
    looper.finishRecording = async (session, decoded) => {
      await originalFinishRecording(session, decoded);
      const track = looper.tracks[session.index];
      track.dryBuffer = track.buffer;
      if (track.autotune === 'chromatic') await applyCorrection(looper, session.index, true);
    };

    const originalImportFile = looper.importFile.bind(looper);
    looper.importFile = async (index, file) => {
      await originalImportFile(index, file);
      const track = looper.tracks[index];
      track.dryBuffer = track.buffer;
      if (track.autotune === 'chromatic') await applyCorrection(looper, index, true);
    };

    document.addEventListener('change', event => {
      const select = event.target.closest?.('.loop-track [data-control="autotune"]');
      if (!select) return;
      const card = select.closest('.loop-track');
      const index = Number(card?.dataset.index);
      const track = looper.tracks[index];
      if (!track) return;
      track.autotune = select.value;
      setTimeout(() => applyCorrection(looper, index, false), 0);
    }, true);

    addReverseButtons(api);
    addEventListener('neusic:live-loop-lanes-visible', () => addReverseButtons(api));
    return true;
  }

  addEventListener('neusic:live-loop-ready', install);
  addEventListener('neusic:live-loop-ui-ready', () => setTimeout(install, 0));
  if (!install()) {
    const timer = setInterval(() => {
      if (install()) clearInterval(timer);
    }, 100);
    setTimeout(() => clearInterval(timer), 10000);
  }
})();
