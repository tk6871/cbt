import fs from 'node:fs';
import { applyVerdicts, verdictPath } from './energy-duplicate-verdicts.mjs';

// Explicitly reviewed same-question/same-answer variants only. Do not infer
// equivalence from shared keywords, answer numbers or a transitive similarity.
const approvedVariants = [
  [173,174], [149,150], [148,150], [148,149], [74,85], [148,152],
  [33,36], [150,152], [149,152], [60,67], [16,17], [163,167],
  [21,33], [36,41], [33,41], [21,36], [111,113], [156,158],
  [55,56], [55,67], [55,60], [49,54], [56,60], [56,67],
];

export function consolidateEnergyMidterm(catalog) {
  const report = applyVerdicts(
    JSON.parse(fs.readFileSync('docs/energy-duplicate-review-2026-10-11.json', 'utf8')),
    JSON.parse(fs.readFileSync(verdictPath, 'utf8')),
  );
  const questions = catalog.rounds.flatMap(r => r.questions);
  const id = q => `${q._originRoundId}:${q._originalNumber}`;
  const bank = new Map(questions.map(q => [id(q), q]));
  const bankId = row => row.id.replace(/^midterm:/, 'school-energy-');
  const plain = s => String(s || '').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
  for (const row of report.rows) {
    const q = bank.get(bankId(row));
    if (!q || q.answer !== row.answer || (q.sourceImage || null) !== row.sourceImage
      || JSON.stringify(q.images || []) !== JSON.stringify(row.images)
      || (!row.ocr && (plain(q.text || q.html) !== row.text
        || JSON.stringify(q.choices.map(c=>plain(c.text || c.html))) !== JSON.stringify(row.choices.map(c=>c.text))))) throw Error('Reviewed bank changed: '+row.id);
  }
  const allowed = new Set(approvedVariants.map(([a,b]) => [a,b].sort((x,y)=>x-y).join(':')));
  const parent = report.rows.map((_,i)=>i);
  const root = i => parent[i] === i ? i : (parent[i] = root(parent[i]));
  const selected = report.pairs.filter(p => p.review.decision === 'same'
    || allowed.has([p.a,p.b].sort((a,b)=>a-b).join(':')));
  if (selected.filter(p=>p.review.decision==='variant').length !== approvedVariants.length)
    throw Error('Approved variants changed; review before consolidation');
  for (const p of selected) {
    if (p.review.warnings?.length) throw Error('Do not consolidate unresolved warnings');
    if (bank.get(bankId(report.rows[p.a])).midtermCalculation
      || bank.get(bankId(report.rows[p.b])).midtermCalculation) throw Error('Preserve numerical variants');
    parent[root(p.a)] = root(p.b);
  }
  for (const p of report.pairs.filter(p=>!selected.includes(p))) {
    if (root(p.a) === root(p.b)) throw Error('Unapproved pair connected by consolidation: '+p.id);
  }
  const groups = new Map();
  report.rows.forEach((row,i)=>{
    const k=root(i); if(!groups.has(k)) groups.set(k,[]); groups.get(k).push(i);
  });
  const labelDate = row => {
    const m=row.label.match(/(\d{4})년\s*(\d+)(?:·(\d+))?회/);
    if (!m) throw Error('Missing source date: '+row.label);
    return Number(m[1])*100 + Number(m[3] || m[2]);
  };
  const dateOf = row => Math.max(labelDate(row), ...(bank.get(bankId(row)).midtermPdfSources || []).map(s=>s.year*100+s.session));
  const ledger = [];
  for (const indices of [...groups.values()].filter(g=>g.length>1)) {
    const rows=indices.map(i=>report.rows[i]).sort((a,b)=>dateOf(b)-dateOf(a)
      || Number(!!b.sourceImage)-Number(!!a.sourceImage) || a.id.localeCompare(b.id));
    const representative=bank.get(bankId(rows[0]));
    const occurrences = new Map();
    for (const row of rows) {
      const q=bank.get(bankId(row));
      const sources=q.midtermPdfSources?.length ? q.midtermPdfSources.map(s=>({year:s.year,session:s.session}))
        : [{year:Math.floor(labelDate(row)/100),session:labelDate(row)%100}];
      for (const s of sources) occurrences.set(`${s.year}-${s.session}`, s);
    }
    representative.midtermOccurrences = [...occurrences.values()].sort((a,b)=>b.year-a.year||b.session-a.session)
      .map(s=>`${s.year}년 ${s.session}회`);
    const latestPdf = [...(representative.midtermPdfSources || [])].sort((a,b)=>b.year-a.year||b.session-a.session)[0];
    if (latestPdf) representative.midtermLatestSource = `${latestPdf.year}년 ${latestPdf.session}회 ${latestPdf.number}번`;
    for (const row of rows.slice(1)) bank.get(bankId(row)).midtermDuplicateOf=id(representative);
    ledger.push({representative:id(representative),source:rows[0].label,latestSource:representative.midtermLatestSource || rows[0].label,occurrences:representative.midtermOccurrences,
      members:rows.map(row=>({id:bankId(row),label:row.label})),
      reasons:selected.filter(p=>indices.includes(p.a)&&indices.includes(p.b)).map(p=>({id:p.id,reason:p.review.reason}))});
  }
  const active=questions.filter(q=>!q.midtermDuplicateOf);
  return {date:'2026-10-12',scope:'energy-midterm-only',stored:questions.length,active:active.length,
    excluded:questions.length-active.length,groups:ledger,policy:'Same question and answer: latest source only. Preserve calculation/answer/condition variants and old saved IDs.'};
}
