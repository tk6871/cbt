// Local-only comparison. No new resampling, compression or asset replacement.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {sourceAssetPath} from './source-asset-path.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const book=read('data/hansol-book-direct.json');
const boundary=read('data/hansol-book-direct-boundaries.json');
const ink=read('data/hansol-book-ink-hidden.json');
const ids='1-25-16 1-26-9 1-27-10 1-30-7 1-30-12 1-32-25 1-34-37 1-35-40 1-58-5 1-36-50 2-200-3 2-213-4'.split(' ').map(id=>'hansol-direct-'+id);
const pages=new Map(book.pages.map(p=>[p.page,p]));
const fixes=new Map(boundary.entries.map(r=>[r.id,r]));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(sourceAssetPath(p))).digest('hex');
const used=new Map();
const entries=ids.map(id=>{
 const r=book.locations.find(r=>r.id===id),fix=fixes.get(id);assert.ok(r&&(!fix||fix.status==='split'));
 let questionParts=fix?.questionParts||[{page:r.page,rect:r.questionRect}];
 let solutionParts=fix?.solutionParts||[{page:r.page,rect:r.solutionRect}];
 // Preview-only boundaries checked against the full page. The source index
 // is deliberately untouched: 43's first line was above its OCR anchor.
 if(id==='hansol-direct-2-200-3')questionParts=[{page:r.page,rect:[0,1193,671,258]}];
 if(id==='hansol-direct-1-27-10')questionParts=[{page:r.page,rect:[671,557,671,262]}];
 // Include the complete float-switch drawing (printed112), not the adjacent
 // text-only114. The sample has its own ID and never writes study records.
 if(id==='hansol-direct-2-213-4'){
  questionParts=[{page:r.page,rect:[0,997,671,550]}];
  solutionParts=[{page:r.page,rect:[0,1547,671,72]}];
 }
 for(const part of [...questionParts,...solutionParts]){
  assert.ok(!part.asset,'Sample must have comparable original/improved page pairs');
  const page=pages.get(part.page),pair=ink.assets.find(a=>a.kind==='page'&&a.oldAsset===page.asset);
  assert.ok(pair,`${part.page}: no existing pair`);
  for(const [asset,hash] of [[pair.sourceAsset,pair.sourceSha256],[pair.asset,pair.outputSha256]])assert.equal(sha(asset),hash);
  used.set(part.page,{page:part.page,size:page.size,key:page.answerKeyRect,
   original:{asset:pair.sourceAsset,previewAsset:sourceAssetPath(pair.sourceAsset),bytes:fs.statSync(sourceAssetPath(pair.sourceAsset)).size,pixels:pair.sourceSize},
   improved:{asset:pair.asset,previewAsset:sourceAssetPath(pair.asset),bytes:fs.statSync(sourceAssetPath(pair.asset)).size,pixels:pair.outputSize}});
 }
 return {id:id==='hansol-direct-2-213-4'?'sample-book-2-213-112':id,page:r.page,questionParts,solutionParts};
});
const pageList=[...used.values()];
const total=kind=>pageList.reduce((sum,p)=>sum+p[kind].bytes,0);
const data={entries,pages:pageList,totals:{original:total('original'),improved:total('improved')},note:'기존 원해상도와 기존 개선본만 사용. 새 이미지 처리·서비스 자산 교체 없음.'};
const dir='work/private-notes/image-quality-sample';fs.mkdirSync(dir,{recursive:true});
const template=fs.readFileSync('tools/image-quality-sample.template.html','utf8');
fs.writeFileSync(path.join(dir,'index.html'),template.replace('/* SAMPLE_DATA */',JSON.stringify(data).replaceAll('<','\\u003c')));
fs.writeFileSync(path.join(dir,'sample-data.json'),JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify({sample:entries.length,uniquePages:pageList.length,bytes:data.totals,savingPercent:((1-total('original')/total('improved'))*100).toFixed(1),url:'http://127.0.0.1:4234/'+dir+'/index.html'}));
