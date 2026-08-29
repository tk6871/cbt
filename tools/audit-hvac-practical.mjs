#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rows = JSON.parse(fs.readFileSync(path.join(root, 'data/hvac-practical-moducbt.json'), 'utf8'));
const guideSource = fs.readFileSync(path.join(root, 'src/cbt/qualificationStudyGuides.ts'), 'utf8');
const drillSource = fs.readFileSync(path.join(root, 'src/cbt/hvacPracticalDrills.ts'), 'utf8');
const typeSource = fs.readFileSync(path.join(root, 'src/cbt/hvacPracticalTypes.ts'), 'utf8');
const errors = [];
const expectedNumbers = Array.from({ length: 47 }, (_, index) => index + 1);

if (rows.length !== 47) errors.push(`공개 필답형 문항이 47개가 아닙니다: ${rows.length}`);
for (const number of expectedNumbers) {
  const row = rows.find((item) => item.number === number);
  if (!row) {
    errors.push(`${number}번 문항이 없습니다.`);
    continue;
  }
  if (!String(row.question || '').trim()) errors.push(`${number}번 문제 문장이 비어 있습니다.`);
  if (!String(row.image || '').trim()) errors.push(`${number}번 이미지 연결이 비어 있습니다.`);
  else if (!fs.existsSync(path.join(root, row.image))) errors.push(`${number}번 이미지 파일이 없습니다: ${row.image}`);
  if (!guideSource.includes(`  ${number}: { answer:`)) errors.push(`${number}번 교정 답안이 없습니다.`);
}

const curatedEntries = [...guideSource.matchAll(/^\s{2}(\d+): \{ answer:/gm)].map((match) => Number(match[1]));
if (curatedEntries.length !== 47 || new Set(curatedEntries).size !== 47) {
  errors.push(`교정 답안 키가 1~47의 고유 번호가 아닙니다: ${curatedEntries.length}개`);
}
if (/answer:\s*['"][^'"\n]*과부하 운전이 가능/.test(guideSource)) errors.push('밀폐형 압축기의 잘못된 원문 답안이 교정 데이터에 남아 있습니다.');
if (/원리\)\s*|압축시킨다\s*$|방지한\s*['"`,}]/m.test(guideSource)) errors.push('잘린 원문형 답안이 교정 데이터에 남아 있습니다.');

const drillIds = [...drillSource.matchAll(/id:\s*'hvac-practical-drill-(\d{2})'/g)].map((match) => Number(match[1]));
if (drillIds.length !== 36 || new Set(drillIds).size !== 36 || drillIds.some((number, index) => number !== index + 1)) {
  errors.push(`심화 필답형 문항 ID가 01~36 순서가 아닙니다: ${drillIds.length}개`);
}
for (const field of ['question', 'answer', 'explanation', 'keyPoints']) {
  const count = [...drillSource.matchAll(new RegExp(`${field}:`, 'g'))].length;
  if (count < 36) errors.push(`심화 필답형 ${field} 항목이 부족합니다: ${count}개`);
}
for (const category of ['cycle', 'calculation', 'operation', 'piping', 'air', 'safety']) {
  if (!drillSource.includes(`category: '${category}'`)) errors.push(`심화 필답형 분야가 없습니다: ${category}`);
}
if (!guideSource.includes('...hvacPracticalDrills')) errors.push('심화 필답형 문제가 전체 문제 목록에 연결되지 않았습니다.');
if (!typeSource.includes("PracticalPromptGroup = 'public' | 'foundation' | 'drill'")) errors.push('필답형 문제 묶음 타입에 drill이 없습니다.');

console.log(JSON.stringify({
  publicQuestions: rows.length,
  publicImages: rows.filter((row) => fs.existsSync(path.join(root, row.image))).length,
  curatedAnswers: curatedEntries.length,
  foundationQuestions: 12,
  drillQuestions: drillIds.length,
  totalQuestions: rows.length + 12 + drillIds.length,
  errors,
}, null, 2));
if (errors.length) process.exitCode = 1;
