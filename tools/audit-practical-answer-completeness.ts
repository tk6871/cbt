import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { practicalPrompts } from '../src/cbt/qualificationStudyGuides';
import { curatedPracticalAnswers, completePracticalPublicAnswer } from '../src/cbt/hvacPracticalPublicAnswers';
import { practicalIssueSnapshot } from '../src/cbt/practicalIssue';
import repairs from '../data/hvac-practical-crop-repairs-20261016.json' with { type: 'json' };
const hash = (path: string) => crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
assert.equal(practicalPrompts.length, 572);
assert.equal(new Set(practicalPrompts.map(p => p.id)).size, 572);
const byId = new Map(practicalPrompts.map(p => [p.id, p]));
let expanded = 0;
for (let number = 1; number <= 47; number++) {
  const answer = completePracticalPublicAnswer(number);
  assert.ok(answer.startsWith('명칭:') || [6,41,42].includes(number));
  if (![6,41,42].includes(number)) {
    assert.ok(answer.includes('\n'), `public ${number} needs a descriptive part`);
    assert.ok(answer.length > curatedPracticalAnswers[number].answer.length);
    expanded++;
  }
  assert.equal(byId.get(`moducbt-hvac-practical-${number}`)!.answer, answer);
}
assert.match(byId.get('moducbt-hvac-practical-10')!.answer, /터보 압축기[\s\S]*특징:[\s\S]*원리:/);
assert.match(byId.get('hvac-practical-photo-20260917-010')!.answer, /특징:/);
assert.match(byId.get('hvac-practical-photo-20260917-004')!.answer, /과부하.*(?:아니|제외)|분해/);
assert.match(byId.get('hvac-practical-photo-20260917-086')!.answer, /회수용 용기/);
for (const [i,prompt] of practicalPrompts.entries()) {
  assert.ok(prompt.answer.trim() && prompt.explanation.trim(), prompt.id);
  const payload = practicalIssueSnapshot(prompt, i+1);
  assert.equal(payload.question_id, prompt.id);
  assert.ok(payload.question_number > 0 && Number.isInteger(payload.question_number));
  assert.ok(payload.question_text!.length <= 5000);
  assert.equal(payload.configured_answer, undefined, 'written answer must not become a 1..4 answer');
  for (const image of [prompt.image, ...(prompt.images || []), ...(prompt.answerImages || [])].filter(Boolean)) assert.ok(fs.existsSync(image!), image);
}
assert.equal(repairs.repairs.length, 10);
for (const repair of repairs.repairs) {
  assert.equal(hash(repair.oldImage), repair.oldSha256, 'original asset retained');
  assert.equal(hash(repair.output), repair.sha256);
  assert.ok(byId.get(repair.id)!.images?.includes(repair.output), 'runtime repair connected');
  assert.ok(!byId.get(repair.id)!.images?.includes(repair.oldImage));
}
const app = fs.readFileSync('src/cbt/App.vue','utf8');
assert.ok(app.includes('class="practical-explanation" open'), 'explanation defaults open only after answer reveal');
assert.ok(app.includes('<PracticalIssueReport :prompt="prompt"'), 'all rendered practical prompts have report controls');
const multi = practicalPrompts.filter(p => /명칭.{0,12}(?:특징|목적|역할|용도|원리|기능)/.test(p.question));
const shortCandidates = multi.filter(p => p.answer.length < 20).map(p=>({id:p.id,question:p.question,answer:p.answer}));
assert.deepEqual(shortCandidates, [], 'compound request with only a short name');
console.log(JSON.stringify({prompts:572,publicExpanded:expanded,compoundStems:multi.length,shortCandidates,cropRepairs:10,payloadChecks:572},null,2));
