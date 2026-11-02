import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {makeTextCorrection} from './textbook-text-correction.mjs';
import {loadHansolReview} from './load-hansol-textbook-review.mjs';
const batch=JSON.parse(fs.readFileSync('tools/hansol-numeric-text-review.json','utf8'));
const c={window:{}};for(const name of ['hvac','hvac-hansol'])vm.runInNewContext(fs.readFileSync(`data/${name}.js`,'utf8'),c);
const bank=new Map(Object.values(c.window).flatMap(b=>b.rounds.flatMap(r=>r.questions.map(q=>[`${r.id}:${q.number}`,q]))));
batch.rows=loadHansolReview(bank).rows.filter(r=>r.presentation==='text');
test('모든 직접 대조 텍스트와 원본·분리 그림 해시 보존',()=>{
 const rows=batch.rows;assert.ok(rows.length);
 for(const row of rows){const original=bank.get(row.sourceId),before=JSON.stringify(original),next=makeTextCorrection(original,row);assert.equal(next.presentation,'text');assert.equal(next.choices.length,4);assert.equal(next.asset,undefined);assert.equal(JSON.stringify(original),before);}
 const figure=rows.find(r=>r.page==='2-20');assert.equal(makeTextCorrection(bank.get(figure.sourceId),figure).images.length,1);
 const replaced=rows.find(r=>r.page==='2-19'),result=makeTextCorrection(bank.get(replaced.sourceId),replaced);
 assert.deepEqual(result.choiceImages,[[],[],[],[]]);assert.equal(result.replacedChoiceFigures.length,1);assert.equal(result.replacedChoiceFigures[0].sha256.length,64);
});
test('확인하지 않은 원문 스캔·그림 누락·안 바뀐 보기 그림 제거 거부',()=>{
 const scan=batch.rows.find(r=>r.page==='2-273');assert.throws(()=>makeTextCorrection(bank.get(scan.sourceId),{...scan,sourceScanTextOnlyVerified:false}),/text-only/);
 const figure=batch.rows.find(r=>r.page==='2-20');assert.throws(()=>makeTextCorrection(bank.get(figure.sourceId),{...figure,retainSourceFigures:false}),/retain/);
 const changed=batch.rows.find(r=>r.page==='2-19'),original=bank.get(changed.sourceId);
 assert.throws(()=>makeTextCorrection(original,{...changed,replacedChoiceFigures:[]}),/retain/);
 assert.throws(()=>makeTextCorrection(original,{...changed,correction:{...changed.correction,choices:original.choices.map(c=>c.text)}}),/unchanged choice/);
});
test('잘못 읽은 기호·비어 있는 해설·숨은 HTML 거부',()=>{
 const row=batch.rows[0],original=bank.get(row.sourceId);
 for(const bad of ['\uE000','�','<img src="x">'])assert.throws(()=>makeTextCorrection(original,{...row,correction:{...row.correction,text:bad}}));
 assert.throws(()=>makeTextCorrection(original,{...row,correction:{...row.correction,explanation:''}}));
 assert.throws(()=>makeTextCorrection({...original,text:original.text+' 원문변경'},row),/original changed/);
});
test('교재 수치 계산·정답 및 교재 해설 산술 오기 구별',()=>{
 assert.equal(1.23+.1,1.33);assert.equal((12-4)/.2,40);
 assert.ok(Math.abs(10000*3.25*(35-2)/(10*3600)-29.7916667)<.00001);
 assert.ok(Math.abs(10*3600/(273+20)-122.86689)<.00001);
 assert.ok(Math.abs(5*.925*Math.log(4/2)-3.2058)<.0001);
 const row=batch.rows.find(r=>r.page==='2-19');assert.equal(1.2*2*.5*1,1.2);assert.match(row.correction.explanation,/2.4kJ로 인쇄/);assert.match(row.correction.explanation,/1.2kJ입니다/);
});
test('추가 대조한 현열·습공기·동결·BF 조건과 정답 구분',()=>{
 const correction=(page,number)=>batch.rows.find(r=>r.page===page&&r.number===number).correction;
 assert.equal(560*4.2*(80-72),18816);assert.equal(correction('1-91',8).answer,4);
 assert.equal(1000*1.01*(30-10),20200);assert.equal(correction('1-210',3).answer,2);
 assert.ok(Math.abs(1.01*30+.0271*(2501+1.85*30)-99.58115)<1e-6);assert.equal(correction('4-49',15).answer,1);
 assert.ok(Math.abs(5000*(.88*(30-(-2))+65.14+.49*((-2)-(-15)))/12/1000-41.5291667)<1e-6);
 assert.match(correction('4-50',23).explanation,/3600으로 또 나누지/);
 assert.equal(1000*(3.25*(20-(-2))+234.5+1.76*((-2)-(-15)))/1000,328.88);
 assert.equal(3000*3.25*(32-2)/(10*3600),8.125);assert.match(correction('4-125',22).explanation,/잠열은 쓰지/);
 assert.equal(20+.2*((32+26*2)/3-20),21.6);assert.equal(correction('1-138',24).answer,1);
 assert.equal(correction('3-345',12).answer,2);assert.match(correction('3-345',12).explanation,/제어대상에서는 입력/);
});
