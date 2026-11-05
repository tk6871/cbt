import { readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const generatedDirectory = resolve(projectRoot, 'modern/pwa-build');
const generatedWorker = resolve(generatedDirectory, 'sw.js');
const publishedWorker = resolve(projectRoot, 'sw.js');
const manifestPath = resolve(projectRoot, 'modern/pwa-build-manifest.json');

let source = await readFile(generatedWorker, 'utf8');
const assets = await readdir(resolve(projectRoot, 'modern/assets'));
const searchWorkers = assets.filter((name) => /^search\.worker-[\w-]+\.js$/.test(name));
if (searchWorkers.length !== 1 || !source.includes('__CBT_SEARCH_WORKER__')) {
  throw new Error('검색 워커의 실제 빌드 파일을 하나로 확정하지 못했습니다.');
}
source = source.replaceAll('__CBT_SEARCH_WORKER__', searchWorkers[0]);
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const visited = new Set();
const urls = new Set();
function include(key) {
  if (visited.has(key)) return;
  visited.add(key);
  const chunk=manifest[key];
  if (!chunk) throw new Error(`Missing PWA build entry: ${key}`);
  for (const asset of [chunk.file,...(chunk.css||[])]) {
    if (!['cbt.js','mobile.js','admin.js','visitor.js','cbt.css','admin.css'].includes(asset)) urls.add(`./modern/${asset}`);
  }
  for(const dependency of chunk.imports||[])include(dependency);
}
for(const file of ['main.ts','mobile.ts','pwa.ts','StudySettings.vue','ThemeStudio.vue','CloudSyncPanel.vue','SyncRecoveryPanel.vue','SchoolExamManager.vue','CoolingMidterm.vue','PracticalTrainingTools.vue']) {
  const key=`src/cbt/${file}`;
  const name=file.replace(/\.(?:vue|ts)$/,'');
  include(manifest[key]?key:Object.keys(manifest).find(id=>manifest[id].name===name&&manifest[id].isDynamicEntry) || key);
}
for(const key of manifest['src/cbt/pwa.ts'].dynamicImports||[])include(key);
const marker = /["']\.\/modern\/__CBT_STATIC_CHUNKS__["']/;
if(!marker.test(source)) throw new Error('PWA dependency placeholder missing');
source=source.replace(marker,[...urls].sort().map(url=>JSON.stringify(url)).join(','));
const cacheVersion = source.match(/unified-industrial-cbt-v(\d+)/)?.[1];
if (!cacheVersion) throw new Error('생성된 서비스워커에서 CBT 캐시 버전을 찾지 못했습니다.');
if (!source.includes(`pwa-v${cacheVersion}.js`) || !source.includes(`workbox-window.prod.es5-v${cacheVersion}.js`)) {
  throw new Error('PWA 등록 청크가 서비스워커 핵심 캐시 목록에서 빠졌습니다.');
}

await writeFile(publishedWorker, source);
await rm(manifestPath);
await rm(generatedDirectory, { recursive: true, force: true });
console.log(`PWA service worker v${cacheVersion} prepared: ${publishedWorker}`);
