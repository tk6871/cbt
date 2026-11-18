import test from 'node:test';
import assert from 'node:assert/strict';
import {questionExclusion} from './explanation-review-scope.mjs';

test('primary origin, supplementary links, and distinct domains', () => {
  const book = {key:'hvac-hansol'};
  const hosted = {source:'https://www.comcbt.com/test'};
  assert.equal(questionExclusion(book, hosted, {}), 'comcbt');
  assert.equal(questionExclusion(book, hosted, {source:'사용자 제공 PDF', additionalExplanations:[hosted]}), null);
  assert.equal(questionExclusion(book, {}, {problemUrl:'https://comcbt.com/x'}), 'comcbt');
  for (const source of ['https://moducbt.com/x', 'https://comcbt.com.example.org', 'https://example.org/comcbt.com']) {
    assert.equal(questionExclusion(book, {}, {source}), null);
  }
});

test('hybrid energy bank is counted by question and exclusions are disjoint', () => {
  const bank = {key:'energy-midterm'};
  assert.equal(questionExclusion(bank, {}, {sourcePage:'교재 32쪽'}), 'energyBook');
  assert.equal(questionExclusion(bank, {}, {sourcePage:'교재 32쪽', problemUrl:'https://www.comcbt.com/x'}), 'comcbt');
  assert.equal(questionExclusion({key:'energy-engineer'}, {}, {source:'사용자 제공 PDF'}), null);
  assert.equal(questionExclusion({key:'energy-restored'}, {}, {}), 'energyBook');
});

test('an explanation authored for a missing original stays in scope after review', () => {
  const bank = {key:'energy-restored'};
  assert.equal(questionExclusion(bank, {}, {explanationProvenance:'printed-question-and-answer-supplement'}), null);
  const q = {source:'https://www.comcbt.com', explanationProvenance:'manual-reviewed'};
  assert.equal(questionExclusion({}, {}, q, {previousExplanationProvenance:'local-beginner-authored'}), null);
  assert.equal(questionExclusion({}, {}, q, {reviewedAnswerNotice:'recorded-sha256'}), null);
  assert.equal(questionExclusion({}, {}, q, {changed:true,changeReason:'공식·계산·기호·단위·반올림'}), 'comcbt');
  assert.equal(questionExclusion({}, {}, {...q,explanationProvenance:'comcbt-exact-duplicate'}), 'comcbt');
});
