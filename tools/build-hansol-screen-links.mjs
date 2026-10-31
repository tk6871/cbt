// Export location links only. Screen/OCR text and book solutions stay private.
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {loadHansolReview} from './load-hansol-textbook-review.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const files=['data/hvac.js','data/hvac-hansol.js'];const c={window:{}};
for(const file of files)vm.runInNewContext(fs.readFileSync(file,'utf8'),c);
const source=new Map(Object.values(c.window).flatMap(b=>b.rounds.flatMap(r=>r.questions.map(q=>[`${r.id}:${q.number}`,q]))));
const entities={nbsp:' ',amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",times:'×',divide:'÷',middot:'·',deg:'°',sup2:'²',sup3:'³',pi:'π',Delta:'Δ'};
const norm=s=>String(s||'').replace(/<\/?(?:p|br|div|span|sup|sub|img|table|tbody|tr|td|strong|b|i|em|a|font)(?:\s[^>]*)?\/?>/gi,' ').replace(/&([A-Za-z0-9]+);/g,(all,key)=>entities[key]??all).replace(/&#(x[\da-f]+|\d+);/gi,(_,n)=>String.fromCodePoint(n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n))).replace(/[•ㆍ․・]/g,'·').normalize('NFKC').replace(/[–—−]/g,'-').replace(/[⁄∕]/g,'/').replaceAll('∆','Δ').replace(/[^\p{L}\p{N}_+\-*/=<>.%°℃~×÷±√∞≈≤≥≠→↔()\[\]{}:·]/gu,'').replaceAll('_','').replace(/\.$/,'');
assert.notEqual(norm('1 mW'),norm('1 MW'));assert.notEqual(norm('2~3'),norm('23'));assert.notEqual(norm('(1+2)*3'),norm('1+2*3'));assert.equal(norm('∞'),'∞');assert.equal(norm('A<B'),'A<B');
assert.equal(norm('−9'),norm('-9'));assert.notEqual(norm('−9'),norm('9'));assert.notEqual(norm('1:4'),norm('14'));assert.equal(norm('½'),norm('1/2'));assert.notEqual(norm('½'),norm('12'));
assert.equal(norm('냉ㆍ난방'),norm('냉·난방'));assert.equal(norm('kg•K'),norm('kg·K'));assert.equal(norm('1.2 m.'),norm('1.2 m'));assert.notEqual(norm('1.2 m'),norm('12 m'));
const normalizeStem=s=>norm(String(s||'').replace(/^\s*\d+[.．)](?!\d)\s*/,''));
assert.equal(normalizeStem('1.2 kW'),norm('1.2 kW'));
const variants=['comparison.json','comparison-columns.json'].map(file=>read(`work/hansol-whole-book/${file}`));
assert.ok(variants.every(v=>v.spreads.length===620),'Whole screen comparison has not finished');
const capture=read('work/hansol-whole-book/capture-progress.json');assert.equal(capture.status,'end-observed-captured-not-compared');assert.equal(capture.readerRestored?.progress,80);
const previousAutomatic=new Map((fs.existsSync('data/hansol-screen-links.json')?read('data/hansol-screen-links.json').rows:[]).map(r=>[`${r.page}:${r.number}`,r]));
function usableExactSource(q,row){
 return !!q&&q.answer===row.printedAnswer&&!q.images?.length&&!q.choices.some(c=>c.images?.length)&&!/<img\b/i.test(q.html||'')&&!/\p{Co}/u.test([q.text,q.html,...q.choices.map(c=>c.text||c.html)].join(' '))
  &&normalizeStem(q.text||q.html)===norm(row.stem)&&JSON.stringify(q.choices.map(c=>norm(c.text||c.html)))===JSON.stringify(row.choices);
}
const grouped=new Map();const candidates=new Map();
for(const [variant,v] of variants.entries())for(const row of v.questions){
 const key=`${row.page}:${row.number}`;const list=candidates.get(key)||[];list.push({...row,variant});candidates.set(key,list);
 if(row.status!=='exact-screen-and-printed-answer'||!row.sourceId||row.requiresImageComparison||row.printedAnswerConflict)continue;
 const q=source.get(row.sourceId);assert.ok(q,row.sourceId);assert.equal(q.answer,row.printedAnswer);
 // Consider all verified exact alternatives. A previous automatic ID is only
 // a tie preference after fresh full validation, never a protected/skip entry.
 // That keeps valid study IDs stable without the old self-erasing output bug.
 const ids=new Set([row.sourceId,...row.candidates.filter(c=>c.exact&&c.answer===row.printedAnswer).map(c=>c.id),previousAutomatic.get(key)?.sourceId].filter(Boolean));
 for(const sourceId of ids){if(!usableExactSource(source.get(sourceId),row))continue;
  const old=grouped.get(key)||[];old.push({...row,sourceId,variant});grouped.set(key,old);
 }
}
// Base the protected set on the independent reviewed inputs, never on this
// generator's prior output (otherwise a second run would erase new links).
const established=new Map(read('data/cooling-midterm-book-review.json').rows.map(r=>[`${r.page}:${r.number}`,{page:r.page,number:r.number,sourceId:r.status.startsWith('confirmed')?r.id:null}]));
for(const row of loadHansolReview(source).rows)established.set(`${row.page}:${row.number}`,row);
for(const [number,sourceId] of [[17,'hvac-hansol-2024-1:6'],[18,'hvac-hansol-2024-1:8'],[19,'hvac-hansol-2024-1:9'],[20,'hvac-hansol-2024-1:7'],[21,'hvac-hansol-2024-2:21']])established.set(`4-10:${number}`,{page:'4-10',number,sourceId});
const existing=[...established.values()];const existingMap=established;
const links=[];const conflicts=[];
for(const [key,rows] of grouped){
 const previous=existingMap.get(key);
 if(previous?.reviewHold)continue;
 // Preserve established source IDs so book study records never move silently.
 const ordered=[...rows].sort((a,b)=>Number(!a.sourceId.startsWith('hvac-hansol-'))-Number(!b.sourceId.startsWith('hvac-hansol-'))||a.sourceId.localeCompare(b.sourceId)||a.variant-b.variant);
 const chosen=ordered.find(r=>r.sourceId===previous?.sourceId)||ordered.find(r=>r.sourceId===previousAutomatic.get(key)?.sourceId)||ordered[0];
 if(previous?.sourceId){
  if(!rows.some(r=>r.sourceId===previous.sourceId))conflicts.push({page:chosen.page,number:chosen.number,existingSourceId:previous.sourceId,exactCandidate:chosen.sourceId});
  continue;
 }
 links.push({page:chosen.page,number:chosen.number,sourceId:chosen.sourceId,answer:chosen.printedAnswer,column:chosen.column,method:'exact-stem-four-ordered-choices-printed-key',variants:[...new Set(rows.map(r=>r.variant===0?'whole-screen':'column-OCR'))]});
}
links.sort((a,b)=>a.page.localeCompare(b.page,'ko',{numeric:true})||a.number-b.number);
const pages=read('work/hansol-whole-book/page-map.json');
const confirmed=new Set([...existing.filter(e=>e.sourceId),...links].map(e=>`${e.page}:${e.number}`));
const held=new Set(existing.filter(e=>e.reviewHold).map(e=>`${e.page}:${e.number}`));
const auditPages=[...new Map(pages.pages.filter(p=>p.page).map(p=>[p.page,p])).values()].map(p=>{
 const detected=[...candidates.keys()].filter(key=>key.startsWith(`${p.page}:`));
 return {page:p.page,basis:p.basis,detectedPositions:detected.length,
  linkedPositions:[...confirmed].filter(key=>key.startsWith(`${p.page}:`)).length,
  heldPositions:[...held].filter(key=>key.startsWith(`${p.page}:`)).length,
  unconfirmedCandidates:detected.filter(key=>!confirmed.has(key)&&!held.has(key)).length};
});
const imageComparison=fs.existsSync('work/hansol-whole-book/source-image-comparison.json')?read('work/hansol-whole-book/source-image-comparison.json'):null;
fs.writeFileSync('data/hansol-screen-links.json',JSON.stringify({date:'2026-10-31',limits:'정상 열람 화면과 열별 OCR에서 지문·4보기 순서·인쇄 정답이 일치한 기존 CBT 연결만 사용합니다. 전체 문항의 육안 검증 완료나 미연결 문항의 부재를 뜻하지 않습니다.',sourceHashes:Object.fromEntries(files.map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')])),rows:links},null,2)+'\n');
fs.writeFileSync('work/hansol-whole-book/established-link-differences.json',JSON.stringify(conflicts,null,2)+'\n');
const audit={date:'2026-10-31',book:'hansol',normalScreensRead:620,columnOcrRegions:2480,readerEndObserved:true,readerSettingsRestored:true,status:'whole-screen-comparison-finished-question-review-continues',pages:auditPages,exactNewLinks:links.length,establishedLinksPreserved:existing.filter(e=>e.sourceId).length,...(imageComparison?{sourceImagesRechecked:imageComparison.sourceImagesRead,sourceImageCandidatesCompared:imageComparison.remainingCandidatesCompared}:{}),limits:'전체 화면 자동 대조가 끝났습니다. 수식·그림·인식이 불완전한 문항은 추가 검토가 남아 있으며, 확인되지 않은 문항을 임의 대체하거나 원문 OCR로 출제하지 않습니다.'};
fs.writeFileSync('data/textbook-page-audit.json',JSON.stringify(audit,null,2)+'\n');
console.log({newLinks:links.length,existingLinked:existing.filter(e=>e.sourceId).length,pages:audit.pages.length,establishedDifferences:conflicts.length});
