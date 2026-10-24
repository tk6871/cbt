import assert from 'node:assert/strict';
import fs from 'node:fs';
import { practicalPrompts } from '../src/cbt/qualificationStudyGuides';
import { practicalMockSlots, practicalMockRounds, buildPracticalPattern, mockSessionPrompts, mockPromptId, validPracticalPattern, practicalPatternSummary, type PracticalPattern } from '../src/cbt/practicalMock';
import { additionalMockCandidate } from '../src/cbt/practicalMockCandidates';
const bankBefore = JSON.stringify(practicalPrompts);
assert.equal(practicalMockSlots.length, 108);
assert.equal(new Set(practicalMockSlots.map(s => s.id)).size, 108);
const counts = (kinds: string[]) => kinds.reduce<Record<string, number>>((a,k)=>(a[k]=(a[k]||0)+1,a),{});
let state = 59;
const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
const ids = new Set<string>();
const additionalIds = new Set<string>(), olderPhotoIds = new Set<string>();
for (const round of practicalMockRounds) {
  const slots = practicalMockSlots.filter(s => s.round === round);
  assert.equal(slots.length,12);
  for (let i=0;i<300;i++) {
    const draw = buildPracticalPattern(practicalPrompts, random, round);
    assert.equal(draw.prompts.length,12);
    assert.equal(new Set(draw.prompts.map(p=>p.id)).size,12);
    assert.equal(new Set(draw.topics).size,12);
    assert.deepEqual(counts(draw.kinds),counts(slots.map(s=>s.kind)));
    assert.equal(draw.prompts.reduce((s,p)=>s+p.points,0),60);
    for (const [j,p] of draw.prompts.entries()) {
      ids.add(p.id);
      const slot = practicalMockSlots.find(s=>s.round===`${p.year}-${p.session}` && s.number===p.number && p.group==='restored' && !p.numberLabel);
      assert.equal(draw.kinds[j],slot?.kind || additionalMockCandidate(p)?.kind);
      if(p.group!=='restored') additionalIds.add(p.id);
      if(p.group==='restored' && !slot) { olderPhotoIds.add(p.id); assert.ok(p.image || p.images?.length); assert.ok(p.question.includes('사진')); }
    }
    assert.ok(draw.prompts.some(p=>p.group!=='restored'),'every exam includes additional materials');
    assert.equal(new Set(draw.prompts.map(p=>`${p.question}|${p.answer}`.normalize('NFKC').replace(/\s+/g,''))).size,12);
    const pattern: PracticalPattern = {attempt:`audit-${round}-${i}`,template:round,sourceIds:draw.prompts.map(p=>p.id),kinds:draw.kinds};
    assert.ok(validPracticalPattern(JSON.parse(JSON.stringify(pattern))));
    const copies=mockSessionPrompts(practicalPrompts,pattern);
    assert.equal(copies.length,12);
    copies.forEach((p,j)=>{assert.equal(p.id,mockPromptId(pattern,j));assert.notEqual(p.id,draw.prompts[j].id);assert.deepEqual({...p,id:draw.prompts[j].id},draw.prompts[j]);});
    assert.ok(practicalPatternSummary(pattern.kinds).includes('수치 계산'));
  }
}
assert.ok(practicalMockSlots.every(s=> practicalPrompts.some(p=>ids.has(p.id) && p.group==='restored' && `${p.year}-${p.session}`===s.round && p.number===s.number)),'all108 reviewed sources remain reachable');
assert.ok(additionalIds.size>100,'a broad set of additional sources is reachable');
assert.ok(olderPhotoIds.size>10,'older photo questions are reachable');
assert.equal(practicalMockSlots.filter(s=>s.kind==='calculation').length,17);
assert.equal(practicalMockSlots.filter(s=>s.kind==='sequence').length,17);
assert.equal(practicalMockSlots.filter(s=>s.kind==='formula').length,2);
assert.ok(practicalMockSlots.some(s=>s.round==='2024-1'&&s.number===8&&s.kind==='calculation'));
assert.throws(()=>buildPracticalPattern(practicalPrompts.filter(p=>p.id!=='hvac-practical-restored-2026-1-05')));
assert.throws(()=>buildPracticalPattern(practicalPrompts,random,'1900-1'));
assert.ok(!validPracticalPattern({}));
assert.ok(!validPracticalPattern({attempt:'foreign',template:'2023-3',sourceIds:Array.from({length:12},(_,i)=>`foreign-${i}`),kinds:Array(12).fill('device')}));
const legacy: PracticalPattern={attempt:'legacy',template:'2023-3',sourceIds:practicalMockSlots.filter(s=>s.round==='2023-3').map(s=>practicalPrompts.find(p=>p.group==='restored' && `${p.year}-${p.session}`===s.round && p.number===s.number)!.id),kinds:practicalMockSlots.filter(s=>s.round==='2023-3').map(s=>s.kind)};
assert.ok(validPracticalPattern(legacy)); assert.equal(mockSessionPrompts(practicalPrompts,legacy).length,12);
assert.equal(additionalMockCandidate(practicalPrompts.find(p=>p.id==='hvac-practical-photo-20260917-001')!)?.topic,additionalMockCandidate(practicalPrompts.find(p=>p.id==='moducbt-hvac-practical-1')!)?.topic);
const motion=practicalPrompts.find(p=>p.id==='hvac-practical-restored-2022-3-01')!;
assert.equal(additionalMockCandidate(motion),null,'older motion-only tasks are not admitted as photos');
for (const p of practicalPrompts.filter(p=>ids.has(p.id))) for(const image of [p.image,...(p.images||[]),...(p.answerImages||[])].filter(Boolean)) assert.ok(fs.existsSync(image!),`missing ${image}`);
assert.equal(JSON.stringify(practicalPrompts),bankBefore,'source bank is never changed');
const app=fs.readFileSync('src/cbt/App.vue','utf8');
assert.ok(app.includes('!practicalExamLocked && practicalStudyMode'));
assert.ok(app.includes("(!practicalExamLocked && practicalStudyMode === 'memorize') || practicalAnswerRevealed(prompt.id)"));
assert.ok(app.includes('viewedAnswerIds: practicalViewedAnswerIds.value.filter'));
assert.ok(app.includes('pattern: practicalSessionPattern.value'));
console.log(JSON.stringify({templates:9,reviewed:108,draws:2700,reachable:ids.size,additionalReachable:additionalIds.size,olderPhotosReachable:olderPhotoIds.size,originalBankUnchanged:true},null,2));
