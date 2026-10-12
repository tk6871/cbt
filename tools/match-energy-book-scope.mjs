import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const directory='work/energy-book-scope';
const context={window:{}};
vm.runInNewContext(fs.readFileSync('data/energy-midterm.js','utf8'),context);
const plain=s=>(s||'').normalize('NFKC').replace(/<[^>]*>/g,' ').replace(/&[a-z#0-9]+;/gi,' ').replace(/\(오류 신고[\s\S]*/,'').replace(/[^가-힣a-zA-Z0-9]/g,'').toLowerCase();
const grams=s=>new Set(Array.from({length:Math.max(0,s.length-1)},(_,i)=>s.slice(i,i+2)));
const overlap=(query,found)=>query.size?[...query].filter(g=>found.has(g)).length/query.size:0;
const manifest=JSON.parse(fs.readFileSync(`${directory}/ocr/_source.json`));
assert.equal(manifest.sha256,'840565d198cbbfe871b25a08e2bcb9b2d3dbdcbbadead2b2ca031308caed767d','Different source PDF');
const pages=fs.readdirSync(`${directory}/ocr`).filter(f=>/^page-\d+\.json$/.test(f)).map(f=>JSON.parse(fs.readFileSync(`${directory}/ocr/${f}`))).sort((a,b)=>a.page-b.page);
assert.equal(pages.length,manifest.pages,'Incomplete OCR search cache');
assert.ok(pages.every((p,i)=>p.page===i+1),'Missing or repeated PDF page');
const windows=[];
for(const page of pages) for(const side of [0,1]) {
 const rows=page.rows.filter(r=>(r.box[0]>=.48?1:0)===side).sort((a,b)=>(1-a.box[1]-a.box[3])-(1-b.box[1]-b.box[3]));
 for(let start=0;start<rows.length;start++){
  const chosen=rows.slice(start,start+15),text=chosen.map(r=>r.text).join('\n');
  const normalized=plain(text);
  windows.push({page:page.page,side,start,rows:chosen,text,normalized,grams:grams(normalized)});
 }
}
const questions=context.window.CBT_DATA_ENERGY_MIDTERM.rounds.flatMap((r,i)=>r.questions.map(q=>({topic:i+1,id:`${q._originRoundId}:${q._originalNumber}`,q})));
const result=[];
for(const item of questions.filter(i=>!i.q.bookVerified)) {
 const query=grams(plain(item.q.text||item.q.html)),choices=item.q.choices.map(c=>grams(plain(c.text||c.html)));
 const candidates=windows.map(w=>{
  const question=overlap(query,w.grams),choiceScores=choices.map(g=>overlap(g,w.grams));
  return {w,question,choiceScores,score:question*.65+choiceScores.reduce((a,b)=>a+b,0)/4*.35};
 }).sort((a,b)=>b.score-a.score);
 const best=[],seen=new Set();
 for(const c of candidates){if(seen.has(c.w.page))continue;seen.add(c.w.page);best.push({page:c.w.page,side:c.w.side,start:c.w.start,score:+c.score.toFixed(3),questionScore:+c.question.toFixed(3),choiceScores:c.choiceScores.map(s=>+s.toFixed(3)),text:c.w.text,boxes:c.w.rows.map(r=>r.box)});if(best.length===4)break;}
 const questionCandidates=[],questionSeen=new Set();
 for(const c of [...candidates].sort((a,b)=>b.question-a.question||b.score-a.score)){
  if(questionSeen.has(c.w.page))continue;
  questionSeen.add(c.w.page);
  questionCandidates.push({page:c.w.page,side:c.w.side,start:c.w.start,questionScore:+c.question.toFixed(3),text:c.w.text,boxes:c.w.rows.map(r=>r.box)});
  if(questionCandidates.length===4)break;
 }
 result.push({...item,candidates:best,questionCandidates});
}
fs.writeFileSync(`${directory}/candidates.json`,JSON.stringify({pages:pages.length,rows:result},null,2)+'\n');
fs.writeFileSync(`${directory}/candidates.txt`,result.map((i,n)=>`${n} ${i.id} T${i.topic} ${i.q.midtermDuplicateOf?'retired':'active'}\nQ ${i.q.text}\n${i.q.choices.map((c,j)=>`${j+1} ${c.text||c.html}`).join('\n')}\nA ${i.q.answer}\n${i.candidates.map(c=>`PAGE ${c.page} SCORE ${c.score} Q${c.questionScore} C${c.choiceScores.join('/')}\n${c.text}`).join('\n---\n')}`).join('\n\n====\n\n'));
console.log({pages:pages.length,pending:result.length,windows:windows.length});
