#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = path.join(root, 'data/hvac-practical-restored.json');
const manifestPath = path.join(root, 'data/hvac-practical-2023-2024-book-scans.json');
const rows = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const imageById = new Map(manifest.crops.map(crop => [
  `hvac-practical-restored-${crop.round}-${String(crop.number).padStart(2, '0')}`,
  crop.output,
]));
const sourceNote = '사용자 제공 복원 PDF·영상과 2023년 3회~2024년 2회 해설 스캔을 문제 내용 기준으로 대조';
const clearAnswerImages = new Set([
  'hvac-practical-restored-2024-1-03',
  'hvac-practical-restored-2024-2-03',
  'hvac-practical-restored-2024-2-11',
  'hvac-practical-restored-2024-2-12',
]);

const expectedIds = new Set(manifest.sourceMapping.map(item => item.targetId));
let sourceNotes = 0;
let images = 0;
for (const row of rows) {
  if (!expectedIds.has(row.id)) continue;
  row.sourceNote = sourceNote;
  sourceNotes += 1;
  const image = imageById.get(row.id);
  if (image) {
    if (!fs.existsSync(path.join(root, image))) throw new Error(`새 스캔 이미지 누락: ${image}`);
    row.images = [image];
    images += 1;
  }
  if (clearAnswerImages.has(row.id)) delete row.answerImages;
}

const solenoid = rows.find(row => row.id === 'hvac-practical-restored-2023-3-08');
if (!solenoid) throw new Error('2023-3 8번을 찾지 못했습니다.');
Object.assign(solenoid, {
  question: '응축기와 팽창밸브 사이에 설치하는 다음 장치의 명칭과 설치 목적을 쓰시오.',
  answer: '전자밸브(솔레노이드 밸브). 전자석으로 밸브를 개폐하여 냉매의 흐름을 자동으로 제어한다.',
  explanation: '코일에 전기가 들어오면 전자력이 플런저를 움직여 밸브를 열고, 전기가 끊기면 밸브가 닫힌다. 냉동장치의 운전 신호에 맞춰 액관의 냉매 공급을 자동으로 켜고 끄는 장치다.',
  keyPoints: ['전자밸브', '솔레노이드 밸브', '전자력으로 개폐', '냉매 흐름 자동 제어'],
  category: 'equipment',
});

const mixedAir = rows.find(row => row.id === 'hvac-practical-restored-2024-1-09');
if (!mixedAir) throw new Error('2024-1 9번을 찾지 못했습니다.');
Object.assign(mixedAir, {
  question: '외부공기와 실내공기의 비율이 1:4일 때, 외부공기 -5℃·0.001 kg/kg(DA), 실내공기 20℃·0.005 kg/kg(DA)라면 혼합공기의 건구온도와 절대습도를 구하시오.',
  answer: '혼합 건구온도 15℃, 혼합 절대습도 0.004 kg/kg(DA)',
  explanation: '외기:실내=1:4이므로 총 5부분으로 가중평균한다. 건구온도는 {(-5×1)+(20×4)}÷5=15℃이고, 절대습도는 {(0.001×1)+(0.005×4)}÷5=0.0042이므로 소수점 셋째 자리까지 쓰면 0.004 kg/kg(DA)이다.',
  keyPoints: ['혼합공기', '가중평균', '외기:실내=1:4'],
  category: 'air',
});

if (sourceNotes !== expectedIds.size) throw new Error(`대조 회차 문항 수 불일치: ${sourceNotes} != ${expectedIds.size}`);
if (images !== imageById.size) throw new Error(`스캔 이미지 적용 수 불일치: ${images} != ${imageById.size}`);

fs.writeFileSync(dataPath, `${JSON.stringify(rows, null, 2)}\n`);
console.log(JSON.stringify({ sourceNotes, images, corrected: [solenoid.id, mixedAir.id] }, null, 2));
