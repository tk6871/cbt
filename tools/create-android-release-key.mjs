import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const signingDirectory = resolve(root, 'android/signing');
const keystoreFile = resolve(signingDirectory, 'industrial-cbt-release.jks');
const propertiesFile = resolve(signingDirectory, 'keystore.properties');
const macJava21 = '/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home';
const javaHome = process.env.JAVA_HOME
  || (process.platform === 'darwin' && existsSync(macJava21) ? macJava21 : '');

if (!javaHome) {
  console.error('Java 21을 찾지 못했습니다. JAVA_HOME을 Java 21 경로로 설정해 주세요.');
  process.exit(1);
}

if (existsSync(keystoreFile) || existsSync(propertiesFile)) {
  console.error('기존 Android 릴리스 서명키가 있습니다. 업데이트 호환성을 위해 새 키로 덮어쓰지 않습니다.');
  process.exit(1);
}

await mkdir(signingDirectory, { recursive: true, mode: 0o700 });
const password = randomBytes(32).toString('base64url');
const alias = 'industrial-cbt';
const keytool = resolve(javaHome, 'bin/keytool');
const result = spawnSync(keytool, [
  '-genkeypair',
  '-v',
  '-keystore', keystoreFile,
  '-storetype', 'PKCS12',
  '-storepass:env', 'CBT_RELEASE_PASSWORD',
  '-keypass:env', 'CBT_RELEASE_PASSWORD',
  '-alias', alias,
  '-keyalg', 'RSA',
  '-keysize', '4096',
  '-validity', '10000',
  '-dname', 'CN=Industrial CBT, O=tk6871, C=KR',
], {
  env: { ...process.env, CBT_RELEASE_PASSWORD: password },
  stdio: 'inherit',
});

if (result.status !== 0) process.exit(result.status ?? 1);

await writeFile(propertiesFile, [
  `keystoreFile=${keystoreFile}`,
  `keystorePassword=${password}`,
  `keyAlias=${alias}`,
  `keyPassword=${password}`,
  '',
].join('\n'), { mode: 0o600 });
await chmod(keystoreFile, 0o600);

console.log('Android 릴리스 서명키를 만들었습니다.');
console.log(`백업 대상 폴더: ${signingDirectory}`);
console.log('이 폴더는 Git에서 제외되며, 분실하면 기존 설치 앱을 같은 서명으로 업데이트할 수 없습니다.');
