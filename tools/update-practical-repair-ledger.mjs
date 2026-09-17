// Print an apply_patch patch after visually reviewing the v514 candidates.
// This records supplied human review decisions; it does not classify pixels.
import fs from 'node:fs';
import crypto from 'node:crypto';
const file = 'docs/hvac-practical-full-image-audit-2026-09-15.json';
const report = JSON.parse(fs.readFileSync(file, 'utf8'));
const repairs = JSON.parse(fs.readFileSync('data/hvac-practical-image-repairs-v514.json', 'utf8'));
const notes = {
  103: '원본 2406초에서 계산식 전체와 우측 kg/h 단위 복구.',
  107: '원본 35초에서 우측 MC-a와 하단 공통선 포함 주회로·제어회로 복구. 잘린 주변 작동조건은 문제 본문에 모두 있음.',
  115: '원본 2310초에서 손에 가리지 않는 완성 계산식과 590 W 결과 복구.',
  117: '원본 2715초에서 두 계전기의 모든 단자·접점·110/220 V 표기 복구. 명칭을 묻는 문제이며 그림에 명칭 정답 없음.',
  118: '문제용과 같은 완전한 계전기 도면으로 답안 참고 이미지도 교체. 명칭 답안은 본문에 별도 표시.',
  119: '원본 3124초에서 냉방·난방 표의 전체 행·열 복구. 하단 여백에 손 일부는 남지만 수치·항목을 가리지 않음.',
  129: '원본 60초에서 빈칸 ③·GL·하단 귀로까지 복구. 정답 기입 전 장면.',
  130: '원본 310초에서 세 빈칸 정답과 우측 GL 회로를 함께 복구.',
  131: '원본 680초에서 우측 PBS2·하단 귀로와 위쪽 MCCB를 포함한 문제 회로 복구. 빈칸 유지.',
  132: '원본 1130초에서 우측 PBS2·X2와 전체 답안 회로 복구.',
  161: '원본 25초에서 우측 MC2 접점 라벨·모든 코일·귀로 복구. 빈칸 유지.',
  162: '원본 630초에서 MC2·자기유지 표기와 전체 답안 회로 복구.',
  164: '원본 1245초에서 오른쪽 T 접점·Ry2/GL 코일·하단 공통선 복구. 같은 문항의 문제용 이미지 교정은 별도 남음.',
  169: '원본 2360초에서 손에 가리지 않는 유인유닛 열교환부와 전체 공조 계통도 복구. 오른쪽 설명 아래 여백에 손 일부가 남음.',
  180: '기존 사진에서 계측기와 1~4 표시 전체만 분리. 잘려 있던 네 측정 조건은 기존 문제 본문과 대조하여 모두 유지됨.',
};
let patch = `*** Begin Patch\n*** Update File: ${file}\n`;
const block = value => JSON.stringify(value, null, 2).split('\n').map(line => '    '+line).join('\n')+',';
for (const entry of report.entries) {
  const old = structuredClone(entry);
  const repair = repairs.find(r => r.index === entry.index);
  if (repair && !entry.repairedInThisAudit) {
    const original = fs.readFileSync(repair.source);
    if (crypto.createHash('sha256').update(original).digest('hex') !== entry.sha256) throw new Error(`Original changed: ${entry.index}`);
    const bytes = fs.readFileSync(repair.target);
    entry.previousSource = entry.source;
    entry.previousSha256 = entry.sha256;
    entry.previousNote = entry.note;
    entry.source = repair.target;
    entry.sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    entry.size = [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
    entry.status = 'repaired';
    entry.note = repair.note || notes[entry.index];
    if (!entry.note) throw new Error(`Missing review note: ${entry.index}`);
    entry.reviewMethod = 'source-frame-and-individual-crop';
    entry.sourceComparison = repair.timestamp === null ? 'existing-image-and-question-text' : 'selected-source-video-frame';
    entry.repairedInThisAudit = true;
    entry.repairVersion = '5.1.4';
  } else if (entry.index === 151 && entry.status === 'repair') {
    entry.previousNote = entry.note;
    entry.status = 'cosmetic';
    entry.note = '판정 정정: 질문이 이미 FCU 명칭을 제공하고 작동원리를 물으므로 FCU 자막은 정답 노출이 아님. 이미지 주변 정리만 검토하며 현재 파일 유지.';
  }
  if (JSON.stringify(old) !== JSON.stringify(entry)) patch += `@@\n-${block(old).split('\n').join('\n-')}\n+${block(entry).split('\n').join('\n+')}\n`;
}
const oldCounts = report.statusCounts;
const counts = {};
for (const e of report.entries) counts[e.status] = (counts[e.status] || 0) + 1;
const countBlock = c => '  "statusCounts": '+JSON.stringify(c,null,2).replace(/\n/g,'\n  ')+',';
if (JSON.stringify(oldCounts) !== JSON.stringify(counts)) patch = patch.replace(`*** Update File: ${file}\n`, `*** Update File: ${file}\n@@\n-${countBlock(oldCounts).split('\n').join('\n-')}\n+${countBlock(counts).split('\n').join('\n+')}\n`);
console.log(patch+'*** End Patch');
