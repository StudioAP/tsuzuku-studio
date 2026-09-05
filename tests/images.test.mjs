import test from 'node:test';import assert from 'node:assert/strict';import {sniffImage} from '../src/images.js';
const bytes=s=>new TextEncoder().encode(s);
test('recognizes JPEG magic, independent of extension',()=>assert.equal(sniffImage(new Uint8Array([255,216,255,224])),'image/jpeg'));
test('recognizes PNG magic',()=>assert.equal(sniffImage(new Uint8Array([137,80,78,71,13,10,26,10])),'image/png'));
test('recognizes WebP',()=>assert.equal(sniffImage(bytes('RIFF1234WEBPxxxx')),'image/webp'));
test('recognizes HEIC brands',()=>assert.equal(sniffImage(bytes('0000ftypheic0000')),'image/heic'));
for(const data of ['','<svg/>','GIF89a','0000ftypavif0000','not an image'])test(`reject unsupported magic ${data}`,()=>assert.equal(sniffImage(bytes(data)),null));
