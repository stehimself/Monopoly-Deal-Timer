// Sehr einfacher SW: Offline-Cache + generierte Icon-Antworten (falls Dateien fehlen)
const CACHE = 'mdt-v1';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './offline.html',
  './icons/icon-192.png', // werden ggf. von SW generiert
  './icons/icon-512.png'
];

// Minimaler 1x1 PNG (transparent) als Base64, falls Icons fehlen
const PNG_1x1_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';

self.addEventListener('install', (evt) => {
  evt.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(ASSETS).catch(()=>{});
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (evt) => {
  evt.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    self.clients.claim();
  })());
});

self.addEventListener('fetch', (evt) => {
  const url = new URL(evt.request.url);

  // On-the-fly Icons bereitstellen, falls die Dateien fehlen
  if (url.pathname.endsWith('/icons/icon-192.png') || url.pathname.endsWith('/icons/icon-512.png')) {
    evt.respondWith((async () => {
      // Versuche aus Cache/Netz; wenn 404, liefere 1x1 PNG
      try {
        const cached = await caches.match(evt.request);
        if (cached) return cached;
        const net = await fetch(evt.request);
        if (net && net.ok) return net;
      } catch {}
      const bytes = Uint8Array.from(atob(PNG_1x1_BASE64), c => c.charCodeAt(0));
      return new Response(bytes, { headers: { 'Content-Type': 'image/png', 'Cache-Control':'public, max-age=31536000' } });
    })());
    return;
  }

  // Navigationsanfragen: Netzwerk zuerst, Offline-Fallback
  if (evt.request.mode === 'navigate') {
    evt.respondWith((async () => {
      try {
        const net = await fetch(evt.request);
        const cache = await caches.open(CACHE);
        cache.put(evt.request, net.clone()).catch(()=>{});
        return net;
      } catch {
        const cached = await caches.match(evt.request);
        return cached || caches.match('./offline.html');
      }
    })());
    return;
  }

  // Sonst: Cache zuerst, dann Netzwerk
  evt.respondWith((async () => {
    const cached = await caches.match(evt.request);
    if (cached) return cached;
    try{
      const net = await fetch(evt.request);
      const cache = await caches.open(CACHE);
      cache.put(evt.request, net.clone()).catch(()=>{});
      return net;
    } catch {
      return new Response('', { status: 504 });
    }
  })());
});