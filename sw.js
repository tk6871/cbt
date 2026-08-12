const CACHE = 'unified-industrial-cbt-v264';
const CORE = [
  './', './index.html', './jewelry.html', './legacy.html', './next.html', './manifest.webmanifest', './jewelry.webmanifest',
  './assets/icons/icon-192.png', './assets/icons/icon-512.png',
  './data/hvac.js?v=255', './data/safety.js?v=255', './data/energy.js?v=255', './data/energy-engineer.js?v=255',
  './data/maintenance.js?v=255', './data/jewelry.js?v=255', './data/changelog.js?v=255', './data/changelog-vue.js?v=264',
  './calculator.html', './calculator.css?v=255', './calculator.js?v=255', './vendor/math.js?v=194',
  './admin.html', './cloud-config.js?v=200', './관리자_방문기록_설정방법.txt',
  './app.css?v=255', './app.js?v=255',
  './modern/cbt.css?v=258', './modern/cbt.js?v=264', './modern/visitor.js?v=255',
  './modern/chunks/import-wrapper-prod.js', './modern/chunks/index.js',
  './modern/assets/search.worker-BqvfbZXG.js'
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
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('activate', (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('unified-industrial-cbt-') && key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith((async () => {
    const request = event.request;
    const url = new URL(request.url);
    const sameOrigin = url.origin === location.origin;
    const networkFirst = sameOrigin && (url.pathname.endsWith('/') || /\/(?:index\.html|jewelry\.html|legacy\.html|next\.html|admin\.html|cloud-config\.js|app\.css|app\.js|modern\/cbt\.css|modern\/cbt\.js|data\/changelog(?:-vue)?\.js)$/.test(url.pathname));
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
