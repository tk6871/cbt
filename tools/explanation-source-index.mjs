// These human-readable labels belong to the HVAC linker, not to every catalog
// that happens to share a year, session and question number.
export function namedHvacSourceDescription({ catalog, round, question }) {
  if (!['hvac', 'hvac-hansol'].includes(catalog.key)) return;
  const kind = catalog.key === 'hvac-hansol' ? '한솔 공조' : Number(round.year) >= 2021 ? '공조 복원' : 'COMCBT';
  const session = String(round.session || '').replace(/^.*?:\s*/, '');
  return `${kind} · ${round.year}년 ${session || round.title} ${question.number}번`;
}
export function buildNamedHvacSourceIndex(rows) {
  const index = new Map();
  for (const row of rows) {
    const description = namedHvacSourceDescription(row);
    if (!description) continue;
    if (index.has(description)) throw new Error(`Ambiguous explanation source: ${description}`);
    index.set(description, row);
  }
  return index;
}
