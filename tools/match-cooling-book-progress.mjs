// Local, read-only question-bank matching. Never changes the published pool.
import fs from 'node:fs';
import vm from 'node:vm';
const input = 'work/cooling-book-scope/core-questions-progress.json';
const output = 'work/cooling-book-scope/match-candidates.json';
const progress = JSON.parse(fs.readFileSync(input, 'utf8'));
for (const name of ['structure-questions-progress.json', 'native-questions-progress.json',
  'theory-practical-progress.json', 'examples-progress.json']) {
  const supplemental = `work/cooling-book-scope/${name}`;
  if (fs.existsSync(supplemental)) progress.questions.push(...JSON.parse(fs.readFileSync(supplemental,'utf8')).questions);
}
const locations = new Set();
for (const [page,number] of progress.questions) {
  const key = `${page}:${number}`;
  if (locations.has(key)) throw new Error(`Duplicate book location: ${key}`);
  locations.add(key);
}
const context = { window:{} };
for (const key of ['hvac', 'hvac-hansol']) vm.runInNewContext(fs.readFileSync(`data/${key}.js`,'utf8'),context);
const plain = value => String(value || '').normalize('NFC').replace(/<[^>]*>/g,' ').replace(/&[^;]+;/g,' ').replace(/[^가-힣a-zA-Z0-9]/g,'').toLowerCase();
const grams = text => new Set(Array.from({length:Math.max(0,text.length-1)},(_,i)=>text.slice(i,i+2)));
const items = Object.values(context.window).flatMap(bank=>bank.rounds.flatMap(round=>round.questions.map(question=>({
  id:`${question._originRoundId || round.id}:${question._originalNumber || question.number}`,
  source:bank.key, year:round.year, session:round.session, roundId:round.id, question,
  stem:plain(question.text || question.html || question.ocrText),
}))));
const rows = progress.questions.map(([page,number,source,query])=>{
  const years = [...source.matchAll(/(\d{2})년/g)].map(m=>2000+Number(m[1]));
  const needle=plain(query), ngrams=grams(needle);
  const citedSessions = [...source.matchAll(/(\d{2})년\s*(\d)회/g)]
    .map(m=>({year:2000+Number(m[1]),session:`${m[2]}회`}));
  const candidates=items.filter(item=>(!years.length || years.includes(item.year))
    && item.year>=2006 && item.year<=2023
    && !(item.source==='hvac' && item.year===2006 && item.roundId<'hvac-20060816')
    && item.source === (item.year>=2017?'hvac-hansol':'hvac')
    && (!/^\d회$/.test(item.session) || !citedSessions.length
      || citedSessions.some(s=>s.year===item.year && s.session===item.session))).map(item=>{
      const words=grams(item.stem);
      const overlap=[...ngrams].filter(g=>words.has(g)).length;
      return { id:item.id,source:item.source,year:item.year,session:item.session,
        score:item.stem.includes(needle)?1:overlap/Math.max(1,ngrams.size),
        queryContained:item.stem.includes(needle),
        stem:item.question.text || item.question.html || item.question.ocrText || '',
        options:item.question.choices, answer:item.question.answer,
        image:item.question.sourceImage || null, images:item.question.images || [],
      };
    }).filter(item=>item.score>=.45).sort((a,b)=>b.score-a.score||b.year-a.year).slice(0,3);
  return {page,number,source,query,status:'candidate-not-approved',
    sourceSessionVerified:false,candidates};
});
const result={date:progress.date,status:'partial-unverified-not-applied',
  limits:'Short query matching is not question, option, number, diagram or answer equality. Requires full comparison before release.',
  total:rows.length,withCandidates:rows.filter(r=>r.candidates.length).length,
  withContainedQuery:rows.filter(r=>r.candidates.some(c=>c.queryContained)).length,rows};
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,rows:undefined},null,2));
