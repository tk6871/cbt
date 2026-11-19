import {androidReleaseVersion} from './android-release-version.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync('data/changelog-vue.js', 'utf8');
const context = { window: {} };
runInNewContext(readFileSync('data/changelog.js', 'utf8'), context);
runInNewContext(source, context);
const log = context.window.CBT_CHANGELOG;
const industrial = log.entries.filter(entry => entry.scope === 'industrial');
assert.equal(industrial[0].version, log.versions.industrial);
assert.equal(log.currentVersion, log.versions.industrial);
const release = androidReleaseVersion('.');
assert.equal(release.versionName, log.currentVersion);
const build = readFileSync('vite.config.ts', 'utf8').match(/const buildVersion = '(\d+)'/);
assert.equal(release.versionCode, Number(build?.[1]));
for (const date of ['2026.09.10', '2026.10.17']) {
  assert.ok(industrial.some(entry => entry.version === '5.1' && entry.date === date));
}
for (const entry of log.entries) {
  assert.match(entry.version, /^\d+\.\d+(?:\.[1-9])?$/, 'Use a major release or a short patch number: ' + entry.version);
}
const count = log.entries.length;
runInNewContext(source, context);
assert.equal(log.entries.length, count, 'Reloading the patch data must not duplicate releases');
console.log(JSON.stringify({ current: log.currentVersion, historicalSameVersionPreserved: true, reloadIdempotent: true }));
