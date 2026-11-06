import fs from 'node:fs';
import crypto from 'node:crypto';
const directory='work/private-notes/image-text';
const output='data/image-text';
const read=path=>JSON.parse(fs.readFileSync(path,'utf8'));
const inputs=read(`${directory}/catalog-inputs.json`);
const priority=read('tools/image-text-priority-reviewed.json');
const reviewed={...read('tools/image-text-reviewed.json').entries,...read('tools/image-text-catalog-reviewed.json').entries,
 ...Object.fromEntries(Object.entries(priority.entries).map(([path,entry])=>[path,{...entry,basis:priority.basis}]))};
// Misread exponents and unit glyphs observed in the priority review. Leave
// unverified cases on the original instead of guessing a corrected unit.
const brokenUnit=/(?:\d\s*(?:cm|mm|m)\s*[?'′]|\d\s*(?:cm|mm|m)[23](?!\d)|kgf\s*\/\s*(?:cai|cm3)\b|\b(?:kd|k)\s*\/\s*kg\b)/i;
const visual=/그림|선도|도표|회로|다음\s*표|표에서|그래프|계산|공식|수식|관계식|방정식|(?:나타내는|옳은|틀린|맞는)\s*식(?:은|을|이|으로)|[=√∫∑≤≥]|[a-z\d)]\s*\+\s*[a-z\d(]|\d\s*[/×÷^]\s*\d|몇\s*(?:k[WJgP]|Pa|W|kg|℃|m\b)/i;
const families=new Map(),confirmed={},stats={},reviewRows=[];
const check=process.argv.includes('--check');
function write(path,value) {
 const bytes=JSON.stringify(value)+'\n';
 if(check){if(fs.readFileSync(path,'utf8')!==bytes)throw new Error(`${path} differs from current source`);}
 else fs.writeFileSync(path,bytes);
}
function parseQuestion(text, number) {
 const markers=[...text.matchAll(/[①②③④]/g)];
 if(markers.map(m=>m[0]).join('')!=='①②③④')return;
 const stem=text.slice(0,markers[0].index).replace(new RegExp(`^\\s*0?${number}(?:[.)]\\s*|\\s+)`),'').trim();
 const choices=markers.map((m,i)=>text.slice(m.index+1,markers[i+1]?.index??text.length).trim());
 if(stem.length<5||choices.some(t=>t.length<1))return;
 return {stem,choices};
}
for(const input of inputs){
 const sha=crypto.createHash('sha256').update(fs.readFileSync(input.asset)).digest('hex');
 if(sha!==input.sha256)throw new Error(`Source changed: ${input.original}`);
 const rawPath=`${directory}/ocr/${input.id}.json`, inkPath=`${directory}/ink/${input.id}.json`;
 const raw=fs.existsSync(rawPath)?read(rawPath):undefined, ink=fs.existsSync(inkPath)?read(inkPath):undefined;
 if(raw&&raw.sha256!==sha||ink&&ink.sha256!==sha)throw new Error(`Stale OCR cache: ${input.original}`);
 const rows=raw?.rows||[];
 const text=rows.map(r=>r.text).join('\n').replace(/^\s*해설\s*\n/,'').trim();
 const confidence=rows.reduce((n,r)=>n+r.score,0)/Math.max(1,rows.length);
 const manual=reviewed[input.original], imageOnly=priority.imageOnly[input.original];
 if(manual&&manual.sha256!==sha)throw new Error(`Reviewed source changed: ${input.original}`);
 if(imageOnly&&(imageOnly!==sha||manual))throw new Error(`Invalid image-only decision: ${input.original}`);
 const question=manual?.question||(input.kind==='question'?parseQuestion(text,input.number):undefined);
 const reason=manual?'reviewed':imageOnly?'reviewed-image':!raw||!ink?'missing':input.figure||visual.test(text)?'visual':brokenUnit.test(text)?'unit-glyph':confidence<.81||text.length<12?'confidence':
  ink.ink<24||ink.outside>Math.max(14,ink.ink*.035)||ink.maxLine>Math.max(12,ink.width*.06)?'unrecognized-ink':input.kind==='question'&&!question?'choice-order':'provisional';
 const bank=stats[input.bank]??={questions:0,explanations:0,eligibleQuestions:0,eligibleExplanations:0,reasons:{}};
 bank[input.kind==='question'?'questions':'explanations']++;
 bank.reasons[reason]=(bank.reasons[reason]||0)+1;
 if(!['reviewed','provisional'].includes(reason))continue;
 bank[input.kind==='question'?'eligibleQuestions':'eligibleExplanations']++;
 const entry={asset:input.asset,sha256:sha,kind:input.kind,status:reason,eligible:true,text:input.kind==='question'?'':manual?.text||text,...(question?{question}:{}),...(manual?.basis?{basis:manual.basis}:{})};
 if(manual){confirmed[input.original]=entry;continue;}
 const family=input.original.split('/')[1];
 if(!/^[a-z0-9-]+$/.test(family))throw new Error(`Unexpected image family: ${family}`);
 if(!families.has(family))families.set(family,{});
 families.get(family)[input.original]=entry;
 reviewRows.push({bank:input.bank,original:input.original,...entry});
}
if(!check)fs.mkdirSync(output,{recursive:true});
write(`${output}/families.json`,[...families.keys()].sort());
write(`${output}/confirmed.json`,confirmed);
for(const [family,entries] of families)write(`${output}/${family}.json`,entries);
if(!check){
 write(`${directory}/catalog-audit.json`,{total:inputs.length,stats});
 // Stratified screen comparison, saved privately. This is not a review certification.
 const chosen=[];
 for(const bank of Object.keys(stats))for(const kind of ['question','explanation']){
  const pool=reviewRows.filter(row=>row.bank===bank&&row.kind===kind);
  if(pool.length)chosen.push(pool[Math.floor(pool.length/3)]);
 }
 const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
 const body=chosen.map(row=>`<article><h2>${escape(row.original)}</h2><div><img src="../../../${row.asset}" alt="원문"><pre>${escape(row.question?[row.question.stem,...row.question.choices.map((c,i)=>'①②③④'[i]+' '+c)].join('\n'):row.text)}</pre></div></article>`).join('');
 fs.writeFileSync(`${directory}/catalog-samples.html`,`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="robots" content="noindex"><title>OCR 원문 표본 비교</title><style>body{font:16px system-ui;background:#fff;color:#111;margin:16px}article{border-bottom:1px solid #777;padding:8px 0 18px}h2{font-size:14px}article div{display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:start}img{width:100%;max-height:280px;object-fit:contain;object-position:left top}pre{margin:0;white-space:pre-wrap;font:16px system-ui}</style><h1>OCR 임시 원문 표본</h1>${body}</html>`);
}
console.log(JSON.stringify({total:inputs.length,confirmed:Object.keys(confirmed).length,families:[...families.keys()],stats}));
