/* Heuristics CBT Builder - service worker (offline-first).
   Bump VERSION whenever you upload a new index.html so users get the update. */
const VERSION = 'v3';
const CACHE = 'heuristics-cbt-' + VERSION;
const LOCAL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];
const GSAP = 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js';

self.addEventListener('install', function (e) {
  e.waitUntil((async function () {
    const c = await caches.open(CACHE);
    // Save each file on its own, so one missing file can never stop the install.
    await Promise.all(LOCAL.map(async function (u) {
      try { await c.put(u, await fetch(new Request(u, { cache: 'reload' }))); } catch (err) {}
    }));
    try { await c.put(GSAP, await fetch(new Request(GSAP, { mode: 'no-cors' }))); } catch (err) {}
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', function (e) {
  e.waitUntil((async function () {
    const keys = await caches.keys();
    await Promise.all(keys.filter(function (k) { return k.indexOf('heuristics-cbt-') === 0 && k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith((async function () {
    const cache = await caches.open(CACHE);
    // Opening the app (any page navigation): always serve the saved page.
    if (req.mode === 'navigate') {
      const page = (await cache.match('./index.html')) || (await cache.match('./'));
      if (page) {
        // quietly refresh the saved copy when online
        fetch(new Request('./index.html', { cache: 'reload' })).then(function (r) {
          if (r && r.ok) cache.put('./index.html', r.clone()), cache.put('./', r);
        }).catch(function () {});
        return page;
      }
      try { return await fetch(req); } catch (err) { return new Response('Offline', { status: 503 }); }
    }
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    } catch (err) {
      return new Response('', { status: 504 });
    }
  })());
});
         
