import fs from 'node:fs';
import vm from 'node:vm';
import { coolingMidtermItems, coolingSafetyItems, uniqueSchoolItems, schoolItemBaseKey, coolingTopic, coolingBookSection } from '../src/cbt/schoolQuestionBank';
import { questionId, subjectFor } from '../src/cbt/catalog';
import { coolingCalculation } from '../src/cbt/coolingPractice';
import type { Catalog } from '../src/cbt/types';

// Read every in-scope record; candidate scores never authorize a merge.
const context={window:{} as Record<string,Catalog>};
for(const key of ['hvac','hvac-hansol']) vm.runInNewContext(fs.readFileSync(`data/${key}.js`,'utf8'),context);
const source=Object.values(context.window).flatMap(c=>c.rounds.flatMap(r=>r.questions.map(q=>({round:{...r,qualificationKey:c.key},question:q,id:questionId(r,q),subject:subjectFor(r,q)}))));
const plain=(s:string)=>String(s||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
const norm=(s:string)=>plain(s).normalize('NFKC').toLowerCase().replace(/프레온/g,'프레온').replace(/[^가-힣a-z0-9]/g,'');
const grams=(s:string)=>new Set(Array.from({length:Math.max(0,s.length-1)},(_,i)=>s.slice(i,i+2)));
const sim=(a:Set<string>,b:Set<string>)=>{let n=0;for(const x of a)if(b.has(x))n++;return a.size+b.size?2*n/(a.size+b.size):0;};
const pool=[...coolingMidtermItems(source),...coolingSafetyItems(source)];
const schoolItemKey=schoolItemBaseKey;
const active=[...uniqueSchoolItems(coolingMidtermItems(source),schoolItemKey),...uniqueSchoolItems(coolingSafetyItems(source),schoolItemKey)];
const rows=active.map((item,index)=>{const q=item.question,chapter=coolingTopic(item);return {index,id:item.id,key:schoolItemKey(item),year:item.round.year,session:item.round.session,number:q.number,chapter,section:coolingBookSection(item,chapter),safety:coolingSafetyItems([item]).length>0,calculation:coolingCalculation(item),text:plain(q.text||q.html||q.ocrText||''),choices:q.choices.map(c=>plain(c.text||c.html||'')),answer:q.answer,correct:plain(q.choices[q.answer-1]?.text||q.choices[q.answer-1]?.html||''),sourceImage:q.sourceImage||'',images:[...(q.images||[]),...q.choices.flatMap(c=>c.images||[])],members:pool.filter(m=>schoolItemKey(m)===schoolItemKey(item)).map(m=>m.id)};});
const prepared=rows.map(r=>({stem:grams(norm(r.text)),correct:grams(norm(r.correct)),choices:r.choices.map(c=>grams(norm(c))),optionSet:r.choices.map(norm).sort().join('|')}));
const pairs:Array<{a:number,b:number,stem:number,correct:number,options:number,score:number}>=[];
for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
 const a=prepared[i],b=prepared[j],stem=sim(a.stem,b.stem),correct=sim(a.correct,b.correct);
 if(stem<.22&&correct<.6)continue;
 const best=(x:Set<string>[],y:Set<string>[])=>x.reduce((n,c)=>n+Math.max(...y.map(d=>sim(c,d))),0)/4;
 const options=(best(a.choices,b.choices)+best(b.choices,a.choices))/2;
 if(stem>=.50 || stem>=.29&&options>=.58 || stem>=.22&&correct>=.72 || a.optionSet===b.optionSet&&stem>=.22){
 pairs.push({a:i,b:j,stem,correct,options,score:stem*.5+correct*.3+options*.2});
 }
}
pairs.sort((a,b)=>b.score-a.score);
fs.mkdirSync('work/cooling-duplicate-review',{recursive:true});
fs.writeFileSync('work/cooling-duplicate-review/inventory.json',JSON.stringify({raw:pool.length,active:rows.length,rows,pairs},null,2)+'\n');
fs.writeFileSync('work/cooling-duplicate-review/inventory.txt',rows.map(r=>`${r.index} ${r.id} [${r.chapter}/${r.section}${r.safety?' 안전':''}${r.calculation?' 계산':''}] ${r.text} => ${r.answer}:${r.correct}${r.images.length?' [그림]':''}`).join('\n')+'\n');
fs.writeFileSync('work/cooling-duplicate-review/pairs.txt',pairs.map((p,i)=>{const a=rows[p.a],b=rows[p.b];return `${i} (${p.a},${p.b}) ${p.stem.toFixed(2)}/${p.correct.toFixed(2)}/${p.options.toFixed(2)}\nA ${a.id}: ${a.text} [${a.choices.map((c,i)=>`${i+1}${i+1===a.answer?'*':''}:${c}`).join(' | ')}]\nB ${b.id}: ${b.text} [${b.choices.map((c,i)=>`${i+1}${i+1===b.answer?'*':''}:${c}`).join(' | ')}]`;}).join('\n')+'\n');
console.log(JSON.stringify({raw:pool.length,active:rows.length,candidates:pairs.length,visual:rows.filter(r=>r.images.length||/그림|선도|도면|표에서/.test(r.text)).length}));
