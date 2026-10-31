// Private work queue only: OCR text is never a public question bank.
import fs from 'node:fs';
const read=p=>JSON.parse(fs.readFileSync(p));
const sources=new Map(read('work/hansol-whole-book/source-index.json').map(q=>[q.id,q]));
const ready=new Set(read('data/textbook-pages.json').entries.filter(e=>e.book==='hansol'&&e.sourceId).map(e=>`${e.page}:${e.number}`));
const held=new Map(read('data/textbook-pages.json').entries.filter(e=>e.book==='hansol'&&!e.sourceId&&e.pendingReason).map(e=>[`${e.page}:${e.number}`,e.pendingReason]));
// Individual review can precede a batch render. Do not requeue already read
// inputs merely because the public correction images have not been rebuilt.
const manual=[...read('tools/hansol-textbook-page-review.json').rows,...read('tools/hansol-book-copy-patches.json').rows];
for(const r of manual){const key=`${r.page}:${r.number}`;if(r.sourceId)ready.add(key);else if(r.reason)held.set(key,r.reason);}
const numberFixes=read('tools/hansol-screen-number-review.json').rows;
const exclusions=read('tools/hansol-individual-review-exclusions.json').rows;
const compact=s=>s.normalize('NFKC').replace(/\s/g,'');
const all=['comparison.json','comparison-columns.json'].map(p=>read(`work/hansol-whole-book/${p}`));const rows=new Map();
for(const [variant,data] of all.entries())for(const q of data.questions){
 const key=`${q.page}:${q.number}`;if(ready.has(key))continue;const candidate=q.candidates[0];if(!candidate)continue;
 if(numberFixes.some(f=>f.page===q.page&&f.column===q.column&&f.rawNumber===q.number&&compact(q.stem).includes(compact(f.contains))))continue;
 if(exclusions.some(f=>f.page===q.page&&f.column===q.column&&f.rawNumber===q.number&&compact(q.stem).includes(compact(f.contains))))continue;
 const score=candidate.stemScore*.65+candidate.choiceScore*.35;
 let kind=held.has(key)?'reviewed-unresolved':q.requiresImageComparison?'image-proof-required':q.candidates.some(c=>c.exact)&&q.printedAnswer==null?'printed-key-needed':candidate.stemScore>=.99&&candidate.choiceScore>=.99&&q.printedAnswer===candidate.answer?'very-close-text':candidate.stemScore>=.95&&candidate.choiceScore>=.95?'close-text':'full-proof-required';
 const row={...q,variant:variant===0?'whole-screen':'column-OCR',kind,score,source:sources.get(candidate.id),...(held.has(key)?{reviewReason:held.get(key)}:{})};
 if(!rows.has(key)||rows.get(key).score<score)rows.set(key,row);
}
const priority={'very-close-text':0,'printed-key-needed':1,'close-text':2,'image-proof-required':3,'full-proof-required':4,'reviewed-unresolved':5};
const queue=[...rows.values()].sort((a,b)=>priority[a.kind]-priority[b.kind]||a.page.localeCompare(b.page,'ko',{numeric:true})||a.number-b.number);
fs.writeFileSync('work/hansol-whole-book/review-queue.json',JSON.stringify({limits:'OCR 후보 수이며 실제 책의 문제 총수/미수록 판정이 아닙니다.',rows:queue},null,2)+'\n');
const publicReady=new Set(read('data/textbook-pages.json').entries.filter(e=>e.book==='hansol'&&e.sourceId).map(e=>`${e.page}:${e.number}`));
fs.writeFileSync('work/hansol-whole-book/individual-progress.json',JSON.stringify({phase:'direct-individual-review-in-progress',publishedLinks:publicReady.size,newReviewedInputs:[...ready].filter(k=>!publicReady.has(k)).length,preparedCorrections:manual.filter(r=>r.correction||r.patches).length,numberFixes:numberFixes.length,reviewedNonQuestionAnchors:exclusions.length,unreviewedCandidates:queue.filter(r=>r.kind!=='reviewed-unresolved').length,reviewedUnresolved:queue.filter(r=>r.kind==='reviewed-unresolved').length,limits:'직접 확인한 입력과 실제 공개 반영/렌더 완료 수는 다릅니다. 전체 개별 검토 완료가 아닙니다.'},null,2)+'\n');
console.log(Object.fromEntries(Object.keys(priority).map(kind=>[kind,queue.filter(r=>r.kind===kind).length])));
