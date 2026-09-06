/** Pure project model. No DOM, network, or persistence dependencies. */
export const VERSION = 1;
export const MAX_SLIDES = 20;
export const MAX_PHOTOS = 20;
export const MAX_FILE_BYTES = 40 * 1024 * 1024;
export const MAX_ARCHIVE_BYTES = 100 * 1024 * 1024;
export const RATIOS = Object.freeze({ '4:5': { width: 1080, height: 1350 }, '3:4': { width: 1080, height: 1440 }, '1:1': { width: 1080, height: 1080 } });
export const THEMES = Object.freeze({ edge: { name: '余白なし', background: '#ffffff', margin: 0 }, paper: { name: 'ペーパー', background: '#f6f2ea', margin: 48 }, ink: { name: 'ダーク', background: '#202624', margin: 48 } });
export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
export const uid = () => globalThis.crypto.randomUUID();
export const neutralTransform = () => ({ zoom: 1, focusX: 0, focusY: 0 });
export const neutralPreprocess = () => ({ rotation: 0, zoom: 1, focusX: 0, focusY: 0, crop: { left: 0, right: 0, top: 0, bottom: 0 } });
export function normalizedPreprocess(value = {}) {
  const crop = value.crop || {};
  const normalized = {
    rotation: clamp(Number(value.rotation) || 0, -180, 180),
    zoom: clamp(Number(value.zoom) || 1, 1, 3),
    focusX: clamp(Number(value.focusX) || 0, -1, 1),
    focusY: clamp(Number(value.focusY) || 0, -1, 1),
    crop: {
      left: clamp(Number(crop.left) || 0, 0, .95),
      right: clamp(Number(crop.right) || 0, 0, .95),
      top: clamp(Number(crop.top) || 0, 0, .95),
      bottom: clamp(Number(crop.bottom) || 0, 0, .95),
    },
  };
  const horizontal = normalized.crop.left + normalized.crop.right;
  const vertical = normalized.crop.top + normalized.crop.bottom;
  if (horizontal >= .99) normalized.crop.right = Math.max(0, .99 - normalized.crop.left);
  if (vertical >= .99) normalized.crop.bottom = Math.max(0, .99 - normalized.crop.top);
  return normalized;
}
export function effectiveAssetSize(asset, preprocess = asset.preprocess) {
  const edit = normalizedPreprocess(preprocess);
  return {
    width: Math.max(1, Math.round(asset.width * (1 - edit.crop.left - edit.crop.right))),
    height: Math.max(1, Math.round(asset.height * (1 - edit.crop.top - edit.crop.bottom))),
    frameWidth: asset.width,
    frameHeight: asset.height,
  };
}
/** Minimum scale that keeps every corner of the original-size frame covered after rotation. */
export function rotationCoverScale(width, height, degrees) {
  const angle = Math.abs(degrees) * Math.PI / 180;
  const cosine = Math.abs(Math.cos(angle)), sine = Math.abs(Math.sin(angle));
  return Math.max(cosine + (height / width) * sine, cosine + (width / height) * sine);
}
/** Image-local translation and bounds that keep the cropped output frame fully covered. */
export function preprocessPlacement(asset, preprocess = asset.preprocess) {
  const edit = normalizedPreprocess(preprocess), angle = edit.rotation * Math.PI / 180;
  const cosine = Math.cos(angle), sine = Math.sin(angle);
  const scale = rotationCoverScale(asset.width, asset.height, edit.rotation) * edit.zoom;
  const xs = [-asset.width / 2 + edit.crop.left * asset.width, asset.width / 2 - edit.crop.right * asset.width];
  const ys = [-asset.height / 2 + edit.crop.top * asset.height, asset.height / 2 - edit.crop.bottom * asset.height];
  const localX = [], localY = [];
  for (const x of xs) for (const y of ys) {
    localX.push((x * cosine + y * sine) / scale);
    localY.push((-x * sine + y * cosine) / scale);
  }
  const xMin = Math.max(...localX) - asset.width / 2, xMax = Math.min(...localX) + asset.width / 2;
  const yMin = Math.max(...localY) - asset.height / 2, yMax = Math.min(...localY) + asset.height / 2;
  const interpolate = (min, max, focus) => (min + max) / 2 + focus * (max - min) / 2;
  return { scale, panX: interpolate(xMin, xMax, edit.focusX), panY: interpolate(yMin, yMax, edit.focusY), xMin, xMax, yMin, yMax };
}
export const slideCount = project => project.blocks.reduce((n, block) => n + block.span, 0);
export function newProject() {
  return { version: VERSION, id: uid(), title: '新しいカルーセル', ratio: '4:5', theme: 'edge', format: 'jpeg', blocks: [] };
}
export function makeBlock(photoId, span = 1) {
  return { id: uid(), photoIds: [photoId], span, layout: 'single', fit: 'contain', transforms: { [photoId]: neutralTransform() } };
}
/** Deterministic, aspect-ratio-based suggestion. Never claims to understand image content. */
export function recommendSpan(asset, ratio) {
  const size = effectiveAssetSize(asset);
  const aspect = size.width / size.height;
  if (aspect < 1.2) return 1;
  const slideAspect = RATIOS[ratio].width / RATIOS[ratio].height;
  return clamp(Math.round(aspect / slideAspect), 2, 6);
}
export function autoBlocks(assets, ratio, budget = MAX_SLIDES) {
  if (assets.length > budget) throw new Error(`写真は${budget}枚以内にしてください。`);
  const blocks = assets.map(asset => makeBlock(asset.id, recommendSpan(asset, ratio)));
  let total = blocks.reduce((n, b) => n + b.span, 0);
  // Compress the largest spans first; never omit a photo or change the order.
  while (total > budget) {
    let index = 0;
    for (let i = 1; i < blocks.length; i++) if (blocks[i].span > blocks[index].span) index = i;
    if (blocks[index].span <= 1) throw new Error('投稿枚数を調整できませんでした。');
    blocks[index].span -= 1;
    total -= 1;
  }
  return blocks;
}
export function moveBlock(project, index, direction) {
  const target = index + direction;
  if (index < 0 || target < 0 || target >= project.blocks.length) return project;
  const blocks = [...project.blocks];
  [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
  return { ...project, blocks };
}
export function joinNext(project, index) {
  const a = project.blocks[index], b = project.blocks[index + 1];
  if (!a || !b || a.photoIds.length !== 1 || b.photoIds.length !== 1) return project;
  const joined = { ...a, photoIds: [...a.photoIds, ...b.photoIds], span: 2, layout: 'overlap', transforms: { ...a.transforms, ...b.transforms } };
  return { ...project, blocks: [...project.blocks.slice(0, index), joined, ...project.blocks.slice(index + 2)] };
}
export function splitBlock(project, index) {
  const block = project.blocks[index];
  if (!block || block.photoIds.length !== 2) return project;
  const blocks = block.photoIds.map(id => ({ ...makeBlock(id), fit: block.fit, transforms: { [id]: { ...block.transforms[id] } } }));
  if (slideCount(project) - block.span + 2 > MAX_SLIDES) throw new Error('分けると20枚を超えます。ほかの写真の枚数を減らしてください。');
  return { ...project, blocks: [...project.blocks.slice(0, index), ...blocks, ...project.blocks.slice(index + 1)] };
}
function finiteRange(value, min, max) { return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max; }
function safeId(id) { return typeof id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(id); }
/** Reject untrusted backup data before it reaches drawing or HTML rendering. */
export function validateProject(project, assets) {
  const bad = detail => { throw new Error(`下書きの形式が正しくありません（${detail}）。`); };
  if (!project || project.version !== VERSION) bad('バージョン');
  if (!safeId(project.id) || typeof project.title !== 'string' || project.title.length > 100) bad('プロジェクト');
  if (!Object.hasOwn(RATIOS, project.ratio) || !Object.hasOwn(THEMES, project.theme) || !['jpeg', 'png'].includes(project.format)) bad('設定');
  if (!Array.isArray(assets) || assets.length > MAX_PHOTOS) bad('写真数');
  const ids = new Set();
  for (const asset of assets) {
    if (!asset || !safeId(asset.id) || ids.has(asset.id)) bad('写真ID');
    if (typeof asset.name !== 'string' || asset.name.length > 255) bad('写真名');
    if (!Number.isInteger(asset.width) || !Number.isInteger(asset.height) || !finiteRange(asset.width, 1, 4096) || !finiteRange(asset.height, 1, 4096) || asset.width * asset.height > 8_010_000) bad('画像サイズ');
    if (asset.preprocess && (!finiteRange(asset.preprocess.rotation, -180, 180) || (asset.preprocess.zoom !== undefined && !finiteRange(asset.preprocess.zoom, 1, 3)) || (asset.preprocess.focusX !== undefined && !finiteRange(asset.preprocess.focusX, -1, 1)) || (asset.preprocess.focusY !== undefined && !finiteRange(asset.preprocess.focusY, -1, 1)) || !asset.preprocess.crop || ['left','right','top','bottom'].some(key => !finiteRange(asset.preprocess.crop[key], 0, .95)) || asset.preprocess.crop.left + asset.preprocess.crop.right >= .99 || asset.preprocess.crop.top + asset.preprocess.crop.bottom >= .99)) bad('写真の前処理');
    ids.add(asset.id);
  }
  if (!Array.isArray(project.blocks) || project.blocks.length > MAX_PHOTOS) bad('レイアウト数');
  const used = new Set(), blockIds = new Set();
  for (const block of project.blocks) {
    if (!block || !safeId(block.id) || blockIds.has(block.id)) bad('レイアウトID');
    blockIds.add(block.id);
    if (!Number.isInteger(block.span) || !finiteRange(block.span, 1, 6)) bad('分割数');
    if (!['single', 'duo', 'overlap'].includes(block.layout) || !['cover', 'contain'].includes(block.fit)) bad('配置');
    if (!Array.isArray(block.photoIds) || block.photoIds.length !== (block.layout === 'single' ? 1 : 2)) bad('写真の組み合わせ');
    for (const id of block.photoIds) {
      if (!ids.has(id) || used.has(id)) bad('写真の参照');
      used.add(id);
      const transform = block.transforms?.[id];
      if (!transform || !finiteRange(transform.zoom, 1, 2.5) || !finiteRange(transform.focusX, -1, 1) || !finiteRange(transform.focusY, -1, 1)) bad('切り取り位置');
    }
  }
  if (used.size !== ids.size || slideCount(project) > MAX_SLIDES) bad('枚数・参照');
  return true;
}
