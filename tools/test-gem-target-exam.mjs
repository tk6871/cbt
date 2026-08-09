import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const targetSubjects = ['보석 특성', '보석 감별', '다이아몬드 감정', '보석 가공'];
const legacySubjectMap = {
  보석학일반: '보석 특성',
  보석감별법: '보석 감별',
  다이아몬드감정법: '다이아몬드 감정',
  보석가공기법: '보석 가공',
};

globalThis.window = {};
await import(`${pathToFileURL(resolve('data/jewelry.js')).href}?gem-target-test=1`);

const catalogs = window.CBT_DATA_JEWELRY || [];
assert.deepEqual(
  catalogs.map((catalog) => catalog.key),
  ['gem-appraiser', 'precious-industrial', 'precious-craftsman', 'precious-master'],
  '보석관 원본 4종목 구성이 달라졌습니다.',
);

const items = catalogs.flatMap((catalog) => catalog.rounds.flatMap((round) => round.questions
  .filter((question) => question.targetRelevance !== 'peripheral')
  .map((question) => ({
    id: `${round.id}:${question.number}`,
    roundId: round.id,
    sourceKey: catalog.key,
    relevance: question.targetRelevance,
    targetSubject: catalog.key === 'gem-appraiser'
      ? legacySubjectMap[question.sourceSubject] || question.targetSubject
      : question.targetSubject,
  }))));

assert.equal(items.length, 2107, '목표 모의시험의 연관 문항 수가 달라졌습니다.');
const direct = items.filter((item) => item.relevance === 'core');
const related = items.filter((item) => item.relevance === 'related');
assert.equal(direct.length, 1800, '직접 연계 문항 수가 달라졌습니다.');
assert.equal(related.length, 307, '유사 보강 문항 수가 달라졌습니다.');

for (const subject of targetSubjects) {
  assert.equal(
    direct.filter((item) => item.targetSubject === subject).length,
    450,
    `${subject}의 옛 보석감정사 과목 통폐합 수가 450문항이 아닙니다.`,
  );
  assert.ok(
    related.filter((item) => item.targetSubject === subject).length >= 5,
    `${subject}에 유사 보강 5문항을 만들 수 없습니다.`,
  );
}

function takeDiverse(pool, count, excluded = new Set()) {
  const selected = [];
  const roundCount = new Map();
  const add = (allowExtraFromRound) => {
    for (const item of pool) {
      if (selected.length >= count || excluded.has(item.id) || selected.some((entry) => entry.id === item.id)) continue;
      if (!allowExtraFromRound && (roundCount.get(item.roundId) || 0) >= 2) continue;
      selected.push(item);
      roundCount.set(item.roundId, (roundCount.get(item.roundId) || 0) + 1);
    }
  };
  add(false);
  if (selected.length < count) add(true);
  return selected;
}

for (const subject of targetSubjects) {
  const directItems = direct.filter((item) => item.targetSubject === subject);
  const relatedItems = related.filter((item) => item.targetSubject === subject);
  const selected = [
    ...takeDiverse(directItems, 15),
    ...takeDiverse(relatedItems, 5),
  ];
  assert.equal(selected.length, 20, `${subject} 실전형 20문항을 만들 수 없습니다.`);
  assert.equal(new Set(selected.map((item) => item.id)).size, 20, `${subject}에 중복 문항이 포함되었습니다.`);
  assert.equal(selected.filter((item) => item.relevance === 'core').length, 15, `${subject} 직접 연계 비율이 다릅니다.`);
  assert.equal(selected.filter((item) => item.relevance === 'related').length, 5, `${subject} 유사 보강 비율이 다릅니다.`);
}

console.log(`Gem target exam audit passed: ${items.length} target items, 4 subjects × 20 questions, direct 15 + related 5.`);
