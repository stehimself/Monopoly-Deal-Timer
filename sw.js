// sw.js
// Schlanker App-Shell-Cache für GitHub Pages (funktioniert in /<repo>/)
const SW_VERSION = 'mdt-v1.0.0';
const CORE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Hilfsfunktion: absoluter URL basierend auf SW-Scope
const toAbs = (path) => new URL(path, self.registration.scope).toString();

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SW_VERSION).then((cache) => cache.addAll(CORE_ASSETS.map(toAbs)))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k !== SW_VERSION).map(k => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// Cache-first für GET; Navigationen fallen auf index.html zurück (SPA)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const req = event.request;

  // Navigations-Requests → index.html
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          return fresh;
        } catch {
          const cache = await caches.open(SW_VERSION);
          const fallback = await cache.match(toAbs('./index.html'));
          return fallback || Response.error();
        }
      })()
    );
    return;
  }

  // Sonst: Cache-first
  event.respondWith(
    (async () => {
      const cache = await caches.open(SW_VERSION);
      const cached = await cache.match(req, { ignoreVary: true, ignoreSearch: true });
      if (cached) return cached;

      try {
        const res = await fetch(req);
        // Nur erfolgreiche, einfache Antworten cachen
        if (res.ok && (res.type === 'basic' || res.type === 'cors')) {
          cache.put(req, res.clone());
        }
        return res;
      } catch {
        // Fallback: nichts
        return Response.error();
      }
    })()
  );
});