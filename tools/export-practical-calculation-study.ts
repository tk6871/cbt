import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { practicalPrompts } from '../src/cbt/qualificationStudyGuides';
import { calculationPrompts, calculationLesson, practicalCalculationLessons, practicalSiBasics, practicalCalculationReferences, practicalExamFamilies, practicalExamFamiliesFor, orderPracticalCalculations, practicalAbsoluteTemperatureExample } from '../src/cbt/practicalCalculations';
import { practicalMockSlots } from '../src/cbt/practicalMock';
import { practicalFormulaSummary } from '../src/cbt/practicalFormulaSummary';
import { practicalSourceLabel } from '../src/cbt/practicalLabels';
import { fractionFormula, fractionBasics } from '../src/cbt/practicalFractions';

const prompts = orderPracticalCalculations(calculationPrompts(practicalPrompts));
assert.equal(prompts.length, Object.keys(practicalCalculationLessons).length, 'All lesson IDs must resolve to bank items');
assert.equal(new Set(prompts.map(p => p.id)).size, prompts.length);
for (const p of practicalPrompts.filter(p => p.category === 'calculation')) assert.ok(calculationLesson(p), p.id);
for (const slot of practicalMockSlots.filter(s => s.kind === 'calculation' || s.kind === 'formula')) {
  const p = practicalPrompts.find(p => p.group === 'restored' && `${p.year}-${p.session}` === slot.round && p.number === slot.number)!;
  assert.ok(p && calculationLesson(p), `Reviewed mock slot omitted: ${slot.id}`);
}
const rows = prompts.map(prompt => {
  const lesson = calculationLesson(prompt)!;
  assert.ok(lesson.symbols.length && lesson.steps.length && lesson.units.length && lesson.why && lesson.memory, prompt.id);
  if (lesson.kind === 'numeric') assert.ok(lesson.examAnswer && lesson.rounding, prompt.id);
  assert.ok(lesson.numberSelection?.used && lesson.numberSelection.condition, `Missing number-selection review: ${prompt.id}`);
  for (const image of [prompt.image, ...(prompt.images || [])].filter((x): x is string => Boolean(x))) assert.ok(existsSync(resolve(image)), image);
  if (lesson.formula.includes('÷')) assert.ok(fractionFormula(lesson.formula).length, `Missing fraction formula: ${prompt.id}`);
  return { prompt, sourceLabel:practicalSourceLabel(prompt), lesson: { ...lesson, formulaFractions:fractionFormula(lesson.formula) }, examFamilies:practicalExamFamiliesFor(prompt) };
});
assert.equal(rows.filter(r => r.examFamilies.length).length,13);
for (const family of practicalExamFamilies) assert.ok(rows.some(r => r.examFamilies.includes(family.key)),family.key);
const path = resolve(process.argv[2] || 'tmp/pdfs/practical-calculation-study.json');
mkdirSync(dirname(path), { recursive:true });
assert.equal(practicalFormulaSummary.length, 10);
assert.equal(new Set(practicalFormulaSummary.map(f => f.key)).size, 10);
writeFileSync(path, JSON.stringify({ date:'2026-10-25', temperatureExample:practicalAbsoluteTemperatureExample, basics:practicalSiBasics, fractionBasics, formulaSummary:practicalFormulaSummary.map(item => ({ ...item, formulaFractions:fractionFormula(item.formula) })), references:practicalCalculationReferences, examFamilies:practicalExamFamilies.map(item => ({ ...item, formulaFractions:fractionFormula(item.formula) })), rows }, null, 2));
console.log(JSON.stringify({ path, total:rows.length, numeric:rows.filter(r => r.lesson.kind === 'numeric').length, formula:rows.filter(r => r.lesson.kind === 'formula').length, restored:rows.filter(r => r.prompt.group === 'restored').length, mockCalculationAndFormulaCoverage:'pass' }));
