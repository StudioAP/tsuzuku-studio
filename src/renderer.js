import { intersects } from './layout.js';
import { ImagePool, canvasBlob } from './images.js';
/** One page at a time; shared scene coordinates prevent independently cropped seams. */
export async function drawPage(canvas, scene, index, pool, outputWidth = 1080, signal) {
  signal?.throwIfAborted();
  if (index < 0 || index >= scene.total) throw new Error('ページ番号が範囲外です。');
  const scale = outputWidth / scene.width;
  canvas.width = outputWidth; canvas.height = Math.round(scene.height * scale);
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('描画できませんでした。ブラウザを開き直してください。');
  ctx.fillStyle = scene.background; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);
  ctx.translate(-index * scene.width, 0);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  const viewport = { x: index * scene.width, y: 0, w: scene.width, h: scene.height };
  for (const placement of scene.placements) {
    const { frame, rect, matte } = placement;
    const padded = { x: frame.x - matte, y: frame.y - matte, w: frame.w + matte * 2, h: frame.h + matte * 2 };
    if (!intersects(padded, viewport)) continue;
    const image = await pool.get(placement.assetId);
    signal?.throwIfAborted();
    ctx.save();
    if (matte) { ctx.fillStyle = scene.background; ctx.fillRect(padded.x, padded.y, padded.w, padded.h); }
    ctx.beginPath(); ctx.rect(frame.x, frame.y, frame.w, frame.h); ctx.clip();
    ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
  }
}
export const yieldToUI = () => new Promise(resolve => setTimeout(resolve, 0));
export async function exportPages(scene, assets, format, onProgress, signal) {
  if (!scene.total || scene.total > 20) throw new Error('投稿は1〜20枚にしてください。');
  const canvas = document.createElement('canvas');
  const pool = new ImagePool(assets, signal);
  const files = [];
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15).replace('T', '-');
  try {
    for (let index = 0; index < scene.total; index++) {
      await drawPage(canvas, scene, index, pool, scene.width, signal);
      const blob = await canvasBlob(canvas, format === 'png' ? 'image/png' : 'image/jpeg', .95);
      signal?.throwIfAborted();
      files.push(new File([blob], `tsuzuku-${stamp}-${String(index + 1).padStart(2, '0')}.${format === 'png' ? 'png' : 'jpg'}`, { type: blob.type, lastModified: Date.now() + index * 1000 }));
      onProgress?.(index + 1, scene.total);
      await yieldToUI();
    }
    return files;
  } finally { canvas.width = canvas.height = 1; pool.clear(); }
}
