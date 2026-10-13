// Kebab Klikacz 2 — service worker (tryb offline)
const CACHE = 'kebab-klikacz-v3.33';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
const CDN = [
  'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.15/hls.min.js',
  'https://fonts.googleapis.com/css2?family=Rubik+Dirt&family=Rubik:wght@400;600;800&family=Press+Start+2P&display=swap'
];
// tych adresów NIGDY nie przechwytujemy (logowanie, ranking, AI, maile)
const BYPASS = /firebaseio\.com|firebasedatabase\.app|identitytoolkit\.googleapis\.com|securetoken\.googleapis\.com|api\.anthropic\.com|api\.emailjs\.com/;

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(CORE.map(u => c.add(u).catch(() => {})));
    await Promise.all(CDN.map(u => c.add(new Request(u, { mode: 'no-cors' })).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (BYPASS.test(url.hostname)) return;
  if (req.headers.has('range') || req.destination === 'audio' || req.destination === 'video') return; // radio
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return;

  // strona: najpierw sieć (świeża wersja), offline -> z pamięci
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); }
      return res;
    }).catch(async () => (await caches.match('./index.html')) || (await caches.match('./')) || Response.error()));
    return;
  }

  // reszta: z pamięci, w tle odświeżana
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => hit);
    return hit || net;
  }));
});
