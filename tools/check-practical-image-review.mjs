// Check that the manual audit still covers the exact current image bytes.
// This does NOT decide whether an image is visually correct.
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const reportPath = process.argv[2] || 'docs/hvac-practical-full-image-audit-2026-09-15.json';
const report = read(reportPath);
const rows = [...read('data/hvac-practical-restored.json'), ...read('data/hvac-practical-moducbt.json')];
const current = rows.flatMap(row => [
  ...[...(row.image ? [row.image] : []), ...(row.images || row.sourceImages || [])].map(source => ({ id: row.id, role: 'question', source })),
  ...(row.answerImages || []).map(source => ({ id: row.id, role: 'answer', source })),
]);
const key = entry => `${entry.id}|${entry.role}|${entry.source}`;
const audited = new Map(report.entries.map(entry => [key(entry), entry]));
const errors = [];
const htmlPath = path.join(root, reportPath.replace(/\.json$/, '.html'));
if (htmlPath.endsWith('.html') && fs.existsSync(htmlPath)) {
  const expectedRows = JSON.stringify(report.entries).replace(/</g, '\\u003c');
  if (!fs.readFileSync(htmlPath, 'utf8').includes(`const rows=${expectedRows};`)) errors.push('HTML and JSON audit entries differ');
}
if (audited.size !== report.entries.length) errors.push('Duplicate audit entries');
const currentKeys = new Set(current.map(key));
for (const entry of report.entries) if (!currentKeys.has(key(entry))) errors.push(`No longer connected: ${key(entry)}`);
for (const entry of current) {
  const match = audited.get(key(entry));
  if (!match) { errors.push(`Not reviewed: ${key(entry)}`); continue; }
  const bytes = fs.readFileSync(path.join(root, entry.source));
  if (crypto.createHash('sha256').update(bytes).digest('hex') !== match.sha256) errors.push(`Changed since review: ${entry.source}`);
}
const counts = {};
for (const entry of report.entries) counts[entry.status] = (counts[entry.status] || 0) + 1;
if (JSON.stringify(Object.entries(counts).sort()) !== JSON.stringify(Object.entries(report.statusCounts).sort())) errors.push('Status totals differ');
console.log(JSON.stringify({ currentReferences: current.length, auditedReferences: report.entries.length, statusCounts: counts, errors }, null, 2));
if (errors.length) process.exitCode = 1;
