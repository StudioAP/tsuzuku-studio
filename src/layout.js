import { RATIOS, THEMES, clamp, slideCount } from './model.js';
/**
 * A virtual strip, NOT a giant canvas. All geometry uses final-output pixels.
 * Internal page boundaries never influence photo scaling, cropping or padding.
 */
export function imageRect(image, frame, fit = 'contain', transform = {}) {
  const zoom = clamp(transform.zoom ?? 1, 1, 2.5);
  const factor = (fit === 'cover' ? Math.max : Math.min)(frame.w / image.width, frame.h / image.height) * zoom;
  const w = image.width * factor, h = image.height * factor;
  return {
    x: frame.x + (frame.w - w) * (clamp(transform.focusX ?? 0, -1, 1) + 1) / 2,
    y: frame.y + (frame.h - h) * (clamp(transform.focusY ?? 0, -1, 1) + 1) / 2,
    w, h,
  };
}
export function intersects(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
// Round once in the shared scene, never independently per exported page.
// Integer clip boundaries avoid per-canvas edge antialiasing on overlapping frames.
function pixelAligned(box) {
  const x = Math.round(box.x), y = Math.round(box.y);
  return { x, y, w: Math.max(1, Math.round(box.x + box.w) - x), h: Math.max(1, Math.round(box.y + box.h) - y) };
}
export function buildScene(project, assets) {
  const { width, height } = RATIOS[project.ratio];
  const theme = THEMES[project.theme];
  const photos = new Map(assets.map(a => [a.id, a]));
  const placements = [], blocks = [];
  let x = 0;
  for (const block of project.blocks) {
    const w = block.span * width;
    const margin = theme.margin;
    const inner = { x: x + margin, y: margin, w: w - 2 * margin, h: height - 2 * margin };
    let frames;
    if (block.layout === 'single') frames = [inner];
    else if (block.layout === 'duo') {
      const gap = 24;
      // A 1-slide diptych is stacked; wide diptychs are side-by-side.
      frames = block.span === 1
        ? [{ ...inner, h: (inner.h - gap) / 2 }, { ...inner, y: inner.y + (inner.h + gap) / 2, h: (inner.h - gap) / 2 }]
        : [{ ...inner, w: (inner.w - gap) / 2 }, { ...inner, x: inner.x + (inner.w + gap) / 2, w: (inner.w - gap) / 2 }];
    } else {
      const pad = Math.max(margin, 54);
      frames = [
        { x: x + pad, y: height * .09, w: w - pad * 2, h: height * .70 },
        { x: x + w * .59, y: height * .38, w: w * .35 - pad / 2, h: height * .55 },
      ];
    }
    block.photoIds.forEach((id, i) => {
      const asset = photos.get(id);
      if (!asset) throw new Error('写真が見つかりません。下書きを読み込み直してください。');
      const frame = pixelAligned(frames[i]);
      const rect = pixelAligned(imageRect(asset, frame, block.fit, block.transforms[id]));
      placements.push({ assetId: id, blockId: block.id, frame, rect, matte: block.layout === 'overlap' && i === 1 ? 14 : 0 });
    });
    blocks.push({ id: block.id, x, w, span: block.span, start: x / width });
    x += w;
  }
  return { width, height, total: slideCount(project), background: theme.background, placements, blocks };
}
export function lowResolutionIds(scene, assets) {
  const photos = new Map(assets.map(a => [a.id, a]));
  return [...new Set(scene.placements.filter(p => {
    const a = photos.get(p.assetId);
    return p.rect.w > a.width * 1.3 || p.rect.h > a.height * 1.3;
  }).map(p => p.assetId))];
}
