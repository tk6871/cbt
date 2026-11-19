import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {androidReleaseVersion} from './android-release-version.mjs';

const root = resolve(import.meta.dirname, '..');
const staged = resolve(root, 'android/app/src/main/assets/public');
const webRoot = existsSync(resolve(staged, 'index.html')) ? staged : root;
const {versionName} = androidReleaseVersion(webRoot);
const apk = resolve(root, 'dist', `industrial-cbt-v${versionName}.apk`);

if (!existsSync(apk)) throw new Error(`서명 APK를 먼저 빌드하세요 (npm run android:release). 필요한 파일: ${apk}`);
execFileSync('adb', ['install', '-r', apk], {stdio:'inherit'});
