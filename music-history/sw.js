const CACHE='music-history-20261018-sync-v2';
const FILES=['./','index.html'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('music-history-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin||!u.pathname.startsWith(new URL(self.registration.scope).pathname)||e.request.headers.has('range'))return;e.respondWith(caches.open(CACHE).then(async c=>{const cached=await c.match(e.request);if(cached)return cached;try{const r=await fetch(e.request);if(r.ok&&r.type==='basic')c.put(e.request,r.clone());return r;}catch(err){if(e.request.mode==='navigate')return c.match('index.html');throw err;}}));});
