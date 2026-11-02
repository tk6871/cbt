import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const review=read('tools/hansol-answer-candidate-review.json');
const native=read('tools/hansol-book-native-review.json').rows;
function bank(file){const context={window:{}};vm.runInNewContext(fs.readFileSync(file,'utf8'),context);return Object.values(context.window).find(v=>v?.rounds);}
const original=[...bank('data/hvac.js').rounds,...bank('data/hvac-hansol.js').rounds];
const published=bank('data/hvac-hansol-book.js').rounds;
const find=(rounds,id)=>{const split=id.lastIndexOf(':');return rounds.find(r=>r.id===id.slice(0,split))?.questions.find(q=>q.number===Number(id.slice(split+1)));};
test('정답 관련48후보의 교재 위치·독립 정답·원문 연결 기록',()=>{
 assert.equal(review.rows.length,48);assert.equal(new Set(review.rows.map(r=>r.key)).size,48);
 const printed=read('tools/hansol-printed-key-review.json').answers;
 for(const r of review.rows){
  const input=native.find(n=>`${n.page}:${n.number}`===r.key);assert.ok(input,r.key);
  assert.equal(input.answer,r.bookAnswer);assert.equal(printed[input.page][input.number],r.bookAnswer);
  assert.equal(find(original,r.candidateId)?.answer,r.candidateAnswer,r.candidateId);
  const q=find(published,r.publishedSourceId);assert.ok(q,r.key);assert.equal(q.answer,r.bookAnswer);
  assert.match(q.sourceImage,/^assets\/hvac-hansol-book\/questions\//);assert.equal(q.explanationProvenance,'book-original-reviewed');
  assert.match(r.sourceScreenSha256,/^[a-f0-9]{64}$/);assert.equal(r.decision,'book-original');
 }
});
test('숫자·단위·보기 순서 차이의 정답을 일반 기출에 덮어쓰지 않음',()=>{
 for(const [key,oldAnswer,bookAnswer]of [['3-262:20',3,1],['3-327:51',1,2],['3-365:9',2,4],['4-17:53',2,4],['3-89:6',4,2],['3-130:4',2,3]]){
  const r=review.rows.find(r=>r.key===key);assert.equal(find(original,r.candidateId).answer,oldAnswer);assert.equal(find(published,r.publishedSourceId).answer,bookAnswer);
 }
 assert.equal((.1*5**2)/2,1.25);
 assert.ok(Math.abs((200*.523+700*4.2*60/3600)*1.2-184.32)<1e-8);
});
