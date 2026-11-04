// Only explicitly reviewed transcriptions are published. OCR scores alone
// cannot approve prose, formulae, diagrams, numbers or printed answer keys.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {sourceAssetPath} from './source-asset-path.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const review=read('tools/textbook-explanation-text-review.json');
const book=read('data/hansol-book-direct.json');
const boundaries=read('data/hansol-book-direct-boundaries.json');
const pages=new Map(book.pages.map(p=>[p.page,p]));
const fixes=new Map(boundaries.entries.map(r=>[r.id,r]));
const extras=new Map(boundaries.assets.map(a=>[a.asset,a]));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(sourceAssetPath(p))).digest('hex');
const seen=new Set();
const entries=review.entries.map(entry=>{
 assert.ok(!seen.has(entry.id));seen.add(entry.id);
 const source=book.locations.find(r=>r.id===entry.id);assert.ok(source);
 const fix=fixes.get(source.id);
 assert.ok(!fix||fix.status==='split');
 const solutionParts=fix?.solutionParts||[{page:source.page,rect:source.solutionRect}];
 assert.ok(solutionParts.every(p=>p.rect?.length===4));
 assert.ok(entry.blocks.length>0);
 for(const b of entry.blocks){
  assert.ok(Boolean(b.text)!==Boolean(b.tex));
  assert.ok(!(b.text||b.tex).includes('<'));
  if(b.tex)assert.ok(b.label?.trim());
 }
 const assets=solutionParts.map(p=>{
  const file=p.asset||pages.get(p.page).asset;
  const expected=p.asset?extras.get(file).sha256:pages.get(p.page).sha256;
  assert.equal(sha(file),expected);
  return {asset:file,sha256:expected};
 });
 return {...entry,page:source.page,number:fix?.printedNumber??source.number,
  questionParts:fix?.questionParts||[{page:source.page,rect:source.questionRect}],solutionParts,assets};
});
const out={schemaVersion:1,reviewedAt:review.reviewedAt,basis:review.basis,entries};
const path='data/textbook-explanation-text.json',content=JSON.stringify(out,null,2)+'\n';
if(process.argv.includes('--check'))assert.equal(fs.readFileSync(path,'utf8'),content);
else fs.writeFileSync(path,content);
console.log(JSON.stringify({reviewed:entries.length,formulae:entries.flatMap(r=>r.blocks).filter(b=>b.tex).length,check:process.argv.includes('--check')}));
