const DB_NAME = 'tsuzuku-studio';
const DB_VERSION = 2;
let dbPromise;
function openDB() {
  if (!globalThis.indexedDB) return Promise.reject(new Error('このブラウザでは下書きを端末に保存できません。'));
  if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects');
      if (!db.objectStoreNames.contains('assets')) db.createObjectStore('assets', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('assetEdits')) db.createObjectStore('assetEdits', { keyPath: 'id' });
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
  const tx = db.transaction(['projects', 'assets', 'assetEdits'], 'readonly');
  const finished = transactionDone(tx);
  let project, assets, edits;
  const p = tx.objectStore('projects').get('active'); p.onsuccess = () => { project = p.result; };
  const a = tx.objectStore('assets').getAll(); a.onsuccess = () => { assets = a.result; };
  const e = tx.objectStore('assetEdits').getAll(); e.onsuccess = () => { edits = e.result; };
  await finished;
  if (!project) return null;
  const byId = new Map((edits || []).map(edit => [edit.id, edit]));
  return { project, assets: (assets || []).map(asset => {
    const edit = byId.get(asset.id);
    return { ...asset, preprocess: edit?.preprocess || asset.preprocess, thumbnail: edit?.thumbnail || asset.thumbnail };
  }) };
}
/** Save only new photo blobs; inexpensive edits update the small project record. */
export async function saveDraft(project, assets) {
  const db = await openDB();
  const tx = db.transaction(['projects', 'assets', 'assetEdits'], 'readwrite');
  const finished = transactionDone(tx), store = tx.objectStore('assets'), editStore = tx.objectStore('assetEdits');
  tx.objectStore('projects').put(project, 'active');
  for (const asset of assets) editStore.put({ id: asset.id, preprocess: asset.preprocess, thumbnail: asset.thumbnail });
  const request = store.getAllKeys();
  request.onsuccess = () => {
    const existing = new Set(request.result), current = new Set(assets.map(a => a.id));
    for (const asset of assets) if (!existing.has(asset.id)) {
      const { id, name, width, height, originalWidth, originalHeight, blob, thumbnail, preprocess } = asset;
      store.put({ id, name, width, height, originalWidth, originalHeight, blob, thumbnail, preprocess });
    }
    for (const id of existing) if (!current.has(id)) store.delete(id);
    const editKeys = editStore.getAllKeys();
    editKeys.onsuccess = () => { for (const id of editKeys.result) if (!current.has(id)) editStore.delete(id); };
  };
  await finished;
}
export async function clearDraft() {
  const db = await openDB(), tx = db.transaction(['projects', 'assets', 'assetEdits'], 'readwrite');
  const finished = transactionDone(tx);
  tx.objectStore('projects').clear(); tx.objectStore('assets').clear();
  tx.objectStore('assetEdits').clear();
  await finished;
}
