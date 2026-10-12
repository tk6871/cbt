// Private book question-unit index. Number detection is a search helper, not a
// claim that all OCR question boundaries are correct. Full-window fallback stays.
import fs from 'node:fs';
const root='work/energy-book-scope';
const report=JSON.parse(fs.readFileSync('docs/energy-midterm-book-scope-2026-10-12.json'));
const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/<[^>]*>|&[^;]+;/g,' ').replace(/\(오류 신고[\s\S]*/,'').replace(/[^가-힣a-z0-9]/g,'');
const bigrams=s=>[...new Set(Array.from({length:Math.max(0,s.length-1)},(_,i)=>s.slice(i,i+2)))];
const units=[];
for(let page=1;page<=634;page++){
 const p=JSON.parse(fs.readFileSync(`${root}/ocr/page-${page}.json`));
 for(const side of [0,1]){
  const rows=p.rows.filter(r=>(r.box[0]>=.48?1:0)===side).sort((a,b)=>b.box[1]+b.box[3]-a.box[1]-a.box[3]);
  const starts=rows.flatMap((r,i)=>/^(\d{1,2})(?!\d)[ .]*[가-힣a-zA-Z(Δ△0-9]/.test(r.text)&&r.text.length>=12?[i]:[]);
  for(let j=0;j<starts.length;j++){
   const start=starts[j],next=starts[j+1]??rows.length;
   let selected=rows.slice(start,next),stop=selected.findIndex((r,i)=>i>0&&/^해[설실]/.test(r.text));
   if(stop>0)selected=selected.slice(0,stop);
   const text=selected.map(r=>r.text).join('\n');
   if(!/[?？]/.test(text))continue;
   units.push({page,side,start,number:Number(rows[start].text.match(/^\d+/)[0]),text,normalized:norm(text),boxes:selected.map(r=>r.box)});
  }
 }
}
const rows=report.rows.map((q,index)=>{
 const query=bigrams(norm(q.question)),choiceQueries=q.choices.map(c=>bigrams(norm(c)));
 const score=(g,s)=>g.length?g.filter(x=>s.includes(x)).length/g.length:0;
 const candidates=units.map(u=>{const question=score(query,u.normalized),choices=choiceQueries.map(c=>score(c,u.normalized));return{u,question,choices,score:.65*question+.35*choices.reduce((a,b)=>a+b,0)/4}}).sort((a,b)=>b.score-a.score);
 const chosen=[],seen=new Set();
 for(const c of candidates){const key=`${c.u.page}:${c.u.side}:${c.u.number}`;if(seen.has(key))continue;seen.add(key);chosen.push({...c.u,normalized:undefined,score:+c.score.toFixed(3),questionScore:+c.question.toFixed(3),choiceScores:c.choices.map(n=>+n.toFixed(3))});if(chosen.length===12)break;}
 return{index,id:q.id,status:q.status,active:q.active,question:q.question,choices:q.choices,answer:q.storedAnswer,candidates:chosen};
});
fs.writeFileSync(`${root}/question-units.json`,JSON.stringify({source:report.source,units:units.length,rows},null,2)+'\n');
console.log({questionUnits:units.length,bankQuestions:rows.length});
