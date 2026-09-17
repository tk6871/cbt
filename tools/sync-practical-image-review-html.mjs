// Regenerate only the embedded data of the standalone audit report.
import fs from 'node:fs';
const base = 'docs/hvac-practical-full-image-audit-2026-09-15';
const rows = JSON.parse(fs.readFileSync(`${base}.json`, 'utf8')).entries;
const html = fs.readFileSync(`${base}.html`, 'utf8');
if (!/^const rows=.*;$/m.test(html)) throw new Error('Audit data marker missing');
fs.writeFileSync(`${base}.html`, html.replace(/^const rows=.*;$/m, () => `const rows=${JSON.stringify(rows).replace(/</g, '\\u003c')};`));
