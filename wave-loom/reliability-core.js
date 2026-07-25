(() => {
  'use strict';
  if (window.NeusicWaveReliability) return;

  const workspace = window.NeusicAudioWorkspace;
  const store = window.NeusicWaveProjectStore;
  const events = new EventTarget();
  const COLORS = ['#29f3ff','#9b6cff','#65ff9c','#ff4fc8','#ffc762','#78a8ff'];
  const PROJECT_ID = 'default';
  const state = {
    ready:false,
    samples:[],
    selectedSampleId:null,
    selectedSliceId:null,
    engineMode:'wave',
    nodeAssignments:{},
    captureSeconds:5,
    transientSensitivity:.72,
    minimumSliceMs:65,
    projectId:PROJECT_ID,
    saveTimer:0,
    migrationComplete:false
  };

  let readyResolve;
  const ready = new Promise(resolve => { readyResolve = resolve; });

  const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
  const uid = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;

  function loom() { return window.NeusicWaveLoom; }

  function setStatus(message, type = '') {
    const global = document.getElementById('statusMessage');
    const input = document.getElementById('sampleInputStatus');
    if (global) global.textContent = message;
    if (input) {
      input.textContent = message;
      input.classList.toggle('error', type === 'error');
      input.classList.toggle('live', type === 'live');
    }
    events.dispatchEvent(new CustomEvent('status',{detail:{message,type}}));
  }

  function peaksFor(buffer, count = 360) {
    const channels = Array.from({length:buffer.numberOfChannels}, (_, index) => buffer.getChannelData(index));
    const step = Math.max(1, Math.ceil(buffer.length / count));
    const peaks = [];
    for (let index = 0; index < count; index++) {
      let min = 1;
      let max = -1;
      const start = index * step;
      const end = Math.min(buffer.length, start + step);
      for (let cursor = start; cursor < end; cursor++) {
        let value = 0;
        for (const channel of channels) value += channel[cursor] || 0;
        value /= Math.max(1, channels.length);
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
      peaks.push([Number.isFinite(min) ? min : 0, Number.isFinite(max) ? max : 0]);
    }
    return peaks;
  }

  function defaultEdit() {
    return {trimStart:0, trimEnd:1, fadeIn:0, fadeOut:0, gainDb:0, reverse:false, normalized:false};
  }

  function normalizeSample(input, index = state.samples.length) {
    const buffer = input.buffer;
    if (!buffer) throw new Error('A decoded AudioBuffer is required.');
    const id = input.id || uid('sample');
    return {
      id,
      name:input.name || `Forge Sample ${index + 1}`,
      mime:input.mime || 'audio/pcm',
      color:input.color || COLORS[index % COLORS.length],
      source:input.source || 'forge',
      createdAt:input.createdAt || new Date().toISOString(),
      updatedAt:new Date().toISOString(),
      buffer,
      duration:buffer.duration,
      peaks:Array.isArray(input.peaks) && input.peaks.length ? input.peaks.map(pair => pair.slice()) : peaksFor(buffer),
      edit:{...defaultEdit(), ...(input.edit || {})},
      slices:Array.isArray(input.slices) ? input.slices.map(slice => ({...slice})) : []
    };
  }

  async function addSample(input, options = {}) {
    const sample = normalizeSample(input);
    const existing = state.samples.findIndex(entry => entry.id === sample.id);
    if (existing >= 0) state.samples.splice(existing,1,sample);
    else state.samples.push(sample);
    state.selectedSampleId = sample.id;
    state.selectedSliceId = sample.slices[0]?.id || null;
    if (options.persist !== false) await store.saveSample(sample,state.projectId);
    queueProjectSave();
    events.dispatchEvent(new CustomEvent('sampleschange',{detail:{action:existing >= 0 ? 'update' : 'add',sample}}));
    if (options.status !== false) setStatus(`${sample.name} is saved in the Forge library.`,'live');
    return sample;
  }

  async function updateSample(sample, options = {}) {
    sample.updatedAt = new Date().toISOString();
    sample.duration = sample.buffer.duration;
    sample.peaks = peaksFor(sample.buffer);
    await store.saveSample(sample,state.projectId);
    queueProjectSave();
    events.dispatchEvent(new CustomEvent('sampleschange',{detail:{action:'update',sample}}));
    if (options.status) setStatus(options.status,'live');
    return sample;
  }

  async function removeSample(id) {
    const index = state.samples.findIndex(sample => sample.id === id);
    if (index < 0) return;
    const [sample] = state.samples.splice(index,1);
    await store.deleteSample(id);
    state.selectedSampleId = state.samples[Math.min(index,state.samples.length - 1)]?.id || null;
    state.selectedSliceId = selectedSample()?.slices[0]?.id || null;
    Object.keys(state.nodeAssignments).forEach(nodeId => {
      if (state.nodeAssignments[nodeId]?.sampleId === id) delete state.nodeAssignments[nodeId];
    });
    queueProjectSave();
    events.dispatchEvent(new CustomEvent('sampleschange',{detail:{action:'remove',sample}}));
    setStatus(`${sample.name} was removed from the persistent Forge library.`);
  }

  function selectedSample() {
    return state.samples.find(sample => sample.id === state.selectedSampleId) || state.samples[0] || null;
  }

  function selectedSlice(sample = selectedSample()) {
    if (!sample) return null;
    return sample.slices.find(slice => slice.id === state.selectedSliceId) || sample.slices[0] || null;
  }

  function selectSample(id, sliceId = null) {
    if (!state.samples.some(sample => sample.id === id)) return;
    state.selectedSampleId = id;
    const sample = selectedSample();
    state.selectedSliceId = sliceId && sample.slices.some(slice => slice.id === sliceId) ? sliceId : sample.slices[0]?.id || null;
    queueProjectSave();
    events.dispatchEvent(new CustomEvent('selectionchange',{detail:{sample, slice:selectedSlice(sample)}}));
  }

  function serializeProject() {
    const patch = (() => { try { return loom()?.getPatch?.() || null; } catch (_) { return null; } })();
    return {
      version:3,
      selectedSampleId:state.selectedSampleId,
      selectedSliceId:state.selectedSliceId,
      engineMode:state.engineMode,
      nodeAssignments:JSON.parse(JSON.stringify(state.nodeAssignments)),
      captureSeconds:state.captureSeconds,
      transientSensitivity:state.transientSensitivity,
      minimumSliceMs:state.minimumSliceMs,
      sampleIds:state.samples.map(sample => sample.id),
      patch
    };
  }

  function queueProjectSave() {
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(() => saveProject().catch(error => console.warn('Wave project autosave failed',error)),180);
  }

  async function saveProject() {
    clearTimeout(state.saveTimer);
    state.saveTimer = 0;
    return store.saveProject(serializeProject(),state.projectId);
  }

  async function restore() {
    workspace.ensure();
    const [samples, project] = await Promise.all([
      store.loadSamples(state.projectId).catch(error => { console.warn(error); return []; }),
      store.loadProject(state.projectId).catch(error => { console.warn(error); return null; })
    ]);
    state.samples = samples.map(normalizeSample);
    const data = project?.data || {};
    state.selectedSampleId = data.selectedSampleId && state.samples.some(sample => sample.id === data.selectedSampleId) ? data.selectedSampleId : state.samples[0]?.id || null;
    state.selectedSliceId = data.selectedSliceId || selectedSample()?.slices[0]?.id || null;
    state.engineMode = ['wave','sample','granular','hybrid'].includes(data.engineMode) ? data.engineMode : 'wave';
    state.nodeAssignments = data.nodeAssignments && typeof data.nodeAssignments === 'object' ? data.nodeAssignments : {};
    state.captureSeconds = clamp(Number(data.captureSeconds) || 5,1,30);
    state.transientSensitivity = clamp(Number(data.transientSensitivity) || .72,.1,2);
    state.minimumSliceMs = clamp(Number(data.minimumSliceMs) || 65,15,1000);
    if (data.patch && loom()?.applyPatch) {
      try { loom().applyPatch(data.patch,{history:false,status:false}); } catch (error) { console.warn('Persistent patch recovery failed',error); }
    }
  }

  async function migrateLegacySamples() {
    if (state.migrationComplete) return;
    state.migrationComplete = true;
    const legacy = loom()?.state?.samples || [];
    for (const sample of legacy) {
      if (!sample?.buffer || state.samples.some(entry => entry.id === sample.id)) continue;
      try {
        await addSample({...sample,source:'legacy-forge'}, {status:false});
      } catch (error) { console.warn('Legacy Forge sample migration failed',error); }
    }
  }

  async function initialize() {
    if (!workspace?.supported || !store || !window.indexedDB) {
      setStatus('Wave Loom reliability services are unavailable in this browser.','error');
      readyResolve(null);
      return;
    }
    let attempts = 0;
    while (!loom() && attempts++ < 200) await new Promise(resolve => setTimeout(resolve,25));
    if (!loom()) {
      setStatus('The Wave Loom engine did not initialize.','error');
      readyResolve(null);
      return;
    }
    await restore();
    await migrateLegacySamples();
    await store.purgeOldTransfers().catch(()=>{});
    state.ready = true;
    events.dispatchEvent(new Event('ready'));
    readyResolve(api);
  }

  const api = {
    version:'3.0.0', state, events, ready, clamp, uid, setStatus, peaksFor, normalizeSample,
    addSample, updateSample, removeSample, selectedSample, selectedSlice, selectSample,
    serializeProject, queueProjectSave, saveProject, restore, migrateLegacySamples,
    get loom(){ return loom(); }, get workspace(){ return workspace; }, get store(){ return store; }
  };

  window.NeusicWaveReliability = api;
  initialize().catch(error => {
    console.error(error);
    setStatus(error.message || 'Wave Loom reliability initialization failed.','error');
    readyResolve(null);
  });
})();