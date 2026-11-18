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
 await build({stdin:{contents:`export {practicalPrompts} from './src/cbt/qualificationStudyGuides'; export {hvacFieldReportRound} from './src/cbt/hvacFieldReportPractice'; export {textbookDirectSources,textbookEntries,textbookWorkedExamples} from './src/cbt/textbookPages';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:runtime,logLevel:'silent'});
 const rt=await import(pathToFileURL(runtime));
 const banks=[],ids=new Set();
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
     if(ids.has(id))throw Error('Duplicate storage ID: '+id);ids.add(id);
     const text=!!(q.explanation||q.explanationHtml),image=!!q.explanationImages?.length,additional=q.additionalExplanations?.length||0;
     if(q.explanation === 'COMCBT 공개 시험 화면에서 정답은 '+q.answer+'번으로 확인됩니다. 등록된 상세 해설은 없습니다.' && !q.explanationHtml && !q.explanationFormula && !image && !additional){
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
 counts.originalReviewUnits=counts.bankQuestions+counts.practical+counts.fieldReport+counts.direct+counts.workedExamples;
 counts.reviewUnitsIncludingVariants=counts.originalReviewUnits+counts.correctedBookVariants;
 const output={schemaVersion:1,counts,summary,rowSchema:{bank:['storageId','printedNumber','hasText','hasImage','additionalBlockCount'],practical:['id','group','year','session','number','hasExplanation'],fieldReport:['id','number','hasExplanation'],direct:['id','page','number','solutionPartCount'],correctedBookVariants:['book','page','number','sourceId','hasOwnExplanation','reviewHold'],workedExamples:['id','pages','title']},banks,derived};
 const outputPath=process.argv[2];if(outputPath)fs.writeFileSync(outputPath,JSON.stringify(output)+'\n');
 console.log(JSON.stringify({counts,summary},null,2));
}finally{fs.rmSync(temp,{recursive:true,force:true});}
