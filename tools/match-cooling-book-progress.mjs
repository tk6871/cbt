// Local, read-only question-bank matching. Never changes the published pool.
import fs from 'node:fs';
import vm from 'node:vm';
const input = 'work/cooling-book-scope/core-questions-progress.json';
const output = 'work/cooling-book-scope/match-candidates.json';
const progress = JSON.parse(fs.readFileSync(input, 'utf8'));
const context = { window:{} };
for (const key of ['hvac', 'hvac-hansol']) vm.runInNewContext(fs.readFileSync(`data/${key}.js`,'utf8'),context);
const plain = value => String(value || '').normalize('NFC').replace(/<[^>]*>/g,' ').replace(/&[^;]+;/g,' ').replace(/[^가-힣a-zA-Z0-9]/g,'').toLowerCase();
const grams = text => new Set(Array.from({length:Math.max(0,text.length-1)},(_,i)=>text.slice(i,i+2)));
const items = Object.values(context.window).flatMap(bank=>bank.rounds.flatMap(round=>round.questions.map(question=>({
  id:`${question._originRoundId || round.id}:${question._originalNumber || question.number}`,
  source:bank.key, year:round.year, session:round.session, question,
  stem:plain(question.text || question.html || question.ocrText),
}))));
const rows = progress.questions.map(([page,number,source,query])=>{
  const years = [...source.matchAll(/(\d{2})년/g)].map(m=>2000+Number(m[1]));
  const needle=plain(query), ngrams=grams(needle);
  const candidates=items.filter(item=>years.includes(item.year)
    && item.source === (item.year>=2017?'hvac-hansol':'hvac')).map(item=>{
      const words=grams(item.stem);
      const overlap=[...ngrams].filter(g=>words.has(g)).length;
      return { id:item.id,year:item.year,session:item.session,
        score:item.stem.includes(needle)?1:overlap/Math.max(1,ngrams.size),
        queryContained:item.stem.includes(needle),
        stem:item.question.text || item.question.html || item.question.ocrText || '',
      };
    }).filter(item=>item.score>=.45).sort((a,b)=>b.score-a.score||b.year-a.year).slice(0,3);
  return {page,number,source,query,status:'candidate-not-approved',candidates};
});
const result={date:progress.date,status:'partial-unverified-not-applied',
  limits:'Short query matching is not question, option, number, diagram or answer equality. Requires full comparison before release.',
  total:rows.length,withCandidates:rows.filter(r=>r.candidates.length).length,
  withContainedQuery:rows.filter(r=>r.candidates.some(c=>c.queryContained)).length,rows};
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,rows:undefined},null,2));
