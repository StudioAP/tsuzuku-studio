const DB_NAME = 'tsuzuku-studio';
const DB_VERSION = 1;
let dbPromise;
function openDB() {
  if (!globalThis.indexedDB) return Promise.reject(new Error('このブラウザでは下書きを端末に保存できません。'));
  if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects');
      if (!db.objectStoreNames.contains('assets')) db.createObjectStore('assets', { keyPath: 'id' });
    };
    request.onsuccess = () => { const db = request.result; db.onversionchange = () => { db.close(); dbPromise = undefined; }; resolve(db); };
    request.onerror = () => { dbPromise = undefined; reject(request.error); };
    request.onblocked = () => { dbPromise = undefined; reject(new Error('別のタブを閉じてから下書きを開いてください。')); };
  });
  return dbPromise;
}
function transactionDone(tx) {
  return new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = tx.onerror = () => reject(tx.error || new Error('端末への保存に失敗しました。')); });
}
export async function loadDraft() {
  const db = await openDB();
  const tx = db.transaction(['projects', 'assets'], 'readonly');
  const finished = transactionDone(tx);
  let project, assets;
  const p = tx.objectStore('projects').get('active'); p.onsuccess = () => { project = p.result; };
  const a = tx.objectStore('assets').getAll(); a.onsuccess = () => { assets = a.result; };
  await finished;
  return project ? { project, assets: assets || [] } : null;
}
/** Save only new photo blobs; inexpensive edits update the small project record. */
export async function saveDraft(project, assets) {
  const db = await openDB();
  const tx = db.transaction(['projects', 'assets'], 'readwrite');
  const finished = transactionDone(tx), store = tx.objectStore('assets');
  tx.objectStore('projects').put(project, 'active');
  const request = store.getAllKeys();
  request.onsuccess = () => {
    const existing = new Set(request.result), current = new Set(assets.map(a => a.id));
    for (const asset of assets) if (!existing.has(asset.id)) {
      const { id, name, width, height, originalWidth, originalHeight, blob, thumbnail } = asset;
      store.put({ id, name, width, height, originalWidth, originalHeight, blob, thumbnail });
    }
    for (const id of existing) if (!current.has(id)) store.delete(id);
  };
  await finished;
}
export async function clearDraft() {
  const db = await openDB(), tx = db.transaction(['projects', 'assets'], 'readwrite');
  const finished = transactionDone(tx);
  tx.objectStore('projects').clear(); tx.objectStore('assets').clear();
  await finished;
}
