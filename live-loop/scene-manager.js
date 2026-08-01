(() => {
  'use strict';

  const STORAGE_KEY = 'neusic-live-loop-scenes-v1';
  const sceneNames = ['A', 'B', 'C'];
  let activeScene = 0;

  const status = message => {
    const output = document.getElementById('statusMessage');
    if (output) output.textContent = message;
    window.dispatchEvent(new CustomEvent('neusic:live-loop-status', {detail:{message}}));
  };

  const api = () => window.NeusicLiveLoop;

  function readScenes() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      return Array.isArray(saved) ? saved.slice(0, 3) : [null, null, null];
    } catch (_) {
      return [null, null, null];
    }
  }

  function writeScenes(scenes) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scenes));
  }

  function snapshot() {
    const live = api();
    if (!live?.looper) return null;
    const looper = live.looper;
    return {
      version: 1,
      savedAt: Date.now(),
      bpm: looper.bpm,
      quantize: looper.quantize,
      selectedTrack: live.selectedTrack,
      synth: {
        voice: document.getElementById('synthWave')?.value || 'piano',
        key: document.getElementById('keySelect')?.value || '0',
        scale: document.getElementById('scaleSelect')?.value || 'major',
        cutoff: Number(document.getElementById('synthCutoff')?.value || 2400),
        attack: Number(document.getElementById('synthAttack')?.value || 2),
        release: Number(document.getElementById('synthRelease')?.value || 45)
      },
      fx: {
        delayTime: Number(document.getElementById('delayTime')?.value || 360),
        delayFeedback: Number(document.getElementById('delayFeedback')?.value || 42),
        delayMix: Number(document.getElementById('delayMix')?.value || 28),
        reverbSize: Number(document.getElementById('reverbSize')?.value || 180),
        reverbTone: Number(document.getElementById('reverbTone')?.value || 7200),
        reverbMix: Number(document.getElementById('reverbMix')?.value || 24)
      },
      lanes: looper.tracks.map(track => ({
        muted: Boolean(track.muted),
        volume: track.volume,
        pan: track.panValue,
        delay: track.delay,
        reverb: track.reverb,
        autotune: track.autotune || 'off',
        rate: track.rate,
        reverse: Boolean(track.reverse)
      }))
    };
  }

  function setInput(id, value, eventName = 'input') {
    const input = document.getElementById(id);
    if (!input || value === undefined || value === null) return;
    input.value = String(value);
    input.dispatchEvent(new Event(eventName, {bubbles:true}));
  }

  async function recallScene(index) {
    const live = api();
    if (!live?.looper) {
      status('Audio engine is not ready yet. Tap START, then try the scene again.');
      return;
    }
    const scenes = readScenes();
    const scene = scenes[index];
    activeScene = index;
    updateButtons();
    if (!scene) {
      status(`Scene ${sceneNames[index]} is empty. Set the mix and tap SAVE SCENE.`);
      return;
    }

    const looper = live.looper;
    looper.setBpm(scene.bpm);
    looper.setQuantize(scene.quantize);
    setInput('bpmInput', scene.bpm, 'change');
    const quantize = document.getElementById('quantizeToggle');
    if (quantize) quantize.checked = Boolean(scene.quantize);

    for (let i = 0; i < looper.tracks.length; i++) {
      const saved = scene.lanes?.[i];
      const track = looper.tracks[i];
      if (!saved || !track) continue;
      looper.setTrackValue(i, 'volume', saved.volume);
      looper.setTrackValue(i, 'pan', saved.pan);
      looper.setTrackValue(i, 'delay', saved.delay);
      looper.setTrackValue(i, 'reverb', saved.reverb);
      looper.setTrackValue(i, 'autotune', saved.autotune || 'off');
      if (track.muted !== Boolean(saved.muted)) looper.toggleMute(i);
      if (track.reverse !== Boolean(saved.reverse) && track.buffer) looper.reverse(i);
      if (track.rate !== saved.rate && track.buffer) looper.halfSpeed(i);

      const card = document.querySelector(`.loop-track[data-index="${i}"]`);
      if (card) {
        const controls = {
          volume: Math.round((saved.volume ?? .9) * 100),
          pan: Math.round((saved.pan ?? 0) * 100),
          delay: Math.round((saved.delay ?? .22) * 100),
          reverb: Math.round((saved.reverb ?? .18) * 100)
        };
        for (const [key, value] of Object.entries(controls)) {
          const input = card.querySelector(`[data-control="${key}"]`);
          if (input) input.value = String(value);
        }
        const tune = card.querySelector('[data-control="autotune"]');
        if (tune) tune.value = saved.autotune || 'off';
      }
    }

    setInput('synthWave', scene.synth?.voice, 'change');
    setInput('keySelect', scene.synth?.key, 'change');
    setInput('scaleSelect', scene.synth?.scale, 'change');
    setInput('synthCutoff', scene.synth?.cutoff);
    setInput('synthAttack', scene.synth?.attack);
    setInput('synthRelease', scene.synth?.release);
    setInput('delayTime', scene.fx?.delayTime);
    setInput('delayFeedback', scene.fx?.delayFeedback);
    setInput('delayMix', scene.fx?.delayMix);
    setInput('reverbSize', scene.fx?.reverbSize);
    setInput('reverbTone', scene.fx?.reverbTone);
    setInput('reverbMix', scene.fx?.reverbMix);

    live.selectTrack?.(scene.selectedTrack ?? 0, {announce:false});
    looper.emit('change');
    status(`Scene ${sceneNames[index]} recalled.`);
  }

  function saveScene(index = activeScene) {
    const current = snapshot();
    if (!current) {
      status('Start the audio engine before saving a scene.');
      return;
    }
    const scenes = readScenes();
    scenes[index] = current;
    writeScenes(scenes);
    activeScene = index;
    updateButtons();
    status(`Scene ${sceneNames[index]} saved locally on this device.`);
  }

  function updateButtons() {
    const scenes = readScenes();
    document.querySelectorAll('.scene-button').forEach(button => {
      const index = Number(button.dataset.scene);
      button.classList.toggle('active', index === activeScene);
      button.classList.toggle('saved', Boolean(scenes[index]));
      button.title = scenes[index]
        ? `Recall locally saved Scene ${sceneNames[index]}`
        : `Scene ${sceneNames[index]} is empty`;
    });
    const save = document.getElementById('saveSceneBtn');
    if (save) save.textContent = 'SAVE SCENE LOCALLY';
  }

  function encodeWav(buffer) {
    const channels = Math.min(2, buffer.numberOfChannels);
    const sampleRate = buffer.sampleRate;
    const frames = buffer.length;
    const blockAlign = channels * 2;
    const array = new ArrayBuffer(44 + frames * blockAlign);
    const view = new DataView(array);
    const write = (offset, text) => {
      for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
    };
    write(0, 'RIFF');
    view.setUint32(4, 36 + frames * blockAlign, true);
    write(8, 'WAVE');
    write(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    write(36, 'data');
    view.setUint32(40, frames * blockAlign, true);
    let offset = 44;
    for (let frame = 0; frame < frames; frame++) {
      for (let channel = 0; channel < channels; channel++) {
        const value = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[frame] || 0));
        view.setInt16(offset, value < 0 ? value * 0x8000 : value * 0x7fff, true);
        offset += 2;
      }
    }
    return array;
  }

  async function exportMix() {
    const live = api();
    const mix = live?.looper?.mixBuffer?.();
    if (!mix) {
      status('Record or load at least one loop before exporting.');
      return;
    }
    const filename = `neusic-live-mix-${new Date().toISOString().slice(0,10)}.wav`;
    const file = new File([encodeWav(mix)], filename, {type:'audio/wav'});

    try {
      if (navigator.canShare?.({files:[file]}) && navigator.share) {
        await navigator.share({files:[file], title:'Neusic Live Loop Mix'});
        status('Mix opened in your device Save/Share sheet.');
        return;
      }
    } catch (error) {
      if (error?.name === 'AbortError') {
        status('Export cancelled.');
        return;
      }
    }

    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    status('Full five-lane mix exported as WAV.');
  }

  function install() {
    document.querySelectorAll('.scene-button').forEach(button => {
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        recallScene(Number(button.dataset.scene));
      }, true);
    });

    const save = document.getElementById('saveSceneBtn');
    save?.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      saveScene(activeScene);
    }, true);

    const exportButton = document.getElementById('exportMixBtn');
    exportButton?.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      exportMix();
    }, true);

    updateButtons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, {once:true});
  } else {
    install();
  }
  window.addEventListener('neusic:live-loop-ui-ready', updateButtons);
})();
