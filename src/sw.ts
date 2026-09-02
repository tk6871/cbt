/// <reference lib="webworker" />

declare const __CBT_BUILD_VERSION__: string;

const worker = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `unified-industrial-cbt-v${__CBT_BUILD_VERSION__}`;
const versionQuery = `v=${__CBT_BUILD_VERSION__}`;
const CORE = [
  './', './index.html', './jewelry.html', './next.html', './recovery.html', './manifest.webmanifest', './jewelry.webmanifest',
  './assets/icons/icon-192.png', './assets/icons/icon-512.png',
  `./data/catalog-index.js?${versionQuery}`, `./data/catalog-bootstrap.js?${versionQuery}`,
  './data/jewelry.js?v=255', './data/changelog.js?v=255', `./data/changelog-vue.js?${versionQuery}`,
  './calculator.html', './calculator.css?v=321', './calculator.js?v=255', './vendor/math.js?v=194',
  './admin.html', './cloud-config.js?v=200', './관리자_방문기록_설정방법.txt',
  `./modern/cbt.css?${versionQuery}`, `./modern/cbt.js?${versionQuery}`, `./modern/mobile.js?${versionQuery}`, './modern/visitor.js?v=255',
  `./modern/chunks/import-wrapper-prod-v${__CBT_BUILD_VERSION__}.js`, `./modern/chunks/index-v${__CBT_BUILD_VERSION__}.js`,
  `./modern/chunks/preload-helper-v${__CBT_BUILD_VERSION__}.js`, `./modern/chunks/web-v${__CBT_BUILD_VERSION__}.js`,
  `./modern/chunks/OptionalFeatureBoundary-v${__CBT_BUILD_VERSION__}.js`, './modern/OptionalFeatureBoundary.css',
  `./modern/chunks/pwa-v${__CBT_BUILD_VERSION__}.js`, `./modern/chunks/workbox-window.prod.es5-v${__CBT_BUILD_VERSION__}.js`,
  './modern/assets/search.worker-BqvfbZXG.js',
];

async function refreshCoreCache(): Promise<void> {
  const cache = await caches.open(CACHE);
  await Promise.all(CORE.map(async (url) => {
    const response = await fetch(url, { cache: 'reload' });
    if (!response.ok) throw new Error(`Failed to cache ${url}`);
    await cache.put(url, response);
  }));
}

worker.addEventListener('install', (event) => {
  // 기존 버전이 실행 중이면 대기 상태를 유지한다. 사용자가 업데이트 적용을
  // 눌렀을 때만 SKIP_WAITING 메시지를 받아 교체해 풀이 중 새로고침을 막는다.
  event.waitUntil(refreshCoreCache());
});

worker.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void worker.skipWaiting();
});

worker.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith('unified-industrial-cbt-') && key !== CACHE)
        .map((key) => caches.delete(key))))
      .then(() => worker.clients.claim()),
  );
});

worker.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith((async (): Promise<Response> => {
    const request = event.request;
    const url = new URL(request.url);
    const sameOrigin = url.origin === worker.location.origin;
    const networkFirst = sameOrigin && (
      url.pathname.endsWith('/')
      || /\/(?:index\.html|jewelry\.html|next\.html|recovery\.html|admin\.html|cloud-config\.js|modern\/(?:cbt|mobile)\.js|modern\/cbt\.css|data\/(?:catalog-index|catalog-bootstrap|changelog(?:-vue)?)\.js)$/.test(url.pathname)
    );

    if (networkFirst) {
      try {
        const response = await fetch(request, { cache: 'no-store' });
        if (response.ok) void (await caches.open(CACHE)).put(request, response.clone());
        return response;
      } catch {
        return (await caches.match(request, { ignoreSearch: true }))
          || (await caches.match('./index.html'))
          || Response.error();
      }
    }

    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && sameOrigin) void (await caches.open(CACHE)).put(request, response.clone());
      return response;
    } catch {
      return (await caches.match('./index.html')) || Response.error();
    }
  })());
});

export {};
