import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');

function verifyWorkedExampleNotes(original, current, records, rowsKey) {
  const reviewed = new Set(records.filter(row => row.changed && row.file === 'data/textbook-worked-examples.json').map(row => row.id));
  const examples = new Map(JSON.parse(readFileSync('data/textbook-worked-examples.json')).entries.map(row => [row.id, row]));
  const baseline = JSON.parse(original);
  const pages = JSON.parse(current);
  for (const [index, entry] of baseline[rowsKey].entries()) {
    const next = pages[rowsKey][index];
    if (!next || next.pendingReason === entry.pendingReason) continue;
    assert.ok(entry.reviewHold && reviewed.has(entry.workedExampleId), 'Unreviewed textbook hold note');
    const example = examples.get(entry.workedExampleId);
    assert.ok(example?.note && example.note === next.pendingReason, 'Hold note differs from reviewed example');
    entry.pendingReason = example.note;
  }
  assert.deepEqual(pages, baseline, 'Protected textbook positions or fields changed');
}

export function verifyProtectedInputs() {
  const guards = JSON.parse(readFileSync('tools/hansol-direct-boundary-review.json', 'utf8')).preservedFiles;
  const changed = Object.entries(guards).filter(([path, expected]) => digest(readFileSync(path)) !== expected);
  if (changed.length) {
    const review = JSON.parse(readFileSync('docs/explanation-review/2026-11-18/review.json', 'utf8'));
    const reviewedBanks = new Set(review.records.filter(row => row.changed).map(row => row.file));
    for (const [path, expected] of changed) {
      const original = execFileSync('git', ['show', review.baseline + ':' + path], {maxBuffer: 64e6});
      assert.equal(digest(original), expected, path + ': review baseline differs from protected input');
      if (path === 'data/textbook-pages.json' || path === 'data/hansol-book-native-audit.json') {
        const key = path === 'data/textbook-pages.json' ? 'entries' : 'locations';
        verifyWorkedExampleNotes(original, readFileSync(path), review.records, key);
      }
      else assert.ok(reviewedBanks.has(path), path + ': changed without a content review');
    }
    execFileSync(process.execPath, ['tools/validate-explanation-review.mjs'], {stdio: 'pipe'});
  }
  return Object.keys(guards).length;
}
