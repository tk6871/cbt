// Conservative: same whole OCR, or same stem, four answers and right answer
// when options move. Never silently discard numbers, units or negative words.
// Do not merge OCR fragments, illustrations or just a similar numerical formula.
import fs from 'node:fs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const texts=read('data/energy-textbook-search.json').texts;
const packed=fs.readdirSync('modern').find(f=>/^textbook-energy-sources-v\d+\.json$/.test(f));
const answers=new Map(read('modern/'+packed).items.map(([,id,,q])=>[id,q.answer]));
const entries=read('data/textbook-pages.json').entries.filter(e=>e.book==='energy'&&!e.reviewHold);
const families=new Map();
for(const id of new Set(entries.map(e=>e.sourceId))){
 const key=texts[id]?.replace(/^\s*\d{1,2}[.\s]+/,'').replace(/\s/g,'');
 if(!key||key.length<45||/그림|도표|그래프|선도|다음식/.test(key)||!['①','②','③','④'].every(c=>key.includes(c))||!answers.get(id))continue;
 const parts=key.split(/([①②③④])/);
 let k=answers.get(id)+'|'+key;
 if(parts.length===9&&parts[0].length>=12){
   const opts=new Map([1,3,5,7].map(i=>[parts[i],parts[i+1].replace(/[。.]$/,'')]));
   const values=[...opts.values()];
   if(opts.size===4&&values.every(v=>v.length>=2)&&new Set(values).size===4){
     const stem=parts[0].replace(/^다음중/,'').replace(/[?？]$/,'');
     k=JSON.stringify([stem,opts.get('①②③④'[answers.get(id)-1]),values.sort()]);
   }
 }
 const ids=families.get(k)??[];ids.push(id);families.set(k,ids);
}
const suffix=s=>s.match(/\d{4}-.+$/)[0];
const out=[...families.values()].filter(g=>g.length>1).map(g=>g.map(suffix).sort((a,b)=>b.localeCompare(a,'ko',{numeric:true})));
fs.writeFileSync('data/energy-final-families.json',JSON.stringify(out)+'\n');
console.log(out.length+' groups / '+out.flat().length+' occurrences');
