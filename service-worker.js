const CACHE='logtek-2.1-stable';
const ASSETS=['/','/index.html','/styles.css','/app.js','/config.js','/products.json','/machines.json'];
self.addEventListener('install', e=>{ e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener('activate', e=>{ e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', e=>{ e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))); });
