import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const review=read('tools/textbook-key-review-20261119.json');
const sources=read('work/textbook-completeness/direct-sources.json');
const pages=new Map(read('data/hansol-book-direct.json').pages.map(p=>[p.page,p]));
const webp=read('data/problem-images-webp90.json').mappings;
const keys=structuredClone(review.answers);
for(const [page,answers] of Object.entries(review.correctedNumberAnswers||{}))keys[page]={...keys[page],...answers};
const entries=[],missing=[];
for(const source of sources){
 const answer=keys[source.page]?.[source.number];
 if(!answer){missing.push(source.id);continue;}
 assert.ok([1,2,3,4].includes(answer));
 const page=pages.get(source.page);
 const actual=webp[page.asset]||page.asset;
 entries.push({id:source.id,page:source.page,number:source.number,answer,pageSha256:page.sha256,questionParts:source.questionParts,solutionParts:source.solutionParts,keyImage:actual,keyImageSha256:createHash('sha256').update(fs.readFileSync(actual)).digest('hex')});
}
assert.equal(missing.length,0,`Unreviewed: ${missing.join(', ')}`);
assert.equal(new Set(entries.map(e=>e.id)).size,entries.length);
const output=JSON.stringify({date:review.date,basis:review.basis,entries})+'\n';
const target='data/textbook-direct-answer-review.json';
if(process.argv.includes('--check'))assert.equal(fs.readFileSync(target,'utf8'),output);
else fs.writeFileSync(target,output);
console.log({published:entries.length,missing});
