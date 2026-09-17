#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = path.join(root, 'data/hvac-practical-restored.json');
const rows = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const asset = (round, number, role) => [
  `assets/hvac-practical/restored/${round}/hvac-practical-restored-${round}-${String(number).padStart(2, '0')}-${role}-pdf-v514.png`,
];

const updates = new Map([
  ['hvac-practical-restored-2026-1-01', { images: asset('2026-1', 1, 'question'), answerImages: asset('2026-1', 1, 'answer') }],
  ['hvac-practical-restored-2026-1-02', { images: asset('2026-1', 2, 'question'), answerImages: asset('2026-1', 2, 'answer') }],
  ['hvac-practical-restored-2026-1-03', { images: asset('2026-1', 3, 'question'), answerImages: null }],
  ['hvac-practical-restored-2026-1-04', { images: asset('2026-1', 4, 'question'), answerImages: null }],
  ['hvac-practical-restored-2026-1-06', { images: asset('2026-1', 6, 'question'), answerImages: null }],
  ['hvac-practical-restored-2026-1-07', { images: asset('2026-1', 7, 'question'), answerImages: null }],
  ['hvac-practical-restored-2026-1-08', { images: asset('2026-1', 8, 'question'), answerImages: null }],
  ['hvac-practical-restored-2026-1-09', { images: asset('2026-1', 9, 'question'), answerImages: null }],
  ['hvac-practical-restored-2026-1-11', { images: asset('2026-1', 11, 'question'), answerImages: asset('2026-1', 11, 'answer') }],
  ['hvac-practical-restored-2026-1-12', { images: asset('2026-1', 12, 'question'), answerImages: asset('2026-1', 12, 'answer') }],
  ['hvac-practical-restored-2026-2-01', {
    images: asset('2026-2', 1, 'question'),
    answerImages: null,
    answer: '① PBS1: MCF 여자·자기유지, 전동기 정회전, YL·GL 점등, MCF b접점으로 역회전 회로 인터록. ② PBS3: MCF 소자, YL 소등, 초기상태(GL 점등) 복귀. ③ PBS2: MCR 여자·자기유지, 전동기 역회전, RL·GL 점등, MCR b접점으로 정회전 회로 인터록.',
    explanation: '정회전과 역회전 접촉기가 동시에 붙으면 상간 단락 위험이 있다. 한쪽 코일이 여자되면 그 b접점으로 반대쪽 코일 회로를 끊는다. 이때 운전 방향 표시등과 함께 전원 표시등 GL은 계속 켜져 있다.',
  }],
  ['hvac-practical-restored-2026-2-02', { images: asset('2026-2', 2, 'question'), answerImages: null }],
  ['hvac-practical-restored-2026-2-03', { images: asset('2026-2', 3, 'question'), answerImages: asset('2026-2', 3, 'answer') }],
  ['hvac-practical-restored-2026-2-04', { images: asset('2026-2', 4, 'question'), answerImages: null }],
  ['hvac-practical-restored-2026-2-06', { images: asset('2026-2', 6, 'question'), answerImages: asset('2026-2', 6, 'answer') }],
  ['hvac-practical-restored-2026-2-08', { answerImages: asset('2026-2', 8, 'answer') }],
  ['hvac-practical-restored-2026-2-10', { images: asset('2026-2', 10, 'question'), answerImages: null }],
  ['hvac-practical-restored-2026-2-11', {
    images: asset('2026-2', 11, 'question'),
    answerImages: null,
    question: '아래 그림을 보고 다음 질문에 답하시오. ① 증발기의 냉매공급 방식을 참고하여 해당 장치의 명칭을 쓰시오. ② 냉매액은 증발기로, 냉매가스는 압축기로 보내어 무엇을 방지하는지 쓰시오.',
    answer: '① 액순환식 증발기 ② 리키드백(액압축) 방지',
    explanation: '저압 수액기에서 액체와 기체를 나눈다. 액냉매는 냉매펌프로 증발기에 다시 보내고, 냉매가스만 압축기로 보낸다. 따라서 액냉매가 압축기로 넘어가는 리키드백과 그로 인한 액압축을 막는다.',
    keyPoints: ['액순환식 증발기', '저압 수액기', '냉매펌프', '리키드백', '액압축 방지'],
  }],
  ['hvac-practical-restored-2026-2-12', {
    images: asset('2026-2', 12, 'question'),
    answerImages: null,
    explanation: '고정 스크롤과 선회 스크롤 사이의 초승달 모양 압축공간이 바깥쪽 흡입부에서 중심 토출구로 이동하면서 점점 작아져 냉매가스를 연속 압축한다. 흡입·압축·토출이 동시에 이어져 진동과 소음이 작다.',
  }],
]);

let changed = 0;
for (const row of rows) {
  if (!row.id.startsWith('hvac-practical-restored-2026-1-') && !row.id.startsWith('hvac-practical-restored-2026-2-')) continue;
  row.sourceNote = '사용자 제공 2026년 회차별 해설 PDF 원문 대조';
  const update = updates.get(row.id);
  if (!update) continue;
  for (const [key, value] of Object.entries(update)) {
    if (value === null) delete row[key];
    else row[key] = value;
  }
  changed += 1;
}

if (changed !== updates.size) throw new Error(`업데이트 수 불일치: ${changed} != ${updates.size}`);
for (const update of updates.values()) {
  for (const image of [...(update.images || []), ...(update.answerImages || [])]) {
    if (!fs.existsSync(path.join(root, image))) throw new Error(`새 PDF 이미지 누락: ${image}`);
  }
}

fs.writeFileSync(dataPath, `${JSON.stringify(rows, null, 2)}\n`);
console.log(JSON.stringify({ updatedQuestions: changed, sourceNotes: 24 }, null, 2));
