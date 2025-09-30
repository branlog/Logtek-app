const CACHE='logtek-3.0-v1';
const ASSETS=['/','/index.html','/styles.css','/app.js','/config.js','/products.json','/machines.json','/manifest.json'];
self.addEventListener('install', (e)=>{ e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener('activate', (e)=>{ e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch', (e)=>{ e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))); });