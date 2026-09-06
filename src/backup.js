import { validateProject, MAX_ARCHIVE_BYTES } from './model.js';
import { makeZip, readZip } from './zip.js';
import { sniffImage, loadImage, drawPreprocessed, canvasBlob } from './images.js';
export async function createBackup(project, assets) {
  validateProject(project, assets);
  const manifest = { app: 'tsuzuku', version: 1, project, assets: assets.map(({ id, name, width, height, originalWidth, originalHeight, preprocess }) => ({ id, name, width, height, originalWidth, originalHeight, preprocess })) };
  const archive = await makeZip([
    { name: 'project.json', data: JSON.stringify(manifest) },
    ...assets.map(asset => ({ name: `assets/${asset.id}.jpg`, data: asset.blob })),
  ]);
  if (archive.size > MAX_ARCHIVE_BYTES) throw new Error('下書きが100MBを超えます。写真を減らして保存してください。');
  return archive;
}
export async function restoreBackup(file, onProgress, signal) {
  const entries = await readZip(file, MAX_ARCHIVE_BYTES);
  const data = entries.get('project.json');
  if (!data || data.length > 256 * 1024) throw new Error('下書きの設定ファイルがありません。');
  let manifest;
  try { manifest = JSON.parse(new TextDecoder().decode(data)); } catch { throw new Error('下書きの設定を読み取れませんでした。'); }
  if (manifest.app !== 'tsuzuku' || manifest.version !== 1) throw new Error('この下書きのバージョンには対応していません。');
  validateProject(manifest.project, manifest.assets);
  if (entries.size !== manifest.assets.length + 1) throw new Error('下書きに想定外のファイルが含まれています。');
  const assets = [];
  for (const record of manifest.assets) {
    signal?.throwIfAborted();
    const bytes = entries.get(`assets/${record.id}.jpg`);
    if (!bytes || sniffImage(bytes.subarray(0, 96)) !== 'image/jpeg' || bytes.length > 40 * 1024 * 1024) throw new Error('下書きの写真が壊れています。');
    const blob = new Blob([bytes], { type: 'image/jpeg' });
    const image = await loadImage(blob, signal);
    try {
      if (image.naturalWidth !== record.width || image.naturalHeight !== record.height) throw new Error('下書きの画像サイズが一致しません。');
      const asset = { id: record.id, name: record.name, width: record.width, height: record.height,
        originalWidth: Number.isFinite(record.originalWidth) ? record.originalWidth : record.width,
        originalHeight: Number.isFinite(record.originalHeight) ? record.originalHeight : record.height,
        blob, preprocess: record.preprocess };
      const thumb = drawPreprocessed(document.createElement('canvas'), image, asset, 320);
      asset.thumbnail = await canvasBlob(thumb, 'image/jpeg', .8);
      thumb.width = thumb.height = 1;
      assets.push(asset);
    } finally { image.src = ''; }
    onProgress?.(assets.length, manifest.assets.length);
  }
  return { project: manifest.project, assets };
}
