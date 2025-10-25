// Minimaler SW für Offline-Grundfunktion – passend für GitHub Pages Unterordner
const CACHE = 'mdt-v1';
const ASSETS = ['./', './index.html']; // bei Bedarf erweitern

// Install: Assets cachen und direkt aktiv werden
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: alte Caches putzen und sofort Clients übernehmen
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: Cache-first Strategie für GET-Anfragen
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((res) => res || fetch(event.request))
  );
});