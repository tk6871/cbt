import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {textbookSourceFingerprint} from './textbook-text-correction.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const rows=read('tools/hansol-numeric-text-review.json').rows;
const entries=read('data/textbook-pages.json').entries.filter(e=>e.book==='hansol');
const keys=read('tools/hansol-printed-key-review.json').answers;
const checked={
 '1-26':{7:1,8:3},'1-27':{14:2,16:3},'1-28':{20:3,22:4},
 '1-32':{26:1},'1-33':{27:2},'1-35':{42:3,44:3,45:3},
 '1-72':{12:2},'1-73':{21:3},'1-74':{25:3},'1-75':{30:4},
 '1-92':{15:3},'1-110':{51:3},'1-112':{64:4,65:4,67:3}
};
const ctx={window:{}};
for(const name of ['hvac','hvac-hansol'])vm.runInNewContext(fs.readFileSync(`data/${name}.js`,'utf8'),ctx);
const source=new Map(Object.values(ctx.window).flatMap(b=>b.rounds.flatMap(r=>r.questions.map(q=>[`${r.id}:${q.number}`,q]))));
const correction=(page,number)=>rows.find(r=>r.page===page&&r.number===number).correction;
test('수치 후보20개의 실제 책 번호·정답·원본 보존',()=>{
 let count=0;
 for(const [page,answers] of Object.entries(checked))for(const [number,answer] of Object.entries(answers)){
  count++;assert.equal(keys[page][number],answer);
  const e=entries.find(e=>e.page===page&&e.number===+number);assert.ok(e,`${page}:${number}`);
  const row=rows.find(r=>r.page===page&&r.number===+number);
  if(row){assert.equal(textbookSourceFingerprint(source.get(row.sourceId)),row.sourceFingerprint);assert.equal(row.correction?.answer??row.answer,answer);assert.equal(e.sourceId,row.sourceId);}
 }
 assert.equal(count,20);
 const fixes=read('tools/hansol-screen-number-review.json').rows;
 for(const [page,rawNumber,number] of [['1-26',4,8],['1-27',2,14]]){
  assert.ok(fixes.some(f=>f.page===page&&f.rawNumber===rawNumber&&f.number===number));
  assert.ok(!entries.some(e=>e.page===page&&e.number===rawNumber));
 }
 assert.equal(entries.find(e=>e.page==='1-26'&&e.number===8).column,0);
 assert.equal(source.get('hvac-20030831:1').answer,3);assert.equal(correction('1-27',14).answer,2);
});
test('시간당·초당 송풍량과 SI 단위·계산에 안 쓰는 조건 구분',()=>{
 const near=(a,b)=>assert.ok(Math.abs(a-b)<.0001,`${a} != ${b}`);
 near((25+27*2)/3,26.3333333);near(7500/(7500+2500),.75);
 near(2326/(2326+407),.8510794);near(760-27.65*.6,743.41);
 assert.equal(1000*(45.4-25.2),20200);
 near(12600/(1.2*1.01*10),1039.6039604);
 near(200*1.2*(1.01*5+2501*.005),4213.2);
 near((7600-2100)/7600,.7236842);
 near(.756*3600/2257,1.2058485);near(11.6*(18-12.5)/(18-(-11)),2.2);
 near(105000/(1.2*1.01*12*60),120.3245325);
 near(30000/1000*60/(1.2*1.01*12),123.7623762);
 near(4070*3600/(1000*1.01*9),1611.8811881);
 assert.match(correction('1-112',64).explanation,/60으로 나눠/);
 assert.match(correction('1-112',65).explanation,/60을 곱해/);
 assert.match(correction('1-73',21).explanation,/지문에 주어진 숫자는 아닙니다/);
 assert.match(correction('1-92',15).explanation,/지문에 직접 적힌 값은 아닙니다/);
 assert.match(correction('1-27',16).explanation,/상대습도50%는 이 계산에 넣지/);
 assert.match(correction('1-75',30).choices[3],/3001.*xᵣ−xₒ/);
});
test('다른 선도·분수 보기는 기존 후보 대신 교재 원문으로 분리',()=>{
 const r=read('tools/hansol-book-native-review.json').rows.find(r=>r.page==='1-28'&&r.number===22);
 assert.equal(r.answer,4);assert.equal(r.choiceRects.length,4);
 assert.deepEqual(r.choices,['(h₁−h₂)/(t₁−t₂)','(h₁−h꜀)/(h₁−h₂)','(x₁−x₂)/(t₁−t₂)','(h꜀−h₂)/(h₁−h₂)']);
 const e=entries.find(e=>e.page==='1-28'&&e.number===22);
 assert.notEqual(e.sourceId,'hvac-hansol-2018-2:9');
 assert.match(r.explanation,/기존 후보와/);
});
