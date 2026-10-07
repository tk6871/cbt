// Candidate search only. Never auto-publishes OCR or declares a duplicate.
import fs from 'node:fs';
import vm from 'node:vm';
const context={window:{}};
vm.runInNewContext(fs.readFileSync('data/energy.js','utf8'),context);
const originals=context.window.CBT_DATA_ENERGY.rounds.flatMap(r=>r.questions.map(q=>({date:r.date,number:q.number,text:q.text,choices:q.choices.map(c=>c.text),answer:q.answer})));
const clean=s=>s.replace(/<[^>]+>/g,'').replace(/[^가-힣a-z0-9]/gi,'').toLowerCase();
const grams=s=>new Set(Array.from({length:Math.max(0,s.length-2)},(_,i)=>s.slice(i,i+3)));
const score=(a,b)=>{let n=0;for(const g of a)if(b.has(g))n++;return 2*n/(a.size+b.size||1);};
const bank=originals.map(q=>({...q,g:grams(clean([q.text,...q.choices].join('')))}));
const manifest=JSON.parse(fs.readFileSync('work/practical-verification/energy-midterm-pdf/manifest.json','utf8'));
const rows=manifest.map(row=>{
 const g=grams(clean(row.ocrReviewOnly.join('')));
 return {key:row.key,candidates:bank.map(q=>({...q,g:undefined,score:score(g,q.g)})).sort((a,b)=>b.score-a.score).slice(0,2)};
});
fs.writeFileSync('work/practical-verification/energy-midterm-pdf/overlap-candidates.json',JSON.stringify(rows,null,2));
for(const row of rows)console.log(`${row.key}: ${row.candidates.map(c=>`${c.date}/${c.number} ${c.score.toFixed(2)} ${c.text} [${c.choices.join('|')}] A${c.answer}`).join('\n  ')}`);
