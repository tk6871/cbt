// Existing public source images only. No ebook extraction or new downloads.
import fs from 'node:fs';import path from 'node:path';
const root=process.cwd(),work='work/hansol-whole-book';
const source=new Map(JSON.parse(fs.readFileSync(`${work}/source-index.json`)).map(r=>[r.id,r]));
const queue=JSON.parse(fs.readFileSync(`${work}/review-queue.json`)).rows;
const ids=[...new Set(queue.flatMap(q=>q.candidates.map(c=>c.id)).filter(id=>source.get(id)?.sourceImage))].sort();
fs.mkdirSync(`${work}/source-ocr`,{recursive:true});
for(let part=0;part<4;part++){
 const rows=ids.filter((_,i)=>i%4===part).map(id=>({id,path:path.join(root,source.get(id).sourceImage)}));
 fs.writeFileSync(`${work}/source-ocr-inputs-${part}.json`,JSON.stringify(rows)+'\n');
}
console.log({existingImages:ids.length,parts:4,output:`${work}/source-ocr`});
