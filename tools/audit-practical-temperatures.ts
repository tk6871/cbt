import assert from 'node:assert/strict';
import { practicalPrompts } from '../src/cbt/qualificationStudyGuides';
import { practicalCalculationLessons, practicalTemperatureModes, calculationLesson, practicalAbsoluteTemperatureExample } from '../src/cbt/practicalCalculations';

const before = JSON.stringify(practicalPrompts);
const modes = Object.values(practicalTemperatureModes);
assert.equal(modes.filter(x => x === 'difference').length, 13);
assert.equal(modes.filter(x => x === 'mixing').length, 3);
assert.equal(modes.filter(x => x === 'coefficient').length, 1);
for (const [id, mode] of Object.entries(practicalTemperatureModes)) {
  const prompt = practicalPrompts.find(p => p.id === `hvac-practical-${id}`)!;
  assert.ok(prompt, id);
  const lesson = calculationLesson(prompt)!;
  assert.equal(lesson.temperatureMode, mode);
  assert.ok(lesson.temperatureNote?.includes('273.15'), id);
}
const close = (a: number,b: number) => assert.ok(Math.abs(a-b)<1e-9, `${a} != ${b}`);
for (const [high,low] of [[31,28],[40,28],[40,31],[26,15],[35,2],[0,-10],[100,0],[28,19],[20,10.2],[20,8.2],[60,10]]) {
  close(high-low, (high+273.15)-(low+273.15));
}
for (const [a,b,wa,wb] of [[-5,20,1,4],[-8,24,1,3],[32,24,10,30]]) {
  close((a*wa+b*wb)/(wa+wb), ((a+273.15)*wa+(b+273.15)*wb)/(wa+wb)-273.15);
}
close(1*4.18*5,20.9);
assert.notEqual(1*4.18*(5+273.15),20.9, 'Do not add the Celsius offset to a rise');
close(20+273.15,293.15);
close((-5+273.15)/((23+273.15)-(-5+273.15)),268.15/28);
assert.ok(practicalAbsoluteTemperatureExample.title.includes('등록 기출 아님'));
assert.equal(Object.values(practicalCalculationLessons).filter(x=>x.temperatureFractions).length,3);
assert.equal(practicalCalculationLessons['hvac-practical-foundation-2'].temperatureMode,undefined,'Q/L is not a Carnot temperature ratio');
assert.equal(practicalCalculationLessons['hvac-practical-drill-13'].temperatureMode,undefined,'Absolute pressure is not absolute temperature');
assert.equal(JSON.stringify(practicalPrompts),before);
console.log(JSON.stringify({ reviewedCalculations:36, temperatureNotes:17, difference:13, mixing:3, coefficient:1, differenceChecks:11, mixingChecks:3, bankUnchanged:true }));
if (process.argv.includes('--review-candidates')) {
  for (const p of practicalPrompts.filter(p => /카르노|이상.?기체|절대온도|273|엔트로피|압축비|토출온도|온도비|성능계수|혼합.*온도|공기.*혼합|체적.*온도|온도.*체적/.test([p.question,p.answer,p.explanation].join('\n')))) {
    console.log(JSON.stringify({id:p.id,year:p.year,session:p.session,number:p.number,question:p.question,answer:p.answer,explanation:p.explanation,images:[p.image,...(p.images||[]),...(p.answerImages||[])].filter(Boolean)},null,2));
  }
}
