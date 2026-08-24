import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

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

console.log(`PWA v${version} audit passed: version sync, recovery safety, offline registration chunks, manual calculation expansion.`);
