import { readFile, readdir, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFile(resolve(root, path), 'utf8');
const [viteConfig, worker, workerSource, recovery, index, jewelry, packageJson, questionCard] = await Promise.all([
  read('vite.config.ts'),
  read('sw.js'),
  read('src/sw.ts'),
  read('recovery.html'),
  read('index.html'),
  read('jewelry.html'),
  read('package.json'),
  read('src/cbt/QuestionCard.vue'),
]);

const version = viteConfig.match(/const buildVersion = '(\d+)'/)?.[1];
if (!version) throw new Error('vite.config.ts에서 PWA 빌드 버전을 찾지 못했습니다.');

const requiredWorkerValues = [
  `unified-industrial-cbt-v${version}`,
  `pwa-v${version}.js`,
  `workbox-window.prod.es5-v${version}.js`,
  'catalog-bootstrap.js?',
  'cbt.js?',
];
requiredWorkerValues.forEach((value) => {
  if (!worker.includes(value)) throw new Error(`서비스워커 필수 항목 누락: ${value}`);
});

if (worker.includes('__CBT_BUILD_VERSION__')) throw new Error('서비스워커 빌드 버전 치환이 끝나지 않았습니다.');
if (worker.includes('__CBT_SEARCH_WORKER__')) throw new Error('검색 워커의 빌드 경로 치환이 끝나지 않았습니다.');
if (!worker.includes(`"v=${version}"`)) throw new Error('서비스워커의 쿼리 버전이 배포 버전과 다릅니다.');
if (/event\.waitUntil\(refreshCoreCache\(\)\.then\([^\n]*skipWaiting/.test(workerSource)) {
  throw new Error('서비스워커가 사용자 확인 전에 새 버전을 강제로 활성화합니다.');
}
if (!index.includes(`cbt.js?v=${version}`) || !jewelry.includes(`cbt.js?v=${version}`)) {
  throw new Error('홈 화면과 서비스워커의 배포 버전이 다릅니다.');
}
if (!recovery.includes("key.startsWith('unified-industrial-cbt-')")) {
  throw new Error('복구 화면이 CBT 캐시만 골라 지우지 않습니다.');
}
if (/localStorage\.clear|indexedDB\.deleteDatabase/.test(recovery)) {
  throw new Error('복구 화면에서 사용자 학습 기록을 지우는 코드가 감지됐습니다.');
}
if (!packageJson.includes('"vite-plugin-pwa": "1.3.0"') || !packageJson.includes('"workbox-window": "7.4.1"')) {
  throw new Error('검증한 PWA 의존성 버전이 고정되지 않았습니다.');
}
if (!questionCard.includes('beginnerCalculationOpen.value = false;')) {
  throw new Error('쉽게 풀어보기의 기본 닫힘 설정이 빠졌습니다.');
}

await access(resolve(root, 'modern/cbt.css'));
for (const file of await readdir(resolve(root, 'modern'))) {
  if (file.endsWith('.css') && !['cbt.css', 'admin.css'].includes(file) && !file.endsWith(`-v${version}.css`)) {
    throw new Error(`분리 CSS가 버전 없는 주소를 사용합니다: ${file}`);
  }
}
for (const document of ['index.html', 'jewelry.html', 'admin.html']) {
  const html = await read(document);
  if (document === 'admin.html' && (!html.includes(`admin.js?v=${version}`) || !html.includes(`admin.css?v=${version}`))) {
    throw new Error('관리 진입점의 코드·CSS 버전이 배포 버전과 다릅니다.');
  }
  for (const match of html.matchAll(/href="(modern\/[^"?]+\.css)(?:\?[^" ]*)?"/g)) {
    await access(resolve(root, match[1]));
  }
}
// Exercise only the install callback with filesystem-backed fetches. A removed
// lazy component must not leave a stale URL that prevents SW installation.
const workerEvents = new Map();
let installation;
runInNewContext(worker, {
  self: { addEventListener: (type, callback) => workerEvents.set(type, callback) },
  caches: { open: async () => ({ put: async () => {} }) },
  fetch: async (url) => {
    const path = url.split('?')[0];
    await access(resolve(root, path === './' ? 'index.html' : path));
    return { ok: true };
  },
});
workerEvents.get('install')({ waitUntil: promise => { installation = promise; } });
await installation;
await access(resolve(root, `modern/chunks/main-v${version}.js`));
for (const file of await readdir(resolve(root, 'modern/chunks'))) {
  if (!file.endsWith('.js')) continue;
  const source = await read(`modern/chunks/${file}`);
  for (const match of source.matchAll(/\.\.\/([^"']+\.css)/g)) {
    // Entry CSS is linked with the build query and explicitly network-first.
    if (!['cbt.css', 'admin.css'].includes(match[1]) && !match[1].endsWith(`-v${version}.css`)) throw new Error(`이전 CSS 캐시 혼합 위험: ${file} → ${match[1]}`);
  }
  if (/from["']\.\.\/(?:cbt|mobile)\.js["']/.test(source)) {
    throw new Error(`앱 중복 실행 위험: ${file}이 버전 없는 앱 진입점을 다시 가져옵니다.`);
  }
}

console.log(`PWA v${version} audit passed: version sync, recovery safety, offline registration chunks, manual calculation expansion.`);
