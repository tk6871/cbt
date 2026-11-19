import assert from 'node:assert/strict';
import test from 'node:test';
import {coolingBookFingerprint} from '../src/cbt/questionFingerprint.ts';

test('교재 연결 지문은 기존 64비트 FNV 값과 같고 변경된 문항을 구분한다', () => {
  const question = {text:'유량 2 ㎥/s 🌡️', choices:[{text:'①', images:['assets/보기.webp']}], answer:1};
  function original() {
    const text = JSON.stringify([question.text, '', '', [['①', '', question.choices[0].images]],
      question.answer, [], '']);
    let hash = 14695981039346656037n;
    for (const ch of text) hash = BigInt.asUintN(64, (hash ^ BigInt(ch.codePointAt(0))) * 1099511628211n);
    return hash.toString(16);
  }
  const before = coolingBookFingerprint(question);
  assert.equal(before, original());
  question.choices[0].images.push('assets/도표.webp');
  assert.equal(coolingBookFingerprint(question), original());
  assert.notEqual(coolingBookFingerprint(question), before);
});
