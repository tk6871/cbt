#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const reportPath = 'docs/hvac-practical-full-image-audit-2026-09-15.json';
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const restored = JSON.parse(fs.readFileSync('data/hvac-practical-restored.json', 'utf8'));
const crops = JSON.parse(fs.readFileSync('data/hvac-practical-2026-reference-pdf.json', 'utf8')).crops;
const target = id => id.startsWith('hvac-practical-restored-2026-1-') || id.startsWith('hvac-practical-restored-2026-2-');
const key = entry => `${entry.id}|${entry.role}`;
const oldTarget = report.entries.filter(entry => target(entry.id));
const retained = report.entries.filter(entry => !target(entry.id));
const pools = new Map();
for (const entry of oldTarget) {
  const list = pools.get(key(entry)) || [];
  list.push(entry);
  pools.set(key(entry), list);
}

const current = restored.filter(row => target(row.id)).flatMap(row => [
  ...(row.images || []).map(source => ({ id: row.id, role: 'question', source })),
  ...(row.answerImages || []).map(source => ({ id: row.id, role: 'answer', source })),
]);
let nextIndex = Math.max(...report.entries.map(entry => entry.index)) + 1;
const replacement = current.map(entry => {
  const previous = (pools.get(key(entry)) || []).shift();
  const crop = crops.find(item => item.output === entry.source);
  if (!crop) throw new Error(`PDF crop metadata missing: ${entry.source}`);
  const bytes = fs.readFileSync(entry.source);
  const output = {
    index: previous?.index ?? nextIndex++,
    id: entry.id,
    role: entry.role,
    source: entry.source,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    size: crop.outputSize,
    sheet: previous?.sheet ?? 0,
    reviewMethod: 'source-pdf-and-individual-crop',
    status: 'repaired',
    note: `사용자 제공 ${crop.round} 해설 PDF ${crop.page}쪽에서 ${crop.role === 'question' ? '문제용' : '답안용'} 도면·사진만 분리해 원문과 대조함. 기존 2026년 영상 캡처는 PDF 자료로 완전 교체함.`,
    sourceComparison: 'user-provided-explanation-pdf',
    repairedInThisAudit: true,
    repairVersion: '5.1.4',
  };
  if (previous && previous.source !== entry.source) {
    output.previousSource = previous.source;
    output.previousSha256 = previous.sha256;
    output.previousNote = previous.note;
  }
  return output;
});

const unmatched = [...pools.values()].flat();
report.scope = '현재 공조 필답형에 연결된 복원 212개와 공개 자료 47개, 총 259개 이미지 참조. 2026년 1·2회는 사용자 제공 해설 PDF에서 분리한 25개를 포함함.';
report.method = '기존 43개 검수표와 개별 이미지 확인에 더해 2026년 1·2회 PDF 18쪽 및 최종 그림 25개를 직접 대조. 자동 검사는 표시·해시를 확인하며 내용 판정은 수동 기록임.';
report.supersededReferences = (report.supersededReferences || []).filter(entry => !target(entry.id));
report.entries = [...retained, ...replacement].sort((a, b) => a.index - b.index);
report.statusCounts = report.entries.reduce((counts, entry) => {
  counts[entry.status] = (counts[entry.status] || 0) + 1;
  return counts;
}, {});

if (report.entries.length !== 259 || replacement.length !== 25) {
  throw new Error(`ledger count mismatch: ${report.entries.length}, PDF replacements ${replacement.length}`);
}
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ entries: report.entries.length, pdfReferences: replacement.length, superseded: unmatched.length, statusCounts: report.statusCounts }, null, 2));
