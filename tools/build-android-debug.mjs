import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const androidRoot = resolve(root, 'android');
const gradle = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
const macJava21 = '/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home';
const javaHome = process.env.JAVA_HOME
  || (process.platform === 'darwin' && existsSync(macJava21) ? macJava21 : '');

if (!javaHome) {
  console.error('Java 21을 찾지 못했습니다. JAVA_HOME을 Java 21 경로로 설정해 주세요.');
  process.exit(1);
}

const result = spawnSync(gradle, ['assembleDebug'], {
  cwd: androidRoot,
  env: { ...process.env, JAVA_HOME: javaHome },
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
