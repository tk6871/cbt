// Strict scan-to-existing-COMCBT links. OCR is a private comparison aid only.
import fs from 'node:fs';import vm from 'node:vm';import crypto from 'node:crypto';
const imageHashes=new Map();
function imageHash(path){if(!imageHashes.has(path))imageHashes.set(path,crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex'));return imageHashes.get(path);}
const context={window:{}};
for(const name of ['energy','energy-restored','energy-textbook','energy-midterm','energy-book-earlier'])vm.runInNewContext(fs.readFileSync(`data/${name}.js`,'utf8'),context);
function fingerprint(q){let h=14695981039346656037n;const text=JSON.stringify([q.text||'',q.html||'',q.ocrText||'',q.choices.map(c=>[c.text||'',c.html||'',c.images||[]]),q.answer,q.images||[],q.sourceImage||'']);for(const ch of text){h^=BigInt(ch.codePointAt(0));h=BigInt.asUintN(64,h*1099511628211n);}return h.toString(16);}
const norm=s=>String(s||'').normalize('NFKC').replace(/<[^>]*>|&[^;]+;/g,' ').toLowerCase().replace(/[^\p{L}\p{N}+\-*=<>.%]/gu,'');
const bank=context.window.CBT_DATA_ENERGY.rounds.flatMap(r=>r.questions.map(q=>({id:`${r.id}:${q.number}`,q,stem:norm(q.text||q.html),choices:q.choices.map(c=>norm(c.text||c.html))})));
const real=bank.filter(({q})=>q.explanationType!=='ai-reference'&&q.explanationProvenance!=='concise-answer-guide'
 && /^https:\/\/www\.comcbt\.com\/cbt\/problem\//.test(q.source||'')
 && (q.explanation||q.explanationHtml||'').trim().length>=15 && !q.images?.length&&!q.choices.some(c=>c.images?.length));
const links={},pending=[];
const targets=new Map(Object.values(context.window).flatMap(b=>b.rounds.flatMap(r=>r.questions.map(q=>[`${q._originRoundId||r.id}:${q._originalNumber||q.number}`,q]))));
const imageLinks=new Map();
for(const [work,prefix] of [['work/energy-restored-full','energy-industrial-restored'],['work/energy-earlier-full','energy-book-earlier']]){
 if(!fs.existsSync(`${work}/answer-geometry/staged.json`))continue;
 const manifest=JSON.parse(fs.readFileSync(`${work}/manifest.json`));const geometry=JSON.parse(fs.readFileSync(`${work}/answer-geometry/staged.json`));
 const ledger=JSON.parse(fs.readFileSync(`${work}/upscale-ledger.json`));
 for(const row of manifest.rows){
  const corrected=`${work}/answer-geometry/ocr-corrected/${row.key}-question.json`;
  const ocr=JSON.parse(fs.readFileSync(fs.existsSync(corrected)?corrected:`${work}/answer-geometry/ocr/${row.key}-question.json`));
  const full=norm(ocr.rows.map(r=>r.text).join(' '));const boxes=geometry[row.key];
  const choices=boxes?.map(b=>norm(ocr.rows.filter(r=>{
   const [x,y,x1,y1]=r.box;const cx=(x+x1)*50,cy=(y+y1)*50;
   return cx>=b.x-1&&cx<=b.x+b.width+1&&cy>=b.y-1&&cy<=b.y+b.height+1;
  }).sort((a,b)=>a.box[1]-b.box[1]||a.box[0]-b.box[0]).map(r=>r.text.replace(/^[①②③④]\s*/, '')).join(' ')));
  const candidates=real.filter(s=>s.stem.length>=8&&full.includes(s.stem));
  const exact=candidates.filter(s=>s.q.answer===row.answer&&choices?.length===4&&s.choices.every((c,i)=>c&&choices[i]===c));
  const id=`${prefix}-${row.year}-${row.session}:${row.number}`;
  if(exact.length){
   const link={sourceId:exact.at(-1).id,sourceFingerprint:fingerprint(exact.at(-1).q),answer:row.answer,match:'exact-stem-and-four-ordered-choices'};
   const pixelHash=ledger[`${row.key}-question`]?.outputSha256;
   const target=targets.get(id);if(target&&imageHash(target.sourceImage)===pixelHash)links[id]={...link,targetFingerprint:fingerprint(target),targetImageSha256:pixelHash};
   imageLinks.set(row.key,{...link,targetImageSha256:pixelHash});
  }
  else if(candidates.length)pending.push({id,key:row.key,sourceIds:candidates.map(s=>s.id),reason:'choices-or-answer-require-visual-comparison'});
 }
}
// The midterm textbook bank reuses these same verified scan crops but has
// independent record IDs. Never infer equality from a year or question number.
for(const [id,q] of targets){
 if(q.imageOnly&&q.sourceImage){
  const key=q.sourceImage.split('/').at(-1).replace(/\.(webp|png)$/,'');const link=imageLinks.get(key);
  if(link&&link.answer===q.answer&&imageHash(q.sourceImage)===link.targetImageSha256)links[id]={...link,targetFingerprint:fingerprint(q)};
  else if(link)pending.push({id,key,sourceIds:[link.sourceId],reason:'target-scan-pixels-differ-requires-visual-comparison'});
 }else if(!real.some(s=>s.id===id)&&!q.images?.length&&!q.choices.some(c=>c.images?.length)){
  const exact=real.filter(s=>s.id!==id&&s.stem===norm(q.text||q.html)&&s.q.answer===q.answer&&s.choices.every((c,i)=>c&&c===norm(q.choices[i].text||q.choices[i].html)));
  if(exact.length)links[id]={sourceId:exact.at(-1).id,sourceFingerprint:fingerprint(exact.at(-1).q),targetFingerprint:fingerprint(q),answer:q.answer,match:'exact-text-stem-and-four-ordered-choices'};
 }
}
fs.mkdirSync('work/textbook-page-review',{recursive:true});
fs.writeFileSync('work/textbook-page-review/comcbt-pending.json',JSON.stringify(pending,null,2)+'\n');
fs.writeFileSync('data/energy-textbook-comcbt-links.json',JSON.stringify({date:'2026-10-29',rule:'기존 COMCBT 원문 해설만. 지문·순서 있는 보기4개·인쇄 정답 모두 일치한 연결.',links},null,2)+'\n');
console.log({actualSources:real.length,confirmed:Object.keys(links).length,pending:pending.length});
