#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = process.argv[2] ? path.resolve(process.argv[2]) : '';
if (!sourcePath || !fs.existsSync(sourcePath)) {
  console.error('사용법: node tools/import-hvac-practical-restored.mjs <검수 완료 JSON>');
  process.exit(1);
}

const sourceRows = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
if (!Array.isArray(sourceRows)) throw new Error('검수 JSON 최상위 값은 배열이어야 합니다.');

const categories = new Set(['equipment', 'cycle', 'calculation', 'operation', 'piping', 'air', 'safety']);
const difficulties = new Set(['basic', 'standard', 'advanced']);
const outputAssets = path.join(root, 'assets/hvac-practical/restored');
const seenIds = new Set();

function copyImages(paths, row, kind) {
  if (!Array.isArray(paths)) return [];
  return paths.map((source, index) => {
    const absoluteSource = path.resolve(String(source));
    if (!fs.existsSync(absoluteSource)) throw new Error(`${row.id}: ${kind} 이미지가 없습니다: ${source}`);
    const extension = path.extname(absoluteSource).toLowerCase() || '.png';
    const round = `${row.year}-${String(row.session).toLowerCase()}`;
    const relative = `assets/hvac-practical/restored/${round}/${row.id}-${kind}-${index + 1}${extension}`;
    const destination = path.join(root, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(absoluteSource, destination);
    return relative;
  });
}

const outputRows = sourceRows.map((row) => {
  if (!row?.id || seenIds.has(row.id)) throw new Error(`필답형 ID가 없거나 중복입니다: ${row?.id}`);
  seenIds.add(row.id);
  for (const field of ['question', 'answer', 'explanation', 'sourceNote']) {
    if (!String(row[field] || '').trim()) throw new Error(`${row.id}: ${field}가 비어 있습니다.`);
  }
  if (String(row.answer).trim() === String(row.explanation).trim()) {
    throw new Error(`${row.id}: 쉬운 풀이가 모범답안을 그대로 반복합니다.`);
  }
  if (!Number.isInteger(Number(row.year)) || Number(row.year) < 2018 || Number(row.year) > 2026) {
    throw new Error(`${row.id}: 잘못된 연도 ${row.year}`);
  }
  if (!/^\d+[AB]?$/i.test(String(row.session || ''))) throw new Error(`${row.id}: 잘못된 회차 ${row.session}`);
  if (!Number.isInteger(Number(row.number)) || Number(row.number) < 1 || Number(row.number) > 12) {
    throw new Error(`${row.id}: 잘못된 문제 번호 ${row.number}`);
  }
  if (!categories.has(row.category)) throw new Error(`${row.id}: 잘못된 분야 ${row.category}`);
  if (!difficulties.has(row.difficulty)) throw new Error(`${row.id}: 잘못된 난이도 ${row.difficulty}`);
  const keyPoints = [...new Set((row.keyPoints || []).map((point) => String(point).replace(/\s+/g, ' ').trim()).filter(Boolean))];
  if (!keyPoints.length) throw new Error(`${row.id}: 채점 핵심어가 비어 있습니다.`);
  const images = copyImages(row.sourceImages || row.images, row, 'question');
  const answerImages = copyImages(row.answerImages, row, 'answer');
  return {
    id: row.id,
    year: Number(row.year),
    session: String(row.session),
    number: Number(row.number),
    question: String(row.question).replace(/\s+/g, ' ').trim(),
    answer: String(row.answer).replace(/\s+/g, ' ').trim(),
    explanation: String(row.explanation).replace(/\s+/g, ' ').trim(),
    keyPoints,
    category: row.category,
    difficulty: row.difficulty,
    points: Number(row.points) || 5,
    sourceNote: String(row.sourceNote).replace(/\s+/g, ' ').trim(),
    ...(images.length ? { images } : {}),
    ...(answerImages.length ? { answerImages } : {}),
  };
});

if (outputRows.length !== 312) throw new Error(`복원문제는 312문항이어야 합니다: ${outputRows.length}`);
const outputPath = path.join(root, 'data/hvac-practical-restored.json');
fs.writeFileSync(outputPath, `${JSON.stringify(outputRows, null, 2)}\n`);
console.log(JSON.stringify({ questions: outputRows.length, outputPath, imageDirectory: outputAssets }, null, 2));
