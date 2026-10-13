// Reviewed scope decisions; book-first candidates plus prior visual source proofs.
// Does not infer correctness/duplicates from a keyword or an OCR score.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const root='work/energy-book-scope';
const inventory=JSON.parse(fs.readFileSync('docs/energy-textbook-inventory-2026-10-13.json'));
const candidates=JSON.parse(fs.readFileSync(`${root}/book-first-topic-candidates.json`));
const verified=JSON.parse(fs.readFileSync('docs/energy-midterm-book-scope-2026-10-12.json'));
const key=q=>`${q.year}-${q.session}-${q.number}`;
const selected=new Map();
const excluded=new Map([
 ['2019-1-20','연료 장단점이 아니라 여과기 설치방법'],
 ['2022-2-30','철·망간은 온도계 소자 재료이며 급수처리가 아님'],
 ['2024-2-33','트랩 앞에 설치하는 여과기 종류 질문'],
 ['2024-2-46','역화는 보기일 뿐 불꽃 들뜸 현상 질문'],
]);
const relatedOverrides=new Set(['2018-2-8','2018-2-26','2018-4-16','2021-1-51','2022-2-63','2022-2-65','2023-4-3','2025-2-6','2025-2-20']);
for(const q of candidates.rows.filter(q=>q.topicCandidates.length)){
 if(excluded.has(key(q)))continue;
 let topic=q.topicCandidates[0];
 if(['2021-2-64','2025-1-77'].includes(key(q)))topic=18;
 selected.set(key(q),{key:key(q),year:q.year,session:q.session,number:q.number,page:q.pdfPage,topic,
  related:[13,17].includes(topic)||relatedOverrides.has(key(q)),legacyIds:[]});
}
for(const old of verified.rows.filter(q=>q.confirmed))for(const e of old.evidence){
 const round=inventory.rounds.find(r=>e.pdfPage>=r.firstPdfPage&&e.pdfPage<=r.answerPdfPage);
 const number=e.bookQuestionNumber??e.number;
 assert.ok(round&&number,`Missing book source: ${old.id}`);
 const q={year:round.year,session:round.session,number};
 if(excluded.has(key(q)))continue;
 if(!selected.has(key(q)))selected.set(key(q),{key:key(q),...q,page:e.pdfPage,topic:old.topic,
  related:[13,17].includes(old.topic),legacyIds:[]});
 selected.get(key(q)).legacyIds.push(old.id);
}
// This note-related combustion-temperature question does not literally say
// '연소실 온도' in its stem. Include its visually established book location.
for(const [year,session,number,page,topic] of [[2020,3,8,417,5]]){
 const q={year,session,number};if(!selected.has(key(q)))selected.set(key(q),{key:key(q),...q,page,topic,related:false,legacyIds:[]});
}
const rows=[...selected.values()].sort((a,b)=>a.year-b.year||String(a.session).localeCompare(String(b.session))||a.number-b.number);
for(const q of rows)q.answerPage=inventory.rounds.find(r=>r.year===q.year&&r.session===q.session).answerPdfPage;
fs.writeFileSync(`${root}/book-selection-plan.json`,JSON.stringify({source:inventory.source,rows,excluded:[...excluded].map(([key,reason])=>({key,reason}))},null,2)+'\n');
console.log({occurrences:rows.length,topics:Array.from({length:20},(_,i)=>rows.filter(q=>q.topic===i+1).length)});
