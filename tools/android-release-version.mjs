import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export function androidReleaseVersion(webRoot) {
  const html = readFileSync(resolve(webRoot, 'index.html'), 'utf8');
  const changelog = readFileSync(resolve(webRoot, 'data/changelog-vue.js'), 'utf8');
  const versionCode = Number(html.match(/data-entry="modern\/cbt\.js\?v=(\d+)"/)?.[1]);
  const versionName = changelog.match(/changelog\.currentVersion\s*=\s*['"]([^'"]+)['"]/)?.[1];
  if (!Number.isSafeInteger(versionCode) || versionCode < 1 || versionCode > 2100000000 || !versionName) {
    throw Error('내장 웹의 Android 릴리스 버전을 읽을 수 없습니다.');
  }
  return {versionCode, versionName};
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(JSON.stringify(androidReleaseVersion(process.argv[2])));
}
