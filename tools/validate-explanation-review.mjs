import fs from 'node:fs';
import katex from 'katex';
import {applySafetyEngineerExplanations} from './safety-engineer-explanations.mjs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const dir='docs/explanation-review/2026-11-18';
const review=JSON.parse(fs.readFileSync(dir+'/review.json'));
const inventory=JSON.parse(fs.readFileSync(dir+'/inventory.json'));
const baseline=review.baseline;
const original=file=>execFileSync('git',['show',`${baseline}:${file}`],{encoding:'utf8',maxBuffer:40e6});
const parse=source=>{const ctx={window:{}};vm.runInNewContext(source,ctx);return structuredClone(Object.values(ctx.window).flatMap(v=>Array.isArray(v)?v:[v]));};
const reviewedIds=new Set(review.records.filter(r=>r.changed).map(r=>r.id));
const formulaDisplayIds=new Set(review.records.filter(r=>r.formulaDisplay).map(r=>r.id));
assert.equal(fs.readFileSync('data/problem-images-webp90.json','utf8'),original('data/problem-images-webp90.json'),'Source/display mapping changed');
const maps=JSON.parse(fs.readFileSync('data/problem-images-webp90.json')).mappings;
let bankQuestions=0,imageReferences=0,changedBankIds=[];
const bankById=new Map();
function imageExists(p){if(!p||/^(https?:|data:)/.test(p))return;const clean=decodeURIComponent(p.split(/[?#]/)[0]).replace(/^\.\//,'');assert.ok(fs.existsSync(maps[clean]||clean),`Missing original/display image: ${p}`);imageReferences++;}
function protectedBank(catalogs){return catalogs.map(c=>({...c,rounds:c.rounds.map(r=>({...r,questions:r.questions.map(q=>{
 const copy=structuredClone(q);
 for(const k of ['explanation','explanationHtml','explanationBasis'])delete copy[k];
 if(copy.additionalExplanations)copy.additionalExplanations=copy.additionalExplanations.map(a=>{const b={...a};delete b.text;delete b.label;return b;});
 return copy;
})}))}));}
for(const file of new Set(inventory.summary.map(b=>b.file))){
 const before=parse(original(file)),after=parse(fs.readFileSync(file,'utf8'));
 const expected=structuredClone(before);
 if(file==='data/safety-engineer.js'){
  applySafetyEngineerExplanations(expected[0].rounds);
  // Compare complete source and generated bank, including prose and provenance.
  assert.deepEqual(after,expected,'Safety explanations differ from the reviewed import');
 }
 for(const catalog of expected)for(const round of catalog.rounds)for(const q of round.questions){
  const id=round.id+':'+q.number;
  if(!formulaDisplayIds.has(id))continue;
  assert.equal(q.explanationFormula,undefined);
  const entry=after.find(c=>c.key===catalog.key).rounds.find(r=>r.id===round.id).questions.find(item=>item.number===q.number);
  assert.ok(entry.explanationFormula,'Missing reviewed fraction: '+id);
  q.explanationFormula=entry.explanationFormula;
 }
 assert.deepEqual(protectedBank(after),protectedBank(expected),`Protected question data changed: ${file}`);
 for(let ci=0;ci<after.length;ci++)for(let ri=0;ri<after[ci].rounds.length;ri++){
  const r=after[ci].rounds[ri];for(let qi=0;qi<r.questions.length;qi++){
   const q=r.questions[qi],b=before[ci].rounds[ri].questions[qi],id=`${q._originRoundId||r.id}:${q._originalNumber||q.number}`;
   assert.ok(!bankById.has(id),`Duplicate ID ${id}`);bankById.set(id,q);bankQuestions++;
   assert.ok(Array.isArray(q.choices)&&q.choices.length===4,`Choice count ${id}`);assert.ok(q.answer>=1&&q.answer<=4,`Answer range ${id}`);
   for(const p of [q.sourceImage,...q.images||[],...q.explanationImages||[],...q.choices.flatMap(c=>c.images||[])])imageExists(p);
   if(JSON.stringify(q)!==JSON.stringify(b)){assert.ok(reviewedIds.has(id),`Unrecorded change ${id}`);changedBankIds.push(id);}
  }
 }
}
const hansolRows=JSON.parse(fs.readFileSync('tools/hansol-book-native-review.json')).rows;
for(const id of review.hvacHansolBookFirst20Rounds.correctedIds){
 const q=bankById.get(id);
 const row=hansolRows.find(row=>`hvac-hansol-book-${row.page}:${row.number}`===id);
 assert.ok(row&&q,'Missing Hansol source: '+id);
 assert.equal(q.explanation,row.explanation,'Hansol explanation differs from source: '+id);
 assert.deepEqual(q.explanationFormula,row.explanationFormula,'Hansol fraction differs from source: '+id);
}
for (const source of review.sources.filter(item => item.digestFields)) {
 const question = bankById.get(source.id);
 assert.ok(question, 'Missing reference question: ' + source.id);
 const bytes = JSON.stringify(source.digestFields.map(key => question[key]));
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), source.sha256, 'Review reference changed: ' + source.id);
}
const fractions=[...bankById.values()].filter(q=>q.explanationFormula);
assert.equal(fractions.length,review.missingExplanationBatch.withFraction+review.missingExplanationBatch.previouslyReviewedFractionDisplays+review.safety20220424Batch.withFraction+review.hvacHansolBookFirst20Rounds.withFraction);
for(const {explanationFormula:{tex,label}} of fractions){
 assert.ok(label.trim());
 assert.ok(katex.renderToString(tex,{throwOnError:true}).includes('<mfrac>'),tex);
}
const withoutExplanation=[...bankById.values()].filter(q=>!q.explanation&&!q.explanationHtml&&!q.explanationImages?.length);
assert.equal(withoutExplanation.length,review.safety20220424SecondBatch.withoutBankExplanation);
assert.equal(bankQuestions,inventory.counts.bankQuestions);
for(const row of review.records)for(const a of row.sourceAssets)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(a.displayAsset)).digest('hex'),a.sha256,`Reviewed pixels changed: ${a.original}`);
const oldConfirmed=JSON.parse(original('data/image-text/confirmed.json')),newConfirmed=JSON.parse(fs.readFileSync('data/image-text/confirmed.json'));
for(const [p,e] of Object.entries(oldConfirmed))assert.deepEqual(newConfirmed[p],e,`Pre-existing transcription changed: ${p}`);
for(const [p,e] of Object.entries(newConfirmed)){
 assert.equal(e.asset,maps[p]||p);assert.equal(crypto.createHash('sha256').update(fs.readFileSync(e.asset)).digest('hex'),e.sha256);
}
const manual=JSON.parse(fs.readFileSync('tools/image-text-catalog-reviewed.json')).entries;
for(const [p,e] of Object.entries(newConfirmed))if(!oldConfirmed[p]){assert.equal(manual[p].text||'',e.text);assert.equal(manual[p].sha256,e.sha256);if(e.kind==='question')assert.deepEqual(manual[p].question,e.question);}
const links=JSON.parse(fs.readFileSync('data/energy-textbook-comcbt-links.json')).links;
const fingerprint=q=>{let h=14695981039346656037n;const text=JSON.stringify([q.text||'',q.html||'',q.ocrText||'',q.choices.map(c=>[c.text||'',c.html||'',c.images||[]]),q.answer,q.images||[],q.sourceImage||'']);for(const ch of text){h^=BigInt(ch.codePointAt(0));h=BigInt.asUintN(64,h*1099511628211n);}return h.toString(16);};
for(const [id,link] of Object.entries(links)){
 const t=bankById.get(id),s=bankById.get(link.sourceId);assert.ok(t&&s,`Missing dynamic link ${id}`);
 assert.equal(fingerprint(t),link.targetFingerprint);assert.equal(fingerprint(s),link.sourceFingerprint);assert.equal(t.answer,s.answer);assert.equal(t.answer,link.answer);
}
assert.equal(new Set(review.records.map(r=>r.id)).size,review.records.length);
assert.equal(review.counts.contentExamined,review.records.length);
assert.equal(review.counts.reviewUnits,review.counts.automaticOnly+review.records.length);
const statusCounts = {
 '내용 검토 완료·수정함': 'contentCompletedChanged',
 '내용 검토 완료·수정 없음': 'contentCompletedUnchanged',
 '근거 부족으로 보류': 'evidenceHold',
 '정답 자체 확인 필요': 'answerNeedsConfirmation',
};
const knownEvidence = new Set([...review.sources, ...review.records].map(entry => entry.id));
for (const record of review.records) {
 assert.ok(Object.hasOwn(statusCounts, record.status) && record.contentExamined, 'Unreviewed entry in manual ledger: ' + record.id);
 assert.equal(record.answerAfter, bankById.get(record.id)?.answer, 'Stored answer differs from ledger: ' + record.id);
 for (const reference of record.evidence) assert.ok(knownEvidence.has(reference), 'Missing evidence: ' + reference);
}
for (const [status, field] of Object.entries(statusCounts)) {
 assert.equal(review.counts[field], review.records.filter(record => record.status === status).length, status);
}
assert.equal(review.counts.contentCompleted, review.counts.contentCompletedChanged + review.counts.contentCompletedUnchanged);
const newTranscriptions=Object.entries(newConfirmed).filter(([p])=>!oldConfirmed[p]);
const affectedIds=new Set(changedBankIds);
for(const [p] of newTranscriptions){const matching=review.records.filter(r=>r.questionImage===p||r.explanationImages.includes(p));assert.ok(matching.length,`Unrecorded transcription ${p}`);for(const r of matching)affectedIds.add(r.id);}
const energyReviewFile = 'data/energy-reviewed-explanations.json';
const energyReviewed = JSON.parse(fs.readFileSync(energyReviewFile));
const expectedDisplays = review.records.filter(record => record.reviewedExplanationFile === energyReviewFile);
assert.deepEqual(Object.keys(energyReviewed).sort(), expectedDisplays.map(record => record.id).sort());
for(const [id,entry] of Object.entries(energyReviewed)){
 const question=bankById.get(id);
 assert.ok(question&&reviewedIds.has(id), 'Unrecorded display change: '+id);
 assert.equal(fingerprint(question),entry.fingerprint, 'Reviewed energy source changed: '+id);
 assert.ok(entry.text.trim()&&entry.basis.trim());
 if(entry.formula)assert.ok(katex.renderToString(entry.formula.tex,{throwOnError:true}).includes('<mfrac>'));
 affectedIds.add(id);
}
assert.equal(review.counts.changedQuestionIds,affectedIds.size);
const result={bankQuestions,imageReferences,reviewedFractions:fractions.length+Object.values(energyReviewed).filter(e=>e.formula).length,reviewedEnergyDisplays:Object.keys(energyReviewed).length,withoutExplanation:withoutExplanation.length,protectedQuestionFields:'unchanged including IDs/order/answers/choices/images/hotspots',changedBankIds,transcriptionsAdded:newTranscriptions.length,transcriptionsByKind:{question:newTranscriptions.filter(([,e])=>e.kind==='question').length,explanation:newTranscriptions.filter(([,e])=>e.kind==='explanation').length},dynamicLinksValidated:Object.keys(links).length,manualContentCompleted:review.counts.contentCompleted,manualExamined:review.records.length};
console.log(JSON.stringify(result,null,2));
