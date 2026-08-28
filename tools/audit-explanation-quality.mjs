#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = [
  'data/hvac.js',
  'data/hvac-hansol.js',
  'data/safety.js',
  'data/energy.js',
  'data/energy-engineer.js',
  'data/maintenance.js',
  'data/electric-craftsman.js',
  'data/gas-craftsman.js',
  'data/hazardous-craftsman.js',
  'data/jewelry.js',
];
const forbidden = /아닌에 해당|않는에 해당|가장 부에 해당|이 조건을 그대로 나타내는|문제의 부정 표현과 단위|핵심은 문제에서 요구한 값/i;
const deferredText = '원문 이미지형 문항이라 현재 텍스트만으로는 문제와 보기를 정확히 판독할 수 없습니다.';
const errors = [];
const report = [];

function readCatalog(filename) {
  const source = fs.readFileSync(path.join(root, filename), 'utf8');
  return JSON.parse(source.slice(source.indexOf('=') + 1, source.lastIndexOf(';')));
}

function plain(value = '') {
  return String(value).replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalized(value = '') {
  return plain(value).normalize('NFKC').toLowerCase().replace(/[^0-9a-z가-힣]/g, '');
}

function bigrams(value) {
  const source = normalized(value);
  const result = new Map();
  for (let index = 0; index < source.length - 1; index += 1) {
    const gram = source.slice(index, index + 2);
    result.set(gram, (result.get(gram) || 0) + 1);
  }
  return result;
}

function diceSimilarity(left, right) {
  const a = normalized(left);
  const b = normalized(right);
  if (a === b) return a ? 1 : 0;
  if (a.length < 2 || b.length < 2) return 0;
  const aBigrams = bigrams(a);
  const bBigrams = bigrams(b);
  let shared = 0;
  for (const [gram, count] of aBigrams) shared += Math.min(count, bBigrams.get(gram) || 0);
  return (2 * shared) / ((a.length - 1) + (b.length - 1));
}

function correctChoice(question) {
  const choice = question.choices?.[Number(question.answer || 1) - 1] || {};
  return plain(choice.text || choice.html || '');
}

function sourceKind(catalog, round) {
  if (catalog.key === 'hvac-hansol') return '한솔 공조';
  return Number(round.year) >= 2021 ? '공조 복원' : 'COMCBT';
}

function sourceDescription(catalog, round, question) {
  const session = String(round.session || '').replace(/^.*?:\s*/, '');
  return `${sourceKind(catalog, round)} · ${round.year}년 ${session || round.title} ${question.number}번`;
}

function sourceMatches(target, source, answerThreshold = 0.9) {
  const targetAnswer = correctChoice(target.question);
  const sourceAnswer = correctChoice(source.question);
  if (!normalized(targetAnswer) || !normalized(sourceAnswer)) return false;
  if (diceSimilarity(targetAnswer, sourceAnswer) < answerThreshold) return false;
  return diceSimilarity(
    target.question.text || target.question.html || '',
    source.question.text || source.question.html || '',
  ) >= 0.9;
}

const parsedCatalogs = files.flatMap((filename) => {
  const parsed = readCatalog(filename);
  return (Array.isArray(parsed) ? parsed : [parsed]).map((catalog) => ({ filename, catalog }));
});
const sourceRows = parsedCatalogs.flatMap(({ catalog }) => (catalog.rounds || []).flatMap((round) => (round.questions || []).map((question) => ({
  catalog,
  round,
  question,
}))));
const sourceByDescription = new Map(sourceRows.map((row) => [sourceDescription(row.catalog, row.round, row.question), row]));
const sourceById = new Map(sourceRows.map((row) => [`${row.round.id}:${row.question.number}`, row]));

for (const { filename, catalog } of parsedCatalogs) {
    const counts = { catalog: catalog.key || filename, questions: 0, explained: 0, deferredImageOcr: 0, conciseGenerated: 0 };
    for (const round of catalog.rounds || []) {
      for (const question of round.questions || []) {
        counts.questions += 1;
        const location = `${catalog.key || filename}:${round.id}:${question.number}`;
        const explanation = plain(question.explanation || question.explanationHtml || '');
        if (!explanation) {
          errors.push(`${location}: 해설이 비어 있습니다.`);
          continue;
        }
        counts.explained += 1;
        if (explanation.includes(deferredText)) counts.deferredImageOcr += 1;
        if (/^(?:정답은|문제에서 설명한|주어진 조건을 계산하면)/.test(explanation)) counts.conciseGenerated += 1;
        if (forbidden.test(explanation)) errors.push(`${location}: 금지된 상투·비문 표현이 남아 있습니다.`);
        if ((catalog.key || filename) === 'energy-engineer'
          && question.imageOnly && /^[①②③④1-4]$/.test(plain(question.choices?.[Number(question.answer) - 1]?.text || ''))
          && !explanation.includes(deferredText)) {
          errors.push(`${location}: 이미지 전용 문항에 원문 대조 없는 추측 해설이 들어 있습니다.`);
        }
        const seenAdditionalSources = new Set();
        for (const addition of question.additionalExplanations || []) {
          const sourceKey = `${plain(addition.label)}:${plain(addition.source)}`;
          if (seenAdditionalSources.has(sourceKey)) errors.push(`${location}: 같은 출처의 추가 해설이 중복되어 있습니다.`);
          seenAdditionalSources.add(sourceKey);
          const source = sourceByDescription.get(plain(addition.source));
          if (!source) {
            errors.push(`${location}: 추가 해설 원문을 찾을 수 없습니다. (${plain(addition.source)})`);
          } else if (!sourceMatches({ catalog, round, question }, source)) {
            errors.push(`${location}: 추가 해설의 원문 문제·정답 보기가 일치하지 않습니다. (${plain(addition.source)})`);
          }
        }
        const linkedIds = [question.explanationProvenance, question.explanationSupplementSource]
          .filter((value) => typeof value === 'string' && /^[^:]+:\d+$/.test(value));
        for (const linkedId of linkedIds) {
          const source = sourceById.get(linkedId);
          if (!source) {
            errors.push(`${location}: 연결된 해설 원문을 찾을 수 없습니다. (${linkedId})`);
          } else if (!sourceMatches({ catalog, round, question }, source)) {
            errors.push(`${location}: 연결된 해설의 원문 문제·정답 보기가 일치하지 않습니다. (${linkedId})`);
          }
        }
        const correctionId = question.answerCorrectionSource;
        if (typeof correctionId === 'string' && /^[^:]+:\d+$/.test(correctionId)) {
          const source = sourceById.get(correctionId);
          if (!source) {
            errors.push(`${location}: 정답 교정 원문을 찾을 수 없습니다. (${correctionId})`);
          } else if (!sourceMatches({ catalog, round, question }, source, 0.8)) {
            errors.push(`${location}: 정답 교정 원문의 문제·정답 보기가 일치하지 않습니다. (${correctionId})`);
          }
        }
      }
    }
    report.push(counts);
}

console.log(JSON.stringify({ report, errors: errors.slice(0, 50), errorCount: errors.length }, null, 2));
if (errors.length) process.exitCode = 1;
