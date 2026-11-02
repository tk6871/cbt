// Publish ONLY this explicitly checked text batch; never sweep pending renders.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {makeTextCorrection,textbookSourceFingerprint as fingerprint} from './textbook-text-correction.mjs';
import {rasterDimensions} from './raster-dimensions.mjs';
import {loadHansolReview} from './load-hansol-textbook-review.mjs';
const read=path=>JSON.parse(fs.readFileSync(path,'utf8'));
const w={window:{}};
for(const name of ['hvac','hvac-hansol'])vm.runInNewContext(fs.readFileSync(`data/${name}.js`,'utf8'),w);
const originals=new Map(Object.values(w.window).flatMap(b=>b.rounds.flatMap(r=>r.questions.map(q=>[`${r.id}:${q.number}`,q]))));
const batch=read('tools/hansol-numeric-text-review.json');
const checked=loadHansolReview(originals).rows;
const keys=read('tools/hansol-printed-key-review.json').answers;
const pages=read('data/textbook-pages.json'),corrections=read('data/textbook-corrections.json'),audit=read('data/textbook-page-audit.json');
const touched=new Set();
for(const row of batch.rows){
 const key=`${row.page}:${row.number}`,q=originals.get(row.sourceId);assert.ok(q,key);assert.equal(q.answer,row.answer,key);
 assert.equal(fingerprint(q),row.sourceFingerprint,`${key}: original changed since direct review`);
 assert.deepEqual(checked.find(r=>r.page===row.page&&r.number===row.number),row,key);
 assert.equal(keys[row.page]?.[row.number],row.correction?.answer??row.answer,`${key}: printed key not checked`);
 const prior=pages.entries.find(e=>e.book==='hansol'&&e.page===row.page&&e.number===row.number);
 if(prior?.sourceId)assert.equal(prior.sourceId,row.sourceId,`${key}: do not move a learning ID`);
 const entry={book:'hansol',page:row.page,number:row.number,sourceId:row.sourceId,fingerprint:fingerprint(q),column:row.column};
 if(row.correction){const correction=makeTextCorrection(q,row);corrections.entries[key]=correction;entry.correction=correction;}
 else if(q.sourceImage)entry.imageSize=rasterDimensions(q.sourceImage);
 if(prior){delete prior.pendingReason;delete prior.reviewHold;delete prior.imageSize;delete prior.correction;Object.assign(prior,entry);}else pages.entries.push(entry);
 touched.add(row.page);
}
const fixes=read('tools/hansol-screen-number-review.json').rows;
const exclusions=read('tools/hansol-individual-review-exclusions.json').rows;
const compact=text=>text.normalize('NFKC').replace(/\s/g,'');
const detected=new Map();
for(const name of ['comparison.json','comparison-columns.json'])for(const q of read(`work/hansol-whole-book/${name}`).questions){
 if(!touched.has(q.page))continue;
 if(exclusions.some(f=>f.page===q.page&&f.column===q.column&&f.rawNumber===q.number&&compact(q.stem).includes(compact(f.contains))))continue;
 const n=fixes.find(f=>f.page===q.page&&f.column===q.column&&f.rawNumber===q.number&&compact(q.stem).includes(compact(f.contains)))?.number??q.number;
 const set=detected.get(q.page)||new Set();set.add(n);detected.set(q.page,set);
}
for(const page of touched){
 const a=audit.pages.find(r=>r.page===page);assert.ok(a,page);
 const es=pages.entries.filter(e=>e.book==='hansol'&&e.page===page),linked=new Set(es.filter(e=>e.sourceId).map(e=>e.number)),held=new Set(es.filter(e=>e.reviewHold).map(e=>e.number));
 Object.assign(a,{detectedPositions:detected.get(page)?.size||0,linkedPositions:linked.size,heldPositions:held.size,unconfirmedCandidates:[...detected.get(page)||[]].filter(n=>!linked.has(n)&&!held.has(n)).length});
}
pages.entries.sort((a,b)=>a.book.localeCompare(b.book)||a.page.localeCompare(b.page,'ko',{numeric:true})||a.number-b.number);
const seen=new Set();for(const e of pages.entries){const key=`${e.book}:${e.page}:${e.number}`;assert.ok(!seen.has(key),key);seen.add(key);}
for(const [path,data] of [['data/textbook-pages.json',pages],['data/textbook-corrections.json',corrections],['data/textbook-page-audit.json',audit]]){
 data.date=batch.date;
 if(process.argv.includes('--check')){assert.deepEqual(data,read(path),`${path}: published text batch is out of date`);continue;}
 fs.writeFileSync(path,JSON.stringify(data,null,2)+'\n');
}
console.log({checkedOnly:process.argv.includes('--check'),reviewedLocations:batch.rows.length,textCorrections:batch.rows.filter(r=>r.correction).length,publishedHansolLinks:pages.entries.filter(e=>e.book==='hansol'&&e.sourceId).length});
