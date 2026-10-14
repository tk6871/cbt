import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { orderCoolingSimilar, coolingOrderConcept } from '../src/cbt/coolingSimilarOrder';
import { coolingMidtermItems, coolingSafetyItems, coolingTopicGroups, coolingSectionGroups, uniqueSchoolItems, coolingTopic, coolingBookSection } from '../src/cbt/schoolQuestionBank';
import { coolingBookConfirmed } from '../src/cbt/coolingBookScope';
import { coolingCalculation, coolingPracticeSelection } from '../src/cbt/coolingPractice';
import { questionId, subjectFor } from '../src/cbt/catalog';
import type { Catalog, QuestionItem } from '../src/cbt/types';

const context = { window: {} as Record<string, Catalog> };
for (const key of ['hvac', 'hvac-hansol']) vm.runInNewContext(fs.readFileSync(`data/${key}.js`, 'utf8'), context);
const items: QuestionItem[] = Object.values(context.window).flatMap(c => c.rounds.flatMap(r => r.questions.map(q => ({
  id: questionId(r, q), round: { ...r, qualificationKey: c.key }, question: q, subject: subjectFor(r, q),
}))));
const before = JSON.stringify(items);
const base = items[0];
const mock = (id: string, text: string): QuestionItem => ({ ...base, id, question: { ...base.question, text, html: undefined, ocrText: undefined, choices: [{ text: '브라인' }, { text: '압축기' }, {}, {}] } });
const scattered = [mock('brine1', '브라인의 구비조건은?'), mock('oil', '냉동기유의 성질은?'), mock('brine2', '브라인의 농도가 높을 때 성질은?'), mock('unknown', '다음 설명 중 옳은 것은?'), mock('brine3', '브라인의 동결온도는?')];
assert.equal(coolingOrderConcept(scattered[3]), undefined, 'choices must not classify the stem');
assert.deepEqual(orderCoolingSimilar(scattered).filter(i => i.id.startsWith('brine')).map(i => i.id).sort(), ['brine1', 'brine2', 'brine3']);
assert.deepEqual(orderCoolingSimilar([]), []);
assert.deepEqual(orderCoolingSimilar([base]), [base]);
const numeric = [mock('n1', '진공압 300mmHg의 절대압력은?'), mock('n2', '진공압 400mmHg의 절대압력은?')];
assert.equal(orderCoolingSimilar(numeric).length, 2, 'keep numerical variants');
let selections = 0;
function check(input: QuestionItem[]): void {
  const originalIds = input.map(i => i.id);
  const ordered = orderCoolingSimilar(input);
  assert.deepEqual(input.map(i => i.id), originalIds, 'must not mutate input order');
  assert.deepEqual(ordered.map(i => i.id).sort(), [...originalIds].sort(), 'exact ID multiset');
  const remaining = input.slice();
  for (const item of ordered) {
    const index = remaining.indexOf(item);
    assert.ok(index >= 0, 'reuse exact original objects, including repeats');
    remaining.splice(index, 1);
  }
  assert.deepEqual(orderCoolingSimilar(input).map(i => i.id), ordered.map(i => i.id), 'deterministic');
  const positions = new Map<string, number[]>();
  ordered.forEach((item, i) => {
    const concept = coolingOrderConcept(item);
    if (!concept) return;
    const chapter = coolingTopic(item);
    const key = `${chapter}:${coolingBookSection(item, chapter)}:${concept}`;
    positions.set(key, [...(positions.get(key) || []), i]);
  });
  for (const indexes of positions.values()) assert.equal(indexes.at(-1)! - indexes[0] + 1, indexes.length, 'same section/concept contiguous');
  selections++;
}
check(scattered); check(numeric); check([base, base]);
const stats = [];
for (const bookOnly of [true, false]) {
  const general = coolingMidtermItems(items).filter(i => !bookOnly || coolingBookConfirmed(i));
  const pool = uniqueSchoolItems(general);
  const safety = uniqueSchoolItems(coolingSafetyItems(items).filter(i => !bookOnly || coolingBookConfirmed(i)));
  assert.equal(pool.length, bookOnly ? 316 : 758);
  assert.equal(safety.length, bookOnly ? 24 : 43);
  check(pool); check(safety);
  for (const calculationCount of [undefined, 5]) {
    const draw = coolingPracticeSelection(pool, 20, calculationCount, () => 0.37);
    check(draw);
    const grouped = orderCoolingSimilar(draw);
    assert.equal(grouped.length, 20, 'random count unchanged');
    if (calculationCount !== undefined) assert.equal(grouped.filter(coolingCalculation).length, 5, 'calculation quota unchanged');
    assert.deepEqual(grouped.map(i => i.id).sort(), draw.map(i => i.id).sort(), 'group only sampled IDs');
  }
  for (const group of coolingTopicGroups(general)) {
    check(group.items);
    for (const section of coolingSectionGroups(group)) check(section.items);
  }
  const brine = orderCoolingSimilar(pool).filter(i => coolingOrderConcept(i) === '브라인');
  stats.push({ bookOnly, general: pool.length, safety: safety.length, recognizedStems: pool.filter(i => coolingOrderConcept(i)).length,
    brine: brine.map(i => ({ id: i.id, stem: (i.question.text || i.question.ocrText || '').slice(0, 95) })) });
}
assert.equal(JSON.stringify(items), before, 'entire source question/answer/image data untouched');
const component = fs.readFileSync('src/cbt/CoolingMidterm.vue', 'utf8');
const random = component.slice(component.indexOf('function startRandom('), component.indexOf('function resumeForGroup('));
assert.ok(!random.includes('orderCoolingSimilar') && random.includes('groupRandom: groupRandom.value'), 'sampling precedes optional ordering');
const app = fs.readFileSync('src/cbt/App.vue', 'utf8');
const start = app.slice(app.indexOf('async function startCoolingMidterm('), app.indexOf('function isMidtermCalculation('));
assert.ok(start.includes('if (payload.randomCount && payload.groupRandom) items = orderCoolingSimilar(items)'), 'random reordering is opt-in');
assert.ok(start.indexOf('coolingPracticeSelection(') < start.indexOf('orderCoolingSimilar('), 'sample first');
assert.ok(component.includes('savedPreferences.groupRandom === true'), 'random grouping defaults off');
assert.ok(component.includes("emit('resume',") && component.includes("emit('replay',"), 'saved order paths remain separate');
assert.ok(component.includes("savedPreferences.questionOrder === 'original' ? 'original' : 'similar'"), 'default similar / original persists');
console.log(JSON.stringify({ selections, stats }, null, 2));
