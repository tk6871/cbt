// Print the largest exact matches first. A group is a reading queue, never a verdict.
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';

const ledger = JSON.parse(fs.readFileSync('docs/explanation-review/2026-11-18/review.json'));
const statuses = new Map(ledger.records.map(row => [row.id, row.status]));
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
        // External overlays, pictures and scanned material require their own comparison.
        if (!q.text?.trim() || q.sourceImage || q.images?.length || q.explanationImages?.length ||
            q.choices.some(c => c.images?.length) || /<img\b|data:image\//i.test(JSON.stringify(q))) continue;
        const ignored = ['number', '_originalNumber', '_originRoundId', 'problemUrl', 'source', 'answerRate'];
        const fields = Object.entries(q).filter(([k]) => !ignored.includes(k)).sort(([a], [b]) => a.localeCompare(b));
        const isExplanation = k => k.toLowerCase().includes('explanation');
        const digest = pairs => createHash('sha256').update(JSON.stringify(pairs)).digest('hex');
        // Keep the exact stem, HTML, ordered choices, key and all unknown contextual fields.
        const key = bank.key + ':' + digest(fields.filter(([k]) => !isExplanation(k)));
        const explanation = digest(fields.filter(([k]) => isExplanation(k)));
        const id = (q._originRoundId || round.id) + ':' + (q._originalNumber || q.number);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push({ id, file, round: round.id, number: q.number, explanation, status: statuses.get(id) || null });
        compared++;
      }
    }
  }
}

const queue = [...groups.values()].filter(rows => rows.length > 1 && rows.some(row => !row.status));
queue.sort((a, b) => b.length - a.length || a[0].id.localeCompare(b[0].id));
const summary = {
  textRowsCompared: compared,
  groupsWithUnreviewedMembers: queue.length,
  distinctStoredExplanationGroups: queue.filter(group => new Set(group.map(row => row.explanation)).size > 1).length,
  members: queue.reduce((count, group) => count + group.length, 0),
  unreviewedMembers: queue.flat().filter(row => !row.status).length,
};
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ summary, queue }) + '\n');
console.log(JSON.stringify(summary, null, 2));
