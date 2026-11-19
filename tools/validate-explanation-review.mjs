import fs from 'node:fs';
import path from 'node:path';
import katex from 'katex';
import {applySafetyEngineerExplanations} from './safety-engineer-explanations.mjs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {build,transformSync} = require(require.resolve('esbuild', {paths:[require.resolve('vite')]}));
const dir=process.argv[2] || 'docs/explanation-review/2026-11-18';
const review=JSON.parse(fs.readFileSync(dir+'/review.json'));
const inventory=JSON.parse(fs.readFileSync(dir+'/inventory.json'));
const baseline=review.baseline;
const original=file=>execFileSync('git',['show',`${baseline}:${file}`],{encoding:'utf8',maxBuffer:40e6});
const parse=source=>{const ctx={window:{}};vm.runInNewContext(source,ctx);return structuredClone(Object.values(ctx.window).flatMap(v=>Array.isArray(v)?v:[v]));};
const reviewedIds=new Set(review.records.filter(r=>r.changed).map(r=>r.id));
const recordsById = new Map(review.records.map(row => [row.id,row]));
const supplementSource = fs.readFileSync('tools/stage-energy-restored-full.py', 'utf8');
const primaryReviews=new Map(review.records.filter(r=>r.primarySourceReviewed).map(r=>[r.id,r]));
const noticeReviews=new Map(review.records.filter(r=>r.reviewedAnswerNotice).map(r=>[r.id,r]));
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
  const notice=noticeReviews.get(id);
  if(notice){
   assert.equal(q.explanation, 'COMCBT 공개 시험 화면에서 정답은 '+q.answer+'번으로 확인됩니다. 등록된 상세 해설은 없습니다.');
   assert.equal(q.explanationProvenance,'comcbt-public-exam-view');
   assert.equal(crypto.createHash('sha256').update(JSON.stringify([q.text,q.html,q.choices,q.answer])).digest('hex'),notice.reviewedAnswerNotice);
  }
  const primary=notice || primaryReviews.get(id);
  if(primary){
   assert.equal(primary.file,file);
   q.explanationProvenance='manual-reviewed';
   const actual=after.find(c=>c.key===catalog.key).rounds.find(r=>r.id===round.id).questions.find(item=>item.number===q.number);
   assert.equal(actual.explanation,primary.resolution);
   assert.equal(actual.explanationBasis,primary.basis);
   if (primary.reviewedFormula) assert.deepEqual(actual.explanationFormula, primary.reviewedFormula, id);
  }
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
   const reviewRow = recordsById.get(id);
   if (reviewRow?.originalItem) {
    const item = reviewRow.originalItem;
    assert.equal(item.file, file, id);
    assert.equal(item.round, r.id, id);
    assert.equal(item.number, q.number, id);
    const bytes = JSON.stringify(item.fields.map(key => q[key]));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), item.sha256, id);
   }
   if (reviewRow?.reviewedSupplement) {
    assert.equal(q.explanation, reviewRow.resolution, id);
    assert.equal(q.explanationProvenance, 'printed-question-and-answer-supplement', id);
    assert.ok(supplementSource.includes(q.explanation), id);
   }
   const corrections = reviewRow?.additionalCorrections ?? (reviewRow?.additionalCorrection ? [reviewRow.additionalCorrection] : []);
   for (const correction of corrections) {
    const index = b.additionalExplanations.findIndex(item => item.source === correction.source &&
      crypto.createHash('sha256').update(item.text).digest('hex') === correction.originalSha256);
    assert.ok(index >= 0, 'Missing reviewed additional explanation: ' + id);
    assert.deepEqual(q.additionalExplanations[index], {...b.additionalExplanations[index], text: correction.text},
      'Additional explanation or source changed: ' + id);
   }
   assert.ok(Array.isArray(q.choices)&&q.choices.length===4,`Choice count ${id}`);assert.ok(q.answer>=1&&q.answer<=4,`Answer range ${id}`);
   for(const p of [q.sourceImage,...q.images||[],...q.explanationImages||[],...q.choices.flatMap(c=>c.images||[])])imageExists(p);
   if(JSON.stringify(q)!==JSON.stringify(b)){assert.ok(reviewedIds.has(id),`Unrecorded change ${id}`);changedBankIds.push(id);}
  }
 }
}
const hansolRows=JSON.parse(fs.readFileSync('tools/hansol-book-native-review.json')).rows;
for(const id of [...review.hvacHansolBookFirst20Rounds.correctedIds,"hvac-hansol-book-2-263:32",...review.continuousReview.bookChanged]){
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
assert.equal(fractions.length,review.missingExplanationBatch.withFraction+review.missingExplanationBatch.previouslyReviewedFractionDisplays+review.safety20220424Batch.withFraction+review.hvacHansolBookFirst20Rounds.withFraction+review.choiceMatchBatch.rawFractionDisplays+review.continuousReview.rawFractionDisplays);
for(const {explanationFormula:{tex,label}} of fractions){
 assert.ok(label.trim());
 assert.ok(katex.renderToString(tex,{throwOnError:true}).includes('<mfrac>'),tex);
}
const withoutExplanation=[...bankById.values()].filter(q=>!q.explanation&&!q.explanationHtml&&!q.explanationImages?.length);
assert.equal(withoutExplanation.length,review.continuousReview.remainingBankBlanks);
assert.equal(bankQuestions,inventory.counts.bankQuestions);
for(const row of review.records)for(const a of row.sourceAssets)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(a.displayAsset)).digest('hex'),a.sha256,`Reviewed pixels changed: ${a.original}`);
const oldConfirmed=JSON.parse(original('data/image-text/confirmed.json')),newConfirmed=JSON.parse(fs.readFileSync('data/image-text/confirmed.json'));
for(const [p,e] of Object.entries(oldConfirmed))assert.deepEqual(newConfirmed[p],e,`Pre-existing transcription changed: ${p}`);
for(const [p,e] of Object.entries(newConfirmed)){
 assert.equal(e.asset,maps[p]||p);assert.equal(crypto.createHash('sha256').update(fs.readFileSync(e.asset)).digest('hex'),e.sha256);
}
const readerVariants = JSON.parse(fs.readFileSync('data/image-text/book-reader-variants.json'));
const readerImages = JSON.parse(fs.readFileSync('data/hansol-book-ink-hidden.json')).assets;
for (const [path, variant] of Object.entries(readerVariants)) {
 const originalEntry = newConfirmed[variant.original];
 assert.equal(originalEntry?.status, 'reviewed');
 assert.ok(readerImages.some(row => row.oldAsset === variant.original && row.asset === path), path);
 assert.equal(variant.asset, maps[path] || path);
 assert.ok(review.records.some(row => (originalEntry.kind === 'question' ? row.questionImage === variant.original : row.explanationImages?.includes(variant.original)) && row.sourceAssets.some(
  asset => asset.original === path && asset.displayAsset === variant.asset && asset.sha256 === variant.sha256)), path);
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
// These authored practice questions load from a TypeScript module outside the JS banks.
const fieldFile = 'src/cbt/hvacFieldReportPractice.ts';
async function fieldRound(source) {
 const {code} = transformSync(source, {loader:'ts', format:'esm'});
 return (await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))).hvacFieldReportRound;
}
const previousFieldRound = await fieldRound(original(fieldFile));
const currentFieldRound = await fieldRound(fs.readFileSync(fieldFile,'utf8'));
const fieldAnswers = new Map();
const fieldChanges = [];
assert.equal(currentFieldRound.questions.length, previousFieldRound.questions.length);
for (const [i, q] of currentFieldRound.questions.entries()) {
 const id = currentFieldRound.id + ':' + q.number;
 fieldAnswers.set(id,q.answer);
 if (q.explanation === previousFieldRound.questions[i].explanation) continue;
 assert.equal(recordsById.get(id)?.resolution,q.explanation,id);
 assert.ok(reviewedIds.has(id),id);
 previousFieldRound.questions[i].explanation=q.explanation;
 fieldChanges.push(id);
}
assert.deepEqual(currentFieldRound,previousFieldRound,'Practice question, choices, keys or order changed');
// Compare the practical prompts as loaded by the app, including authored TypeScript and JSON inputs.
async function practicalPrompts(atBaseline) {
 const result = await build({
  stdin: {contents: "export {practicalPrompts} from './src/cbt/qualificationStudyGuides'", resolveDir: process.cwd()},
  bundle:true, write:false, format:'esm', platform:'node',
  plugins: atBaseline ? [{
   name:'baseline-practical-sources',
   setup(builder) {
    builder.onLoad({filter:/\.(?:ts|json)$/}, ({path: filename}) => ({
     contents:original(path.relative(process.cwd(),filename)), loader:filename.endsWith('.json')?'json':'ts',
     resolveDir:path.dirname(filename),
    }));
   },
  }] : [],
 });
 const moduleUrl='data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].contents).toString('base64');
 return (await import(moduleUrl)).practicalPrompts;
}
const [oldPractical,currentPractical] = await Promise.all([practicalPrompts(true),practicalPrompts(false)]);
assert.deepEqual(currentPractical.map(p=>p.id),oldPractical.map(p=>p.id),'Practical IDs or order changed');
const practicalAnswers=new Map();
const practicalChanges=[];
for (const [index,prompt] of currentPractical.entries()) {
 const previous=oldPractical[index], record=recordsById.get(prompt.id);
 practicalAnswers.set(prompt.id,prompt.answer);
 if (record) {
  const digest=crypto.createHash('sha256').update(JSON.stringify([prompt.question,prompt.answer,prompt.keyPoints??null])).digest('hex');
  assert.equal(record.practicalQuestionDigest,digest,prompt.id);
  assert.equal(record.resolution,prompt.explanation,prompt.id);
 }
 if (prompt.explanation!==previous.explanation) {
  assert.ok(record?.changed,prompt.id);
  practicalChanges.push(prompt.id);
 }
 assert.deepEqual(prompt,{...previous,explanation:prompt.explanation},'Practical fields changed: '+prompt.id);
}
const practicalImages=new Set(currentPractical.flatMap(prompt=>
 [prompt.image,...prompt.images||[],...prompt.answerImages||[]].filter(Boolean)));
