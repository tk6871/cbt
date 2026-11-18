import {isComcbtSource, questionExclusion, questionOriginExclusion, hasAuthoredMissingExplanation} from './explanation-review-scope.mjs';
import {isAnswerNoticeOnly} from './review-choice-matching.mjs';
// Inventory source banks by discovered assignments, not an audit's file whitelist.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);
const {build}=await import(pathToFileURL(require.resolve('esbuild',{paths:[require.resolve('vite')]})));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'cbt-review-inventory-'));
try {
 const runtime=path.join(temp,'runtime.mjs');
 await build({stdin:{contents:`export {practicalPrompts} from './src/cbt/qualificationStudyGuides'; export {hvacFieldReportRound} from './src/cbt/hvacFieldReportPractice'; export {textbookDirectSources,textbookEntries,textbookStudyId,textbookWorkedExamples} from './src/cbt/textbookPages';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:runtime,logLevel:'silent'});
 const rt=await import(pathToFileURL(runtime));
 const banks=[],ids=new Set();
 const records = new Map(JSON.parse(fs.readFileSync('docs/explanation-review/2026-11-18/review.json')).records.map(row => [row.id, row]));
 const scope = {excluded:{comcbt:0,energyBook:0}, included:0, statuses:{}, groups:{}, answerNeedsConfirmation:[], authoredWhenMissing:{total:0,restored:{comcbt:0,energyBook:0}}, bankExplanationFields:{text:0,image:0,additionalBlocks:0,empty:0}};
 const questionHasExplanation = new Map();
 const counted = new Set();
 function track(group,id,exclusion) {
  if(counted.has(id)) throw Error('Duplicate review unit: '+id);
  counted.add(id);
  if(exclusion) {scope.excluded[exclusion]++; return;}
  scope.included++;
  const state = records.get(id)?.status || '자동검사만 완료';
  scope.statuses[state] = (scope.statuses[state] || 0) + 1;
  if (state === '정답 자체 확인 필요') scope.answerNeedsConfirmation.push(id);
  const item = scope.groups[group] ||= {total:0, inspected:0, next:null};
  item.total++;
  if(records.has(id)) item.inspected++;
  else item.next ??= id;
 }
 const noticeIds=new Set();
 for(const filename of fs.readdirSync('data').filter(f=>f.endsWith('.js')).sort()){
  const file='data/'+filename,source=fs.readFileSync(file,'utf8');
  if(!/window\.CBT_DATA_/.test(source))continue;
  const ctx={window:{}};vm.runInNewContext(source,ctx,{filename:file});
  for(const value of Object.values(ctx.window))for(const c of Array.isArray(value)?value:[value]){
   if(!c?.rounds)continue;
   const bank={file,catalog:c.key,name:c.name,rounds:[],questions:0,text:0,image:0,additional:0,legacyEmbeddedAdditional:0,answerNoticeOnly:0};
   for(const r of c.rounds){
    const round={id:r.id,title:r.title,questionRows:[]};
    for(const q of r.questions){
     const id=`${q._originRoundId||r.id}:${q._originalNumber||q.number}`;
     const review = records.get(id);
     if (hasAuthoredMissingExplanation(q,review)) {
      scope.authoredWhenMissing.total++;
      const origin = questionOriginExclusion(c,r,q);
      if (origin) scope.authoredWhenMissing.restored[origin]++;
     }
     const exclusion = questionExclusion(c,r,q,review);
     track(c.key,id,exclusion);
     if(ids.has(id))throw Error('Duplicate storage ID: '+id);ids.add(id);
     const text=!!(q.explanation||q.explanationHtml),image=!!q.explanationImages?.length,additional=q.additionalExplanations?.length||0;
     questionHasExplanation.set(id, Boolean(text || image || additional));
     if (!exclusion) {
      scope.bankExplanationFields.text += Number(text);
      scope.bankExplanationFields.image += Number(image);
      scope.bankExplanationFields.additionalBlocks += additional;
      if (!text && !image && !additional) scope.bankExplanationFields.empty++;
     }
     if(isAnswerNoticeOnly(q)){
      noticeIds.add(id);bank.answerNoticeOnly++;
     }
     round.questionRows.push([id,q.number,+text,+image,additional]);bank.questions++;bank.text+=+text;bank.image+=+image;bank.additional+=additional;
     bank.legacyEmbeddedAdditional+=+(/동일 문제 (?:추가|보충) 해설/.test(q.explanation||''));
    }
    bank.rounds.push(round);
   }
   banks.push(bank);
  }
 }
 const corrections=rt.textbookEntries.filter(e=>e.correction);
 for (const p of rt.practicalPrompts) track('practical',p.id,isComcbtSource(p.sourceUrl)?'comcbt':null);
 for (const q of rt.hvacFieldReportRound.questions) track('fieldReport',rt.hvacFieldReportRound.id+':'+q.number,questionExclusion({},rt.hvacFieldReportRound,q));
 for (const e of rt.textbookDirectSources) track('direct',e.id,e.book==='energy'?'energyBook':null);
 // Corrected variants render the textbook's own stem and choices, even when
 // the fallback exam explanation points to a COMCBT question.
 for (const e of corrections) track('correctedBookVariants',rt.textbookStudyId(e),e.book==='energy'?'energyBook':null);
 for (const e of rt.textbookWorkedExamples) track('workedExamples',e.id,e.book==='energy'||e.id.startsWith('energy-')?'energyBook':null);
 // Count a linked explanation once for each separately rendered study item.
 const missingDerived = rt.practicalPrompts.filter(p=>!isComcbtSource(p.sourceUrl) && !p.explanation).length
  + rt.hvacFieldReportRound.questions.filter(q=>!q.explanation).length
  + rt.textbookDirectSources.filter(e=>e.book!=='energy' && !e.solutionParts.length).length
  + corrections.filter(e=>e.book!=='energy' && !e.correction.explanation && !questionHasExplanation.get(e.sourceId)).length;
 scope.withExplanationOrNotice = scope.included - scope.bankExplanationFields.empty - missingDerived;
 const derived={
  practical:rt.practicalPrompts.map(p=>[p.id,p.group,p.year||null,p.session||null,p.number||null,+!!p.explanation]),
  fieldReport:rt.hvacFieldReportRound.questions.map(q=>[`${rt.hvacFieldReportRound.id}:${q.number}`,q.number,+!!q.explanation]),
  direct:rt.textbookDirectSources.map(e=>[e.id,e.page,e.number,e.solutionParts.length]),
  correctedBookVariants:corrections.map(e=>[e.book,e.page,e.number,e.sourceId,+!!e.correction.explanation,+!!e.reviewHold]),
  workedExamples:rt.textbookWorkedExamples.map(e=>[e.id,e.pages,e.title]),
 };
 const summary=banks.map(({rounds,...b})=>({...b,rounds:rounds.length}));
 const sum=k=>summary.reduce((n,b)=>n+b[k],0);
 const counts={bankQuestions:ids.size,bankTextRows:sum('text'),bankAnswerNoticeOnly:noticeIds.size,bankImageRows:sum('image'),bankAdditionalBlocks:sum('additional'),bankLegacyEmbeddedAdditionalRows:sum('legacyEmbeddedAdditional'),practical:derived.practical.length,fieldReport:derived.fieldReport.length,direct:derived.direct.length,workedExamples:derived.workedExamples.length,correctedBookVariants:corrections.length,correctedBookExplanationTexts:corrections.filter(e=>e.correction.explanation).length,linkedBookPositions:rt.textbookEntries.length,energyDynamicExplanationLinks:Object.keys(JSON.parse(fs.readFileSync('data/energy-textbook-comcbt-links.json')).links).length};
 const disputeIds=Object.keys(JSON.parse(fs.readFileSync('data/disputed-question-explanations.json')));
 counts.disputeExplanationOverlays=disputeIds.length;
 derived.disputeExplanationOverlays=disputeIds;

 counts.originalReviewUnits=counts.bankQuestions+counts.practical+counts.fieldReport+counts.direct+counts.workedExamples;
 counts.reviewUnitsIncludingVariants=counts.originalReviewUnits+counts.correctedBookVariants;
 if(counted.size!==counts.reviewUnitsIncludingVariants) throw Error('Editorial scope does not partition all review units');
 const output={schemaVersion:1,scope,counts,summary,rowSchema:{bank:['storageId','printedNumber','hasText','hasImage','additionalBlockCount'],practical:['id','group','year','session','number','hasExplanation'],fieldReport:['id','number','hasExplanation'],direct:['id','page','number','solutionPartCount'],correctedBookVariants:['book','page','number','sourceId','hasOwnExplanation','reviewHold'],workedExamples:['id','pages','title']},banks,derived};
 const outputPath=process.argv[2];if(outputPath)fs.writeFileSync(outputPath,JSON.stringify(output)+'\n');
 console.log(JSON.stringify({counts,summary},null,2));
}finally{fs.rmSync(temp,{recursive:true,force:true});}
