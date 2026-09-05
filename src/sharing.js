import { makeZip } from './zip.js';
export function canShareFiles(files) {
  try { return !!(globalThis.isSecureContext && navigator.share && navigator.canShare && files.length && navigator.canShare({ files })); }
  catch { return false; }
}
/** Call synchronously from the click handler. Do NOT encode images before this call. */
export function shareFiles(files) {
  if (!canShareFiles(files)) return Promise.reject(new Error('この環境では画像の共有が使えません。1枚ずつ保存するか、ZIPを利用してください。'));
  return navigator.share({ files }); // Files only: no text/URL that could change iOS share targets.
}
export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = name;
  document.body.append(anchor); anchor.click(); anchor.remove();
  // iOS may begin consuming the URL after the click has returned.
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export async function createExportZip(files) {
  const guide = 'つづく / 投稿の順番\n\n画像をファイル名末尾の01、02…の順でInstagramの複数選択に追加してください。\n写真アプリの表示順は端末側で変わる場合があります。保存後に順番と枚数を確認してください。\n全画像で同じ比率を選び、個別に切り取り・回転しないでください。\n\n' + files.map((file, i) => `${String(i + 1).padStart(2, '0')}  ${file.name}`).join('\n');
  return makeZip([...files.map(file => ({ name: file.name, data: file })), { name: '投稿の順番.txt', data: guide }]);
}
