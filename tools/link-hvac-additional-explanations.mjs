#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function readCatalog(filename) {
  const source = fs.readFileSync(path.join(root, filename), 'utf8');
  return JSON.parse(source.slice(source.indexOf('=') + 1, source.lastIndexOf(';')));
}

function plain(value = '') {
  return String(value).replace(/<[^>]+>/g, ' ').replace(/&(?:nbsp|amp|lt|gt);/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalized(value = '') {
  return plain(value).normalize('NFKC').toLowerCase().replace(/[^0-9a-z가-힣]/g, '');
}

function primaryExplanation(question) {
  return String(question.explanation || question.explanationHtml || '')
    .split(/\n\n\[(?:한솔아카데미 동일 문제 보충 해설|COMCBT 동일 문제 추가 해설|정답·해설 대조 완료)\]\n/)[0]
    .trim();
}

function markerSupplement(question) {
  const source = String(question.explanation || question.explanationHtml || '');
  const match = source.split(/\n\n\[(?:한솔아카데미 동일 문제 보충 해설|COMCBT 동일 문제 추가 해설)\]\n/)[1];
  return String(match || '').split(/\n\n\[정답·해설 대조 완료\]\n/)[0].trim();
}

function correctChoice(question) {
  const choice = question.choices?.[Number(question.answer || 1) - 1] || {};
  return plain(choice.text || choice.html || '');
}

function sourceKind(catalog, round) {
  if (catalog.key === 'hvac-hansol') return '한솔 공조';
  return Number(round.year) >= 2021 ? '공조 복원' : 'COMCBT';
}

function sourceLabel(kind) {
  return `${kind} 추가 해설`;
}

function sourceDescription(kind, round, question) {
  const session = String(round.session || '').replace(/^.*?:\s*/, '');
  return `${kind} · ${round.year}년 ${session || round.title} ${question.number}번`;
}

function explanationForTarget(target, source, value) {
  const text = plain(value);
  if (!text || Number(target.question.answer) === Number(source.question.answer)) return text;
  const targetAnswer = correctChoice(target.question);
  return `※ 보기 순서가 다른 동일 문제입니다. 이 화면의 정답은 ${target.question.answer}번 ‘${targetAnswer}’이며, 아래 번호는 ${source.kind} 원문 순서입니다. ${text}`;
}

function signature(question) {
  return `${normalized(correctChoice(question))}:${normalized(question.text || question.html || '')}`;
}

const hvac = readCatalog('data/hvac.js');
const hansol = readCatalog('data/hvac-hansol.js');
const rows = [hvac, hansol].flatMap((catalog) => catalog.rounds.flatMap((round) => round.questions.map((question) => ({
  catalog,
  round,
  question,
  kind: sourceKind(catalog, round),
  primary: primaryExplanation(question),
}))));
const bySignature = new Map();
const byId = new Map();

for (const row of rows) {
  const key = signature(row.question);
  if (key.split(':')[1]) {
    const group = bySignature.get(key) || [];
    group.push(row);
    bySignature.set(key, group);
  }
  byId.set(`${row.round.id}:${row.question.number}`, row);
}

let linkedQuestions = 0;
let linkedSections = 0;
const linkedByKind = { COMCBT: 0, '공조 복원': 0, '한솔 공조': 0 };

for (const target of rows) {
  const additions = [];
  const seenTexts = new Set([normalized(target.primary)]);
  const candidates = [...(bySignature.get(signature(target.question)) || [])];
  const explicitIds = [target.question.explanationProvenance, target.question.explanationSupplementSource]
    .filter((value) => typeof value === 'string' && /:\d+$/.test(value));
  for (const id of explicitIds) {
    const explicit = byId.get(id);
    if (explicit && !candidates.includes(explicit)) candidates.unshift(explicit);
  }

  const usedKinds = new Set();
  for (const source of candidates) {
    if (source === target || source.kind === target.kind || usedKinds.has(source.kind)) continue;
    const text = explanationForTarget(target, source, source.primary);
    const key = normalized(text);
    if (!text || !key || seenTexts.has(key)) continue;
    additions.push({
      label: sourceLabel(source.kind),
      source: sourceDescription(source.kind, source.round, source.question),
      text,
    });
    seenTexts.add(key);
    usedKinds.add(source.kind);
  }

  const linkedMarkerSource = explicitIds.map((id) => byId.get(id)).find(Boolean);
  const marker = linkedMarkerSource
    ? explanationForTarget(target, linkedMarkerSource, markerSupplement(target.question).replace(/\[해설작성자[^\]]*\]/g, ' '))
    : plain(markerSupplement(target.question).replace(/\[해설작성자[^\]]*\]/g, ' '));
  const markerKey = normalized(marker);
  if (marker && markerKey && !seenTexts.has(markerKey)) {
    const linked = linkedMarkerSource;
    const kind = linked?.kind || (target.kind === '한솔 공조' ? 'COMCBT' : '한솔 공조');
    additions.push({
      label: sourceLabel(kind),
      source: linked ? sourceDescription(kind, linked.round, linked.question) : `${kind} 동일 문제`,
      text: marker,
    });
    seenTexts.add(markerKey);
  }

  if (additions.length) {
    target.question.additionalExplanations = additions;
    linkedQuestions += 1;
    linkedSections += additions.length;
    for (const addition of additions) {
      const kind = addition.label.replace(' 추가 해설', '');
      if (kind in linkedByKind) linkedByKind[kind] += 1;
    }
  } else {
    delete target.question.additionalExplanations;
  }
}

fs.writeFileSync(path.join(root, 'data/hvac.js'), `window.CBT_DATA_HVAC=${JSON.stringify(hvac)};\n`);
fs.writeFileSync(path.join(root, 'data/hvac-hansol.js'), `window.CBT_DATA_HANSOL_HVAC=${JSON.stringify(hansol)};\n`);

console.log(JSON.stringify({ linkedQuestions, linkedSections, linkedByKind }, null, 2));
