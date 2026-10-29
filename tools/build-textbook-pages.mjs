// Publish confirmed location links only, never ebook body text/screenshots.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const context={window:{}};
for(const key of ['hvac','hvac-hansol','energy-textbook','energy-restored'])vm.runInNewContext(fs.readFileSync(`data/${key}.js`,'utf8'),context);
const items=new Map(Object.values(context.window).flatMap(b=>b.rounds.flatMap(r=>r.questions.map(q=>[`${q._originRoundId||r.id}:${q._originalNumber||q.number}`,q]))));
function fingerprint(q){
 const text=JSON.stringify([q.text||'',q.html||'',q.ocrText||'',q.choices.map(c=>[c.text||'',c.html||'',c.images||[]]),q.answer,q.images||[],q.sourceImage||'']);
 let h=14695981039346656037n;for(const ch of text){h^=BigInt(ch.codePointAt(0));h=BigInt.asUintN(64,h*1099511628211n);}return h.toString(16);
}
const entries=[];
for(const r of read('data/cooling-midterm-book-review.json').rows){
 const confirmed=r.status.startsWith('confirmed');
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
const full=read('data/energy-restored-import-audit.json');
const textbookImages=read('data/energy-textbook-images.json').images;
const fullKeys=new Set(full.rows.map(r=>r.key));
for(const r of full.rows){
 const id=`energy-industrial-restored-${r.key.replace(/-\d+$/,'')}:${Number(r.key.split('-').at(-1))}`;
 assert.ok(items.has(id));
 // Only question pixel parts, not pages occupied solely by its explanation.
 const pages=[...new Set(r.parts.filter(p=>p.question).map(p=>p.page+11))];
 for(const page of pages)entries.push({book:'energy',page:String(page),number:Number(r.key.split('-').at(-1)),sourceId:id,fingerprint:fingerprint(items.get(id)),column:r.parts.find(p=>p.question&&p.page+11===page).side});
}
for(const r of read('work/energy-textbook/manifest.json').rows){
 if(fullKeys.has(r.key))continue;
 const image=textbookImages[`${r.key}-question`]?.asset;
 const id=[...items].find(([,q])=>q.sourceImage===image)?.[0];
 assert.ok(items.has(id),id);
 for(const page of new Set(r.parts.filter(p=>p.question).map(p=>p.page+11)))entries.push({book:'energy',page:String(page),number:r.number,sourceId:id,fingerprint:fingerprint(items.get(id)),column:r.parts.find(p=>p.question&&p.page+11===page).side});
}
const sizes=new Map([...Object.values(full.images),...Object.values(textbookImages)].map(r=>[r.asset,r.outputSize]));
const seen=new Set();for(const e of entries){const key=`${e.book}:${e.page}:${e.number}`;assert.ok(!seen.has(key),key);seen.add(key);if(e.sourceId){assert.equal(fingerprint(items.get(e.sourceId)),e.fingerprint,e.sourceId);const size=sizes.get(items.get(e.sourceId).sourceImage);if(size)e.imageSize=size;}}
fs.writeFileSync('data/textbook-pages.json',JSON.stringify({version:1,date:'2026-10-29',limits:'대조하여 확인된 연결만 사용합니다. 미확인 페이지는 문제가 없다는 뜻이 아닙니다.',entries},null,2)+'\n');
console.log(Object.fromEntries(['hansol','energy'].map(book=>[book,{pages:new Set(entries.filter(e=>e.book===book).map(e=>e.page)).size,locations:entries.filter(e=>e.book===book).length,linked:entries.filter(e=>e.book===book&&e.sourceId).length}])));
