import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { loadCatalogs, questionItems, subjectsForScope } from '../src/cbt/catalog';
import { qualificationRuleFor } from '../src/cbt/qualificationRules';
const context = { window:{} as Record<string,unknown> };
for (const path of ['data/catalog-index.js','data/maintenance.js','data/maintenance-engineer.js']) {
  vm.runInNewContext(fs.readFileSync(path,'utf8'), context);
}
Object.assign(globalThis,{window:context.window});
const bank = loadCatalogs().find(c=>c.key==='maintenance-engineer')!;
assert.equal(bank.rounds.length,27);
assert.equal(questionItems(bank,2006,2022,'all-mapped').length,2660);
assert.equal(subjectsForScope(bank,'all-mapped').length,5);
assert.equal(questionItems(bank,2006,2022,'current').length,160);
assert.equal(subjectsForScope(bank,'current').length,4);
assert.equal(questionItems(bank,2006,2022,'legacy-original').length,2500);
assert.equal(subjectsForScope(bank,'legacy-original').length,5);
assert.equal(questionItems(bank,2022,2022,'legacy-original').length,0);
assert.equal(questionItems(bank,2006,2022,'all-mapped').filter(i=>i.subject==='윤활관리').length,500);
assert.equal(new Set(questionItems(bank,2006,2022,'all-mapped').map(i=>i.id)).size,2660);
assert.equal(loadCatalogs().find(c=>c.key==='maintenance')?.rounds.length,48);
const rule=qualificationRuleFor(bank.key)!;
assert.equal(rule.examMinutes,120); assert.equal(rule.subjectMinimum,40); assert.equal(rule.passScore,60);
console.log('PASS: 기사/산업기사 분리, 전체2660/2022체계160/구체계2500/윤활500, 고유ID·기준');
