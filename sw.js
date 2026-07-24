const CACHE = 'unified-industrial-cbt-v183';
const CORE = [
  './', './index.html', './app.css?v=183', './app.js?v=183', './manifest.webmanifest',
  './assets/icons/icon-192.png', './assets/icons/icon-512.png',
  './data/hvac.js', './data/safety.js', './data/energy.js', './data/maintenance.js', './data/jewelry.js?v=183', './data/changelog.js?v=183'
];
async function refreshCoreCache() {
  const cache = await caches.open(CACHE);
  await Promise.all(CORE.map(async (url) => {
    const response = await fetch(url, { cache: 'reload' });
    if (!response.ok) throw new Error(`Failed to cache ${url}`);
    await cache.put(url, response);
  }));
}
self.addEventListener('install', (event) => event.waitUntil(refreshCoreCache().then(() => self.skipWaiting())));
self.addEventListener('activate', (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('unified-industrial-cbt-') && key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith((async () => {
    const request = event.request;
    const url = new URL(request.url);
    const sameOrigin = url.origin === location.origin;
    const networkFirst = sameOrigin && (url.pathname.endsWith('/') || /\/(?:index\.html|app\.css|app\.js|data\/changelog\.js)$/.test(url.pathname));
    if (networkFirst) {
      try {
        const response = await fetch(request, { cache: 'no-store' });
        if (response.ok) (await caches.open(CACHE)).put(request, response.clone());
        return response;
      } catch (error) {
        return (await caches.match(request, { ignoreSearch: true })) || caches.match('./index.html');
      }
    }
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && sameOrigin) (await caches.open(CACHE)).put(request, response.clone());
      return response;
    } catch (error) {
      return caches.match('./index.html');
    }
  })());
});
