// A new namespace intentionally leaves every legacy app's projects untouched.
const DB = 'neusical-suite-v1';
export class ProjectStore {
  constructor() {this.persistedIds = new Set();}
  async open() {
    if (this.db) return this.db;
    this.db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(DB, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('projects', {keyPath: 'id'});
        request.result.createObjectStore('assets', {keyPath: 'id'});
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return this.db;
  }
  async save(project, assets) {
    const db = await this.open();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(['projects', 'assets'], 'readwrite');
      tx.objectStore('projects').put({...structuredClone(project), assetIds: [...assets.keys()]});
      const added = [];
      for (const asset of assets.values()) if (!this.persistedIds.has(asset.id)) {tx.objectStore('assets').put(asset); added.push(asset.id);}
      tx.oncomplete = () => {added.forEach(id => this.persistedIds.add(id)); resolve();}; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || new Error('Save aborted.'));
    });
    localStorage.setItem('neusical-suite-last-project', project.id);
  }
  async list() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const request = db.transaction('projects').objectStore('projects').getAll();
      request.onsuccess = () => resolve(request.result.map(p => ({id: p.id, name: p.name, updatedAt: p.updatedAt})).sort((a,b) => b.updatedAt-a.updatedAt));
      request.onerror = () => reject(request.error);
    });
  }
  async restore(projectId) {
    const id = projectId || localStorage.getItem('neusical-suite-last-project');
    if (!id) return null;
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['projects', 'assets'], 'readonly');
      const p = tx.objectStore('projects').get(id), a = tx.objectStore('assets').getAll();
      tx.oncomplete = () => {
        a.result.forEach(x => this.persistedIds.add(x.id));
        const selected = p.result?.assetIds ? a.result.filter(x => p.result.assetIds.includes(x.id)) : a.result;
        resolve(p.result ? {project: p.result, assets: new Map(selected.map(x => [x.id, x]))} : null);
      };
      tx.onerror = () => reject(tx.error);
    });
  }
}
