#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';

const reportPath = 'docs/hvac-practical-full-image-audit-2026-09-15.json';
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const restored = JSON.parse(fs.readFileSync('data/hvac-practical-restored.json', 'utf8'));
const crops = JSON.parse(fs.readFileSync('data/hvac-practical-2023-2024-book-scans.json', 'utf8')).crops;
const cropBySource = new Map(crops.map(crop => [crop.output, crop]));
const targetRounds = new Set(['2023-3', '2024-1', '2024-2']);
const roundOf = id => id.match(/^hvac-practical-restored-(\d{4}-\d)-/)?.[1];
const target = id => targetRounds.has(roundOf(id));
const key = entry => `${entry.id}|${entry.role}`;
const exactKey = entry => `${key(entry)}|${entry.source}`;
const oldTarget = report.entries.filter(entry => target(entry.id));
const retained = report.entries.filter(entry => !target(entry.id));
const exact = new Map(oldTarget.map(entry => [exactKey(entry), entry]));
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
const usedIndexes = new Set();
const replacement = current.map(entry => {
  const unchanged = exact.get(exactKey(entry));
  const currentBytes = fs.readFileSync(entry.source);
  const currentSha256 = crypto.createHash('sha256').update(currentBytes).digest('hex');
  if (unchanged && unchanged.sha256 === currentSha256) {
    usedIndexes.add(unchanged.index);
    return unchanged;
  }

  const crop = cropBySource.get(entry.source);
  if (!crop) throw new Error(`검수 기록과 일치하지 않는 새 이미지: ${entry.source}`);
  const previous = (pools.get(key(entry)) || []).find(item => !usedIndexes.has(item.index));
  const output = {
    index: previous?.index ?? nextIndex++,
    id: entry.id,
    role: entry.role,
    source: entry.source,
    sha256: currentSha256,
    size: crop.outputSize,
    sheet: previous?.sheet ?? 0,
    reviewMethod: 'source-scan-and-individual-crop',
    status: 'repaired',
    note: `사용자 제공 ${crop.round} 해설 스캔의 인쇄 ${crop.sourceQuestion}번에서 문제에 필요한 도면·표·사진만 분리하고, 기존 복원 문항과 내용 기준으로 대조함.`,
    sourceComparison: 'user-provided-book-scan',
    repairedInThisAudit: true,
    repairVersion: '5.1.4',
  };
  usedIndexes.add(output.index);
  if (previous) {
    output.previousSource = previous.source;
    output.previousSha256 = previous.sha256;
    output.previousNote = previous.note;
  }
  return output;
});

const superseded = oldTarget.filter(entry => !usedIndexes.has(entry.index));
report.scope = `현재 공조 필답형에 연결된 총 ${retained.length + replacement.length}개 이미지 참조. 2023년 3회~2024년 2회 해설 스캔에서 분리·대조한 24개와 2026년 1·2회 해설 PDF에서 분리한 25개를 포함함.`;
report.method = '기존 전수 검수표와 개별 이미지 확인에 더해 2023년 3회~2024년 2회 해설 스캔 21장 및 최종 그림 24개를 문제 내용으로 직접 대조. 자동 검사는 표시·해시를 확인하며 내용 판정은 수동 기록임.';
report.supersededReferences = [
  ...(report.supersededReferences || []).filter(entry => !target(entry.id)),
  ...superseded.map(entry => ({ ...entry, supersededReason: '해설 스캔 대조 후 중복·불완전 이미지 연결 제거' })),
];
report.entries = [...retained, ...replacement].sort((a, b) => a.index - b.index);
report.statusCounts = report.entries.reduce((counts, entry) => {
  counts[entry.status] = (counts[entry.status] || 0) + 1;
  return counts;
}, {});

if (report.entries.length !== 259 || replacement.length !== 41 || crops.length !== 25) {
  throw new Error(`검수표 수 불일치: 전체 ${report.entries.length}, 대상 ${replacement.length}, 새 크롭 ${crops.length}`);
}
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  entries: report.entries.length,
  targetReferences: replacement.length,
  scanCrops: crops.length,
  superseded: superseded.length,
  statusCounts: report.statusCounts,
}, null, 2));
