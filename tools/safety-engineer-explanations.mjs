import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import reviewed from './safety-engineer-explanations.json' with {type:'json'};

export function applySafetyEngineerExplanations(rounds) {
  const applied = new Set();
  for (const round of rounds) {
    for (const q of round.questions) {
      const id = round.id + ':' + q.number;
      const entry = reviewed[id];
      if (!entry) continue;
      const source = JSON.stringify([q.text, q.html, q.choices, q.answer]);
      const digest = createHash('sha256').update(source).digest('hex');
      assert.equal(digest, entry.questionSHA256, 'Recheck changed source before applying explanation: ' + id);
      q.explanation = entry.explanation;
      q.explanationProvenance = entry.explanationProvenance;
      if (entry.explanationFormula) q.explanationFormula = entry.explanationFormula;
      if (entry.explanationBasis) q.explanationBasis = entry.explanationBasis;
      applied.add(id);
    }
  }
  assert.equal(applied.size, Object.keys(reviewed).length, 'Missing source questions for reviewed explanations');
}
