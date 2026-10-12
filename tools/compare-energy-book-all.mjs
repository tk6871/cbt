// Inverse comparison: each midterm source against every scanned book window.
// OCR candidates are search aids only; no inclusion verdict is made here.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const root = 'work/energy-book-scope';
const report = JSON.parse(fs.readFileSync('docs/energy-midterm-book-scope-2026-10-12.json'));
const manifest = JSON.parse(fs.readFileSync(`${root}/ocr/_source.json`));
assert.equal(manifest.sha256, report.source.sha256);
const normalize = s => String(s || '').normalize('NFKC').replace(/<[^>]+>|&[^;]+;/g, ' ').replace(/\(오류 신고[\s\S]*/g, '').toLowerCase().replace(/[^가-힣a-z0-9]/g, '');
const grams = s => [...new Set(Array.from({ length: Math.max(0, s.length - 1) }, (_, i) => s.slice(i, i + 2)))];
const pages = Array.from({ length: manifest.pages }, (_, i) => JSON.parse(fs.readFileSync(`${root}/ocr/page-${i + 1}.json`)));
const windows = [];
for (const p of pages) for (const side of [0, 1]) {
  const rows = p.rows.filter(r => (r.box[0] >= .48 ? 1 : 0) === side).sort((a, b) => b.box[1] + b.box[3] - a.box[1] - a.box[3]);
  for (let start = 0; start < rows.length; start++) {
    const selected = rows.slice(start, start + 21), text = selected.map(r => r.text).join('\n');
    const endQuestion = selected.findIndex((r, i) => i > 0 && /^[①②③④❶❷❸❹]/.test(r.text));
    windows.push({ page: p.page, side, start, text, boxes: selected.map(r => r.box),
      normalized: normalize(text), stem: normalize(selected.slice(0, endQuestion > 0 ? endQuestion : 5).map(r => r.text).join('')) });
  }
}
const results = [];
for (let index = 0; index < report.rows.length; index++) {
  const q = report.rows[index], query = grams(normalize(q.question)), choices = q.choices.map(c => grams(normalize(c)));
  const overlap = (list, text) => list.length ? list.filter(g => text.includes(g)).length / list.length : 0;
  const candidates = windows.map(w => {
    const questionScore = overlap(query, w.normalized), stemScore = overlap(query, w.stem);
    const choiceScores = choices.map(c => overlap(c, w.normalized));
    const choiceScore = choiceScores.reduce((a, b) => a + b, 0) / 4;
    return { w, questionScore, stemScore, choiceScores, choiceScore,
      combined: .45 * questionScore + .55 * choiceScore,
      minChoice: Math.min(...choiceScores), threeChoices: [...choiceScores].sort((a,b)=>b-a).slice(0,3).reduce((a,b)=>a+b,0)/3 };
  });
  const pick = (field, limit, problemOnly) => {
    const sorted = candidates.filter(c => !problemOnly || c.w.page >= 310).sort((a,b)=>b[field]-a[field]||b.combined-a.combined);
    const chosen = [], seen = new Set();
    for (const c of sorted) { if (seen.has(c.w.page)) continue; seen.add(c.w.page);
      chosen.push({ page: c.w.page, side: c.w.side, start: c.w.start, score: +c[field].toFixed(3), questionScore: +c.questionScore.toFixed(3), choiceScores: c.choiceScores.map(n=>+n.toFixed(3)), text: c.w.text, boxes: c.w.boxes });
      if (chosen.length === limit) break;
    }
    return chosen;
  };
  const evidencePages = new Set(q.evidence.map(e=>e.pdfPage));
  const evidence = candidates.filter(c=>evidencePages.has(c.w.page)).sort((a,b)=>b.combined-a.combined);
  const byEvidence = [...evidencePages].map(p=>evidence.find(c=>c.w.page===p)).filter(Boolean).map(c=>({page:c.w.page,side:c.w.side,start:c.w.start,text:c.w.text,boxes:c.w.boxes,score:c.combined}));
  results.push({ index, id: q.id, status:q.status, active:q.active, question:q.question, choices:q.choices, answer:q.storedAnswer, evidence:byEvidence,
    combined:pick('combined',10,true), questionOnly:pick('questionScore',10,true), choicesOnly:pick('choiceScore',10,true), threeChoices:pick('threeChoices',6,true) });
  console.log(`${index+1}/${report.rows.length}: ${q.id}`);
}
fs.writeFileSync(`${root}/all-comparisons.json`,JSON.stringify({source:manifest,rows:results},null,2)+'\n');
// Compact texts to inspect every distinct candidate without repeating windows.
for (const group of ['unconfirmed','confirmed']) {
 const selected=results.filter(r=>group==='unconfirmed'?['variant','theory','unresolved'].includes(r.status):['previous','same'].includes(r.status));
 fs.writeFileSync(`${root}/${group}-all.txt`,selected.map(r=>{
  const candidates=[...r.evidence,...r.combined.slice(0,6),...r.questionOnly.slice(0,6),...r.choicesOnly.slice(0,6)],seen=new Set();
  return `\n=== ${r.index} ${r.id} ${r.status} ${r.active?'active':'retired'} ===\n${r.question}\n${r.choices.join(' / ')}\n`+candidates.filter(c=>{if(seen.has(c.page))return false;seen.add(c.page);return true}).map(c=>`PAGE ${c.page} SIDE ${c.side} SCORE ${c.score}\n${c.text}`).join('\n---\n');
 }).join('\n'));
}
console.log({pages:pages.length,windows:windows.length,questions:results.length});
