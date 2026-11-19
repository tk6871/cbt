// Read the same normalized sources as the reader, not just the raw OCR index.
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {build}=createRequire(require.resolve('vite'))('esbuild');
const out='work/textbook-completeness';
fs.mkdirSync(out,{recursive:true});
const {outputFiles}=await build({stdin:{contents:`export * from './src/cbt/textbookPages';export * from './src/cbt/textbookDirectAnswer';`,resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
globalThis.window={};
const api=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const webp=read('data/problem-images-webp90.json').mappings;
const ctx={window:{}};
for(const file of ['hvac','hvac-hansol','hvac-hansol-book','energy','energy-restored','energy-textbook','energy-book-earlier'])vm.runInNewContext(fs.readFileSync(`data/${file}.js`,'utf8'),ctx);
const items=Object.values(ctx.window).flatMap(b=>(b.rounds||[]).flatMap(round=>round.questions.map(question=>({id:`${question._originRoundId||round.id}:${question._originalNumber||question.number}`,round,question,subject:''}))));
Object.assign(window,ctx.window);
const exists=asset=>/^(https?:|data:)/.test(asset)||fs.existsSync(webp[asset]||asset);
const linked=api.textbookStudyItems(items);
const linkedById=new Map(linked.map(i=>[i.id,i]));
const rows=api.textbookEntries.filter(e=>['energy','hansol'].includes(e.book)).map(e=>{
 const item=linkedById.get(api.textbookStudyId(e));
 const direct=api.textbookDirectSources.find(s=>s.id===e.directSourceId);
 if(direct){const page=api.textbookDirectPageMap.get(direct.page);return {book:e.book,page:e.page,number:e.number,id:direct.id,kind:'direct',answer:api.textbookDirectAnswer(direct,page)||null,hasExplanation:direct.solutionParts.length>0,missingImages:[...direct.questionParts,...direct.solutionParts].map(p=>p.asset||api.textbookDirectPageMap.get(p.page)?.asset).filter(p=>!p||!exists(p))};}
 const q=item?.question;
 return {book:e.book,page:e.page,number:e.number,id:e.sourceId,kind:e.workedExampleId?'worked-example':'linked',resolved:!!q,reviewHold:!!e.reviewHold,answer:q?.answer||null,hasExplanation:!!(q&&(q.explanation?.trim()||q.explanationHtml?.trim()||q.explanationImages?.length||q.additionalExplanations?.length)),missingImages:q?[q.sourceImage,...(q.images||[]),...(q.explanationImages||[])].filter(Boolean).filter(p=>!exists(p)):[]};
});
const summary=Object.fromEntries(['hansol','energy'].map(book=>{const a=rows.filter(r=>r.book===book&&r.kind!=='worked-example');return [book,{total:a.length,missingAnswer:a.filter(r=>![1,2,3,4].includes(r.answer)).length,missingExplanation:a.filter(r=>!r.hasExplanation).length,missingImages:a.filter(r=>r.missingImages.length).length,unresolved:a.filter(r=>r.resolved===false).length}];}));
fs.writeFileSync(`${out}/audit.json`,JSON.stringify({summary,rows},null,2)+'\n');
fs.writeFileSync(`${out}/direct-sources.json`,JSON.stringify(api.textbookDirectSources,null,2)+'\n');
console.log(summary);
if(process.argv.includes('--check')&&Object.values(summary).some(s=>!s.total||s.missingAnswer||s.missingExplanation||s.missingImages||s.unresolved))process.exitCode=1;
