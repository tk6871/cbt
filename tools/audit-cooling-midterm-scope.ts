import fs from 'node:fs';
import vm from 'node:vm';
import { subjectFor, questionId } from '../src/cbt/catalog';
import { coolingMidtermItems, coolingSafetyItems, coolingTopicGroups, coolingSectionGroups, normalizedSchoolSubject, uniqueSchoolItems } from '../src/cbt/schoolQuestionBank';
import { coolingSourceAllowed, coolingSafety, coolingSupplementChapter, coolingStem } from '../src/cbt/coolingScope';
import type { Catalog, QuestionItem } from '../src/cbt/types';

const context = { window: {} as Record<string, Catalog> };
for (const key of ['hvac', 'hvac-hansol']) vm.runInNewContext(fs.readFileSync(`data/${key}.js`, 'utf8'), context);
const catalogs = Object.values(context.window);
const items: QuestionItem[] = catalogs.flatMap(c => c.rounds.flatMap(r => r.questions.map(q => ({
  round: { ...r, qualificationKey: c.key }, question: q, id: questionId(r, q), subject: subjectFor(r, q),
}))));
const pool = coolingMidtermItems(items);
const safety = coolingSafetyItems(items);
const selected = new Set(pool.map(item => item.id));
const separate = new Set(safety.map(item => item.id));
const rows = items.map(item => ({ id: item.id, year: item.round.year, session: item.round.session,
  source: item.round.qualificationKey, subject: item.subject, number: item.question.number,
  state: selected.has(item.id) ? 'main' : separate.has(item.id) ? 'safety-separate' : 'excluded',
  reason: !coolingSourceAllowed(item) ? 'source-year-cutoff' : separate.has(item.id) ? 'safety-regulations'
    : normalizedSchoolSubject(item) === '냉동냉장설비' ? 'original-refrigeration-subject'
    : selected.has(item.id) ? 'textbook-related-supplement' : 'no-clear-textbook-topic',
  stem: coolingStem(item).slice(0, 120), chapter: coolingSupplementChapter(item),
}));
const report = { schemaVersion: 1, date: '2026-10-08',
  limits: 'Metadata/stem-based scope review, not full source-image or answer correctness validation.',
  totalQuestions: items.length, totalRounds: catalogs.reduce((sum, c) => sum + c.rounds.length, 0),
  mainOriginal: pool.length, mainUnique: uniqueSchoolItems(pool).length,
  safetyOriginal: safety.length, safetyUnique: uniqueSchoolItems(safety).length,
  sources: Object.fromEntries(['hvac', 'hvac-hansol'].map(key => [key, pool.filter(item => item.round.qualificationKey === key).length])),
  supplementary: pool.filter(item => normalizedSchoolSubject(item) !== '냉동냉장설비').length,
  groups: coolingTopicGroups(pool).map(group => ({ title: group.label, count: group.items.length,
    sections: coolingSectionGroups(group).map(section => ({ title: section.label, count: section.items.length })) })), rows,
};
fs.writeFileSync('docs/cooling-midterm-scope-audit-2026-10-08.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...report, rows: undefined, groups: undefined }, null, 2));
console.log('Supplementary selected stems:');
for (const row of rows.filter(row => row.reason === 'textbook-related-supplement')) console.log(`${row.id} [${row.subject}] ${row.stem}`);
console.log('Separate safety stems:');
for (const row of rows.filter(row => row.state === 'safety-separate')) console.log(`${row.id} ${row.stem}`);
