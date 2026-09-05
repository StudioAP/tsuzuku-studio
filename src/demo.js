import { canvasBlob } from './images.js';
/** Original procedural illustrations, not stock photos. No external requests or licenses. */
function hill(ctx, points, color) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, 1200);
  for (const [x, y] of points) ctx.lineTo(x, y);
  ctx.lineTo(1800, 1200); ctx.closePath(); ctx.fill();
}
export function paintLandscape(ctx, width, height, variant = 0) {
  ctx.save(); ctx.scale(width / 1800, height / 1200);
  const sky = ctx.createLinearGradient(0, 0, 0, 1200);
  sky.addColorStop(0, variant === 2 ? '#c7d5cc' : '#dae5df'); sky.addColorStop(1, '#eee9d6');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 1800, 1200);
  ctx.fillStyle = '#f8efcb'; ctx.beginPath(); ctx.arc(1300, 255, 114, 0, Math.PI * 2); ctx.fill();
  hill(ctx, [[0,650],[230,490],[420,610],[750,300],[1090,640],[1420,390],[1800,650]], '#9baea3');
  hill(ctx, [[0,840],[350,560],[670,800],[1020,640],[1350,790],[1650,620],[1800,670]], '#6f8e80');
  hill(ctx, [[0,890],[240,810],[490,970],[850,850],[1170,1010],[1550,850],[1800,960]], '#395e51');
  ctx.fillStyle = '#b6c4b3'; ctx.beginPath(); ctx.moveTo(780,820); ctx.bezierCurveTo(850,980,1150,920,1080,1200); ctx.lineTo(1380,1200); ctx.bezierCurveTo(1210,950,890,990,800,820); ctx.fill();
  ctx.fillStyle = '#eae4d2'; ctx.fillRect(1110,706,90,90); ctx.fillStyle = '#574f43';
  ctx.beginPath(); ctx.moveTo(1092,706); ctx.lineTo(1156,650); ctx.lineTo(1217,706); ctx.fill();
  ctx.fillRect(1145,752,23,44);
  ctx.restore();
}
export function paintStillLife(ctx, width, height) {
  ctx.save(); ctx.scale(width / 1000, height / 1400);
  ctx.fillStyle = '#e8ddce'; ctx.fillRect(0,0,1000,1400);
  ctx.fillStyle = '#c7b89f'; ctx.fillRect(0,1030,1000,370);
  ctx.fillStyle = '#9a623e'; ctx.beginPath(); ctx.ellipse(520,1025,230,55,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = '#bb7c53'; ctx.beginPath(); ctx.moveTo(315,715); ctx.bezierCurveTo(360,1050,350,1080,520,1090); ctx.bezierCurveTo(690,1080,680,1050,725,715); ctx.closePath(); ctx.fill();
  ctx.strokeStyle='#4e664e'; ctx.lineWidth=13;
  for (const [x,y] of [[280,340],[730,350],[530,180],[340,530],[700,610]]) { ctx.beginPath(); ctx.moveTo(510,745); ctx.quadraticCurveTo(500,y+150,x,y); ctx.stroke(); ctx.fillStyle='#718360'; ctx.beginPath(); ctx.ellipse(x,y,55,100,(x-500)/500,0,Math.PI*2); ctx.fill(); }
  ctx.restore();
}
export async function demoFiles() {
  const definitions = [{name:'デモ・山のつづき.jpg',w:1800,h:1200,paint:paintLandscape}, {name:'デモ・小さな緑.jpg',w:1000,h:1400,paint:paintStillLife}, {name:'デモ・静かな山並み.jpg',w:1800,h:1200,paint:(ctx,w,h)=>paintLandscape(ctx,w,h,2)}];
  const files=[];
  for (const d of definitions) {
    const canvas=document.createElement('canvas'); canvas.width=d.w; canvas.height=d.h;
    d.paint(canvas.getContext('2d'),d.w,d.h);
    files.push(new File([await canvasBlob(canvas)],d.name,{type:'image/jpeg'}));
    canvas.width=canvas.height=1;
  }
  return files;
}
