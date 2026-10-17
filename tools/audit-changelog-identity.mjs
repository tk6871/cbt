import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync('data/changelog-vue.js', 'utf8');
const context = { window: {} };
runInNewContext(source, context);
const log = context.window.CBT_CHANGELOG;
const industrial = log.entries.filter(entry => entry.scope === 'industrial');
assert.equal(industrial[0].version, log.versions.industrial);
assert.equal(log.currentVersion, log.versions.industrial);
assert.ok(readFileSync('android/app/build.gradle', 'utf8').includes(`versionName "${log.currentVersion}"`));
for (const date of ['2026.09.10', '2026.10.17']) {
  assert.ok(industrial.some(entry => entry.version === '5.1' && entry.date === date));
}
const count = log.entries.length;
runInNewContext(source, context);
assert.equal(log.entries.length, count, 'Reloading the patch data must not duplicate releases');
console.log(JSON.stringify({ current: log.currentVersion, historicalSameVersionPreserved: true, reloadIdempotent: true }));
