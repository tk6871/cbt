import test from 'node:test';
import assert from 'node:assert/strict';
import {buildNamedHvacSourceIndex} from './explanation-source-index.mjs';
const row = (key, answer) => ({catalog:{key},round:{id:key+'-20212',year:2021,session:'2회'},question:{number:25,answer}});
test('an unrelated restored bank cannot overwrite a named HVAC source',()=>{
 const hvac=row('hvac',3), energy=row('energy-restored',1);
 const index=buildNamedHvacSourceIndex([hvac,energy]);
 assert.equal(index.size,1);
 assert.equal(index.get('공조 복원 · 2021년 2회 25번'),hvac);
 assert.equal(index.get('공조 복원 · 2021년 2회 25번').question.answer,3);
});
test('ambiguous real HVAC sources remain an error',()=>{
 assert.throws(()=>buildNamedHvacSourceIndex([row('hvac',3),row('hvac',1)]),/Ambiguous/);
});
