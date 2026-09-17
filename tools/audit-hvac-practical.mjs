#!/usr/bin/env node

import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rows = JSON.parse(fs.readFileSync(path.join(root, 'data/hvac-practical-moducbt.json'), 'utf8'));
const restoredRows = JSON.parse(fs.readFileSync(path.join(root, 'data/hvac-practical-restored.json'), 'utf8'));
const supplementRows = JSON.parse(fs.readFileSync(path.join(root, 'data/hvac-practical-supplement-20260916.json'), 'utf8'));
const supplementSource = fs.readFileSync(path.join(root, 'src/cbt/hvacPracticalSupplement.ts'), 'utf8');
const photoRows = JSON.parse(fs.readFileSync(path.join(root, 'data/hvac-practical-photo-20260917.json'), 'utf8'));
const reference2026 = JSON.parse(fs.readFileSync(path.join(root, 'data/hvac-practical-2026-reference-pdf.json'), 'utf8'));
const sharedAnswerSource = fs.readFileSync(path.join(root, 'src/cbt/hvacPracticalPublicAnswers.ts'), 'utf8');
const guideSource = fs.readFileSync(path.join(root, 'src/cbt/qualificationStudyGuides.ts'), 'utf8');
const drillSource = fs.readFileSync(path.join(root, 'src/cbt/hvacPracticalDrills.ts'), 'utf8');
const typeSource = fs.readFileSync(path.join(root, 'src/cbt/hvacPracticalTypes.ts'), 'utf8');
const errors = [];
if (photoRows.length !== 123) errors.push('사진 PDF 123문항 수 불일치');
for (const [index, row] of photoRows.entries()) {
  if (row.number !== index + 1 || row.id !== `hvac-practical-photo-20260917-${String(index + 1).padStart(3, '0')}`) errors.push(`사진 자료 번호/ID 오류: ${row.id}`);
  if (!row.question || !row.sourceAnswer || !row.sourcePage || row.sourceEndPage < row.sourcePage || !/^[a-f0-9]{64}$/.test(row.sourceSha256)) errors.push(`사진 자료 출처 누락: ${row.id}`);
  if (row.images.length !== row.imageSources.length) errors.push(`사진 원본 기록 불일치: ${row.id}`);
  for (const [i, image] of row.images.entries()) {
    if (!fs.existsSync(path.join(root, image))) errors.push(`사진 누락: ${image}`);
    else if (crypto.createHash('sha256').update(fs.readFileSync(path.join(root, image))).digest('hex') !== row.imageSources[i]?.sha256) errors.push(`사진 원본 해시 불일치: ${image}`);
  }
}
if (!guideSource.includes('...hvacPracticalPhotos')) errors.push('사진 자료 앱 연결 누락');
if (supplementRows.length !== 42) errors.push('추가 PDF 42문항 수 불일치');
for (const [index, row] of supplementRows.entries()) {
  if (row.number !== index + 1 || row.id !== `hvac-practical-supplement-20260916-${String(index + 1).padStart(2, '0')}`) errors.push(`추가 자료 번호/ID 오류: ${row.id}`);
  if (!row.question || !row.sourcePage || !/^[a-f0-9]{64}$/.test(row.sourceSha256)) errors.push(`추가 자료 출처 누락: ${row.id}`);
  if (!supplementSource.includes(`  ${row.number}: { category:`)) errors.push(`추가 자료 학습 답안 누락: ${row.id}`);
  if (row.image && !fs.existsSync(path.join(root, row.image))) errors.push(`추가 자료 이미지 누락: ${row.image}`);
}
if (!guideSource.includes('...hvacPracticalSupplement')) errors.push('추가 자료 앱 연결 누락');
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
  if (!sharedAnswerSource.includes(`  ${number}: { answer:`)) errors.push(`${number}번 교정 답안이 없습니다.`);
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

if (reference2026.sources?.['2026-1']?.pages !== 10 || reference2026.sources?.['2026-2']?.pages !== 8) {
  errors.push('2026년 해설 PDF 쪽수 기록이 10쪽·8쪽과 다릅니다.');
}
for (const [roundId, source] of Object.entries(reference2026.sources || {})) {
  if (!/^[a-f0-9]{64}$/.test(source.sha256 || '')) errors.push(`${roundId}: 2026년 해설 PDF 해시 누락`);
}
if (reference2026.crops?.length !== 25) errors.push(`2026년 해설 PDF 그림 수 불일치: ${reference2026.crops?.length}`);
for (const crop of reference2026.crops || []) {
  const outputPath = path.join(root, crop.output || '');
  if (!fs.existsSync(outputPath)) errors.push(`2026년 해설 PDF 그림 누락: ${crop.output}`);
  else if (crypto.createHash('sha256').update(fs.readFileSync(outputPath)).digest('hex') !== crop.sha256) errors.push(`2026년 해설 PDF 그림 해시 불일치: ${crop.output}`);
  if (!['2026-1', '2026-2'].includes(crop.round) || !['question', 'answer'].includes(crop.role)) errors.push(`2026년 해설 PDF 그림 기록 오류: ${crop.output}`);
}
const reviewed2026 = restoredRows.filter((row) => row.year === 2026 && ['1', '2'].includes(String(row.session)));
if (reviewed2026.length !== 24 || reviewed2026.some((row) => row.sourceNote !== '사용자 제공 2026년 회차별 해설 PDF 원문 대조')) {
  errors.push('2026년 1·2회 24문항의 해설 PDF 대조 기록이 완전하지 않습니다.');
}
const round2Question11 = restoredRows.find((row) => row.id === 'hvac-practical-restored-2026-2-11');
if (!round2Question11?.answer.includes('액순환식 증발기') || !round2Question11?.answer.includes('리키드백')) {
  errors.push('2026년 2회 11번의 해설 PDF 교정 답안이 없습니다.');
}

const curatedEntries = [...sharedAnswerSource.matchAll(/^\s{2}(\d+): \{ answer:/gm)].map((match) => Number(match[1]));
if (curatedEntries.length !== 47 || new Set(curatedEntries).size !== 47) {
  errors.push(`교정 답안 키가 1~47의 고유 번호가 아닙니다: ${curatedEntries.length}개`);
}
if (/answer:\s*['"][^'"\n]*과부하 운전이 가능/.test(sharedAnswerSource)) errors.push('밀폐형 압축기의 잘못된 원문 답안이 교정 데이터에 남아 있습니다.');
if (/원리\)\s*|압축시킨다\s*$|방지한\s*['"`,}]/m.test(sharedAnswerSource)) errors.push('잘린 원문형 답안이 교정 데이터에 남아 있습니다.');

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
  reference2026Crops: reference2026.crops?.length || 0,
  supplementQuestions: supplementRows.length,
  supplementImages: supplementRows.filter(row => row.image).length,
  photoQuestions: photoRows.length,
  photoImages: photoRows.reduce((sum, row) => sum + row.images.length, 0),
  totalQuestions: rows.length + restoredRows.length + 12 + drillIds.length + supplementRows.length + photoRows.length,
  errors,
}, null, 2));
if (errors.length) process.exitCode = 1;
