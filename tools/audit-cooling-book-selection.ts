import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { coolingBookConfirmed, coolingBookFingerprint } from '../src/cbt/coolingBookScope';
import { coolingMidtermItems, coolingSafetyItems, coolingRecordItem, coolingRecordSourceItems, uniqueSchoolItems } from '../src/cbt/schoolQuestionBank';
import { subjectFor, questionId } from '../src/cbt/catalog';
import type { Catalog, QuestionItem } from '../src/cbt/types';
import review from '../data/cooling-midterm-book-review.json' with { type: 'json' };
import manifest from '../data/cooling-midterm-book-verified.json' with { type: 'json' };
const context = { window: {} as Record<string, Catalog> };
for (const key of ['hvac','hvac-hansol']) vm.runInNewContext(fs.readFileSync(`data/${key}.js`,'utf8'),context);
const items: QuestionItem[] = Object.values(context.window).flatMap(c => c.rounds.flatMap(r => r.questions.map(q => ({
  id: questionId(r,q), round: {...r,qualificationKey:c.key}, question:q, subject:subjectFor(r,q),
}))));
const byId = new Map(items.map(i => [i.id,i]));
assert.equal(manifest.entries.length,362);
assert.equal(review.rows.length,589);
assert.equal(review.rows.filter(r => r.status.startsWith('confirmed')).length,362);
assert.equal(review.rows.filter(r => !r.status.startsWith('confirmed')).length,227);
for (const [id,hash] of manifest.entries) {
  const item = byId.get(id)!;
  assert.ok(item, id);
  assert.equal(coolingBookFingerprint(item.question),hash,id);
  assert.ok(coolingBookConfirmed(item),id);
  assert.ok(coolingBookConfirmed(coolingRecordItem(item)),id);
  const q = structuredClone(item.question);
  assert.ok(coolingBookConfirmed({...item,question:q}));
  q.answer = q.answer === 4 ? 1 : q.answer + 1;
  assert.equal(coolingBookConfirmed({...item,question:q}),false,`answer guard ${id}`);
  q.answer = item.question.answer;
  q.choices[0].text += ' changed';
  assert.equal(coolingBookConfirmed({...item,question:q}),false,`same-object option guard ${id}`);
  const imageChanged = {...item.question,images:[...(item.question.images || []),'changed.png']};
  assert.equal(coolingBookConfirmed({...item,question:imageChanged}),false,`figure guard ${id}`);
  assert.ok(coolingBookConfirmed({...item,question:{...item.question,explanation:'additional explanation'}}));
}
const general = coolingMidtermItems(items), safety = coolingSafetyItems(items);
// The old pools and restoration catalogue are untouched; the checkbox is only
// a new-selection filter in CoolingMidterm, never a destructive data migration.
assert.equal(general.length,1123);assert.equal(safety.length,57);
assert.equal(coolingRecordSourceItems(items).length,1920);
assert.equal(uniqueSchoolItems(general).length,758);
assert.equal(uniqueSchoolItems(safety).length,43);
const selected=general.filter(coolingBookConfirmed), selectedSafety=safety.filter(coolingBookConfirmed);
const unknown=manifest.entries.filter(([id])=>![...general,...safety].some(i=>i.id===id));
assert.equal(unknown.length,0,`Confirmed sources missing from original scope: ${JSON.stringify(unknown)}`);
assert.ok(!manifest.entries.some(([id])=>id==='hvac-20100509:22'),'printed answer disagreement excluded');
assert.ok(!manifest.entries.some(([id])=>id==='hvac-20110320:40'),'different medium/gas target excluded');
assert.equal(new Set(review.rows.map(r=>`${r.page}:${r.number}`)).size,589);
console.log(JSON.stringify({general:uniqueSchoolItems(selected).length,generalOriginals:selected.length,
  safety:uniqueSchoolItems(selectedSafety).length,safetyOriginals:selectedSafety.length,
  oldGeneral:758,oldSafety:43,restoration:1920,verified:manifest.entries.length,pending:227},null,2));
