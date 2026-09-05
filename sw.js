/* Only application files are cached. User photos and drafts never pass through this worker. */
const BASE=new URL('./',self.location.href).href;
const PREFIX='tsuzuku-'+encodeURIComponent(new URL(BASE).pathname)+'-';
const CACHE=PREFIX+'__BUILD_ID__';
const FILES=['./','./index.html','./manifest.webmanifest','./styles/main.css','./src/main.js','./src/app.js','./src/model.js','./src/layout.js','./src/images.js','./src/renderer.js','./src/storage.js','./src/backup.js','./src/zip.js','./src/sharing.js','./src/demo.js','./src/icons.js','./public/icon.svg','./public/icon-192.png','./public/icon-512.png','./public/apple-touch-icon.png'];
const ALLOWED=new Set(FILES.map(path=>new URL(path,BASE).href));
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const request=event.request, url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(BASE)) return;
  if(request.mode==='navigate') {
    event.respondWith(fetch(request).catch(()=>caches.open(CACHE).then(cache=>cache.match(new URL('./index.html',BASE).href)))); return;
  }
  if(!ALLOWED.has(url.href)) return;
  event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(request))||fetch(request)));
});
