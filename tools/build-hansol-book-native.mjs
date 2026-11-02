// Book-only sources for explicitly reviewed unmatched locations. Preserve all
// existing ordinary banks; OCR is never the displayed question body.
import fs from 'node:fs';import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {textbookSourceFingerprint} from './textbook-text-correction.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const review=read('tools/hansol-book-native-review.json'),staged=read('work/hansol-book-native/manifest.json'),ledger=read('work/hansol-book-native/upscale-ledger.json');
const keys=read('tools/hansol-printed-key-review.json').answers;
const pages=read('data/textbook-pages.json'),examples=read('data/textbook-worked-examples.json'),audit=read('data/textbook-page-audit.json');
const rounds=new Map(),locations=[],imageAudit={};
for(const r of review.rows){
 const key=`${r.page}-${r.number}`,stage=staged.rows.find(s=>s.key===key);assert.ok(stage,key);
 assert.equal(stage.sourceScreenSha256,sha(`work/hansol-whole-book/screens/spread-${String(r.spread).padStart(4,'0')}.png`),`${key}: normal-reader screen changed`);
 for(const [path,hash] of Object.entries(stage.sourceScreens||{}))assert.equal(sha(path),hash,`${key}: continued book segment changed`);
 const ims=Object.fromEntries(['question','explanation'].map(kind=>{
  const im=ledger[`${key}-${kind}`];assert.ok(im,key);assert.equal(im.sourceSha256,sha(`work/hansol-book-native/original/${key}-${kind}.png`),key);assert.equal(im.outputSha256,sha(im.asset),key);
  assert.equal(im.native,'arm64');assert.equal(im.tile,256);assert.equal(im.model,'realesrgan-x4plus-anime');assert.deepEqual(im.sourceSize,stage[kind+'Size']);assert.deepEqual(im.outputSize,im.sourceSize.map(n=>n*2));
  imageAudit[`${key}-${kind}`]=im;return [kind,im];
 }));
 let entry={book:'hansol',page:r.page,number:r.number,column:r.column,sourceId:null,fingerprint:null};
 if(r.kind==='worked-example'){
  const id=`hansol-book-example-${key}`;entry.workedExampleId=id;
  if(String(r.answer).includes('정답표'))Object.assign(entry,{reviewHold:true,pendingReason:r.note});
  const example={id,book:'hansol',pages:[r.page],number:r.number,title:r.text,kind:'worked-example',question:ims.question.asset,questionSize:ims.question.outputSize,solution:ims.explanation.asset,solutionSize:ims.explanation.outputSize,answer:r.answer,note:r.note||'객관식 보기가 없는 교재 본문 풀이 예제입니다. 객관식 시험에서는 제외합니다.',explanation:r.explanation,images:ims};
  const old=examples.entries.findIndex(e=>e.id===id);if(old>=0)examples.entries[old]=example;else examples.entries.push(example);
 }else{
  assert.ok([1,2,3,4].includes(r.answer));assert.equal(r.choices.length,4);assert.equal(r.choiceRects.length,4);
  assert.equal(keys[r.page]?.[r.number],r.answer,`${key}: printed book key must be independently recorded`);
  const [x,y,x1,y1]=r.crop,w=x1-x,h=y1-y;
  const hotspots=r.choiceRects.map(([a,b,c,d],i)=>{assert.ok(x<=a&&c<=x1&&y<=b&&d<=y1);const region={x:(a-x)/w*100,y:(b-y)/h*100,width:(c-a)/w*100,height:(d-b)/h*100};return {choice:i+1,...region,segments:[region]};});
  const subject=r.page.startsWith('1-')?'공기조화설비':r.page.startsWith('2-')?'냉동냉장설비':r.page.startsWith('3-')?'공조냉동 설치·운영':'교재 모의고사';
  const roundId=`hvac-hansol-book-${r.page}`,q={number:r.number,text:r.text,html:'',ocrText:r.text,images:[],sourceImage:ims.question.asset,sourceImageSize:ims.question.outputSize,imageOnly:true,choices:r.choices.map(text=>({text,html:'',images:[]})),answer:r.answer,answerHotspots:hotspots,explanation:r.explanation,explanationHtml:'',explanationImages:[ims.explanation.asset],originalExplanationImagesFolded:true,explanationType:'editorial-supplement',explanationProvenance:'book-original-reviewed',explanationBasis:'교재 지문·네 보기·정답을 직접 읽어 정리한 설명입니다. 교재 원문 풀이 이미지는 따로 보존합니다.',bookVerified:true,_subject:subject,source:'한솔 공조 교재',sourcePage:`한솔 공조 교재 ${r.page}쪽 ${r.number}번`};
  if(!rounds.has(roundId))rounds.set(roundId,{id:roundId,year:0,session:'교재',qualificationKey:'hvac-hansol',title:`한솔 공조 교재 ${r.page}쪽`,subjects:[subject],kind:'textbook-pages',questions:[]});
  rounds.get(roundId).questions.push(q);Object.assign(entry,{sourceId:`${roundId}:${r.number}`,fingerprint:textbookSourceFingerprint(q),imageSize:ims.question.outputSize});
 }
 const old=pages.entries.findIndex(e=>e.book==='hansol'&&e.page===r.page&&e.number===r.number);
 if(old>=0){assert.ok(!pages.entries[old].sourceId||pages.entries[old].sourceId===entry.sourceId,`${key}: preserve existing CBT link`);if(r.kind==='worked-example'&&pages.entries[old].reviewHold)Object.assign(entry,{reviewHold:true,pendingReason:pages.entries[old].pendingReason});pages.entries[old]=entry;}else pages.entries.push(entry);
 locations.push(entry);
}
for(const a of audit.pages){const es=pages.entries.filter(e=>e.book==='hansol'&&e.page===a.page);a.linkedPositions=es.filter(e=>e.sourceId).length;a.heldPositions=es.filter(e=>e.reviewHold).length;a.workedExamplePositions=es.filter(e=>e.workedExampleId).length;const covered=new Set(es.filter(e=>e.sourceId||e.reviewHold||e.workedExampleId).map(e=>e.number));a.unconfirmedCandidates=Math.max(0,a.detectedPositions-covered.size);}
pages.entries.sort((a,b)=>a.book.localeCompare(b.book)||a.page.localeCompare(b.page,'ko',{numeric:true})||a.number-b.number);
const bank={key:'hvac-hansol-book',name:'한솔 공조 교재 직접 문제',rounds:[...rounds.values()]};
const bankCode=`window.CBT_DATA_HVAC_HANSOL_BOOK = ${JSON.stringify(bank)};\n`;
if(process.argv.includes('--check'))assert.equal(fs.readFileSync('data/hvac-hansol-book.js','utf8'),bankCode);else fs.writeFileSync('data/hvac-hansol-book.js',bankCode);
for(const [path,data] of [['data/textbook-pages.json',pages],['data/textbook-worked-examples.json',examples],['data/textbook-page-audit.json',audit],['data/hansol-book-native-audit.json',{date:review.date,locations,images:imageAudit,limits:'직접 읽은 정상 열람 문제 영역만 반영합니다. 기존 CBT 전체나 교재 전체 수록 완료가 아닙니다.'}]]){data.date=review.date;if(process.argv.includes('--check'))assert.deepEqual(read(path),data,`${path}: stale native book data`);else fs.writeFileSync(path,JSON.stringify(data,null,2)+'\n');}
console.log({mcq:bank.rounds.reduce((n,r)=>n+r.questions.length,0),workedExamples:locations.filter(e=>e.workedExampleId).length,images:Object.keys(imageAudit).length});
