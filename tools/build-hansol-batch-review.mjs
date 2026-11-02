// Normal-reader captures/OCR stay PRIVATE. This tool never edits a bank/link.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {classify,digest,topicFor,riskNames,differenceMarkup} from './hansol-batch-review-lib.mjs';
import {pageHtml} from './hansol-batch-review-page.mjs';
const root=path.resolve(import.meta.dirname,'..'),work=path.join(root,'work/hansol-whole-book'),out=path.join(work,'batch-review');
// Refresh cheap indexes only. No capture, OCR, bank publishing or image render.
for(const script of ['index-hansol-screen-sources.mjs','build-hansol-review-queue.mjs'])execFileSync(process.execPath,[path.join(root,'tools',script)],{cwd:root,stdio:'pipe'});
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const sourceIndex=read('work/hansol-whole-book/source-index.json'),sources=new Map(sourceIndex.map(r=>[r.id,r]));
const comparisons=['comparison.json','comparison-columns.json'].flatMap(p=>JSON.parse(fs.readFileSync(path.join(work,p),'utf8')).questions);
const queue=read('work/hansol-whole-book/review-queue.json').rows;
const manual=[...read('tools/hansol-textbook-page-review.json').rows,...read('tools/hansol-book-copy-patches.json').rows];
const fixes=read('tools/hansol-screen-number-review.json').rows;
const entries=read('data/textbook-pages.json').entries.filter(r=>r.book==='hansol');
const confirmed=new Map(entries.filter(r=>r.sourceId).map(r=>[`${r.page}:${r.number}`,r]));
const holds=new Map(entries.filter(r=>!r.sourceId&&r.pendingReason).map(r=>[`${r.page}:${r.number}`,r]));
for(const r of manual){const key=`${r.page}:${r.number}`;if(r.sourceId){confirmed.set(key,r);holds.delete(key);}else if(r.reason){confirmed.delete(key);holds.set(key,{...r,pendingReason:r.reason});}}
const canonical=q=>fixes.find(f=>f.page===q.page&&f.column===q.column&&f.rawNumber===q.number&&q.stem.replace(/\s/g,'').includes(f.contains.replace(/\s/g,'')))?.number??q.number;
function anchor(page,number){return comparisons.find(q=>q.page===page&&canonical(q)===number);}
const fileHashes=new Map(),dimensions=new Map();
function assetHash(file){
 if(!file)return null;
 if(path.isAbsolute(file)||file.split(/[\\/]/).includes('..'))throw new Error(`Unsafe asset path: ${file}`);
 if(!fileHashes.has(file))fileHashes.set(file,fs.existsSync(path.join(root,file))?crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'):'MISSING');
 return fileHashes.get(file);
}
function imageSize(file){
 if(dimensions.has(file))return dimensions.get(file);
 const fd=fs.openSync(path.join(root,file),'r'),header=Buffer.alloc(24);try{fs.readSync(fd,header,0,24,0);}finally{fs.closeSync(fd);}
 if(header.toString('hex',0,8)!=='89504e470d0a1a0a')throw new Error('Expected PNG screen');
 const size=[header.readUInt32BE(16),header.readUInt32BE(20)];dimensions.set(file,size);return size;
}
function snapshot(q,source){
 const screen=q?.spread?`work/hansol-whole-book/screens/spread-${String(q.spread).padStart(4,'0')}.png`:null;
 const assets=[source?.sourceImage,...source?.images||[],...(source?.choiceImages||[]).flat()].filter(Boolean);
 return {screen,screenHash:assetHash(screen),screenSize:screen?imageSize(screen):null,bounds:q?.bounds||null,sourceHash:digest(source||null),assetHashes:Object.fromEntries(assets.map(p=>[p,assetHash(p)]))};
}
fs.mkdirSync(out,{recursive:true});
const baselinePath=path.join(out,'confirmed-baseline.json');
const baseline=fs.existsSync(baselinePath)?JSON.parse(fs.readFileSync(baselinePath,'utf8')):{version:1,limits:'이 기준은 생성 당시 파일 상태입니다. 과거 개별 검수 당시의 이미지 해시를 증명하지 않습니다.',rows:{}};
const changed=[];let unchanged=0,newBaselines=0;
for(const [key,r] of confirmed){
 const q=anchor(r.page,r.number),source=sources.get(r.sourceId);
 const fp=digest({entry:r,snapshot:snapshot(q,source)});
 if(!baseline.rows[key]){baseline.rows[key]=fp;newBaselines++;}
 else if(baseline.rows[key]!==fp)changed.push({...q,page:r.page,number:r.number,source,candidates:[{id:r.sourceId,stemScore:1,choiceScore:1}],changedConfirmed:true,reviewReason:'확정 기준 생성 후 책 캡처·원문·검토 입력이 바뀌었습니다.'});
 else unchanged++;
}
const raw=[...queue];
const seen=new Set(raw.map(r=>`${r.page}:${r.number}`));
for(const [key,r] of holds)if(!seen.has(key)){
 const q=anchor(r.page,r.number);raw.push({...q,page:r.page,number:r.number,kind:'reviewed-unresolved',source:sources.get(r.candidateSourceId)||null,reviewReason:r.pendingReason,candidates:q?.candidates||[]});seen.add(key);
}
const rows=[...changed,...raw].map(r=>{
 const source=r.source||sources.get(r.candidates?.[0]?.id)||null;
 const s=snapshot(r,source),key=`${r.page}:${r.number}`;
 const row={...r,source,key,part:r.page.split('-')[0],topic:topicFor({...r,source}),...classify({...r,source}),snapshot:s};
 row.fields=row.fields.map(field=>({...field,diff:differenceMarkup(field.book,field.source)}));
 row.fingerprint=digest({key,stem:r.stem,choices:r.choices,printedAnswer:r.printedAnswer,reviewReason:r.reviewReason,snapshot:s});
 return row;
}).sort((a,b)=>a.priority-b.priority||a.topic.localeCompare(b.topic,'ko')||a.page.localeCompare(b.page,'ko',{numeric:true})||a.number-b.number);
if(new Set(rows.map(r=>r.key)).size!==rows.length)throw new Error('Duplicate location in batch review');
const manifest={schemaVersion:1,limits:'비공개 비교 보조자료. OCR 차이는 실제 책의 오류 판정이 아닙니다. 클릭 결과는 공개 문제/정답/연결에 자동 반영되지 않습니다.',summary:{unreviewed:queue.filter(r=>r.kind!=='reviewed-unresolved').length,held:holds.size,reviewedUnchanged:unchanged,newBaselines,changedConfirmed:changed.length,total:rows.length,riskCounts:Object.fromEntries(Object.keys(riskNames).map(k=>[k,rows.filter(r=>r.risk===k).length]))},riskNames,rows};
fs.writeFileSync(baselinePath,JSON.stringify(baseline,null,2)+'\n');
fs.writeFileSync(path.join(out,'triage.json'),JSON.stringify(manifest)+'\n');
fs.writeFileSync(path.join(out,'index.html'),pageHtml);
console.log(JSON.stringify(manifest.summary,null,2));
console.log('Private review: work/hansol-whole-book/batch-review/index.html');