for (const asset of practicalImages) {
 assert.ok(fs.statSync(maps[asset]||asset).isFile(),'Missing practical image: '+asset);
}
const exampleFile = 'data/textbook-worked-examples.json';
const oldExamples = JSON.parse(original(exampleFile)).entries;
const currentExamples = JSON.parse(fs.readFileSync(exampleFile)).entries;
const exampleAnswers = new Map();
const exampleChanges = [];
const nativeExamples = new Map(JSON.parse(fs.readFileSync('tools/hansol-book-native-review.json')).rows
 .filter(row=>row.kind==='worked-example').map(row=>[row.page+':'+row.number,row]));
assert.equal(currentExamples.length,oldExamples.length);
for (const [index, example] of currentExamples.entries()) {
 const before=oldExamples[index];
 const record=recordsById.get(example.id);
 exampleAnswers.set(example.id,example.answer);
 if (!record) { assert.deepEqual(example,before); continue; }
 const native=nativeExamples.get(example.pages[0]+':'+example.number);
 assert.ok(native);
 assert.equal(record.answerBefore,before.answer,example.id);
 if(record.answerCaptionCorrection) {
  assert.equal(native.note,example.note);
  assert.equal(native.answer,example.answer);
  before.answer=example.answer;
  before.note=example.note;
 }
 assert.equal(record.resolution,example.explanation);
 assert.equal(native.explanation,example.explanation);
 before.explanation=example.explanation;
 if (example.explanationTranscribed) {
  assert.equal(native.explanationTranscribed,true);
  assert.equal(newConfirmed[example.solution]?.kind,'explanation');
  before.explanationTranscribed=true;
 }
 if (example.explanationFormula) {
  assert.deepEqual(example.explanationFormula,native.explanationFormula);
  assert.ok(katex.renderToString(example.explanationFormula.tex,{throwOnError:true}).includes('<mfrac>'),example.id);
  before.explanationFormula=example.explanationFormula;
 }
 assert.deepEqual(example,before,'Worked example media, order or original fields changed: '+example.id);
 if(record.changed) exampleChanges.push(example.id);
}
// Direct textbook exercises keep their page coordinates and answer keys in separate files.
for (const file of ['hansol-book-direct','hansol-book-direct-boundaries','textbook-direct-answers','textbook-direct-hitboxes']) {
 const path = 'data/' + file + '.json';
 assert.equal(fs.readFileSync(path,'utf8'),original(path),path);
}
const directModule = await build({
 stdin:{contents:"export {textbookDirectSources,textbookDirectPageMap} from './src/cbt/textbookPages'; export {textbookDirectAnswer} from './src/cbt/textbookDirectAnswer'; export {textbookExplanationText} from './src/cbt/textbookExplanationText';",resolveDir:process.cwd()},
 bundle:true,write:false,platform:'node',format:'esm',
});
const direct = await import('data:text/javascript;base64,'+Buffer.from(directModule.outputFiles[0].contents).toString('base64'));
const directFile='data/textbook-explanation-text.json';
const oldDirect=new Map(JSON.parse(original(directFile)).entries.map(entry=>[entry.id,entry]));
const directAnswers=new Map(),directChanges=[],directNew=[];
for(const source of direct.textbookDirectSources){
 const previous=oldDirect.get(source.id), entry=direct.textbookExplanationText(source), record=recordsById.get(source.id);
 directAnswers.set(source.id,direct.textbookDirectAnswer(source,direct.textbookDirectPageMap.get(source.page)));
 if(previous)assert.deepEqual({...entry,blocks:previous.blocks},previous,source.id);
 if(record?.directReview){
  assert.deepEqual(record.resolution,entry.blocks,source.id);
  assert.equal(record.directReview.newTranscription,!previous,source.id);
 }
 if(!entry)continue;
 if(!previous)directNew.push(source.id);
 if(!previous||JSON.stringify(previous.blocks)!==JSON.stringify(entry.blocks)){
  assert.ok(record?.directReview&&record.changed,source.id);
  directChanges.push(source.id);
 }
 oldDirect.delete(source.id);
}
// A reviewed crop was archived by the upstream printed-key release. Validate its original
// transcription as historical work even though it no longer appears in the reader.
const archive = review.upstreamDirectReview;
const upstreamJson = file => JSON.parse(execFileSync('git', ['show', archive.commit + ':' + file], {encoding:'utf8', maxBuffer:40e6}));
const upstreamHidden = upstreamJson('data/textbook-direct-number-review.json').hiddenDuplicates;
const upstreamPrinted = new Map(upstreamJson('data/textbook-direct-answer-review.json').entries.map(e => [e.id, e]));
const publishedText = new Map(JSON.parse(fs.readFileSync(directFile)).entries.map(e => [e.id,e]));
for (const id of archive.archivedReviewedIds) {
 assert.ok(upstreamHidden.includes(id) && !directAnswers.has(id), id);
 const entry = publishedText.get(id);
 const upstreamEntry = upstreamJson(directFile).entries.find(item => item.id === id);
 assert.deepEqual(entry, upstreamEntry, id);
 assert.deepEqual(entry.blocks, recordsById.get(id).resolution, id);
 assert.ok(recordsById.get(id).directReview.newTranscription && !oldDirect.has(id), id);
 directNew.push(id);
 directChanges.push(id);
}
for (const row of review.records.filter(r => r.answerImportedFrom)) {
 assert.equal(row.answerImportedFrom, archive.commit);
 assert.equal(upstreamPrinted.get(row.id)?.answer, row.answerAfter, row.id);
 assert.equal(directAnswers.get(row.id), row.answerAfter, row.id);
}
assert.equal(oldDirect.size,0,'A previously displayed direct explanation disappeared');
// The appendix was introduced after the review baseline. Compare the imported
// rounds directly, including their order, hotspots, original scans and keys.
const appendixFile='data/hansol-appendix-rounds.json';
const appendixBefore=JSON.parse(execFileSync('git',['show','03caf79f0d163a47ac03fe699f51851b8e040d48:'+appendixFile],{encoding:'utf8'}));
const appendixAfter=JSON.parse(fs.readFileSync(appendixFile));
const appendixRows=new Map(inventory.derived.appendix.map(row=>[row.sourceId,row]));
const appendixAnswers=new Map(), appendixChanges=[];
for(const [i,round] of appendixAfter.entries()){
 for(const [j,question] of round.questions.entries()){
  const sourceId=round.id+':'+question.number;
  const row=appendixRows.get(sourceId), previous=appendixBefore[i].questions[j];
  assert.ok(row,sourceId);
  appendixAnswers.set(row.id,question.answer);
  const record=recordsById.get(row.id);
  if(!record?.appendixReview)continue;
  assert.deepEqual(record.explanationImages,question.explanationImages,sourceId);
  for(const asset of record.sourceAssets){
   assert.equal(crypto.createHash('sha256').update(fs.readFileSync(asset.displayAsset)).digest('hex'),asset.sha256,asset.original);
  }
  if(!record.changed)continue;
  assert.equal(record.resolution,question.explanation,sourceId);
  assert.ok(!previous.explanation,sourceId);
  previous.explanation=question.explanation;
  previous.originalExplanationImagesFolded=true;
  if(question.explanationFormula){
   katex.renderToString(question.explanationFormula.tex,{throwOnError:true});
   previous.explanationFormula=question.explanationFormula;
  }
  appendixChanges.push(row.id);
 }
}
assert.deepEqual(appendixAfter,appendixBefore,'Unrecorded changes in textbook appendix');
for (const record of review.records) {
 assert.ok(Object.hasOwn(statusCounts, record.status) && record.contentExamined, 'Unreviewed entry in manual ledger: ' + record.id);
 assert.equal(record.answerAfter, bankById.get(record.id)?.answer ?? fieldAnswers.get(record.id) ?? exampleAnswers.get(record.id) ?? practicalAnswers.get(record.id) ?? directAnswers.get(record.id) ?? appendixAnswers.get(record.id), 'Stored answer differs from ledger: ' + record.id);
 for (const reference of record.evidence) assert.ok(knownEvidence.has(reference), 'Missing evidence: ' + reference);
}
for (const [status, field] of Object.entries(statusCounts)) {
 assert.equal(review.counts[field], review.records.filter(record => record.status === status).length, status);
}
assert.equal(review.counts.contentCompleted, review.counts.contentCompletedChanged + review.counts.contentCompletedUnchanged);
const newTranscriptions=Object.entries(newConfirmed).filter(([p])=>!oldConfirmed[p]);
const explanationTranscriptions = newTranscriptions.filter(([, entry]) => entry.kind === 'explanation').length + directNew.length + appendixChanges.length;
assert.equal(review.counts.imageTranscribed, explanationTranscriptions);
assert.equal(review.counts.imageFullyTranscribed + review.counts.imagePartiallyTranscribed, explanationTranscriptions);
assert.equal(review.counts.imageCompared, explanationTranscriptions);
assert.equal(review.counts.questionImagesConverted, newTranscriptions.filter(([, entry]) => entry.kind === 'question').length);
const affectedIds=new Set([...changedBankIds,...fieldChanges,...exampleChanges,...practicalChanges,...directChanges,...appendixChanges]);
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
const disputeFile = 'data/disputed-question-explanations.json';
const disputes = JSON.parse(fs.readFileSync(disputeFile));
const disputeRecords = review.records.filter(row => row.reviewedExplanationFile === disputeFile);
assert.deepEqual(Object.keys(disputes).sort(), disputeRecords.map(row => row.id).sort());
for (const record of disputeRecords) {
 const entry = disputes[record.id];
 const q = bankById.get(record.id);
 assert.equal(entry.fingerprint, fingerprint(q), record.id);
 assert.equal(entry.source, q.source);
 assert.equal(entry.originalSha256, crypto.createHash('sha256').update(q.explanation).digest('hex'), record.id);
 assert.equal(entry.text, record.resolution);
 assert.equal(entry.basis, record.basis);
 if (entry.formula) assert.ok(katex.renderToString(entry.formula.tex, {throwOnError:true}).includes('<mfrac>'));
 affectedIds.add(record.id);
}
assert.equal(review.counts.changedQuestionIds,affectedIds.size);
const result={appendixTextAdded:appendixChanges.length,directTextAdded:directNew.length,directDisplayChanges:directChanges.length,practicalDisplayAssets:practicalImages.size,disputedExplanations:disputeRecords.length,bankQuestions,imageReferences,reviewedFractions:fractions.length+Object.values(disputes).filter(e=>e.formula).length+Object.values(energyReviewed).filter(e=>e.formula).length,reviewedEnergyDisplays:Object.keys(energyReviewed).length,withoutExplanation:withoutExplanation.length,protectedQuestionFields:'unchanged including IDs/order/answers/choices/images/hotspots',changedBankIds,transcriptionsAdded:newTranscriptions.length+directNew.length+appendixChanges.length,transcriptionsByKind:{question:newTranscriptions.filter(([,e])=>e.kind==='question').length,explanation:explanationTranscriptions},dynamicLinksValidated:Object.keys(links).length,manualContentCompleted:review.counts.contentCompleted,manualExamined:review.records.length};
console.log(JSON.stringify(result,null,2));
