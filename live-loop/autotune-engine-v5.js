(() => {
  'use strict';

  const jobs = new Map();
  let jobSequence = 0;

  const status = message => {
    const node = document.getElementById('statusMessage');
    if (node) node.textContent = message;
    window.dispatchEvent(new CustomEvent('neusic:live-loop-status', {detail:{message}}));
  };

  function publish(looper, index) {
    const track = looper.tracks[index];
    looper.restartTrack(track);
    looper.emit('track', {index});
    looper.emit('change');
  }

  function processBuffer(context, input, index) {
    return new Promise((resolve, reject) => {
      if (!window.Worker) {
        reject(new Error('Background audio processing is unavailable in this browser.'));
        return;
      }
      const worker = new Worker('autotune-worker-v5.js?v=1');
      const id = `lane-${index}-${++jobSequence}`;
      const channelCount = Math.min(2, Math.max(1, input.numberOfChannels));
      const channelArrays = [];
      const transfers = [];
      for (let channel = 0; channel < channelCount; channel++) {
        const copy = new Float32Array(input.getChannelData(channel));
        channelArrays.push(copy.buffer);
        transfers.push(copy.buffer);
      }
      const cleanup = () => {
        worker.onmessage = null;
        worker.onerror = null;
        worker.terminate();
      };
      worker.onerror = event => {
        cleanup();
        reject(new Error(event.message || 'AutoTune worker failed.'));
      };
      worker.onmessage = event => {
        const data = event.data || {};
        if (data.id !== id) return;
        if (data.type === 'progress') {
          status(`Applying AutoTune to LOOP ${index + 1} · ${Math.round((data.progress || 0) * 100)}%`);
          return;
        }
        if (data.type === 'error') {
          cleanup();
          reject(new Error(data.message || 'AutoTune processing failed.'));
          return;
        }
        if (data.type === 'complete') {
          try {
            const channels = (data.channels || []).map(buffer => new Float32Array(buffer));
            const output = context.createBuffer(channels.length, input.length, input.sampleRate);
            channels.forEach((samples, channel) => output.copyToChannel(samples, channel));
            cleanup();
            resolve(output);
          } catch (error) {
            cleanup();
            reject(error);
          }
        }
      };
      worker.postMessage({id, sampleRate:input.sampleRate, channels:channelArrays}, transfers);
    });
  }

  async function setEnabled(looper, index, enabled) {
    const track = looper.tracks[index];
    if (!track) return;
    track.autotune = enabled ? 'chromatic' : 'off';

    const activeJob = jobs.get(index);
    if (activeJob) activeJob.cancelled = !enabled;

    if (!track.buffer && !track.dryBuffer) {
      status(`${track.name} AutoTune ${enabled ? 'armed' : 'off'}. REC remains ready.`);
      looper.emit('track', {index});
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
      status(`${track.name} chromatic AutoTune on.`);
      return;
    }

    if (track.pitchCorrectionBusy) return;
    track.pitchCorrectionBusy = true;
    const job = {cancelled:false};
    jobs.set(index, job);
    const card = document.querySelector(`.loop-track[data-index="${index}"]`);
    card?.classList.add('pitch-correcting');

    try {
      const tuned = await processBuffer(looper.context, dry, index);
      if (jobs.get(index) !== job) return;
      track.tunedBuffer = tuned;
      track.tunedFromDry = dry;
      track.buffer = track.autotune === 'chromatic' && !job.cancelled ? tuned : dry;
      publish(looper, index);
      status(track.buffer === tuned
        ? `${track.name} chromatic AutoTune on.`
        : `${track.name} dry recording active.`);
    } catch (error) {
      console.error('AutoTune v5 failed:', error);
      track.autotune = 'off';
      track.buffer = dry;
      publish(looper, index);
      status(`${track.name} AutoTune failed; dry recording restored.`);
    } finally {
      if (jobs.get(index) === job) jobs.delete(index);
      track.pitchCorrectionBusy = false;
      card?.classList.remove('pitch-correcting');
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
        event.stopImmediatePropagation();
        const track = api.looper.tracks[index];
        if (!track?.buffer) {
          status(`Lane ${index + 1} is empty.`);
          return;
        }
        api.looper.reverse(index);
        button.classList.toggle('active', Boolean(track.reverse));
        status(`${track.name} reverse ${track.reverse ? 'on' : 'off'}.`);
      }, true);
      const edit = actions.querySelector('[data-action="edit"]');
      actions.insertBefore(button, edit || null);
    });
  }

  function install() {
    const api = window.NeusicLiveLoop;
    const looper = api?.looper;
    if (!looper || looper.__pitchCorrectionV5) return Boolean(looper?.__pitchCorrectionV5);
    looper.__pitchCorrectionV5 = true;

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

    addReverseButtons(api);
    window.addEventListener('neusic:live-loop-lanes-visible', () => addReverseButtons(api));
    window.NeusicAutoTune = {
      setEnabled:(index, enabled) => setEnabled(looper, index, enabled),
      getState:index => {
        const track = looper.tracks[index];
        return {
          enabled:track?.autotune === 'chromatic',
          hasDry:Boolean(track?.dryBuffer),
          hasTuned:Boolean(track?.tunedBuffer),
          busy:Boolean(track?.pitchCorrectionBusy)
        };
      }
    };
    return true;
  }

  window.addEventListener('neusic:live-loop-ready', install);
  const timer = setInterval(() => { if (install()) clearInterval(timer); }, 100);
  setTimeout(() => clearInterval(timer), 30000);
})();
