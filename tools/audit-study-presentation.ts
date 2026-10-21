import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { practicalFormulaSummary } from '../src/cbt/practicalFormulaSummary';
import katex from 'katex';
import { fractionFormula, fractionTex, fractionText, fractionBasics, fractionsForProblem } from '../src/cbt/practicalFractions';
import { practicalCalculationLessons } from '../src/cbt/practicalCalculations';
import { pageItems } from '../src/cbt/listPresentation';
import { practicalSourceLabel } from '../src/cbt/practicalLabels';
import { practicalPrompts } from '../src/cbt/qualificationStudyGuides';
import { adminViewLabel, issueImageUrl, issueTypeLabel, issueStatusLabel, seoulDayStart, resultModeLabel, resultResponseLabel, paginate } from '../src/admin/presentation';

assert.deepEqual(practicalFormulaSummary.slice(0,5).map(f => f.key), ['cgt','cr','cop','bf','affinity']);
assert.equal(new Set(practicalFormulaSummary.map(f => f.key)).size, 10);
for (const f of practicalFormulaSummary) for (const field of ['title','formula','when','symbols','remember'] as const) assert.ok(f[field].trim(), `${f.key}.${field}`);
for (const item of [...practicalFormulaSummary, ...Object.values(practicalCalculationLessons)]) {
  const rows = fractionFormula(item.formula);
  if (item.formula.includes('÷')) assert.ok(rows.length, `Fraction layout missing: ${item.formula}`);
  for (const row of rows) {
    const markup = katex.renderToString(fractionTex(row.parts), { throwOnError:true, strict:'ignore' });
    assert.ok(markup.includes('katex'));
  }
}
for (const prompt of practicalPrompts) for (const row of fractionsForProblem(prompt.id)) {
  assert.ok(katex.renderToString(fractionTex(row.parts),{throwOnError:true,strict:'ignore'}).includes('mfrac'));
}
assert.match(fractionText(fractionBasics[1].parts), /\(24\) ÷ \(2 × 3\)/);
assert.equal(24/(2*3),4);
assert.equal(24/2*3,36);
assert.equal((400-250)/(450-400),3);
assert.ok(Math.abs(9800*(1500/3600)*10/(1000*.7)-58.3333333333)<1e-8);
// Arithmetic examples and the unit-scaled pump formula used in the recall sheet.
assert.equal(2 * 4.18 * 5, 41.8);
assert.equal(2 * 335, 670);
assert.equal(12 / 3, 4);
assert.equal((18 - 10) / (30 - 10), .4);
assert.deepEqual([2, 2 ** 2, 2 ** 3], [2,4,8]);
assert.equal(9800 * .01 * 20 / (1000 * .7), 2.8);
for (const prompt of practicalPrompts) assert.doesNotMatch(practicalSourceLabel(prompt), /undefined|null/);
assert.equal(adminViewLabel('next-guide'), '시험 자료실');
assert.equal(adminViewLabel('next-showcase'), '신기술 체험관');
assert.equal(issueImageUrl('assets/question.png'), './assets/question.png');
assert.equal(issueImageUrl('./assets/question.png'), './assets/question.png');
for (const path of [null,'','../assets/q.png','https://example.test/q.png','assets/../q.png','assets/q.png?x','assets\\q.png']) assert.equal(issueImageUrl(path), undefined);
assert.equal(issueTypeLabel('missing-image'), '그림 없음');
assert.equal(issueStatusLabel('resolved'), '수정 완료');
assert.equal(new Date(seoulDayStart(Date.parse('2026-10-18T15:01:00Z'))).toISOString(), '2026-10-18T15:00:00.000Z');
assert.equal(resultModeLabel('exam'), 'CBT');
assert.equal(resultResponseLabel(2), '미응답 2문제 포함');
const rows = Array.from({ length: 1000 }, (_,i) => i);
assert.equal(paginate(rows, 1).rows.length, 50);
assert.equal(paginate(rows, 20).rows.at(-1), 999);
assert.equal(paginate(rows, 21).page, 20);
assert.deepEqual(paginate([], 9), { page:1, pageCount:1, rows:[] });
const main = readFileSync('src/cbt/App.vue','utf8');
for (const count of [0,1,39,40,41,434]) {
  const input = Array.from({length:count},(_,i)=>i);
  const pages = pageItems(input,1).pages;
  const output = Array.from({length:pages},(_,i)=>pageItems(input,i+1).rows).flat();
  assert.deepEqual(output,input);
  assert.equal(pageItems(input,999).page,pages);
}
assert.ok(main.includes('v-for="item in calculationPagination.rows"'));
assert.ok(main.includes('v-if="filteredCalculationRows.length" class="library-pagination"'));
assert.ok(main.includes("weakRows.value.length ? '취약 문제 집중' : '기초 진단 학습'"));
assert.ok(main.includes("!row.answered ? '미진단'"));
assert.ok(main.includes("coachHasEvidence ? predictedScore : '—'"));
console.log('PASS: 10 recall formulas, arithmetic examples, source labels, safe image links, Korea date, 1000-row pagination and no-record display guards');
