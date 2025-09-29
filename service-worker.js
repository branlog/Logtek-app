const CACHE_NAME = 'logtek-pro2-v1';
const ASSETS = ['/', '/index.html','/styles.css','/app.js','/config.js','/products.json','/manifest.json'];
self.addEventListener('install', e=>{ e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener('activate', e=>{ e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', e=>{ e.respondWith(caches.match(e.request).then(r=> r || fetch(e.request))); });
