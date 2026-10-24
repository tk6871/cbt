import assert from 'node:assert/strict';
import { practicalPrompts } from '../src/cbt/qualificationStudyGuides';
import { createPracticalSearchIndex, matchesPracticalText, searchPracticalPrompts, type PracticalSearchOptions } from '../src/cbt/practicalSearch';

const before = JSON.stringify(practicalPrompts);
const index = createPracticalSearchIndex(practicalPrompts);
const defaults: PracticalSearchOptions = { query: '', group: 'all', category: 'all', field: 'all' };
const search = (query: string, extra: Partial<PracticalSearchOptions> = {}) => searchPracticalPrompts(index, { ...defaults, ...extra, query });
assert.equal(index.length, practicalPrompts.length);
assert.deepEqual(search('   '), []);
assert.deepEqual(search('unlikely-search-no-match-9xy'), []);
assert.equal(matchesPracticalText('냉매 순환량 COP', '냉매순환량 cop'), true);
assert.equal(matchesPracticalText('냉매 순환량', '냉매 응축기'), false);
assert.deepEqual(search('COP').map(r => r.prompt.id), search('ｃｏｐ').map(r => r.prompt.id));
assert.ok(search('압축기').length > 0);
assert.ok(search('냉매 순환량').length > 0);
for (const group of ['restored', 'public', 'supplement', 'photos', 'foundation', 'drill'] as const) {
  const prompt = practicalPrompts.find(p => p.group === group)!;
  const results = search(prompt.question, { group, field: 'question' });
  assert.ok(results.some(r => r.prompt.id === prompt.id), `${group} source is searchable`);
  assert.ok(results.every(r => r.prompt.group === group));
}
for (const field of ['question', 'answer', 'explanation'] as const) {
  const prompt = practicalPrompts.find(p => p[field].trim().length > 4)!;
  assert.ok(search(prompt[field], { field }).some(r => r.prompt.id === prompt.id));
}
for (const category of new Set(practicalPrompts.map(p => p.category))) {
  const results = search('냉', { category });
  assert.ok(results.every(r => r.prompt.category === category));
}
const round = search('2024 3회');
assert.ok(round.length > 0);
assert.ok(round.every(r => r.prompt.year === 2024 && r.prompt.session === '3'));
const results = search('압축기');
assert.equal(new Set(results.map(r => r.prompt.id)).size, results.length);
assert.equal(JSON.stringify(practicalPrompts), before);
console.log(`PASS: ${index.length}문제 · 6출처 · 위치/분야/회차 · 한글 공백/영문/NFKC · 중복/원본 보존`);
