// /sw.js
// Einfacher App-Shell Service Worker mit zwei Caches:
// - STATIC (Cache First) fuer CSS/JS/Icons/Manifest
// - HTML (Network First + Offline-Fallback) fuer Seiteninhalte

const STATIC_CACHE = 'static-v1';
const HTML_CACHE   = 'html-v1';
const OFFLINE_URL  = './offline.html';

// Dateiliste fuer den Install-Cache (App-Shell)
const STATIC_ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.webmanifest',
  './offline.html',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png'
];

// Install: App-Shell vorcachen
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: alte Caches aufraeumen
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => {
        if (![STATIC_CACHE, HTML_CACHE].includes(k)) return caches.delete(k);
      }))
    )
  );
  self.clients.claim();
});

// Fetch-Strategien:
// - HTML: Network First, bei Fehler Offline-Seite
// - Sonst: Cache First, dann Netz
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // HTML-Seiten erkennen
  const isHTML = req.mode === 'navigate' ||
                 (req.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    event.respondWith(networkFirst(req));
  } else {
    event.respondWith(cacheFirst(req));
  }
});

// Network First fuer HTML
async function networkFirst(request){
  const cache = await caches.open(HTML_CACHE);
  try {
    const fresh = await fetch(request);
    cache.put(request, fresh.clone());
    return fresh;
  } catch (err) {
    const cached = await cache.match(request);
    return cached || caches.match(OFFLINE_URL);
  }
}

// Cache First fuer statische Assets
async function cacheFirst(request){
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const fresh = await fetch(request);
    const cacheName = STATIC_CACHE;
    const cache = await caches.open(cacheName);
    cache.put(request, fresh.clone());
    return fresh;
  } catch (err) {
    // Im Fehlerfall nichts weiter moeglich
    return new Response('', {status: 408, statusText: 'Offline'});
  }
}