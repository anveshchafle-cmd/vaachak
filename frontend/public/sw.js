// Keeps the app shell, offline voice clips and samples on the phone, so Demo mode and the
// offline reader still open with no internet. API calls always go to the network.
const CACHE = 'vaachak-v3';
const PRECACHE = [
  '/',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/silence.wav',
  '/samples/audio/scam.mr.wav',
  '/samples/audio/expired.mr.wav',
  '/samples/audio/low-confidence.mr.wav',
  '/samples/audio/scam.hi.wav',
  '/samples/audio/expired.hi.wav',
  '/samples/audio/low-confidence.hi.wav',
  '/samples/electricity-bill.wav',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  // Every page load (including shared ?text=... links) is the same single-page app, cached as '/'.
  const key = e.request.mode === 'navigate' ? '/' : e.request;
  // Built files have a content hash in their name and never change, so the phone's copy is used
  // right away (the app opens instantly on a slow connection).
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(e.request).then(
        (hit) =>
          hit ||
          fetch(e.request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(e.request, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }
  // Network first, so new deploys show up; fall back to the cache when offline.
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(key, copy));
        }
        return res;
      })
      .catch(() => caches.match(key)),
  );
});
