#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rows = JSON.parse(fs.readFileSync(path.join(root, 'data/hvac-practical-moducbt.json'), 'utf8'));
const restoredRows = JSON.parse(fs.readFileSync(path.join(root, 'data/hvac-practical-restored.json'), 'utf8'));
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

if (restoredRows.length !== 312) errors.push(`회차별 복원 필답형 문항이 312개가 아닙니다: ${restoredRows.length}`);
const restoredIds = new Set();
const restoredRounds = new Set();
let restoredImageCount = 0;
const restoredCategories = new Set(['equipment', 'cycle', 'calculation', 'operation', 'piping', 'air', 'safety']);
const restoredDifficulties = new Set(['basic', 'standard', 'advanced']);
for (const row of restoredRows) {
  if (!row.id || restoredIds.has(row.id)) errors.push(`회차별 복원 필답형 ID가 없거나 중복입니다: ${row.id}`);
  restoredIds.add(row.id);
  restoredRounds.add(`${row.year}-${row.session}`);
  if (!Number.isInteger(row.year) || row.year < 2018 || row.year > 2026) errors.push(`${row.id}: 연도가 잘못되었습니다: ${row.year}`);
  if (!/^\d+[AB]?$/i.test(String(row.session || ''))) errors.push(`${row.id}: 회차가 잘못되었습니다: ${row.session}`);
  if (!Number.isInteger(row.number) || row.number < 1 || row.number > 12) errors.push(`${row.id}: 문제 번호가 잘못되었습니다: ${row.number}`);
  if (!restoredCategories.has(row.category)) errors.push(`${row.id}: 분야가 잘못되었습니다: ${row.category}`);
  if (!restoredDifficulties.has(row.difficulty)) errors.push(`${row.id}: 난이도가 잘못되었습니다: ${row.difficulty}`);
  for (const field of ['question', 'answer', 'explanation', 'sourceNote']) {
    if (!String(row[field] || '').trim()) errors.push(`${row.id}: ${field}가 비어 있습니다.`);
  }
  if (String(row.answer || '').trim() === String(row.explanation || '').trim()) {
    errors.push(`${row.id}: 쉬운 풀이가 모범답안 반복입니다.`);
  }
  if (!Array.isArray(row.keyPoints) || !row.keyPoints.length) errors.push(`${row.id}: 채점 핵심어가 비어 있습니다.`);
  for (const image of [...(row.images || []), ...(row.answerImages || [])]) {
    restoredImageCount += 1;
    if (!fs.existsSync(path.join(root, image))) errors.push(`${row.id}: 복원 필답형 이미지가 없습니다: ${image}`);
  }
}
if (restoredRows.length && restoredRounds.size !== 26) errors.push(`회차별 복원 필답형 회차가 26개가 아닙니다: ${restoredRounds.size}`);

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
for (const group of ['public', 'restored', 'foundation', 'drill']) {
  if (!typeSource.includes(`'${group}'`)) errors.push(`필답형 문제 묶음 타입에 ${group}이 없습니다.`);
}

console.log(JSON.stringify({
  publicQuestions: rows.length,
  publicImages: rows.filter((row) => fs.existsSync(path.join(root, row.image))).length,
  curatedAnswers: curatedEntries.length,
  foundationQuestions: 12,
  drillQuestions: drillIds.length,
  restoredQuestions: restoredRows.length,
  restoredRounds: restoredRounds.size,
  restoredImages: restoredImageCount,
  totalQuestions: rows.length + restoredRows.length + 12 + drillIds.length,
  errors,
}, null, 2));
if (errors.length) process.exitCode = 1;
