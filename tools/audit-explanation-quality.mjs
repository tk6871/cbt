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

for (const filename of files) {
  const parsed = readCatalog(filename);
  for (const catalog of Array.isArray(parsed) ? parsed : [parsed]) {
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
        }
      }
    }
    report.push(counts);
  }
}

console.log(JSON.stringify({ report, errors: errors.slice(0, 50), errorCount: errors.length }, null, 2));
if (errors.length) process.exitCode = 1;
