// Publish confirmed location links only, never ebook body text/screenshots.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {loadHansolReview} from './load-hansol-textbook-review.mjs';
import {readOriginalAsset} from './read-original-asset.mjs';
import {rasterDimensions} from './raster-dimensions.mjs';
import {correctionFigures,correctionFigureAssets} from './textbook-correction-figures.mjs';
import {makeTextCorrection} from './textbook-text-correction.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const previouslyPublished=read('data/textbook-pages.json').entries;
const context={window:{}};
for(const key of ['hvac','hvac-hansol','energy-textbook','energy-restored','energy-book-earlier'])vm.runInNewContext(fs.readFileSync(`data/${key}.js`,'utf8'),context);
if(fs.existsSync('data/hvac-hansol-book.js'))vm.runInNewContext(fs.readFileSync('data/hvac-hansol-book.js','utf8'),context);
const items=new Map(Object.values(context.window).flatMap(b=>b.rounds.flatMap(r=>r.questions.map(q=>[`${q._originRoundId||r.id}:${q._originalNumber||q.number}`,q]))));
function fingerprint(q){
 const text=JSON.stringify([q.text||'',q.html||'',q.ocrText||'',q.choices.map(c=>[c.text||'',c.html||'',c.images||[]]),q.answer,q.images||[],q.sourceImage||'']);
 let h=14695981039346656037n;for(const ch of text){h^=BigInt(ch.codePointAt(0));h=BigInt.asUintN(64,h*1099511628211n);}return h.toString(16);
}
const entries=[];
const corrections=read('data/textbook-corrections.json').entries;
for(const r of loadHansolReview(items).rows){
 const q=r.sourceId?items.get(r.sourceId):undefined;
 if(r.sourceId){assert.ok(q,r.sourceId);assert.equal(q.answer,r.answer,r.sourceId);}
 const correction=corrections[`${r.page}:${r.number}`];
 if(r.correction){assert.ok(correction);assert.equal(correction.sourceId,r.sourceId);assert.deepEqual(correction.choices,r.correction.choices);assert.equal(correction.text,r.correction.text);
  assert.equal(correction.answer,r.correction.answer);if(correction.answer!==undefined)assert.ok([1,2,3,4].includes(correction.answer));
  if(r.presentation==='text')assert.deepEqual(correction,makeTextCorrection(q,r),`${r.page}:${r.number}: verified text must match`);
  else assert.deepEqual(correction.figureAssets||[],correctionFigureAssets(correctionFigures(q,r)),`${r.page}:${r.number}: figure assets must be rendered and unchanged`);
  for(const [path,hash] of [[correction.asset,correction.sha256],[correction.sourceImage,correction.sourceImageSha256]])if(path)assert.equal(crypto.createHash('sha256').update(readOriginalAsset(path)).digest('hex'),hash,path);}
 entries.push({book:'hansol',page:r.page,number:r.number,sourceId:r.sourceId,fingerprint:q?fingerprint(q):null,column:r.column,...(r.previousDirectId?{previousDirectId:r.previousDirectId}:{}),...(r.reviewHold?{reviewHold:true}:{}),...(!q&&r.reason?{pendingReason:r.reason}:{}),...(correction?{correction,imageSize:correction.size}:{})});
}
for(const r of read('data/cooling-midterm-book-review.json').rows){
 const confirmed=r.status.startsWith('confirmed');
 const manual=entries.find(e=>e.book==='hansol'&&e.page===r.page&&e.number===r.number);
 if(manual){if(confirmed)assert.equal(manual.sourceId,r.id,`${r.page}:${r.number}`);continue;}
 entries.push({book:'hansol',page:r.page,number:r.number,sourceId:confirmed?r.id:null,
  fingerprint:confirmed?r.fingerprint:null});
}
// 2026-10-29, normal Kyobo app reading: all five stems, four choices and
// printed answer row visually compared. Prefer identical Hansol bank versions.
for(const [number,id,answer] of [[17,'hvac-hansol-2024-1:6',3],[18,'hvac-hansol-2024-1:8',3],
 [19,'hvac-hansol-2024-1:9',3],[20,'hvac-hansol-2024-1:7',2],[21,'hvac-hansol-2024-2:21',4]]){
 const q=items.get(id);assert.equal(q.answer,answer);
 entries.push({book:'hansol',page:'4-10',number,sourceId:id,fingerprint:fingerprint(q),column:number<20?0:1});
}
// Confirmed exact comparisons from the COMPLETE normal-reader screen pass.
// Keep manual/established source IDs and their independent learning records.
const screenLinks=read('data/hansol-screen-links.json');
const screenedItems=new Map();
for(const [path,hash] of Object.entries(screenLinks.sourceHashes)){
 const original=execFileSync('git',['show','88fb43e0:'+path],{maxBuffer:80_000_000});
 assert.equal(crypto.createHash('sha256').update(original).digest('hex'),hash,path);
 const env={window:{}};vm.runInNewContext(original.toString(),env);
 for(const bank of Object.values(env.window))for(const round of bank.rounds)
  for(const q of round.questions)screenedItems.set(round.id+':'+q.number,q);
}
for(const r of screenLinks.rows){
 const q=items.get(r.sourceId);assert.ok(q,r.sourceId);assert.equal(q.answer,r.answer,r.sourceId);
 assert.equal(fingerprint(q),fingerprint(screenedItems.get(r.sourceId)),r.sourceId);
 const prior=entries.find(e=>e.book==='hansol'&&e.page===r.page&&e.number===r.number);
 if(prior?.sourceId||prior?.reviewHold)continue;
 const next={book:'hansol',page:r.page,number:r.number,sourceId:r.sourceId,fingerprint:fingerprint(q),column:r.column};
 if(prior)Object.assign(prior,next);else entries.push(next);
}
const full=read('data/energy-restored-import-audit.json');
const earlier=read('data/energy-book-earlier-import-audit.json');
const existing=read(process.env.CBT_ENERGY_TEXTBOOK_MANIFEST || 'work/energy-textbook/manifest.json').rows;
const existingKeys=new Set(existing.map(r=>r.key));
const textbookImages=read('data/energy-textbook-images.json').images;
const fullKeys=new Set(full.rows.map(r=>r.key));
for(const r of [...full.rows,...earlier.rows.filter(r=>!existingKeys.has(r.key))]){
 const prefix=fullKeys.has(r.key)?'energy-industrial-restored':'energy-book-earlier';
 const id=`${prefix}-${r.key.replace(/-\d+$/,'')}:${Number(r.key.split('-').at(-1))}`;
 assert.ok(items.has(id));
 // Only question pixel parts, not pages occupied solely by its explanation.
 const pages=[...new Set(r.parts.filter(p=>p.question).map(p=>p.page+11))];
 for(const page of pages)entries.push({book:'energy',page:String(page),number:Number(r.key.split('-').at(-1)),sourceId:id,fingerprint:fingerprint(items.get(id)),column:r.parts.find(p=>p.question&&p.page+11===page).side});
}
for(const r of existing){
 if(fullKeys.has(r.key))continue;
 const image=textbookImages[`${r.key}-question`]?.asset;
 const id=[...items].find(([,q])=>q.sourceImage===image)?.[0];
 assert.ok(items.has(id),id);
 for(const page of new Set(r.parts.filter(p=>p.question).map(p=>p.page+11)))entries.push({book:'energy',page:String(page),number:r.number,sourceId:id,fingerprint:fingerprint(items.get(id)),column:r.parts.find(p=>p.question&&p.page+11===page).side});
}
if(fs.existsSync('data/hansol-book-native-audit.json'))for(const r of read('data/hansol-book-native-audit.json').locations){
 if(r.sourceId)assert.equal(fingerprint(items.get(r.sourceId)),r.fingerprint);
 const old=entries.findIndex(e=>e.book==='hansol'&&e.page===r.page&&e.number===r.number);
 const published=previouslyPublished.find(e=>e.book==='hansol'&&e.page===r.page&&e.number===r.number);
 assert.ok(!published?.sourceId||published.sourceId===r.sourceId,`${r.page}:${r.number}: keep the published learning source`);
 if(old>=0)entries[old]=r;else entries.push(r);
}
for (const round of read('data/hansol-appendix-rounds.json')) {
 for (const q of round.questions) items.set(round.id+':'+q.number,q);
}
for (const row of read('tools/hansol-appendix-print-review.json')) {
 for (const [number,column,previousDirectId] of row.added) {
  const sourceId='hansol-appendix-'+row.page+':'+number;
  const question=items.get(sourceId);
  assert.equal(question.answer,Number(row.answers[number-row.start]),sourceId);
  entries.push({book:'hansol',page:row.page,number,sourceId,fingerprint:fingerprint(question),column,imageSize:question.sourceImageSize,...(previousDirectId?{previousDirectId}:{})});
 }
}
const sizes=new Map([...Object.values(full.images),...Object.values(earlier.images),...Object.values(textbookImages)].map(r=>[r.asset,r.outputSize]));
for(const e of entries.filter(e=>e.book==='hansol'&&e.sourceId&&!e.correction)){
 const image=items.get(e.sourceId).sourceImage;if(image&&!sizes.has(image))sizes.set(image,rasterDimensions(image));
}
const seen=new Set();for(const e of entries){const key=`${e.book}:${e.page}:${e.number}`;assert.ok(!seen.has(key),key);seen.add(key);if(e.sourceId){assert.equal(fingerprint(items.get(e.sourceId)),e.fingerprint,e.sourceId);if(e.correction?.presentation!=='text'){const size=e.correction?.size||sizes.get(items.get(e.sourceId).sourceImage);if(size)e.imageSize=size;}}}
// Manual confirmations are appended during review, not necessarily in page
// order. Publish the actual book order without changing stable study IDs.
entries.sort((a,b)=>a.book.localeCompare(b.book)||a.page.localeCompare(b.page,'ko',{numeric:true})||a.number-b.number);
if(process.argv.includes('--check')){
 const sort=(rows)=>[...rows].sort((a,b)=>a.book.localeCompare(b.book)||a.page.localeCompare(b.page,'ko',{numeric:true})||a.number-b.number);
 assert.deepEqual(JSON.parse(JSON.stringify(entries)),sort(previouslyPublished));
}else fs.writeFileSync('data/textbook-pages.json',JSON.stringify({version:1,date:read('data/textbook-pages.json').date,limits:'대조하여 확인된 연결만 사용합니다. 미확인 페이지는 문제가 없다는 뜻이 아닙니다.',entries},null,2)+'\n');
console.log(Object.fromEntries(['hansol','energy'].map(book=>[book,{pages:new Set(entries.filter(e=>e.book===book).map(e=>e.page)).size,locations:entries.filter(e=>e.book===book).length,linked:entries.filter(e=>e.book===book&&e.sourceId).length}])));
