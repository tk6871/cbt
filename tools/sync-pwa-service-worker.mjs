import { copyFile, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const generatedDirectory = resolve(projectRoot, 'modern/pwa-build');
const generatedWorker = resolve(generatedDirectory, 'sw.js');
const publishedWorker = resolve(projectRoot, 'sw.js');

const source = await readFile(generatedWorker, 'utf8');
const cacheVersion = source.match(/unified-industrial-cbt-v(\d+)/)?.[1];
if (!cacheVersion) throw new Error('생성된 서비스워커에서 CBT 캐시 버전을 찾지 못했습니다.');
if (!source.includes(`pwa-v${cacheVersion}.js`) || !source.includes(`workbox-window.prod.es5-v${cacheVersion}.js`)) {
  throw new Error('PWA 등록 청크가 서비스워커 핵심 캐시 목록에서 빠졌습니다.');
}

await copyFile(generatedWorker, publishedWorker);
await rm(generatedDirectory, { recursive: true, force: true });
console.log(`PWA service worker v${cacheVersion} prepared: ${publishedWorker}`);
