import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {textbookSourceFingerprint} from './textbook-text-correction.mjs';
import {loadHansolReview} from './load-hansol-textbook-review.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const checked={
 "1-113:73": 3,
 "1-114:76": 3,
 "1-168:21": 2,
 "4-11:24": 1,
 "4-22:16": 3,
 "4-25:28": 1,
 "4-27:34": 3,
 "4-34:6": 3,
 "4-34:8": 3,
 "4-35:10": 3,
 "4-37:22": 1,
 "4-46:2": 2,
 "4-61:19": 4,
 "4-85:10": 3,
 "4-98:13": 4,
 "4-99:17": 3,
 "4-135:7": 2,
 "4-152:26": 4,
 "4-161:5": 4,
 "5-8:21": 1,
 "5-17:6": 3,
 "5-21:28": 1,
 "5-27:2": 2,
 "5-29:15": 1,
 "5-81:39": 1,
 "5-87:10": 4,
 "5-88:16": 2,
 "1-27:13": 1,
 "1-27:18": 1,
 "1-29:1": 4,
 "1-34:38": 4,
 "1-62:25": 4,
 "1-70:1": 3,
 "1-71:7": 4,
 "1-71:8": 4,
 "1-94:26": 1,
 "1-109:48": 2,
 "1-111:63": 1,
 "1-113:71": 3,
 "1-113:74": 3,
 "1-114:78": 1,
 "1-118:99": 4,
 "1-138:23": 2,
 "1-139:28": 3,
 "1-140:31": 3,
 "1-142:41": 2,
 "1-142:43": 3,
 "1-155:19": 4
};
const rows=read('tools/hansol-numeric-text-review.json').rows.filter(r=>r.reviewBatch==='values-48-2026-11-03');
const entries=read('data/textbook-pages.json').entries;
const corrections=read('data/textbook-corrections.json').entries;
const keys=read('tools/hansol-printed-key-review.json').answers;
const ctx={window:{}};
for(const name of ['hvac','hvac-hansol'])vm.runInNewContext(fs.readFileSync(`data/${name}.js`,'utf8'),ctx);
const sources=new Map(Object.values(ctx.window).flatMap(b=>b.rounds.flatMap(r=>r.questions.map(q=>[`${r.id}:${q.number}`,q]))));
const row=key=>rows.find(r=>`${r.page}:${r.number}`===key);
test('후속48위치: 실제 책 정답·26텍스트/22같은 원문·원본 fingerprint',()=>{
 assert.equal(rows.length,48);assert.equal(rows.filter(r=>r.correction).length,26);
 assert.equal(rows.filter(r=>!r.correction).length,22);
 assert.deepEqual(rows.map(r=>`${r.page}:${r.number}`).sort(),Object.keys(checked).sort());
 for(const [key,answer] of Object.entries(checked)){
  const r=row(key),q=sources.get(r.sourceId);
  assert.equal(keys[r.page][r.number],answer,key);
  assert.equal(q.answer,r.answer,key);
  assert.equal(textbookSourceFingerprint(q),r.sourceFingerprint,key);
  assert.match(r.bookScreenSha256,/^[a-f0-9]{64}$/);
  const e=entries.find(e=>e.book==='hansol'&&e.page===r.page&&e.number===r.number);
  assert.equal(e.sourceId,r.sourceId,key);assert.equal(e.column,r.column,key);
  if(r.correction){assert.deepEqual(e.correction,corrections[key]);assert.equal(r.correction.answer??r.answer,answer);}
  else assert.equal(e.correction,undefined,key);
 }
 assert.equal(loadHansolReview(sources).date,'2026-11-03');
 assert.equal(read('data/textbook-pages.json').date,'2026-11-03');
});
test('같은 쇠고기 유형의kg·시간·kJ/Wh 차이를 별도로 계산',()=>{
 const near=(a,b)=>assert.ok(Math.abs(a-b)<.0001,`${a} != ${b}`);
 near(5000*3.25*30/(12*3600),11.2847222);
 assert.equal(5000*.88*30/(12*1000),11);
 assert.equal(10000*.88*30/(12*1000),22);
 near(10000*3.25*33/(10*3600),29.7916667);
 assert.match(row('4-25:28').correction.explanation,/12×3600/);
 assert.match(row('4-37:22').correction.explanation,/3600을 다시 나누지/);
 assert.match(row('4-152:26').correction.text,/65.14Wh/);
 assert.match(sources.get('hvac-20231:32').text,/56.14/);
 assert.match(row('4-152:26').correction.explanation,/잠열65.14는 이번 계산에 넣지/);
});
test('SI열량·분당 환기·책의 보기·기준 상수 출처',()=>{
 const near=(a,b)=>assert.ok(Math.abs(a-b)<.0001,`${a} != ${b}`);
 assert.equal(10*(2.1*10+333.6+4.2*100+2256),30306);
 assert.equal(5*2257,11285);assert.equal(630*2/60,21);
 assert.equal(40*10*1.2*3.6,1728);
 assert.equal(1.3*10*10*8*3600/(.15*1000),24960);
 near(300000/(25200*17)*100,70.0280112);
 near(3.5*3600/(1.2*1.01*10),1039.6039604);
 near(40/(1.2*1.005*14),2.3691069);
 assert.equal(row('1-34:38').correction.choices[1],'24.8℃');
 assert.equal(row('1-113:73').correction.choices[1],'20W, 90W');
 assert.equal(row('1-113:73').correction.choices[3],'90W, 30W');
 for(const key of ['4-27:34','4-34:6','4-35:10','1-27:18'])assert.match(row(key).correction.explanation,/지문.*(?:아니라|않)/,key);
 assert.match(row('4-22:16').correction.note,/kJ\/kJ/);
 assert.match(row('4-22:16').correction.explanation,/273을/);
 assert.match(row('1-155:19').correction.text,/1000kg\/m³/);
 assert.match(row('1-155:19').correction.explanation,/중력가속도9.81/);
});
test('선도·분수 유지와 명시적으로 옮긴분수2개의 원본 보존',()=>{
 for(const key of ['1-168:21','4-135:7','5-27:2','1-140:31','1-142:41'])assert.ok(!row(key).correction,key);
 const bf=corrections['5-88:16'];
 assert.deepEqual(bf.images,['assets/hvac/assets/comcbt/20070513/images/nq20070513m4.png']);
 assert.equal(row('5-88:16').retainSourceFigures,true);
 assert.ok(!row('5-88:16').correction.text.includes('\\'));
 const wall=corrections['1-114:78'];
 assert.equal(wall.replacedChoiceFigures.length,2);
 for(const f of wall.replacedChoiceFigures){assert.ok(fs.existsSync(f.path));assert.match(f.sha256,/^[a-f0-9]{64}$/);}
 assert.deepEqual(wall.choiceImages,[[],[],[],[]]);
 assert.equal(wall.choices[3],'q_w=K×A×(tᵣ−tₑ)');
 assert.match(wall.choices[1],/\(K×A\)\/\(tₑ−tᵣ\)/);
});
