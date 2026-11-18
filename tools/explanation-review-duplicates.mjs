// Print the largest exact matches first. A group is a reading queue, never a verdict.
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';

import {questionExclusion} from './explanation-review-scope.mjs';
import { choiceMatch, isAnswerNoticeOnly } from './review-choice-matching.mjs';

const {values, positionals} = parseArgs({allowPositionals:true, options:{
  'match-choices': {type:'boolean'},
  'answer-notices': {type:'boolean'},
  packet: {type:'string'},
  limit: {type:'string', default:'20'},
}});
const byChoice = values['match-choices'];
const noticesOnly = values['answer-notices'];
if (noticesOnly && !byChoice) throw Error('--answer-notices requires --match-choices.');
const [output] = positionals;
const limit = Number(values.limit);
if (values.packet && (!byChoice || !Number.isSafeInteger(limit) || limit < 1 || values.packet === output))
  throw Error('Use --match-choices --packet FILE --limit POSITIVE_INTEGER, with separate output paths.');
const packetRows = new Map();
const pendingNotices = new Set();
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const isExplanation = key => key.toLowerCase().includes('explanation');
const ledger = JSON.parse(fs.readFileSync('docs/explanation-review/2026-11-18/review.json'));
const records = new Map(ledger.records.map(row => [row.id, row]));
const groups = new Map();
let compared = 0;

for (const name of fs.readdirSync('data').filter(name => name.endsWith('.js')).sort()) {
  const file = 'data/' + name;
  const source = fs.readFileSync(file, 'utf8');
  if (!source.includes('window.CBT_DATA_')) continue;
  const context = { window: {} };
  vm.runInNewContext(source, context, { filename: file });
  for (const bank of Object.values(context.window).flat()) {
    for (const round of bank?.rounds || []) {
      for (const q of round.questions) {
        const id = (q._originRoundId || round.id) + ':' + (q._originalNumber || q.number);
        if (questionExclusion(bank, round, q, records.get(id))) continue;
        // External overlays, pictures and scanned material require their own comparison.
        if (!byChoice && (!q.text?.trim() || q.sourceImage || q.images?.length || q.explanationImages?.length ||
            q.choices.some(c => c.images?.length) || /<img\b|data:image\//i.test(JSON.stringify(q)))) continue;
        const ignored = ['number', '_originalNumber', '_originRoundId', 'problemUrl', 'source', 'answerRate'];
        const fields = Object.entries(q).filter(([k]) => !ignored.includes(k)).sort(([a], [b]) => a.localeCompare(b));
        const match = byChoice ? choiceMatch(q) : null;
        if (byChoice && !match) continue;
        const groupKey = byChoice ? digest(match.signature) : bank.key + ':' + digest(fields.filter(([k]) => !isExplanation(k)));
        const explanation = digest(fields.filter(([k]) => isExplanation(k)));
        if (noticesOnly && !records.has(id) && isAnswerNoticeOnly(q)) pendingNotices.add(id);
        if (values.packet) packetRows.set(id, q);
        if (!groups.has(groupKey)) groups.set(groupKey, []);
        groups.get(groupKey).push({ id, file, round: round.id, number: q.number, ...(match && { positions: match.positions, correct: match.correct, answer: q.answer }), explanation, status: records.get(id)?.status || null });
        compared++;
      }
    }
  }
}

const queue = [...groups.values()].filter(rows => noticesOnly ? rows.some(row => pendingNotices.has(row.id)) :
  rows.length > 1 && rows.some(row => !row.status));
queue.sort((a, b) => b.length - a.length || a[0].id.localeCompare(b[0].id));
const summary = {
  textRowsCompared: compared,
  ...(noticesOnly && {unreviewedTextAnswerNotices:pendingNotices.size, singletonPackets:queue.filter(group => group.length === 1).length}),
  groupsWithUnreviewedMembers: queue.length,
  distinctStoredExplanationGroups: queue.filter(group => new Set(group.map(row => row.explanation)).size > 1).length,
  members: queue.reduce((count, group) => count + group.length, 0),
  unreviewedMembers: queue.flat().filter(row => !row.status).length,
};
if (byChoice) {
  summary.reorderedGroups = queue.filter(rows => new Set(rows.map(row => row.positions.join())).size > 1).length;
  summary.conflictingKeyGroups = queue.filter(rows => new Set(rows.map(row => row.correct)).size > 1).length;
  summary.groupsWithReviewedSource = queue.filter(rows => rows.some(row => row.status?.startsWith('내용 검토 완료'))).length;
}
if (values.packet) {
  const records = new Map(ledger.records.map(row => [row.id, row]));
  const overlays = JSON.parse(fs.readFileSync('data/energy-reviewed-explanations.json'));
  const priority = rows => new Set(rows.map(row => row.correct)).size > 1 ? 0 :
    rows.some(row => row.status?.startsWith('내용 검토 완료')) ? 1 :
    rows.some(row => ['data/energy.js','data/hvac.js'].includes(row.file)) ? 2 : 3;
  const packets = [...queue].sort((a,b) => priority(a) - priority(b)).slice(0,limit).map(rows => {
    // Intern byte-for-byte identical content only. Preserve every distinct raw spelling and markup.
    const stems=[], choices=[], explanations=[], contexts=[];
    const index = (list, value) => {
      const existing = list.findIndex(item => JSON.stringify(item) === JSON.stringify(value));
      return existing < 0 ? list.push(value)-1 : existing;
    };
    const members = rows.map(({id,file,answer,positions,correct,status}) => {
      const q=packetRows.get(id), record=records.get(id);
      return {id,file,status,answer,positions,correct, ...(noticesOnly && {pendingAnswerNotice:pendingNotices.has(id)}),
        stem:index(stems,[q.text,q.html,q.hint]),
        context:index(contexts,Object.fromEntries(Object.entries(q).filter(([k])=>
          !['text','html','hint','choices','answer','number','source','sourcePage','problemUrl'].includes(k) && !isExplanation(k)))),
        choices:q.choices.map(c=>index(choices,c)),
        explanation:index(explanations,Object.fromEntries(Object.entries(q).filter(([k])=>isExplanation(k)))),
        source:q.problemUrl || q.source, sourcePage:q.sourcePage, ...(overlays[id] && {display:overlays[id]}),
        ...(record && {basis:record.basis,evidence:record.evidence})};
    });
    return {stems,choices,contexts,explanations,members};
  });
  fs.writeFileSync(values.packet, JSON.stringify(packets,null,2)+'\n');
}
if (output) fs.writeFileSync(output, JSON.stringify({ summary, queue }) + '\n');
console.log(JSON.stringify(summary, null, 2));
