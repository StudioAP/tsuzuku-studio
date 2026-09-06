import { newProject, autoBlocks, makeBlock, recommendSpan, moveBlock, joinNext, splitBlock, slideCount, RATIOS, THEMES, MAX_PHOTOS, MAX_SLIDES, validateProject, neutralTransform, neutralPreprocess, normalizedPreprocess, effectiveAssetSize, preprocessPlacement, clamp } from './model.js';
import { buildScene, lowResolutionIds } from './layout.js';
import { importPhoto, ImagePool, loadImage, drawPreprocessed, refreshThumbnail } from './images.js';
import { drawPage, exportPages, yieldToUI } from './renderer.js';
import { loadDraft, saveDraft, clearDraft } from './storage.js';
import { createBackup, restoreBackup } from './backup.js';
import { canShareFiles, shareFiles, downloadBlob, createExportZip } from './sharing.js';
import { demoFiles, paintLandscape } from './demo.js';
import { icon } from './icons.js';
const escapeHTML = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const num = n => String(n).padStart(2, '0');
const bytesLabel = n => n < 1024 * 1024 ? `${Math.ceil(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
const pressed = value => `aria-pressed="${value}"`;
const disabled = value => value ? 'disabled' : '';

export class Studio {
  constructor(root) {
    this.root = root;
    this.dialog = document.querySelector('#app-dialog');
    this.project = newProject(); this.assets = []; this.urls = new Map();
    this.selected = null; this.selectedPhoto = null; this.previewMode = 'strip';
    this.history = []; this.future = []; this.revision = 0;
    this.busy = false; this.busyLabel = ''; this.notice = '';
    this.saveStatus = 'この端末だけで編集'; this.saveFailed = false;
    this.saveChain = Promise.resolve(); this.previewController = null;
    this.outputFiles = []; this.outputUrls = []; this.sharing = false;
    this.preprocessAssetId = null; this.preprocessDraft = null; this.preprocessImage = null;
    this.preprocessPointers = new Map(); this.preprocessGesture = null;
    document.addEventListener('click', event => this.onClick(event));
    document.addEventListener('input', event => this.onInput(event));
    document.addEventListener('change', event => this.onChange(event));
    document.addEventListener('pointerdown', event => this.onPreprocessPointerDown(event));
    document.addEventListener('pointermove', event => this.onPreprocessPointerMove(event));
    document.addEventListener('pointerup', event => this.onPreprocessPointerUp(event));
    document.addEventListener('pointercancel', event => this.onPreprocessPointerUp(event));
    this.dialog.addEventListener('cancel', () => { this.exportController?.abort(); this.closePreprocess(); });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && this.saveTimer) { clearTimeout(this.saveTimer); this.queueSave(); }
    });
    window.addEventListener('beforeunload', event => {
      if (this.assets.length && (this.saveTimer || this.saveFailed || this.saveStatus === '下書きを保存中…')) { event.preventDefault(); event.returnValue = ''; }
    });
    document.addEventListener('keydown', event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '') && !this.dialog.open) {
        event.preventDefault(); this.travelHistory(event.shiftKey);
      }
    });
  }
  async init() {
    try {
      const draft = await loadDraft();
      if (draft) { validateProject(draft.project, draft.assets); this.project = draft.project; this.assets = draft.assets; this.saveStatus = this.assets.length ? '端末の下書きを復元しました' : 'この端末だけで編集'; }
    } catch { this.saveFailed = true; this.saveStatus = '端末保存を利用できません'; this.notice = '下書きを読み込めませんでした。編集は続けられます。大切な編集は「下書きを持ち出す」でファイルに保存してください。'; }
    this.selected = this.project.blocks[0]?.id;
    this.syncUrls(); this.render();
  }
  snapshot() { return { project: structuredClone(this.project), assets: [...this.assets] }; }
  pushHistory(before) { this.history.push(before); if (this.history.length > 20) this.history.shift(); this.future = []; }
  syncUrls() {
    const ids = new Set(this.assets.map(a => a.id));
    for (const [id, url] of this.urls) if (!ids.has(id)) { URL.revokeObjectURL(url); this.urls.delete(id); }
    for (const asset of this.assets) if (!this.urls.has(asset.id)) this.urls.set(asset.id, URL.createObjectURL(asset.thumbnail));
  }
  invalidateOutputs() {
    for (const url of this.outputUrls) URL.revokeObjectURL(url);
    this.outputUrls = []; this.outputFiles = [];
  }
  commit(rerender = true) {
    this.revision++; this.invalidateOutputs(); this.syncUrls();
    if (!this.project.blocks.some(b => b.id === this.selected)) this.selected = this.project.blocks[0]?.id;
    this.saveStatus = '下書きを保存中…';
    clearTimeout(this.saveTimer); this.saveTimer = setTimeout(() => this.queueSave(), 450);
    if (rerender) this.render(); else { this.updateSaveBadge(); this.schedulePreview(); this.updateHistoryButtons(); }
  }
  updateSaveBadge() { const badge = document.querySelector('#save-state'); if (badge) { badge.textContent = this.saveStatus; badge.classList.toggle('warning', this.saveFailed); } }
  queueSave() {
    clearTimeout(this.saveTimer); this.saveTimer = null;
    const snapshot = this.snapshot(), revision = this.revision;
    this.saveChain = this.saveChain.catch(() => {}).then(async () => {
      try {
        await saveDraft(snapshot.project, snapshot.assets);
        if (revision === this.revision) { this.saveStatus = 'この端末に保存済み'; this.saveFailed = false; this.updateSaveBadge(); }
      } catch {
        if (revision === this.revision) {
          this.saveStatus = '端末保存に失敗'; this.saveFailed = true; this.updateSaveBadge();
          this.toast('端末に下書きを保存できません。「下書きを持ち出す」でファイルに保存してください。', true);
        }
      }
    });
    return this.saveChain;
  }
  edit(mutator, rerender = true, remember = true) {
    const before = this.snapshot();
    const next = mutator(structuredClone(this.project));
    if (slideCount(next) > MAX_SLIDES) { this.toast('投稿は20枚までです。ほかの写真の分割数を減らしてください。', true); return; }
    validateProject(next, this.assets);
    if (remember) this.pushHistory(before);
    this.project = next; this.commit(rerender);
  }
  editBlock(updater, rerender = true, remember = true) {
    this.edit(project => ({ ...project, blocks: project.blocks.map(block => block.id === this.selected ? updater(block) : block) }), rerender, remember);
  }
  travelHistory(forward = false) {
    if (this.busy) return;
    const from = forward ? this.future : this.history, to = forward ? this.history : this.future;
    if (!from.length) return;
    to.push(this.snapshot());
    const snapshot = from.pop(); this.project = snapshot.project; this.assets = snapshot.assets;
    for (const url of this.urls.values()) URL.revokeObjectURL(url); this.urls.clear();
    this.activeRange = null; this.commit();
  }
  updateHistoryButtons() {
    document.querySelectorAll('[data-action="undo"]').forEach(button => { button.disabled = !this.history.length || this.busy; });
    document.querySelectorAll('[data-action="redo"]').forEach(button => { button.disabled = !this.future.length || this.busy; });
  }
  toast(message, error = false) {
    const element = document.querySelector('#toast');
    element.textContent = message; element.className = `toast visible${error ? ' error' : ''}`;
    clearTimeout(this.toastTimer); this.toastTimer = setTimeout(() => element.classList.remove('visible'), error ? 9000 : 5500);
  }
  asset(id) { return this.assets.find(asset => asset.id === id); }
  selectedBlock() { return this.project.blocks.find(block => block.id === this.selected); }
  preprocessLabel(asset) {
    const edit = normalizedPreprocess(asset?.preprocess);
    const size = asset ? effectiveAssetSize(asset, edit) : null;
    const square = size && Math.abs(size.width / size.height - 1) < .015;
    const cropped = Object.values(edit.crop).some(value => value > .001);
    const positioned = edit.zoom > 1.001 || Math.abs(edit.focusX) > .001 || Math.abs(edit.focusY) > .001;
    return [square ? '正方形' : cropped ? 'トリミング済み' : '', edit.rotation ? `傾き ${edit.rotation}°` : '', positioned ? '位置調整済み' : ''].filter(Boolean).join('・') || '未調整';
  }
  closePreprocess() {
    if (this.preprocessImage) this.preprocessImage.src = '';
    this.preprocessImage = null; this.preprocessAssetId = null; this.preprocessDraft = null;
    this.preprocessPointers.clear(); this.preprocessGesture = null;
  }
  preprocessDialogHTML(asset) {
    const edit = this.preprocessDraft;
    const rows = [['left','左を切る',0,95,Math.round(edit.crop.left*100),'%'],['right','右を切る',0,95,Math.round(edit.crop.right*100),'%'],['top','上を切る',0,95,Math.round(edit.crop.top*100),'%'],['bottom','下を切る',0,95,Math.round(edit.crop.bottom*100),'%']];
    return `<div class="dialog-header"><span class="eyebrow">PREPARE THE PHOTO</span><button class="icon-button" data-action="close-dialog" aria-label="写真の前処理を閉じる">${icon('close')}</button></div><h2 class="dialog-title">元写真を整える</h2><p class="dialog-lead">写真を1本指で動かし、2本指で広げて拡大できます。回転や移動をしても白場が出ない範囲に自動で収めます。</p><div class="preprocess-layout"><div class="preprocess-preview"><div class="gesture-frame"><canvas id="preprocess-canvas" aria-label="前処理後の写真プレビュー。ドラッグで移動、ピンチで拡大"></canvas><span class="gesture-hint">1本指で移動 ・ 2本指で拡大</span></div><span>白場を残さない仕上がり</span></div><div class="preprocess-controls"><div class="preprocess-presets"><button class="button secondary" data-action="preprocess-preset" data-value="reset">切り取りなし</button><button class="button secondary square-preset" data-action="preprocess-preset" data-value="square">正方形にする</button></div><label class="range-label" for="preprocess-rotation"><span>傾き</span><output id="preprocess-value-rotation">${edit.rotation.toFixed(1)}°</output></label><div class="rotation-control"><button class="button secondary" data-action="rotation-step" data-value="-0.1" aria-label="左へ0.1度回転">−0.1°</button><input id="preprocess-rotation" data-preprocess="rotation" type="range" min="-180" max="180" step="0.1" value="${edit.rotation}"><button class="button secondary" data-action="rotation-step" data-value="0.1" aria-label="右へ0.1度回転">＋0.1°</button></div><p class="rotation-note">角度に合わせて自動拡大し、四隅まで写真で埋めます。</p><label class="range-label" for="preprocess-zoom"><span>拡大</span><output id="preprocess-value-zoom">${Math.round(edit.zoom*100)}%</output></label><input id="preprocess-zoom" data-preprocess="zoom" type="range" min="100" max="300" step="1" value="${Math.round(edit.zoom*100)}"><button class="text-button recenter-button" data-action="preprocess-recenter">写真を中央に戻す</button>${rows.map(([key,label,min,max,value,suffix])=>`<label class="range-label" for="preprocess-${key}"><span>${label}</span><output id="preprocess-value-${key}">${value}${suffix}</output></label><input id="preprocess-${key}" data-preprocess="${key}" type="range" min="${min}" max="${max}" step="1" value="${value}">`).join('')}<p class="control-note">正方形にしたあとも、写真を直接動かして残す位置を選べます。</p></div></div><div class="preprocess-footer"><button class="text-button" data-action="preprocess-reset-all">すべての調整を戻す</button><div><button class="button secondary" data-action="close-dialog">キャンセル</button><button class="button primary" data-action="preprocess-apply">この形を使う ${icon('arrow')}</button></div></div>`;
  }
  async openPreprocess(id) {
    const asset = this.asset(id); if (!asset) return;
    this.closePreprocess(); this.preprocessAssetId = id; this.preprocessDraft = normalizedPreprocess(asset.preprocess);
    this.dialog.innerHTML = this.preprocessDialogHTML(asset); this.dialog.showModal();
    this.preprocessImage = await loadImage(asset.blob);
    this.renderPreprocessPreview();
  }
  renderPreprocessPreview() {
    const asset = this.asset(this.preprocessAssetId), canvas = document.querySelector('#preprocess-canvas');
    if (!asset || !canvas || !this.preprocessImage) return;
    drawPreprocessed(canvas, this.preprocessImage, { ...asset, preprocess: this.preprocessDraft }, 560);
  }
  syncPreprocessGestureControls() {
    const zoom=document.querySelector('#preprocess-zoom'), output=document.querySelector('#preprocess-value-zoom');
    if(zoom) zoom.value=String(Math.round(this.preprocessDraft.zoom*100));
    if(output) output.textContent=`${Math.round(this.preprocessDraft.zoom*100)}%`;
  }
  onPreprocessPointerDown(event) {
    if(event.target.id!=='preprocess-canvas' || !this.preprocessDraft) return;
    event.preventDefault();
    try { event.target.setPointerCapture?.(event.pointerId); } catch { /* Synthetic tests and older WebKit may not expose an active native pointer. */ }
    this.preprocessPointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    const points=[...this.preprocessPointers.values()];
    if(points.length===1) this.preprocessGesture={mode:'drag',start:points[0],edit:structuredClone(this.preprocessDraft)};
    else if(points.length===2) this.preprocessGesture={mode:'pinch',distance:Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y),zoom:this.preprocessDraft.zoom};
  }
  onPreprocessPointerMove(event) {
    if(!this.preprocessPointers.has(event.pointerId) || !this.preprocessGesture) return;
    event.preventDefault(); this.preprocessPointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    const points=[...this.preprocessPointers.values()], asset=this.asset(this.preprocessAssetId), canvas=document.querySelector('#preprocess-canvas');
    if(!asset || !canvas) return;
    if(points.length>=2 && this.preprocessGesture.mode==='pinch') {
      const distance=Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y);
      this.preprocessDraft=normalizedPreprocess({...this.preprocessDraft,zoom:this.preprocessGesture.zoom*distance/Math.max(1,this.preprocessGesture.distance)});
    } else if(points.length===1 && this.preprocessGesture.mode==='drag') {
      const start=this.preprocessGesture.edit, placement=preprocessPlacement(asset,start), rect=canvas.getBoundingClientRect();
      const angle=start.rotation*Math.PI/180, dx=points[0].x-this.preprocessGesture.start.x, dy=points[0].y-this.preprocessGesture.start.y;
      const screenScale=rect.width/effectiveAssetSize(asset,start).width*placement.scale;
      const localX=(dx*Math.cos(angle)+dy*Math.sin(angle))/screenScale, localY=(-dx*Math.sin(angle)+dy*Math.cos(angle))/screenScale;
      const toFocus=(pan,min,max)=>max-min<1e-7?0:clamp(2*(pan-(min+max)/2)/(max-min),-1,1);
      this.preprocessDraft=normalizedPreprocess({...start,focusX:toFocus(placement.panX+localX,placement.xMin,placement.xMax),focusY:toFocus(placement.panY+localY,placement.yMin,placement.yMax)});
    }
    this.syncPreprocessGestureControls(); this.renderPreprocessPreview();
  }
  onPreprocessPointerUp(event) {
    if(!this.preprocessPointers.has(event.pointerId)) return;
    this.preprocessPointers.delete(event.pointerId);
    const points=[...this.preprocessPointers.values()];
    this.preprocessGesture=points.length===1?{mode:'drag',start:points[0],edit:structuredClone(this.preprocessDraft)}:null;
  }
  squarePreprocess(asset, rotation = normalizedPreprocess(asset.preprocess).rotation) {
    const size = effectiveAssetSize(asset, { ...neutralPreprocess(), rotation });
    const crop = { left: 0, right: 0, top: 0, bottom: 0 };
    if (size.frameWidth > size.frameHeight) crop.left = crop.right = (1 - size.frameHeight / size.frameWidth) / 2;
    else crop.top = crop.bottom = (1 - size.frameWidth / size.frameHeight) / 2;
    return normalizedPreprocess({ rotation, crop });
  }
  async applyAssetPreprocess(id, preprocess, squareSingle = false) {
    const asset = this.asset(id); if (!asset) return;
    const before = this.snapshot(), nextAsset = { ...asset, preprocess: normalizedPreprocess(preprocess) };
    nextAsset.thumbnail = await refreshThumbnail(nextAsset);
    const assets = this.assets.map(item => item.id === id ? nextAsset : item);
    let project = this.project;
    if (squareSingle) project = { ...project, blocks: project.blocks.map(block => block.id === this.selected ? { ...block, span: 1, fit: 'contain' } : block) };
    validateProject(project, assets); this.pushHistory(before); this.assets = assets; this.project = project;
    const url = this.urls.get(id); if (url) URL.revokeObjectURL(url); this.urls.delete(id);
    this.commit();
  }
  render() {
    this.previewController?.abort();
    const oldStage = document.querySelector('#preview-scroll');
    const scroll = oldStage?.scrollLeft || 0;
    const count = slideCount(this.project);
    this.root.innerHTML = `
      <header class="site-header">
        <a class="brand" href="./" aria-label="つづく ホーム"><span class="brand-mark" aria-hidden="true"><i></i><i></i></span><span>tsuzuku<span class="brand-dot">.</span></span><span class="brand-ja">つづく</span></a>
        <div class="header-tools"><span class="save-state ${this.saveFailed ? 'warning' : ''}" id="save-state">${escapeHTML(this.saveStatus)}</span><button class="button quiet icon-label" data-action="help">${icon('help')}<span>使い方</span></button></div>
      </header>
      <main id="main-content">
        ${this.notice ? `<div class="notice" role="alert"><span>${escapeHTML(this.notice)}</span><button class="icon-button" data-action="dismiss-notice" aria-label="お知らせを閉じる">${icon('close')}</button></div>` : ''}
        ${this.assets.length ? this.editorHTML(count) : this.welcomeHTML()}
      </main>
      <footer class="site-footer"><span>Make room for the whole story.</span><span>${icon('shield')} 写真は外部に送信しません</span></footer>
      <input id="photo-input" class="visually-hidden" type="file" accept="image/*" multiple aria-label="写真を選ぶ" ${disabled(this.busy)}>
      <input id="backup-input" class="visually-hidden" type="file" accept=".tsuzuku,application/zip" aria-label="下書きファイルを選ぶ" ${disabled(this.busy)}>
      ${this.busy && !this.exportController ? `<div class="busy-overlay" role="status"><div class="busy-card"><span class="spinner"></span><strong id="busy-label">${escapeHTML(this.busyLabel)}</strong><p>写真はこの端末で処理しています。</p></div></div>` : ''}`;
    if (this.assets.length) {
      const stage = document.querySelector('#preview-scroll'); if (stage) stage.scrollLeft = scroll;
      this.schedulePreview();
    } else {
      const canvas = document.querySelector('#hero-art'); if (canvas) paintLandscape(canvas.getContext('2d'), canvas.width, canvas.height);
    }
  }
  welcomeHTML() {
    return `<section class="welcome">
      <div class="hero-copy"><p class="eyebrow"><span class="tiny-dot"></span> SEAMLESS CAROUSEL STUDIO</p>
        <h1>写真がつながる。<br>思い出が<span class="underline-word">つづく。</span></h1>
        <p class="hero-description">1枚におさまらない景色も、<br>いくつもの好きな瞬間も。<br class="mobile-break">スワイプでつながる投稿に。</p>
        <button class="button primary hero-button" data-action="choose" ${disabled(this.busy)}>${icon('plus')} 写真を選んではじめる ${icon('arrow')}</button>
        <p class="privacy-note">${icon('shield')} ログイン不要。写真はこの端末の中だけ。</p>
        <button class="text-button demo-button" data-action="demo" ${disabled(this.busy)}>まずはデモで試す <span aria-hidden="true">↗</span></button>
        <button class="text-button restore-link" data-action="backup-open" ${disabled(this.busy)}>保存した下書きを開く</button>
      </div>
      <div class="hero-visual" aria-label="横長のイラストが2枚の投稿につながるデモ">
        <div class="visual-top"><span class="small-caps">ONE VIEW. TWO FRAMES.</span><span class="capsule">← スワイプ →</span></div>
        <div class="hero-art-frame"><canvas id="hero-art" width="1080" height="810"></canvas><div class="hero-seam"></div><span class="art-number first">01</span><span class="art-number second">02</span></div>
        <div class="visual-bottom"><span><i class="line"></i> ひとつの景色、そのままつづく。</span><span class="art-credit">デモイラスト</span></div>
      </div>
    </section>
    <section class="feature-row" aria-label="使い方の流れ"><div><span class="step-num">01</span><div><h2>写真を選ぶ</h2><p>横長も縦長も、まとめて。</p></div></div><div><span class="step-num">02</span><div><h2>つながりを整える</h2><p>おまかせで作って、少しだけ調整。</p></div></div><div><span class="step-num">03</span><div><h2>保存して、投稿</h2><p>Instagramで順番に選ぶだけ。</p></div></div></section>`;
  }
  editorHTML(count) {
    const dimensions = RATIOS[this.project.ratio];
    return `<section class="editor-heading"><div><p class="eyebrow">YOUR STORY, CONTINUED.</p><h1>いつもの写真に、つづきを。</h1><p class="editor-subtitle">${this.assets.length}枚の写真 <span>→</span> <strong>${count}枚の投稿</strong><span class="dimensions">${dimensions.width} × ${dimensions.height} px</span></p></div><button class="button secondary" data-action="choose" ${disabled(this.busy || this.assets.length >= MAX_PHOTOS)}>${icon('plus')} 写真を追加</button></section>
      <section class="workspace">
        <div class="canvas-column">
          <div class="format-toolbar"><div class="toolbar-group"><span class="field-caption">投稿の形</span><div class="segmented" aria-label="投稿の縦横比">${Object.keys(RATIOS).map(ratio => `<button data-action="ratio" data-value="${ratio}" ${pressed(this.project.ratio === ratio)} ${disabled(this.busy)}>${ratio}<small>${ratio === '1:1' ? '正方形' : '縦長'}</small></button>`).join('')}</div></div>
          <div class="toolbar-group"><span class="field-caption">スタイル</span><div class="theme-picker" aria-label="背景スタイル">${Object.entries(THEMES).map(([key, theme]) => `<button class="theme-option theme-${key}" data-action="theme" data-value="${key}" ${pressed(this.project.theme === key)} ${disabled(this.busy)}><span class="theme-swatch"></span>${theme.name}</button>`).join('')}</div></div></div>
          <section class="preview-panel" aria-labelledby="preview-heading"><div class="panel-top"><h2 id="preview-heading"><span class="section-index">01</span> つながりを確認</h2><div class="view-switch"><button data-action="view" data-value="strip" ${pressed(this.previewMode === 'strip')}>つながり</button><button data-action="view" data-value="swipe" ${pressed(this.previewMode === 'swipe')}>スワイプ</button></div></div>
            <div class="preview-stage"><div id="preview-scroll" class="preview-scroll ${this.previewMode}" tabindex="0" aria-label="投稿プレビュー。横にスクロールできます"><div class="tile-strip">${Array.from({ length: count }, (_, index) => `<div class="preview-tile" data-page="${index}"><canvas width="320" height="${Math.round(dimensions.height * 320 / 1080)}" aria-label="投稿 ${index + 1}枚目のプレビュー"></canvas><span class="page-number">${num(index + 1)}</span><span class="seam-guide" aria-hidden="true"></span></div>`).join('')}</div></div><div class="preview-hint"><span id="preview-status">プレビューを作成中…</span><span>← 横にスワイプ →</span></div></div>
            <div class="preview-caption"><span>${icon('layers')} 番号とガイド線は、書き出す画像には入りません。</span><span class="count-pill">${num(count)} FRAMES</span><button class="text-button mobile-jump" data-action="jump-edit">写真を調整 ↓</button></div>
          </section>
          <div id="quality-warning" class="quality-warning" hidden></div>
          <section class="export-summary"><div><span class="eyebrow">READY TO SHARE</span><h2>できたら、Instagramへ。</h2><p>画像を保存して、Instagramアプリで順番に選びます。</p></div><label class="format-select">書き出し形式<select id="format-select" ${disabled(this.busy)}><option value="jpeg" ${this.project.format === 'jpeg' ? 'selected' : ''}>JPEG · 写真向け</option><option value="png" ${this.project.format === 'png' ? 'selected' : ''}>PNG · 大きめのファイル</option></select></label></section>
          <div class="project-tools"><div><button class="text-button" data-action="undo" ${disabled(!this.history.length || this.busy)}>${icon('restore')} 元に戻す</button><button class="text-button" data-action="redo" ${disabled(!this.future.length || this.busy)}>やり直す</button></div><details><summary>下書き・データ管理</summary><div class="project-menu"><button class="text-button" data-action="backup-save" ${disabled(this.busy)}>${icon('download')} 下書きを持ち出す</button><button class="text-button" data-action="backup-open" ${disabled(this.busy)}>下書きを読み込む</button><button class="text-button danger" data-action="new" ${disabled(this.busy)}>この端末の下書きを削除</button></div></details></div>
        </div>
        <aside class="edit-panel" aria-labelledby="arrange-heading"><div class="panel-top"><h2 id="arrange-heading"><span class="section-index">02</span> 並べ方を整える</h2><button class="text-button auto-button" data-action="auto" ${disabled(this.busy)}>${icon('spark')} おまかせ</button></div><p class="panel-description">写真を選んで調整。↑ ↓ で順番を変更。</p><ol class="block-list">${this.blocksHTML()}</ol>${this.controlsHTML()}</aside>
      </section>
      <div class="export-bar"><div><span class="export-count">${count}<small> / 20枚</small></span><span class="export-bar-note">${dimensions.width} × ${dimensions.height} · ${this.project.format.toUpperCase()}</span></div><button class="button primary export-button" data-action="export" ${disabled(this.busy || !count)}>${icon('download')} ${count}枚を書き出す ${icon('arrow')}</button></div>`;
  }
  blocksHTML() {
    let start = 1;
    return this.project.blocks.map((block, index) => {
      const first = start; start += block.span;
      const names = block.photoIds.map(id => this.asset(id)?.name || '写真').join(' + ');
      const selected = this.selected === block.id;
      const subtitle = block.layout === 'single' ? `${block.span === 1 ? '1枚で見せる' : `${block.span}枚につなぐ`}` : block.layout === 'duo' ? '2枚を並べる' : '重ねてつなぐ';
      return `<li class="block-card ${selected ? 'selected' : ''}"><button class="block-select" data-action="select" data-id="${block.id}" ${pressed(selected)} ${disabled(this.busy)} aria-label="${index + 1}番目の写真を調整: ${escapeHTML(names)}"><span class="block-thumb ${block.photoIds.length === 2 ? 'paired' : ''}">${block.photoIds.map(id => `<img src="${this.urls.get(id)}" alt="" width="52" height="58">`).join('')}</span><span class="block-description"><span class="block-name">${escapeHTML(names)}</span><span class="block-detail">${subtitle} <span>· ${num(first)}${block.span > 1 ? `–${num(start - 1)}` : ''}</span></span></span></button><div class="move-buttons"><button class="icon-button" data-action="move" data-index="${index}" data-direction="-1" ${disabled(this.busy || index === 0)} aria-label="${index + 1}番目を前へ">${icon('up')}</button><button class="icon-button" data-action="move" data-index="${index}" data-direction="1" ${disabled(this.busy || index === this.project.blocks.length - 1)} aria-label="${index + 1}番目を後ろへ">${icon('down')}</button></div></li>`;
    }).join('');
  }
  controlsHTML() {
    const block = this.selectedBlock(); if (!block) return '';
    const index = this.project.blocks.findIndex(b => b.id === block.id), next = this.project.blocks[index + 1];
    if (!block.photoIds.includes(this.selectedPhoto)) this.selectedPhoto = block.photoIds[0];
    const transform = block.transforms[this.selectedPhoto];
    return `<section class="selection-controls" aria-label="選んだ写真の設定"><div class="selection-heading"><span class="field-caption">選んだ写真の見せ方</span><span class="selected-dot"></span></div><label class="control-label">何枚につなぐ？</label><div class="span-picker" aria-label="分割枚数">${[1,2,3,4,5,6].map(span => `<button data-action="span" data-value="${span}" ${pressed(block.span === span)} ${disabled(this.busy || slideCount(this.project) - block.span + span > MAX_SLIDES)}>${span}<small>枚</small></button>`).join('')}</div>
      ${block.photoIds.length === 2 ? `<label class="control-label">組み合わせ方</label><div class="segmented fill"><button data-action="layout" data-value="duo" ${pressed(block.layout === 'duo')} ${disabled(this.busy)}>2枚を並べる</button><button data-action="layout" data-value="overlap" ${pressed(block.layout === 'overlap')} ${disabled(this.busy)}>重ねてつなぐ</button></div>` : ''}
      <div class="preprocess-callout"><div><span class="control-label">配置前の写真</span><strong>${escapeHTML(this.preprocessLabel(this.asset(this.selectedPhoto)))}</strong><small>傾き・トリミング・正方形化</small></div><button class="button secondary" data-action="preprocess-open" data-id="${this.selectedPhoto}" ${disabled(this.busy)}>元写真を整える</button></div>${block.layout === 'single' ? `<button class="text-button square-single" data-action="square-single" data-id="${this.selectedPhoto}" ${disabled(this.busy)}>正方形＋上下余白の1枚にする</button>` : ''}
      <label class="control-label">写真の収め方</label><div class="segmented fill"><button data-action="fit" data-value="contain" ${pressed(block.fit === 'contain')} ${disabled(this.busy)}>全体を残す</button><button data-action="fit" data-value="cover" ${pressed(block.fit === 'cover')} ${disabled(this.busy)}>枠いっぱい</button></div><p class="control-note">${block.fit === 'contain' ? '前処理後の写真を切らずに配置。正方形なら上下に余白が入ります。' : '前処理後の写真を枠いっぱいに配置。はみ出す部分は切り取ります。'}</p>
      <details class="fine-tune"><summary>見せる位置の微調整 <span>＋</span></summary><div class="fine-tune-body">${block.photoIds.length === 2 ? `<div class="photo-target">${block.photoIds.map((id, i) => `<button data-action="photo-target" data-id="${id}" ${pressed(id === this.selectedPhoto)}>写真 ${i + 1}</button>`).join('')}</div>` : ''}
        ${[['zoom','拡大',100,250,Math.round(transform.zoom*100),'%'],['focusX','横の位置',-100,100,Math.round(transform.focusX*100),''],['focusY','縦の位置',-100,100,Math.round(transform.focusY*100),'']].map(([key,label,min,max,value,suffix]) => `<label class="range-label" for="range-${key}"><span>${label}</span><output id="value-${key}">${value}${suffix}</output></label><input id="range-${key}" data-transform="${key}" type="range" min="${min}" max="${max}" step="1" value="${value}" ${disabled(this.busy)}>`).join('')}<button class="text-button" data-action="reset-transform" ${disabled(this.busy)}>位置と拡大をリセット</button><p class="control-note">拡大すると「全体を残す」でも一部が切れます。</p></div></details>
      <button class="button secondary mobile-jump preview-return" data-action="jump-preview">つながりを確認する ↑</button><div class="block-actions">${block.photoIds.length === 2 ? `<button class="text-button" data-action="split" ${disabled(this.busy)}>2枚を別々に戻す</button>` : next?.photoIds.length === 1 ? `<button class="text-button" data-action="join" ${disabled(this.busy)}>${icon('layers')} 次の写真と組み合わせる</button>` : ''}<button class="text-button danger" data-action="remove" ${disabled(this.busy)}>${icon('trash')} ${block.photoIds.length === 2 ? 'この組を' : 'この写真を'}外す</button></div></section>`;
  }
  schedulePreview() { clearTimeout(this.previewTimer); this.previewController?.abort(); this.previewTimer = setTimeout(() => this.renderPreview(), 100); }
  async renderPreview() {
    if (!this.assets.length || this.busy) return;
    this.previewController?.abort();
    const controller = new AbortController(); this.previewController = controller;
    const canvases = [...document.querySelectorAll('.preview-tile canvas')];
    const pool = new ImagePool(this.assets, controller.signal);
    try {
      const scene = buildScene(this.project, this.assets);
      const warning = document.querySelector('#quality-warning');
      const low = lowResolutionIds(scene, this.assets);
      if (warning) { warning.hidden = !low.length; warning.textContent = low.length ? `選んだ配置では${low.length}枚の写真が大きく拡大されます。ぼやける場合は分割枚数や拡大率を減らしてください。` : ''; }
      for (let index = 0; index < canvases.length; index++) {
        await drawPage(canvases[index], scene, index, pool, 320, controller.signal);
        await yieldToUI();
      }
      const label = document.querySelector('#preview-status');
      if (label) label.textContent = this.previewMode === 'strip' ? '境界をまたいで、ひとつの景色に。' : '1枚ずつ、投稿の見え方をチェック。';
    } catch (error) {
      if (error.name !== 'AbortError') { const label = document.querySelector('#preview-status'); if (label) label.textContent = error.message; }
    } finally { pool.clear(); }
  }
  focusSelectedPreview() {
    const index = this.project.blocks.findIndex(block => block.id === this.selected);
    if (index < 0) return;
    const start = this.project.blocks.slice(0, index).reduce((sum, block) => sum + block.span, 0);
    const stage = document.querySelector('#preview-scroll');
    const tile = document.querySelector(`.preview-tile[data-page="${start}"]`);
    if (stage && tile) stage.scrollLeft += tile.getBoundingClientRect().left - stage.getBoundingClientRect().left;
  }
  updateBusy(message) { this.busyLabel = message; const label = document.querySelector('#busy-label'); if (label) label.textContent = message; }
  async addPhotos(files) {
    if (this.busy || !files.length) return;
    if (this.assets.length + files.length > MAX_PHOTOS) { this.toast(`写真は合計20枚までです。あと${MAX_PHOTOS - this.assets.length}枚選べます。`, true); return; }
    this.busy = true; this.busyLabel = '写真を読み込んでいます'; this.render();
    const before = this.snapshot(), imported = [], failures = [];
    try {
      for (let index = 0; index < files.length; index++) {
        this.updateBusy(`写真を読み込み中 ${index + 1} / ${files.length}`);
        try { imported.push(await importPhoto(files[index])); }
        catch (error) { failures.push(`${files[index].name}: ${error.message}`); }
        await yieldToUI();
      }
      if (imported.length) {
        this.pushHistory(before); this.assets = [...this.assets, ...imported];
        const blocks = [...this.project.blocks, ...imported.map(asset => makeBlock(asset.id, recommendSpan(asset, this.project.ratio)))];
        let total = blocks.reduce((n,b) => n+b.span,0), adjusted = false;
        while (total > MAX_SLIDES) {
          let index = 0;
          for (let i=1;i<blocks.length;i++) if(blocks[i].span>blocks[index].span) index=i;
          blocks[index] = { ...blocks[index], span: blocks[index].span - 1 }; total--; adjusted = true;
        }
        this.project = { ...this.project, blocks }; this.selected = blocks[blocks.length - imported.length]?.id;
        this.notice = failures.length ? failures.join('\n') : adjusted ? '写真を省かずに20枚以内に収めるため、分割数を調整しました。各写真を選ぶと変更できます。' : '';
        validateProject(this.project, this.assets);
        this.commit(false);
      } else if (failures.length) this.notice = failures.join('\n');
    } finally { this.busy = false; this.render(); }
  }
  async openBackup(file) {
    if (this.busy || !file) return;
    if (this.assets.length && !confirm('今の編集を読み込んだ下書きに切り替えます。「元に戻す」で戻せます。続けますか？')) return;
    this.busy = true; this.busyLabel = '下書きを読み込んでいます'; this.render();
    try {
      const backup = await restoreBackup(file, (i,n)=>this.updateBusy(`下書きの写真を確認中 ${i} / ${n}`));
      this.pushHistory(this.snapshot()); this.project = backup.project; this.assets = backup.assets;
      for (const url of this.urls.values()) URL.revokeObjectURL(url); this.urls.clear();
      this.selected = this.project.blocks[0]?.id; this.notice = ''; this.commit(false);
      this.toast('下書きを読み込みました。');
    } catch (error) { this.notice = error.message; }
    finally { this.busy = false; this.render(); }
  }
  async generateExports() {
    if (this.busy || !this.assets.length) return;
    if (this.outputFiles.length) { this.dialog.innerHTML = this.exportDialogHTML(); this.dialog.showModal(); return; }
    this.previewController?.abort(); clearTimeout(this.previewTimer);
    this.exportController = new AbortController(); this.busy = true; this.render();
    const count = slideCount(this.project);
    this.dialog.innerHTML = `<div class="dialog-header"><span class="eyebrow">FINISHING YOUR STORY</span><button class="icon-button" data-action="close-dialog" aria-label="書き出しをキャンセル">${icon('close')}</button></div><div class="export-progress"><span class="spinner"></span><h2>つながる画像を作っています。</h2><p id="export-progress-text">0 / ${count}枚</p><progress id="export-progress" max="${count}" value="0"></progress><p>この端末だけで処理しています。</p><button class="button secondary" data-action="close-dialog">キャンセル</button></div>`;
    this.dialog.showModal();
    try {
      this.outputFiles = await exportPages(buildScene(this.project, this.assets), this.assets, this.project.format, (done,total) => {
        const progress = document.querySelector('#export-progress'), text = document.querySelector('#export-progress-text');
        if (progress) progress.value = done; if (text) text.textContent = `${done} / ${total}枚`;
      }, this.exportController.signal);
      this.outputUrls = this.outputFiles.map(file => URL.createObjectURL(file));
      this.dialog.innerHTML = this.exportDialogHTML();
      this.dialog.querySelector('.primary')?.focus();
    } catch (error) {
      this.invalidateOutputs();
      this.dialog.close();
      if (error.name !== 'AbortError') this.toast(error.message, true);
    } finally { this.busy = false; this.exportController = null; this.render(); }
  }
  exportDialogHTML() {
    const shareable = canShareFiles(this.outputFiles), totalBytes = this.outputFiles.reduce((sum,file)=>sum+file.size,0);
    return `<div class="dialog-header"><span class="eyebrow">YOUR STORY IS READY</span><button class="icon-button" data-action="close-dialog" aria-label="書き出し画面を閉じる">${icon('close')}</button></div><h2 class="dialog-title">Instagramへ、あとひと息。</h2><p class="dialog-lead">${this.outputFiles.length}枚を書き出しました · ${bytesLabel(totalBytes)}<br>下の番号順に、保存して選んでください。</p>
      <div class="save-flow"><div><span>1</span>画像を保存</div><i>→</i><div><span>2</span>Instagramで複数選択</div></div>
      <button class="button primary share-all" data-action="share-all" ${disabled(!shareable)}>${icon('share')} 共有メニューを開く <small>${this.outputFiles.length}枚</small></button>
      <p class="share-help">${shareable ? '共有メニューに「画像を保存」が表示されたら選択してください。表示や保存順は端末によって異なります。' : 'この環境では一括共有を利用できません。下の「保存」または「画像を開く」を使ってください。iPhoneではHTTPSのURLをSafariで開いてください。'}</p>
      <div id="share-message" class="share-message" role="status" aria-live="polite"></div>
      <div class="output-grid">${this.outputFiles.map((file,index)=>`<article class="output-card"><div class="output-image"><img src="${this.outputUrls[index]}" alt="保存用の${index+1}枚目" width="216" height="${RATIOS[this.project.ratio].height/5}"><span class="page-number">${num(index+1)}</span></div><div class="output-card-body"><strong>${num(index+1)} <small>${bytesLabel(file.size)}</small></strong><button class="button secondary compact" data-action="share-one" data-index="${index}">${icon('download')} 保存</button><a class="text-button" href="${this.outputUrls[index]}" target="_blank" rel="noopener">画像を開く ↗</a><span class="file-label">${escapeHTML(file.name)}</span></div></article>`).join('')}</div>
      <details class="save-troubleshooting"><summary>保存・投稿で困ったら</summary><p>一括で保存できないときは、1枚ずつ「保存」を押してください。「画像を開く」から画像を長押しして保存する方法も試せます。ダウンロードは「写真」ではなく「ファイル」に入る場合があります。</p><p>写真アプリで保存した枚数と順番を確認し、Instagramの新規投稿で複数選択します。ここにある01 → 02 → 03…の順に選んでください。写真アプリの並び順だけには頼らないでください。</p><p>投稿時は全画像を同じ比率にそろえ、画像ごとの切り取りや回転をしないでください。Instagram側の余白・圧縮・スワイプ表示は、このアプリからは制御できません。</p></details>
      <div class="dialog-bottom"><button class="text-button" data-action="export-zip">${icon('download')} ZIPでまとめて保存 <small>主にMac向け</small></button><button class="button secondary" data-action="close-dialog">編集に戻る</button></div>`;
  }
  dialogMessage(message, error=false) { const element=document.querySelector('#share-message'); if(element) {element.textContent=message; element.classList.toggle('error',error);} }
  async runShare(files, button) {
    if (this.sharing) return;
    this.sharing = true; button.disabled = true;
    try {
      // No await before shareFiles: retains the user's transient activation on iOS.
      await shareFiles(files);
      this.dialogMessage('共有メニューを閉じました。写真アプリで保存結果と順番を確認してください。');
    } catch (error) {
      this.dialogMessage(error.name === 'AbortError' ? '共有をキャンセルしました。書き出した画像はここに残っています。' : `${error.message} 1枚ずつの保存もお試しください。`, error.name !== 'AbortError');
    } finally { this.sharing=false; button.disabled=false; }
  }
  showHelp() {
    this.dialog.innerHTML = `<div class="dialog-header"><span class="eyebrow">A LITTLE GUIDE</span><button class="icon-button" data-action="close-dialog" aria-label="使い方を閉じる">${icon('close')}</button></div><h2 class="dialog-title">「つづく」の使い方。</h2><div class="help-copy"><h3>写真を選ぶだけで、まずは完成。</h3><p>縦横比を見て、横長の写真を2枚以上に、縦長の写真を1枚に配置します。写真の内容を理解するAIではなく、形に合わせるおまかせ機能です。好みと違うところだけ調整してください。</p><h3>配置の前に、元写真を整える。</h3><p>写真ごとの「元写真を整える」で、写真を1本指で移動、2本指で拡大できます。傾きと上下左右の不要部分も調整でき、白場が出る位置には動きません。「正方形にする」後も写真を直接動かせます。「正方形＋上下余白の1枚にする」なら、横写真の連結と同じ投稿に混ぜられます。編集は非破壊で、元ファイルを変更しません。</p><h3>横長写真を、ひとつながりに。</h3><p>写真を選び「何枚につなぐ？」を2枚にします。「全体を残す」なら写真を切らずに配置。「枠いっぱい」なら、余白をなくす代わりにはみ出す部分を切り取ります。内部の境界には余白を入れません。</p><h3>2枚を組み合わせる。</h3><p>「次の写真と組み合わせる」で隣り合う写真を一組にできます。「重ねてつなぐ」は写真をページ境界にまたがるレイアウトに。「2枚を並べる」なら、1ページでは上下、2ページ以上では左右に配置します。</p><h3>保存して、Instagramで投稿。</h3><p>書き出し後に共有メニューを開き、「画像を保存」があれば選択します。見つからない場合は1枚ずつ保存してください。Instagramアプリでは番号順に複数選択し、同じ比率のまま投稿します。自動投稿やInstagramログインは使いません。</p><h3>写真と下書きについて。</h3><p>写真はサーバーへ送信せず、ブラウザの中で処理します。下書きはこの端末のブラウザ内に自動保存しますが、プライベートブラウズ・容量不足・ブラウザデータ削除などで失われることがあります。大切な編集は「下書きを持ち出す」で保存してください。別の端末には自動同期しません。同じ編集は1つのタブで行ってください。</p><p>JPEG・PNG・WebPに対応。HEICはブラウザが読み込める場合に対応し、対応するSafariでの利用を想定しています。透明部分は白に、写真は長辺4096px・約8MP以内の作業用JPEGに変換します。元の写真は変更しません。最大20写真、出力20枚、写真1枚40MBまでです。巨大な写真は端末メモリの制限で失敗する場合があります。</p><p>初回表示には通信が必要です。アプリ本体の配信先には一般的なアクセスログが残る場合がありますが、写真のアップロード先や解析サービスは設けていません。</p></div><button class="button primary" data-action="close-dialog">はじめよう ${icon('arrow')}</button>`;
    this.dialog.showModal();
  }
  async onClick(event) {
    const button = event.target.closest('[data-action]');
    if (!button || button.disabled) return;
    const action = button.dataset.action;
    try {
      if (action === 'close-dialog') { this.exportController?.abort(); this.closePreprocess(); this.dialog.close(); return; }
      if (action === 'help') { if (!this.busy) this.showHelp(); return; }
      if (action === 'share-all') { await this.runShare(this.outputFiles,button); return; }
      if (action === 'share-one') {
        const file = this.outputFiles[Number(button.dataset.index)]; if(!file) return;
        if(canShareFiles([file])) await this.runShare([file],button);
        else { downloadBlob(file,file.name); this.dialogMessage('保存を開始しました。「写真」または「ファイル」で保存結果を確認してください。'); }
        return;
      }
      if (action === 'export-zip') { button.disabled=true; try { const blob=await createExportZip(this.outputFiles); downloadBlob(blob,'tsuzuku-images.zip'); this.dialogMessage('ZIPの保存を開始しました。写真アプリへは直接入りません。'); } finally { button.disabled=false; } return; }
      if (action === 'preprocess-preset') {
        const asset=this.asset(this.preprocessAssetId); if(!asset) return;
        this.preprocessDraft=button.dataset.value==='square' ? this.squarePreprocess(asset,this.preprocessDraft.rotation) : { ...this.preprocessDraft,crop:neutralPreprocess().crop };
        this.dialog.innerHTML=this.preprocessDialogHTML(asset); this.renderPreprocessPreview(); return;
      }
      if (action === 'rotation-step') {
        if(!this.preprocessDraft) return;
        const rotation=Math.round((this.preprocessDraft.rotation+Number(button.dataset.value))*10)/10;
        this.preprocessDraft=normalizedPreprocess({ ...this.preprocessDraft,rotation });
        const slider=document.querySelector('#preprocess-rotation'), output=document.querySelector('#preprocess-value-rotation');
        if(slider) slider.value=String(this.preprocessDraft.rotation);
        if(output) output.textContent=`${this.preprocessDraft.rotation.toFixed(1)}°`;
        this.renderPreprocessPreview(); return;
      }
      if (action === 'preprocess-recenter') {
        if(!this.preprocessDraft) return;
        this.preprocessDraft=normalizedPreprocess({...this.preprocessDraft,focusX:0,focusY:0});
        this.renderPreprocessPreview(); return;
      }
      if (action === 'preprocess-reset-all') {
        const asset=this.asset(this.preprocessAssetId); if(!asset) return;
        this.preprocessDraft=neutralPreprocess(); this.dialog.innerHTML=this.preprocessDialogHTML(asset); this.renderPreprocessPreview(); return;
      }
      if (action === 'preprocess-apply') {
        const id=this.preprocessAssetId, edit=structuredClone(this.preprocessDraft); this.closePreprocess(); this.dialog.close();
        this.busy=true; this.render(); try { await this.applyAssetPreprocess(id,edit); } finally { this.busy=false; this.render(); } return;
      }
      if (this.busy) return;
      switch(action) {
        case 'jump-edit': document.querySelector('.edit-panel')?.scrollIntoView({block:'start',behavior:'smooth'}); break;
        case 'jump-preview': this.focusSelectedPreview(); document.querySelector('.preview-panel')?.scrollIntoView({block:'start',behavior:'smooth'}); break;
        case 'choose': document.querySelector('#photo-input').click(); break;
        case 'backup-open': document.querySelector('#backup-input').click(); break;
        case 'demo': await this.addPhotos(await demoFiles()); break;
        case 'dismiss-notice': this.notice=''; this.render(); break;
        case 'view': this.previewMode=button.dataset.value; this.render(); break;
        case 'select': this.selected=button.dataset.id; this.selectedPhoto=null; this.render(); this.focusSelectedPreview(); break;
        case 'photo-target': this.selectedPhoto=button.dataset.id; this.render(); document.querySelector('.fine-tune')?.setAttribute('open',''); break;
        case 'preprocess-open': await this.openPreprocess(button.dataset.id); break;
        case 'square-single': {
          const asset=this.asset(button.dataset.id); if(!asset) break;
          this.busy=true; this.render(); try { await this.applyAssetPreprocess(asset.id,this.squarePreprocess(asset),true); } finally { this.busy=false; this.render(); }
          this.toast('正方形に整え、上下余白の1枚にしました。'); break;
        }
        case 'ratio': this.edit(project=>({...project,ratio:button.dataset.value})); break;
        case 'theme': this.edit(project=>({...project,theme:button.dataset.value})); break;
        case 'span': this.editBlock(block=>({...block,span:Number(button.dataset.value)})); break;
        case 'fit': this.editBlock(block=>({...block,fit:button.dataset.value})); break;
        case 'layout': this.editBlock(block=>({...block,layout:button.dataset.value})); break;
        case 'move': this.edit(project=>moveBlock(project,Number(button.dataset.index),Number(button.dataset.direction))); break;
        case 'join': this.edit(project=>joinNext(project,project.blocks.findIndex(b=>b.id===this.selected))); break;
        case 'split': this.edit(project=>splitBlock(project,project.blocks.findIndex(b=>b.id===this.selected))); break;
        case 'reset-transform': this.editBlock(block=>({...block,transforms:{...block.transforms,[this.selectedPhoto]:neutralTransform()}})); document.querySelector('.fine-tune')?.setAttribute('open',''); break;
        case 'undo': this.travelHistory(); break;
        case 'redo': this.travelHistory(true); break;
        case 'remove': {
          const selected=this.selectedBlock(); if(!selected) break;
          this.pushHistory(this.snapshot());
          this.assets=this.assets.filter(a=>!selected.photoIds.includes(a.id));
          this.project={...this.project,blocks:this.project.blocks.filter(b=>b.id!==selected.id)};
          this.commit(); break;
        }
        case 'auto': {
          if(!confirm('写真の順番を保ったまま、分割数と組み合わせをおまかせで作り直します。手動調整はリセットされます。続けますか？')) break;
          const ordered=this.project.blocks.flatMap(b=>b.photoIds).map(id=>this.asset(id));
          this.edit(project=>({...project,blocks:autoBlocks(ordered,project.ratio)})); break;
        }
        case 'export': await this.generateExports(); break;
        case 'backup-save': {
          button.disabled=true;
          try { const blob=await createBackup(this.project,this.assets); downloadBlob(blob,`tsuzuku-draft-${new Date().toISOString().slice(0,10)}.tsuzuku`); this.toast('下書きファイルの保存を開始しました。写真を含むため、共有先に注意してください。'); }
          finally { button.disabled=false; }
          break;
        }
        case 'new': {
          if(!confirm('このブラウザ内の下書きと写真データを削除します。保存済みの元写真や書き出したファイルは消えません。削除しますか？')) break;
          clearTimeout(this.saveTimer); this.saveTimer=null; this.previewController?.abort(); this.busy=true;
          await this.saveChain;
          try { await clearDraft(); } catch { this.toast('端末の下書きを削除できませんでした。ブラウザ設定からサイトデータを削除してください。',true); this.busy=false; break; }
          this.project=newProject(); this.assets=[]; this.history=[]; this.future=[]; this.notice=''; this.selected=null;
          this.revision++; this.invalidateOutputs(); this.syncUrls(); this.busy=false; this.saveStatus='この端末だけで編集'; this.saveFailed=false; this.render(); break;
        }
      }
    } catch(error) { this.toast(error.message || '操作を完了できませんでした。',true); }
  }
  onInput(event) {
    const preprocessKey=event.target.dataset.preprocess;
    if(preprocessKey && this.preprocessDraft) {
      const value=Number(event.target.value), next=structuredClone(this.preprocessDraft);
      if(preprocessKey==='rotation') next.rotation=value;
      else if(preprocessKey==='zoom') next.zoom=value/100;
      else next.crop[preprocessKey]=value/100;
      this.preprocessDraft=normalizedPreprocess(next);
      const output=document.querySelector(`#preprocess-value-${preprocessKey}`); if(output) output.textContent=preprocessKey==='rotation' ? `${value.toFixed(1)}°` : `${value}%`;
      this.renderPreprocessPreview(); return;
    }
    const key=event.target.dataset.transform;
    if(!key || this.busy) return;
    if(!['zoom','focusX','focusY'].includes(key)) return;
    try {
      const remember=this.activeRange !== event.target.id;
      this.activeRange=event.target.id;
      const value=Number(event.target.value)/100;
      this.editBlock(block=>({...block,transforms:{...block.transforms,[this.selectedPhoto]:{...block.transforms[this.selectedPhoto],[key]:value}}}),false,remember);
      const output=document.querySelector(`#value-${key}`); if(output) output.textContent=`${event.target.value}${key==='zoom'?'%':''}`;
    } catch(error) { this.toast(error.message,true); }
  }
  async onChange(event) {
    if(event.target.dataset.transform) { this.activeRange=null; return; }
    try {
    if(event.target.id==='photo-input') { const files=[...event.target.files]; event.target.value=''; await this.addPhotos(files); }
    if(event.target.id==='backup-input') { const file=event.target.files[0]; event.target.value=''; await this.openBackup(file); }
    if(event.target.id==='format-select' && !this.busy) this.edit(project=>({...project,format:event.target.value}));
    } catch (error) { this.toast(error.message || '操作を完了できませんでした。', true); }
  }
}
