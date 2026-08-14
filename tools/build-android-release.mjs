import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const androidRoot = resolve(root, 'android');
const propertiesFile = resolve(androidRoot, 'signing/keystore.properties');
const gradle = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
const macJava21 = '/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home';
const javaHome = process.env.JAVA_HOME
  || (process.platform === 'darwin' && existsSync(macJava21) ? macJava21 : '');

if (!javaHome) {
  console.error('Java 21을 찾지 못했습니다. JAVA_HOME을 Java 21 경로로 설정해 주세요.');
  process.exit(1);
}

if (!existsSync(propertiesFile)) {
  console.error('릴리스 서명키가 없습니다. 먼저 npm run android:key를 한 번 실행해 주세요.');
  process.exit(1);
}

const properties = Object.fromEntries((await readFile(propertiesFile, 'utf8'))
  .split(/\r?\n/)
  .filter((line) => line && !line.startsWith('#'))
  .map((line) => {
    const index = line.indexOf('=');
    return [line.slice(0, index), line.slice(index + 1)];
  }));
const required = ['keystoreFile', 'keystorePassword', 'keyAlias', 'keyPassword'];
if (required.some((key) => !properties[key]) || !existsSync(properties.keystoreFile)) {
  console.error('Android 서명 설정이 없거나 서명키 파일을 찾지 못했습니다.');
  process.exit(1);
}

const env = {
  ...process.env,
  JAVA_HOME: javaHome,
  ANDROID_KEYSTORE_FILE: properties.keystoreFile,
  ANDROID_KEYSTORE_PASSWORD: properties.keystorePassword,
  ANDROID_KEY_ALIAS: properties.keyAlias,
  ANDROID_KEY_PASSWORD: properties.keyPassword,
};
const build = spawnSync(gradle, ['assembleRelease'], { cwd: androidRoot, env, stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status ?? 1);

const buildGradle = await readFile(resolve(androidRoot, 'app/build.gradle'), 'utf8');
const version = buildGradle.match(/versionName\s+["']([^"']+)["']/)?.[1];
if (!version) {
  console.error('Android versionName을 찾지 못했습니다.');
  process.exit(1);
}

const source = resolve(androidRoot, 'app/build/outputs/apk/release/app-release.apk');
const outputDirectory = resolve(root, 'dist');
const output = resolve(outputDirectory, `industrial-cbt-v${version}.apk`);
await mkdir(outputDirectory, { recursive: true });
await copyFile(source, output);

const sdkRoot = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
const localProperties = resolve(androidRoot, 'local.properties');
const configuredSdk = existsSync(localProperties)
  ? (await readFile(localProperties, 'utf8')).match(/^sdk\.dir=(.+)$/m)?.[1]?.replace(/\\\\/g, '\\')
  : '';
const apksigner = resolve(sdkRoot || configuredSdk || '', 'build-tools/36.0.0/apksigner');
if (apksigner && existsSync(apksigner)) {
  const verify = spawnSync(apksigner, ['verify', '--verbose', '--print-certs', output], {
    env: { ...process.env, JAVA_HOME: javaHome },
    stdio: 'inherit',
  });
  if (verify.status !== 0) process.exit(verify.status ?? 1);
}

console.log(`서명된 Android APK: ${output}`);
