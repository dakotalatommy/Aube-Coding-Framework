// @ts-ignore injected by Vite define
const VERSION = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';
const CACHE_NAME = `bvx-cache-${VERSION}`;
const CORE_ASSETS = [
  '/',
  '/index.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET') return;
  // Network-first for app shell (HTML/JS/CSS) to avoid stale UI
  const isAppShell = req.mode === 'navigate' || url.pathname.endsWith('.js') || url.pathname.endsWith('.css');
  if (url.origin === location.origin && isAppShell) {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return resp;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match('/index.html')))
    );
    return;
  }
  // Cache-first for static assets (images/fonts)
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        return resp;
      }))
    );
  }
});


