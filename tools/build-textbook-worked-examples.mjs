// Read-only worked examples retain their supplied scan; no invented choices.
import fs from 'node:fs';import assert from 'node:assert/strict';import crypto from 'node:crypto';
const ledger=JSON.parse(fs.readFileSync('work/energy-theory-examples/upscale-ledger.json'));
const images={};
for(const kind of ['question','explanation']){
 const row=ledger[`theory-88-toe-${kind}`];assert.equal(row.tile,256);assert.equal(row.native,'arm64');
 assert.deepEqual(row.outputSize,row.sourceSize.map(n=>n*2));
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(row.asset)).digest('hex'),row.outputSha256);
 images[kind]=row;
}
const parts=[30000*1.055/1000,80000*.215/1000,45000*.895/1000];
assert.ok(Math.abs(parts.reduce((a,b)=>a+b,0)-89.125)<1e-10);
fs.writeFileSync('data/textbook-worked-examples.json',JSON.stringify({date:'2026-10-30',entries:[{
 id:'energy-theory-88-toe',book:'energy',pages:['88','89'],title:'월간 에너지 소비량의 석유환산톤(TOE)',
 kind:'worked-example',question:images.question.asset,questionSize:images.question.outputSize,solution:images.explanation.asset,solutionSize:images.explanation.outputSize,
 answer:'89.125 TOE',note:'객관식 보기가 없는 본문 풀이 예제입니다. 교재에 인쇄된 환산계수를 사용합니다. 원문 합계의 쉼표 표기는 앞의 세 값을 더한 89.125 TOE로 읽습니다.',
 explanation:'도시가스 31.65 + 전력 17.2 + 등유 40.275 = 89.125 TOE입니다. 각 사용량에 교재의 환산계수를 곱해 같은 기준의 석유환산량으로 바꾸고, 1,000으로 나누어 톤 단위로 맞춥니다.',
 images,sourcePdfSha256:'840565d198cbbfe871b25a08e2bcb9b2d3dbdcbbadead2b2ca031308caed767d',sourcePdfPages:[77,78]
}]},null,2)+'\n');
console.log('Worked example: 1; native upscaled images: 2; arithmetic verified');
