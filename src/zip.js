/** Minimal ZIP STORE writer/reader. No compression, encryption, ZIP64 or dependencies. */
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; }
export function crc32(bytes) { let crc = 0xffffffff; for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }
function header(length) { const bytes = new Uint8Array(length); return { bytes, view: new DataView(bytes.buffer) }; }
function safeName(name) { return typeof name === 'string' && name.length > 0 && name.length <= 255 && !name.startsWith('/') && !name.includes('\\') && !name.split('/').some(s => s === '..' || s === '.' || s === '') && !/[\x00-\x1f]/.test(name); }
export async function makeZip(entries) {
  if (entries.length > 64) throw new Error('ZIP内のファイル数が多すぎます。');
  const parts = [], central = [], names = new Set();
  let offset = 0, centralSize = 0;
  for (const entry of entries) {
    if (!safeName(entry.name) || names.has(entry.name)) throw new Error('ZIPのファイル名が不正です。');
    names.add(entry.name);
    const name = encoder.encode(entry.name);
    const blob = entry.data instanceof Blob ? entry.data : new Blob([entry.data]);
    if (blob.size > 100 * 1024 * 1024) throw new Error('ZIPのファイルが大きすぎます。');
    const crc = crc32(new Uint8Array(await blob.arrayBuffer()));
    const local = header(30);
    const v = local.view;
    v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint16(6, 0x0800, true);
    v.setUint16(12, 0x0021, true); // DOS date: 1980-01-01; original capture metadata is not copied.
    v.setUint32(14, crc, true); v.setUint32(18, blob.size, true); v.setUint32(22, blob.size, true); v.setUint16(26, name.length, true);
    parts.push(local.bytes, name, blob);
    const record = header(46), c = record.view;
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(14, 0x0021, true);
    c.setUint32(16, crc, true); c.setUint32(20, blob.size, true); c.setUint32(24, blob.size, true); c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
    central.push(record.bytes, name); centralSize += 46 + name.length; offset += 30 + name.length + blob.size;
  }
  if (offset + centralSize > 120 * 1024 * 1024) throw new Error('ZIPが大きすぎます。');
  const end = header(22), e = end.view;
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, entries.length, true); e.setUint16(10, entries.length, true); e.setUint32(12, centralSize, true); e.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end.bytes], { type: 'application/zip' });
}
export async function readZip(blob, maxBytes = 100 * 1024 * 1024) {
  if (blob.size > maxBytes || blob.size < 22) throw new Error('下書きファイルのサイズが不正です。');
  const bytes = new Uint8Array(await blob.arrayBuffer()), view = new DataView(bytes.buffer);
  const files = new Map(), metadata = new Map(); let offset = 0, total = 0;
  const fail = () => { throw new Error('下書きファイルが壊れているか、対応しないZIP形式です。'); };
  while (offset + 4 <= bytes.length && view.getUint32(offset, true) === 0x04034b50) {
    if (offset + 30 > bytes.length || files.size >= 64) fail();
    const flags = view.getUint16(offset + 6, true), method = view.getUint16(offset + 8, true);
    const crc = view.getUint32(offset + 14, true), packed = view.getUint32(offset + 18, true), size = view.getUint32(offset + 22, true);
    const nameLength = view.getUint16(offset + 26, true), extraLength = view.getUint16(offset + 28, true);
    if (flags & ~0x0800 || method !== 0 || packed !== size || !nameLength) fail();
    const start = offset + 30 + nameLength + extraLength, end = start + size;
    if (end > bytes.length || (total += size) > maxBytes) fail();
    let name; try { name = decoder.decode(bytes.subarray(offset + 30, offset + 30 + nameLength)); } catch { fail(); }
    if (!safeName(name) || files.has(name)) fail();
    const data = bytes.subarray(start, end);
    if (crc32(data) !== crc) fail();
    files.set(name, data); metadata.set(name, { offset, flags, method, crc, size }); offset = end;
  }
  // Validate the complete directory and end marker, not just a plausible first file.
  const centralStart = offset, listed = new Set(); let count = 0;
  while (offset + 46 <= bytes.length && view.getUint32(offset, true) === 0x02014b50) {
    const nameLength = view.getUint16(offset + 28, true), extraLength = view.getUint16(offset + 30, true), commentLength = view.getUint16(offset + 32, true);
    const next = offset + 46 + nameLength + extraLength + commentLength;
    if (next > bytes.length) fail();
    let name; try { name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength)); } catch { fail(); }
    const meta = metadata.get(name);
    if (!meta || listed.has(name) || view.getUint16(offset + 8, true) !== meta.flags || view.getUint16(offset + 10, true) !== meta.method || view.getUint32(offset + 16, true) !== meta.crc || view.getUint32(offset + 20, true) !== meta.size || view.getUint32(offset + 24, true) !== meta.size || view.getUint16(offset + 34, true) !== 0 || view.getUint32(offset + 42, true) !== meta.offset) fail();
    listed.add(name); offset = next; count++;
  }
  if (offset + 22 !== bytes.length || view.getUint32(offset, true) !== 0x06054b50 || view.getUint16(offset + 4, true) !== 0 || view.getUint16(offset + 6, true) !== 0 || view.getUint16(offset + 8, true) !== files.size || view.getUint16(offset + 20, true) !== 0 || count !== files.size || view.getUint16(offset + 10, true) !== files.size || view.getUint32(offset + 12, true) !== offset - centralStart || view.getUint32(offset + 16, true) !== centralStart) fail();
  return files;
}
