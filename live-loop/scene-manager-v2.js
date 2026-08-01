(() => {
  'use strict';

  const DB_NAME = 'neusic-live-loop';
  const STORE = 'scenes';
  const RECORD_ID = 'abc-scenes-v2';
  const names = ['A', 'B', 'C'];
  let activeScene = 0;
  let cachedScenes = [null, null, null];

  const status = message => {
    const node = document.getElementById('statusMessage');
    if (node) node.textContent = message;
    dispatchEvent(new CustomEvent('neusic:live-loop-status', {detail:{message}}));
  };

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) {
          request.result.createObjectStore(STORE, {keyPath:'id'});
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function loadScenes() {
    try {
      const db = await openDb();
      const record = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const request = tx.objectStore(STORE).get(RECORD_ID);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      db.close();
      cachedScenes = Array.isArray(record?.scenes) ? record.scenes.slice(0, 3) : [null, null, null];
    } catch (error) {
      console.warn('IndexedDB scene load failed; trying localStorage.', error);
      try {
        const stored = JSON.parse(localStorage.getItem(RECORD_ID) || 'null');
        cachedScenes = Array.isArray(stored) ? stored.slice(0, 3) : [null, null, null];
      } catch (_) {
        cachedScenes = [null, null, null];
      }
    }
    updateButtons();
    return cachedScenes;
  }

  async function persistScenes() {
    try {
      const db = await openDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put({id:RECORD_ID, scenes:cachedScenes, updatedAt:Date.now()});
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
      try { localStorage.setItem(RECORD_ID, JSON.stringify(cachedScenes)); } catch (_) {}
      return true;
    } catch (error) {
      console.error(error);
      try {
        localStorage.setItem(RECORD_ID, JSON.stringify(cachedScenes));
        return true;
      } catch (_) {
        return false;
      }
    }
  }

  const numberValue = (selector, fallback) => {
    const value = Number(document.querySelector(selector)?.value);
    return Number.isFinite(value) ? value : fallback;
  };

  function laneSnapshot(card, index) {
    const track = window.NeusicLiveLoop?.looper?.tracks?.[index];
    return {
      muted: Boolean(track?.muted),
      volume: track?.volume ?? numberValue(`[data-index="${index}"] [data-control="volume"]`, 90) / 100,
      pan: track?.panValue ?? numberValue(`[data-index="${index}"] [data-control="pan"]`, 0) / 100,
      delay: track?.delay ?? numberValue(`[data-index="${index}"] [data-control="delay"]`, 22) / 100,
      reverb: track?.reverb ?? numberValue(`[data-index="${index}"] [data-control="reverb"]`, 18) / 100,
      autotune: track?.autotune || card?.querySelector('[data-control="autotune"]')?.value || 'off',
      rate: track?.rate ?? 1,
      reverse: Boolean(track?.reverse)
    };
  }

  function snapshot() {
    const live = window.NeusicLiveLoop;
    const cards = [...document.querySelectorAll('.loop-track')];
    return {
      version: 2,
      savedAt: Date.now(),
      bpm: live?.looper?.bpm ?? numberValue('#bpmInput', 112),
      quantize: live?.looper?.quantize ?? Boolean(document.getElementById('quantizeToggle')?.checked),
      selectedTrack: live?.selectedTrack ?? 0,
      synth: {
        voice: document.getElementById('synthWave')?.value || 'piano',
        key: document.getElementById('keySelect')?.value || '0',
        scale: document.getElementById('scaleSelect')?.value || 'major',
        cutoff: numberValue('#synthCutoff', 2400),
        attack: numberValue('#synthAttack', 2),
        release: numberValue('#synthRelease', 45)
      },
      fx: {
        delayTime: numberValue('#delayTime', 360),
        delayFeedback: numberValue('#delayFeedback', 42),
        delayMix: numberValue('#delayMix', 28),
        reverbSize: numberValue('#reverbSize', 180),
        reverbTone: numberValue('#reverbTone', 7200),
        reverbMix: numberValue('#reverbMix', 24)
      },
      lanes: Array.from({length:5}, (_, index) => laneSnapshot(cards[index], index))
    };
  }

  function setControl(selector, value, eventName = 'input') {
    const input = document.querySelector(selector);
    if (!input || value === undefined || value === null) return;
    input.value = String(value);
    input.dispatchEvent(new Event(eventName, {bubbles:true}));
  }

  function applyDom(scene) {
    setControl('#bpmInput', scene.bpm, 'change');
    const quantize = document.getElementById('quantizeToggle');
    if (quantize) {
      quantize.checked = Boolean(scene.quantize);
      quantize.dispatchEvent(new Event('change', {bubbles:true}));
    }
    setControl('#synthWave', scene.synth?.voice, 'change');
    setControl('#keySelect', scene.synth?.key, 'change');
    setControl('#scaleSelect', scene.synth?.scale, 'change');
    setControl('#synthCutoff', scene.synth?.cutoff);
    setControl('#synthAttack', scene.synth?.attack);
    setControl('#synthRelease', scene.synth?.release);
    setControl('#delayTime', scene.fx?.delayTime);
    setControl('#delayFeedback', scene.fx?.delayFeedback);
    setControl('#delayMix', scene.fx?.delayMix);
    setControl('#reverbSize', scene.fx?.reverbSize);
    setControl('#reverbTone', scene.fx?.reverbTone);
    setControl('#reverbMix', scene.fx?.reverbMix);

    scene.lanes?.forEach((lane, index) => {
      setControl(`[data-index="${index}"] [data-control="volume"]`, Math.round((lane.volume ?? .9) * 100));
      setControl(`[data-index="${index}"] [data-control="pan"]`, Math.round((lane.pan ?? 0) * 100));
      setControl(`[data-index="${index}"] [data-control="delay"]`, Math.round((lane.delay ?? .22) * 100));
      setControl(`[data-index="${index}"] [data-control="reverb"]`, Math.round((lane.reverb ?? .18) * 100));
      setControl(`[data-index="${index}"] [data-control="autotune"]`, lane.autotune || 'off', 'change');
    });
  }

  function applyEngine(scene) {
    const live = window.NeusicLiveLoop;
    const looper = live?.looper;
    if (!looper) return false;
    looper.setBpm(scene.bpm);
    looper.setQuantize(scene.quantize);
    scene.lanes?.forEach((saved, index) => {
      const track = looper.tracks[index];
      if (!track || !saved) return;
      looper.setTrackValue(index, 'volume', saved.volume ?? .9);
      looper.setTrackValue(index, 'pan', saved.pan ?? 0);
      looper.setTrackValue(index, 'delay', saved.delay ?? .22);
      looper.setTrackValue(index, 'reverb', saved.reverb ?? .18);
      looper.setTrackValue(index, 'autotune', saved.autotune || 'off');
      if (track.muted !== Boolean(saved.muted)) looper.toggleMute(index);
      if (track.reverse !== Boolean(saved.reverse) && track.buffer) looper.reverse(index);
      if (track.rate !== (saved.rate ?? 1) && track.buffer) looper.halfSpeed(index);
    });
    live.selectTrack?.(scene.selectedTrack ?? 0, {announce:false});
    looper.emit('change');
    return true;
  }

  async function saveScene(index = activeScene) {
    cachedScenes[index] = snapshot();
    activeScene = index;
    const saved = await persistScenes();
    updateButtons();
    status(saved
      ? `Scene ${names[index]} saved locally on this device.`
      : `Scene ${names[index]} could not be saved because browser storage is blocked.`);
  }

  async function recallScene(index) {
    activeScene = index;
    updateButtons();
    const scene = cachedScenes[index];
    if (!scene) {
      status(`Scene ${names[index]} is empty. Set the mix and tap SAVE SCENE LOCALLY.`);
      return;
    }
    applyDom(scene);
    if (!applyEngine(scene)) {
      addEventListener('neusic:live-loop-ready', () => applyEngine(scene), {once:true});
    }
    status(`Scene ${names[index]} recalled.`);
  }

  function updateButtons() {
    document.querySelectorAll('.scene-button').forEach(button => {
      const index = Number(button.dataset.scene);
      button.classList.toggle('active', index === activeScene);
      button.classList.toggle('saved', Boolean(cachedScenes[index]));
    });
    const save = document.getElementById('saveSceneBtn');
    if (save) save.textContent = 'SAVE SCENE LOCALLY';
  }

  function install() {
    document.querySelectorAll('.scene-button').forEach(button => {
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        recallScene(Number(button.dataset.scene));
      }, true);
    });
    document.getElementById('saveSceneBtn')?.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      saveScene(activeScene);
    }, true);
    updateButtons();
    loadScenes();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true});
  else install();
})();