import { MAX_FILE_BYTES, uid, effectiveAssetSize, normalizedPreprocess, neutralPreprocess, rotationCoverScale } from './model.js';
export function sniffImage(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if ([137,80,78,71,13,10,26,10].every((b, i) => bytes[i] === b)) return 'image/png';
  const text = new TextDecoder('latin1').decode(bytes.subarray(0, 96));
  if (text.startsWith('RIFF') && text.slice(8, 12) === 'WEBP') return 'image/webp';
  if (text.slice(4, 8) === 'ftyp' && /heic|heix|hevc|hevx|mif1|msf1/.test(text.slice(8))) return 'image/heic';
  return null;
}
export function canvasBlob(canvas, type = 'image/jpeg', quality = .95) {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('画像を作成できませんでした。写真の枚数を減らして再試行してください。')), type, quality));
}
export async function loadImage(blob, signal) {
  signal?.throwIfAborted();
  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.decoding = 'async';
  try {
    await new Promise((resolve, reject) => {
      const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', aborted); image.onload = null; image.onerror = null; };
      const aborted = () => { cleanup(); image.src = ''; reject(new DOMException('Canceled', 'AbortError')); };
      const timer = setTimeout(() => { cleanup(); image.src = ''; reject(new Error('画像の読み込みに時間がかかっています。小さな写真でお試しください。')); }, 30000);
      image.onload = () => { cleanup(); resolve(); };
      image.onerror = () => { cleanup(); reject(new Error('この画像形式を開けませんでした。')); };
      signal?.addEventListener('abort', aborted, { once: true });
      image.src = url;
    });
    signal?.throwIfAborted();
    return image;
  } finally { URL.revokeObjectURL(url); }
}
export async function importPhoto(file, signal) {
  if (file.size > MAX_FILE_BYTES) throw new Error('1枚40MBまでです。小さなサイズで選び直してください。');
  const kind = sniffImage(new Uint8Array(await file.slice(0, 96).arrayBuffer()));
  if (!kind) throw new Error('JPEG / PNG / WebP / HEIC の静止画を選んでください。動画・RAW・SVG・GIFは対象外です。');
  let image;
  try { image = await loadImage(file.type === kind ? file : file.slice(0, file.size, kind), signal); }
  catch (error) {
    if (error.name === 'AbortError') throw error;
    if (kind === 'image/heic') throw new Error('このブラウザではHEICを開けません。対応するiPhoneのSafariで開くか、JPEGに変換して選んでください。');
    throw error;
  }
  const originalWidth = image.naturalWidth, originalHeight = image.naturalHeight;
  if (!originalWidth || !originalHeight || originalWidth * originalHeight > 100_000_000) {
    image.src = '';
    throw new Error('画像が大きすぎるか壊れています。100MP以下の写真を選んでください。');
  }
  const scale = Math.min(1, 4096 / Math.max(originalWidth, originalHeight), Math.sqrt(8_000_000 / (originalWidth * originalHeight)));
  const width = Math.max(1, Math.floor(originalWidth * scale)), height = Math.max(1, Math.floor(originalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('この端末で画像を処理できませんでした。');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, width, height);
  image.src = '';
  // Canvas normalizes EXIF orientation as decoded by the browser and omits source metadata.
  const blob = await canvasBlob(canvas);
  const thumbScale = Math.min(1, 320 / Math.max(width, height));
  const thumb = document.createElement('canvas');
  thumb.width = Math.max(1, Math.round(width * thumbScale)); thumb.height = Math.max(1, Math.round(height * thumbScale));
  thumb.getContext('2d', { alpha: false }).drawImage(canvas, 0, 0, thumb.width, thumb.height);
  const thumbnail = await canvasBlob(thumb, 'image/jpeg', .8);
  canvas.width = canvas.height = 1; thumb.width = thumb.height = 1;
  signal?.throwIfAborted();
  return { id: uid(), name: file.name.slice(0, 255), width, height, originalWidth, originalHeight, blob, thumbnail, preprocess: neutralPreprocess() };
}
export function drawPreprocessed(canvas, image, asset, maxSide = Infinity) {
  const edit = normalizedPreprocess(asset.preprocess);
  const size = effectiveAssetSize(asset, edit);
  const scale = Math.min(1, maxSide / Math.max(size.width, size.height));
  canvas.width = Math.max(1, Math.round(size.width * scale));
  canvas.height = Math.max(1, Math.round(size.height * scale));
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('この端末で画像を処理できませんでした。');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.scale(scale, scale);
  ctx.translate(-edit.crop.left * size.frameWidth, -edit.crop.top * size.frameHeight);
  ctx.translate(size.frameWidth / 2, size.frameHeight / 2);
  ctx.rotate(edit.rotation * Math.PI / 180);
  const coverScale = rotationCoverScale(asset.width, asset.height, edit.rotation);
  ctx.scale(coverScale, coverScale);
  ctx.drawImage(image, -asset.width / 2, -asset.height / 2, asset.width, asset.height);
  return canvas;
}
export async function refreshThumbnail(asset, signal) {
  const image = await loadImage(asset.blob, signal);
  try {
    const canvas = drawPreprocessed(document.createElement('canvas'), image, asset, 320);
    const thumbnail = await canvasBlob(canvas, 'image/jpeg', .8);
    canvas.width = canvas.height = 1;
    return thumbnail;
  } finally { image.src = ''; }
}
/** Two decoded working photos at most, rather than retaining every full-resolution image. */
export class ImagePool {
  constructor(assets, signal) { this.assets = new Map(assets.map(a => [a.id, a])); this.cache = new Map(); this.signal = signal; }
  async get(id) {
    this.signal?.throwIfAborted();
    if (this.cache.has(id)) { const image = this.cache.get(id); this.cache.delete(id); this.cache.set(id, image); return image; }
    while (this.cache.size >= 2) { const key = this.cache.keys().next().value; this.cache.get(key).src = ''; this.cache.delete(key); }
    const asset = this.assets.get(id);
    if (!asset) throw new Error('写真が見つかりません。');
    const source = await loadImage(asset.blob, this.signal);
    const edit = normalizedPreprocess(asset.preprocess);
    const edited = edit.rotation !== 0 || Object.values(edit.crop).some(Boolean);
    if (!edited) { this.cache.set(id, source); return source; }
    const canvas = drawPreprocessed(document.createElement('canvas'), source, asset);
    source.src = '';
    this.cache.set(id, canvas);
    return canvas;
  }
  clear() { for (const image of this.cache.values()) { if ('src' in image) image.src = ''; else image.width = image.height = 1; } this.cache.clear(); }
}
