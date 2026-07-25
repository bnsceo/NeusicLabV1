(() => {
  'use strict';
  if (window.NeusicWaveProjectStore) return;

  const DB_NAME = 'neusic-wave-loom-v3';
  const DB_VERSION = 3;
  const SAMPLE_STORE = 'samples';
  const PROJECT_STORE = 'projects';
  const TRANSFER_STORE = 'studioTransfers';
  const DEFAULT_PROJECT = 'default';

  let dbPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(SAMPLE_STORE)) {
          const samples = db.createObjectStore(SAMPLE_STORE, {keyPath:'id'});
          samples.createIndex('updatedAt', 'updatedAt');
          samples.createIndex('projectId', 'projectId');
        }
        if (!db.objectStoreNames.contains(PROJECT_STORE)) db.createObjectStore(PROJECT_STORE, {keyPath:'id'});
        if (!db.objectStoreNames.contains(TRANSFER_STORE)) {
          const transfers = db.createObjectStore(TRANSFER_STORE, {keyPath:'id'});
          transfers.createIndex('createdAt', 'createdAt');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        dbPromise = null;
        reject(request.error || new Error('IndexedDB could not be opened.'));
      };
      request.onblocked = () => console.warn('Wave Loom project database upgrade is blocked by another tab.');
    });
    return dbPromise;
  }

  async function transact(storeName, mode, operation) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      let result;
      try { result = operation(store, tx); }
      catch (error) { reject(error); return; }
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error || new Error(`IndexedDB ${mode} transaction failed.`));
      tx.onabort = () => reject(tx.error || new Error(`IndexedDB ${mode} transaction was aborted.`));
    });
  }

  function requestValue(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function sampleRecord(sample, projectId = DEFAULT_PROJECT) {
    const workspace = window.NeusicAudioWorkspace;
    if (!workspace || !sample?.buffer) throw new Error('A decoded AudioBuffer is required to save a sample.');
    const pcm = workspace.serializeBuffer(sample.buffer);
    return {
      id:sample.id,
      projectId,
      name:sample.name || 'Untitled sample',
      mime:sample.mime || 'audio/pcm',
      color:sample.color || '#29f3ff',
      source:sample.source || 'forge',
      createdAt:sample.createdAt || new Date().toISOString(),
      updatedAt:new Date().toISOString(),
      pcm,
      edit:{
        trimStart:Number(sample.edit?.trimStart ?? 0),
        trimEnd:Number(sample.edit?.trimEnd ?? 1),
        fadeIn:Number(sample.edit?.fadeIn ?? 0),
        fadeOut:Number(sample.edit?.fadeOut ?? 0),
        gainDb:Number(sample.edit?.gainDb ?? 0),
        reverse:Boolean(sample.edit?.reverse),
        normalized:Boolean(sample.edit?.normalized)
      },
      slices:Array.isArray(sample.slices) ? sample.slices.map(slice => ({
        id:slice.id,
        name:slice.name,
        start:Number(slice.start || 0),
        end:Number(slice.end || 1)
      })) : [],
      peaks:Array.isArray(sample.peaks) ? sample.peaks.map(pair => [Number(pair[0]), Number(pair[1])]) : []
    };
  }

  function hydrateSample(record) {
    const workspace = window.NeusicAudioWorkspace;
    if (!workspace) throw new Error('The shared audio workspace has not loaded.');
    return {
      id:record.id,
      projectId:record.projectId || DEFAULT_PROJECT,
      name:record.name,
      mime:record.mime,
      color:record.color,
      source:record.source,
      createdAt:record.createdAt,
      updatedAt:record.updatedAt,
      buffer:workspace.deserializeBuffer(record.pcm),
      edit:{...record.edit},
      slices:(record.slices || []).map(slice => ({...slice})),
      peaks:(record.peaks || []).map(pair => pair.slice())
    };
  }

  async function saveSample(sample, projectId = DEFAULT_PROJECT) {
    const record = sampleRecord(sample, projectId);
    await transact(SAMPLE_STORE, 'readwrite', store => store.put(record));
    return sample;
  }

  async function saveSamples(samples, projectId = DEFAULT_PROJECT) {
    const records = samples.map(sample => sampleRecord(sample, projectId));
    await transact(SAMPLE_STORE, 'readwrite', store => records.forEach(record => store.put(record)));
    return samples;
  }

  async function loadSamples(projectId = DEFAULT_PROJECT) {
    const db = await openDb();
    const records = await new Promise((resolve, reject) => {
      const tx = db.transaction(SAMPLE_STORE, 'readonly');
      const index = tx.objectStore(SAMPLE_STORE).index('projectId');
      const request = index.getAll(IDBKeyRange.only(projectId));
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
    return records.sort((a,b) => String(a.createdAt).localeCompare(String(b.createdAt))).map(hydrateSample);
  }

  async function getSample(id) {
    const db = await openDb();
    const tx = db.transaction(SAMPLE_STORE, 'readonly');
    const record = await requestValue(tx.objectStore(SAMPLE_STORE).get(id));
    return record ? hydrateSample(record) : null;
  }

  async function deleteSample(id) {
    await transact(SAMPLE_STORE, 'readwrite', store => store.delete(id));
  }

  async function clearSamples(projectId = DEFAULT_PROJECT) {
    const db = await openDb();
    const ids = await new Promise((resolve, reject) => {
      const tx = db.transaction(SAMPLE_STORE, 'readonly');
      const index = tx.objectStore(SAMPLE_STORE).index('projectId');
      const request = index.getAllKeys(IDBKeyRange.only(projectId));
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
    await transact(SAMPLE_STORE, 'readwrite', store => ids.forEach(id => store.delete(id)));
  }

  async function saveProject(data, id = DEFAULT_PROJECT) {
    const record = {id, type:'neusic-wave-project', version:3, updatedAt:new Date().toISOString(), data};
    await transact(PROJECT_STORE, 'readwrite', store => store.put(record));
    return record;
  }

  async function loadProject(id = DEFAULT_PROJECT) {
    const db = await openDb();
    const tx = db.transaction(PROJECT_STORE, 'readonly');
    return requestValue(tx.objectStore(PROJECT_STORE).get(id));
  }

  async function createStudioTransfer({buffer, name, patch, tempo, root, scale, slices, metadata} = {}) {
    if (!buffer) throw new Error('No audio was supplied for Studio transfer.');
    const id = `wave-studio-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
    const record = {
      id,
      type:'neusic-wave-studio-transfer',
      version:1,
      createdAt:new Date().toISOString(),
      name:name || 'Wave Loom Audio',
      tempo:Number(tempo) || 112,
      root:Number(root) || 0,
      scale:scale || 'minor',
      patch:patch || null,
      slices:Array.isArray(slices) ? slices.map(slice => ({...slice})) : [],
      metadata:metadata || {},
      pcm:window.NeusicAudioWorkspace.serializeBuffer(buffer)
    };
    await transact(TRANSFER_STORE, 'readwrite', store => store.put(record));
    return record;
  }

  async function getStudioTransfer(id) {
    const db = await openDb();
    const tx = db.transaction(TRANSFER_STORE, 'readonly');
    return requestValue(tx.objectStore(TRANSFER_STORE).get(id));
  }

  async function deleteStudioTransfer(id) {
    await transact(TRANSFER_STORE, 'readwrite', store => store.delete(id));
  }

  async function purgeOldTransfers(maxAgeMs = 24 * 60 * 60 * 1000) {
    const db = await openDb();
    const records = await new Promise((resolve, reject) => {
      const tx = db.transaction(TRANSFER_STORE, 'readonly');
      const request = tx.objectStore(TRANSFER_STORE).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
    const cutoff = Date.now() - maxAgeMs;
    const stale = records.filter(record => Date.parse(record.createdAt || 0) < cutoff).map(record => record.id);
    if (stale.length) await transact(TRANSFER_STORE, 'readwrite', store => stale.forEach(id => store.delete(id)));
    return stale.length;
  }

  window.NeusicWaveProjectStore = {
    DB_NAME, DB_VERSION, SAMPLE_STORE, PROJECT_STORE, TRANSFER_STORE, DEFAULT_PROJECT,
    openDb, saveSample, saveSamples, loadSamples, getSample, deleteSample, clearSamples,
    saveProject, loadProject, createStudioTransfer, getStudioTransfer, deleteStudioTransfer, purgeOldTransfers,
    sampleRecord, hydrateSample
  };
})();