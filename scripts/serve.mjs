import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const args = process.argv.slice(2);
function arg(name, fallback) { const i=args.indexOf(name); return i<0 ? fallback : args[i+1] || fallback; }
const port = Number(arg('--port', process.env.PORT || '5173'));
const host = arg('--host','127.0.0.1');
const root = resolve(arg('--dir','.'));
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port');
const types = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.txt':'text/plain; charset=utf-8' };
const server = createServer(async (req,res) => {
  if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405,{'Allow':'GET, HEAD'}); res.end('Method not allowed'); return; }
  let pathname;
  try { pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname); } catch { res.writeHead(400);res.end('Bad request');return; }
  if(pathname.split('/').some(p=>p.startsWith('.') || p.includes('\0'))) {res.writeHead(403);res.end('Forbidden');return;}
  let file=resolve(root,'.'+pathname);
  if (file !== root && !file.startsWith(root+sep)) {res.writeHead(403);res.end('Forbidden');return;}
  try {
    const info=await stat(file); if(info.isDirectory()) file=resolve(file,'index.html');
    const type=types[extname(file)]; if(!type) {res.writeHead(404);res.end('Not found');return;}
    const data=await readFile(file);
    res.writeHead(200,{'Content-Type':type,'Content-Length':data.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'});
    res.end(req.method==='HEAD'?undefined:data);
  } catch {res.writeHead(404);res.end('Not found');}
});
server.on('error', error=>{console.error(error.message);process.exitCode=1;});
server.listen(port,host,()=>console.log(`tsuzuku → http://${host}:${port}\nServing ${root}\nFor iPhone file sharing, deploy to HTTPS. Ctrl+C to stop.`));
