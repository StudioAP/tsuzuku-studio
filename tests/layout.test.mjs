import test from 'node:test';
import assert from 'node:assert/strict';
import {newProject,makeBlock,recommendFit} from '../src/model.js';
import {imageRect,buildScene,intersects,lowResolutionIds} from '../src/layout.js';
const image={id:'a',width:3000,height:1500};
const frame={x:100,y:20,w:2160,h:1350};
test('contain keeps the entire photo, centers both axes',()=>assert.deepEqual(imageRect(image,frame,'contain'),{x:100,y:155,w:2160,h:1080}));
test('cover fills the frame and crops symmetrically',()=>assert.deepEqual(imageRect(image,frame,'cover'),{x:-170,y:20,w:2700,h:1350}));
test('focus endpoints move the crop to the image edges',()=>{assert.equal(imageRect(image,frame,'cover',{focusX:-1}).x,100);assert.equal(imageRect(image,frame,'cover',{focusX:1}).x,-440);});
test('zoom multiplies one unified rectangle',()=>{assert.equal(imageRect(image,frame,'contain',{zoom:2}).w,4320);});
test('touching rectangle edges do not count as intersection',()=>{assert.equal(intersects({x:0,y:0,w:10,h:10},{x:10,y:0,w:10,h:10}),false);assert.equal(intersects({x:0,y:0,w:11,h:10},{x:10,y:0,w:10,h:10}),true);});
for(const theme of ['edge','paper','ink'])test(`page seam does not split placements or add internal margins: ${theme}`,()=>{const p={...newProject(),theme,blocks:[makeBlock('a',2)]};const s=buildScene(p,[image]);assert.equal(s.total,2);assert.equal(s.placements.length,1);const f=s.placements[0].frame;assert.ok(f.x<1080&&f.x+f.w>1080);assert.ok(intersects(f,{x:0,y:0,w:1080,h:s.height}));assert.ok(intersects(f,{x:1080,y:0,w:1080,h:s.height}));});
test('different blocks are arranged in cumulative output coordinates',()=>{const s=buildScene({...newProject(),blocks:[makeBlock('a',2),makeBlock('b',3)]},[image,{...image,id:'b'}]);assert.deepEqual(s.blocks.map(b=>({start:b.start,x:b.x,w:b.w})),[{start:0,x:0,w:2160},{start:2,x:2160,w:3240}]);});
for(const span of [1,2,6])for(const layout of ['duo','overlap'])test(`pair geometry is finite: ${layout}, ${span} slides`,()=>{const block={...makeBlock('a',span),photoIds:['a','b'],layout,transforms:{a:{zoom:1},b:{zoom:1}}};const s=buildScene({...newProject(),blocks:[block]},[image,{...image,id:'b'}]);assert.equal(s.placements.length,2);for(const p of s.placements){assert.ok(p.frame.w>0&&p.frame.h>0);for(const v of Object.values(p.rect))assert.ok(Number.isFinite(v));}});
test('low resolution warning uses working pixels, not original-file metadata',()=>{const a={id:'a',width:100,height:80,originalWidth:10000};const s=buildScene({...newProject(),blocks:[makeBlock('a',2)]},[a]);assert.deepEqual(lowResolutionIds(s,[a]),['a']);});
test('missing assets fail clearly before drawing',()=>assert.throws(()=>buildScene({...newProject(),blocks:[makeBlock('gone')]},[]),/写真/));
test('even an extremely thin photo retains at least one output pixel',()=>{const a={id:'a',width:4096,height:1};const s=buildScene({...newProject(),ratio:'1:1',blocks:[makeBlock('a',1)]},[a]);assert.ok(s.placements[0].rect.h>=1);});
test('a two-page panorama and square single photo coexist in one 4:5 post',()=>{const square={id:'b',width:2400,height:1600,preprocess:{rotation:0,crop:{left:1/6,right:1/6,top:0,bottom:0}}};const single=makeBlock('b',1);const s=buildScene({...newProject(),blocks:[makeBlock('a',2),single]},[image,square]);assert.equal(s.total,3);const squarePlacement=s.placements[1];assert.deepEqual(squarePlacement.frame,{x:2160,y:0,w:1080,h:1350});assert.equal(squarePlacement.rect.w,1080);assert.equal(squarePlacement.rect.h,1080);assert.equal(squarePlacement.rect.y,135);});
test('recommended portrait fit covers the output while square/landscape singles leave only top-bottom background',()=>{
  const portrait={id:'p',width:1200,height:1800},square={id:'s',width:1600,height:1600},landscape={id:'l',width:2400,height:1600};
  const project={...newProject(),blocks:[makeBlock('p',1,recommendFit(portrait,'4:5')),makeBlock('s',1,recommendFit(square,'4:5')),makeBlock('l',1,recommendFit(landscape,'4:5'))]};
  const scene=buildScene(project,[portrait,square,landscape]);
  const [p,s,l]=scene.placements;
  assert.equal(p.rect.x,p.frame.x);assert.ok(p.rect.w>=p.frame.w);assert.ok(p.rect.h>=p.frame.h);
  for(const placement of [s,l]) {assert.equal(placement.rect.x,placement.frame.x);assert.equal(placement.rect.w,placement.frame.w);assert.ok(placement.rect.h<placement.frame.h);}
});
