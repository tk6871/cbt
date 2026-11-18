import test from 'node:test';
import assert from 'node:assert/strict';
import {choiceMatch} from './review-choice-matching.mjs';

const make = (text='압축 온도는?', opts=['10','−10','x²','x₂'], answer=2) =>
  ({text,html:text,choices:opts.map(text=>({text,html:text})),answer});

test('permutation maps each original index and key to the same choice content',()=>{
  const a=choiceMatch(make()),b=choiceMatch(make('압축온도는?',['x₂','10','−10','x²'],3));
  assert.deepEqual(a.signature,b.signature);
  assert.equal(a.correct,b.correct);
  assert.notDeepEqual(a.positions,b.positions);
  assert.notEqual(a.correct,choiceMatch(make(undefined,undefined,1)).correct);
});
test('preserves numeric boundaries, rich text, explicit choice references and auxiliary conditions',()=>{
  const base=make();
  for(const q of [make('10 2'),make('102'),make('압축 온도는?',['10','+10','x²','x₂']),{...base,html:'<b>압축</b> 온도는?'},{...base,hint:'기준 온도 0℃'},{...base,table:'A'}])
    assert.notDeepEqual(choiceMatch(q).signature,choiceMatch(base).signature);
  assert.notDeepEqual(choiceMatch(make('10 2')).signature,choiceMatch(make('102')).signature);
  assert.notDeepEqual(choiceMatch(make('①의 값은?')).signature,choiceMatch(make('①의 값은?',['x²','−10','10','x₂'])).signature);
});
test('excludes ambiguous, missing and image inputs',()=>{
  for(const q of [make('',undefined),make(undefined,['A','A','C','D']),make(undefined,['A','B','','D']),
      {...make(),sourceImage:'p.webp'},{...make(),answer:0},{...make(),html:'<img src="x">'},{...make(),answerHotspots:[{}]}])
    assert.equal(choiceMatch(q),null);
});
