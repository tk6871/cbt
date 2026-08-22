#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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

function stemKey(question) {
  return normalized(question.text || question.html || '');
}

function fullKey(question) {
  return normalized([question.text || question.html, ...question.choices.map((choice) => choice.text || choice.html)].join(' '));
}

function calculationGuide(source) {
  const rules = [
    [/임피던스.*(?:강하|전압).*단락전류|단락전류.*임피던스/i, '단락전류 배수 = 100 ÷ 임피던스 전압(%)', '5%라면 100 ÷ 5 = 20배입니다. 퍼센트 숫자를 그대로 100에서 나눕니다.'],
    [/회전자.*입력.*슬립|슬립.*2차.*동손/i, '2차 동손 = 슬립 × 회전자 입력', '슬립 4%는 0.04로 바꾸고, 10 kW는 10,000 W로 바꾼 뒤 곱합니다.'],
    [/가스.*소\s*모량|연료.*소\s*비량|보일러.*발열량.*효율/i, '연료량 = 필요한 열량 ÷ (연료 발열량 × 효율)', '먼저 물의 열량 m×c×온도차를 구하고, 효율 95%는 0.95로 바꿔 발열량과 곱한 값으로 나눕니다.'],
    [/2전력계|두.*전력계/i, '3상 소비전력 = 첫째 전력계 P₁ + 둘째 전력계 P₂', '두 전력계가 가리킨 값을 그대로 더합니다.'],
    [/성능계수|\bCOP\b/i, '냉동 COP = 냉동효과(Qₗ) ÷ 압축기에 넣은 일(W)', '분자와 분모의 단위를 같게 맞춘 뒤 나눕니다. COP에는 단위가 남지 않습니다.'],
    [/냉동톤|\bRT\b/i, '1 USRT = 약 3.517 kW = 약 3,024 kcal/h', 'RT를 kW로 바꿀 때는 3.517을 곱하고, 반대로 바꿀 때는 3.517로 나눕니다.'],
    [/상대습도|수증기분압/i, '상대습도(%) = 현재 수증기압 ÷ 포화수증기압 × 100', '두 압력의 단위를 같게 맞춘 뒤 나누고 마지막에 100을 곱합니다.'],
    [/옴의 법칙|저항.*(?:전류|전압)|(?:전류|전압).*저항/i, 'V = I × R (I = V ÷ R, R = V ÷ I)', 'V·A·Ω 단위를 확인하고, 모르는 값 하나만 왼쪽에 남깁니다.'],
    [/3상|삼상|역률.*(?:전력|전압|전류)|유효전력/i, '3상 유효전력 P = √3 × V × I × cosφ', 'W로 계산한 뒤 kW가 필요하면 1,000으로 나눕니다.'],
    [/펌프|양정|수동력|축동력/i, '펌프 동력 P = ρ × g × Q × H ÷ η', '유량 Q를 m³/s로 맞추고 효율은 %가 아닌 소수로 넣습니다.'],
    [/송풍기|팬.*법칙|상사법칙/i, '팬 법칙: 풍량 Q∝N, 압력 H∝N², 동력 P∝N³', '회전수 비를 먼저 만들고 풍량은 1제곱, 압력은 2제곱, 동력은 3제곱합니다.'],
    [/유량|유속|단면적/i, '체적유량 Q = 단면적 A × 속도 v', '지름이 주어지면 A = πd²÷4로 면적을 먼저 구하고 mm는 m로 바꿉니다.'],
    [/열관류|열통과/i, '벽을 통과하는 열량 Q = K × A × ΔT', '열관류율·면적·온도차를 차례로 곱하고 시간 단위를 확인합니다.'],
    [/열량|비열|현열|온도차/i, '현열 Q = m × c × ΔT', '질량·비열·온도차를 같은 단위계로 맞춘 뒤 차례로 곱합니다.'],
    [/효율/i, '효율(%) = 유효한 출력 ÷ 공급한 입력 × 100', '입력과 출력의 단위를 같게 만든 뒤 나누고 마지막에 100을 곱합니다.'],
  ];
  return rules.find(([pattern]) => pattern.test(source))?.slice(1) || null;
}

function beginnerExplanation(question) {
  const answer = question.answer;
  const answerText = plain(question.choices[answer - 1]?.text || question.choices[answer - 1]?.html || `${answer}번`);
  const stem = plain(question.text || question.html || '문제의 조건');
  const source = `${stem} ${question.choices.map((choice) => plain(choice.text || choice.html)).join(' ')}`;
  const asksNumber = /계산|구하|산출|얼마|몇\s*(?:개|배|%|℃|도|kW|W|kcal|kg|m|Pa|V|A|Ω|rpm|RT)?|값은|동력|전력|유량|풍량/i.test(stem);
  const guide = calculationGuide(source);
  if (asksNumber && guide) {
    return [
      `정답은 ${answer}번 ‘${answerText}’입니다.`,
      '초보자 계산 순서',
      `1. 먼저 무엇을 구하는지 표시합니다: ${stem}`,
      `2. 사용할 기본식은 ‘${guide[0]}’입니다.`,
      `3. ${guide[1]}`,
      `4. 숫자를 한 자리씩 넣어 계산한 뒤 보기의 단위까지 같은 ${answer}번과 비교합니다.`,
    ].join('\n');
  }
  const negative = /옳지\s*않|아닌|틀린|거리가\s*먼|해당되지\s*않/.test(stem);
  return [
    `정답은 ${answer}번 ‘${answerText}’입니다.`,
    '초보자 확인 순서',
    `1. 이 문제는 ${negative ? '맞는 설명이 아니라 예외·틀린 설명을 찾는 문제이므로 부정 표현에 표시합니다.' : '문제에서 요구한 조건과 정확히 일치하는 설명을 찾는 문제입니다.'}`,
    `2. 핵심 판단 문장은 ‘${answerText}’입니다.`,
    `3. 시험 직전에는 이 문장을 ${negative ? '나머지 보기와 구분되는 예외로' : '정답이 되는 기준 문장으로'} 짧게 묶어 기억하세요.`,
  ].join('\n');
}

const hvac = readCatalog('data/hvac.js');
const hansol = readCatalog('data/hvac-hansol.js');
const allHansol = hansol.rounds.flatMap((round) => round.questions.map((question) => ({ round, question })));
const knownByStem = new Map();
const knownByFull = new Map();

for (const entry of allHansol) {
  const { question } = entry;
  if (question.explanationProvenance === 'hansol-answer-only'
    || question.explanationProvenance === 'hansol-beginner-authored') continue;
  knownByStem.set(`${question.answer}:${stemKey(question)}`, entry);
  knownByFull.set(`${question.answer}:${fullKey(question)}`, entry);
}

let propagated = 0;
let authored = 0;
for (const { question } of allHansol) {
  if (question.explanationProvenance !== 'hansol-answer-only'
    && question.explanationProvenance !== 'hansol-beginner-authored') continue;
  const source = knownByFull.get(`${question.answer}:${fullKey(question)}`)
    || knownByStem.get(`${question.answer}:${stemKey(question)}`);
  if (source) {
    question.explanation = source.question.explanation;
    question.explanationProvenance = `${source.round.id}:${source.question.number}`;
    question.explanationMatchScore = 1;
    propagated += 1;
  } else {
    question.explanation = beginnerExplanation(question);
    question.explanationProvenance = 'hansol-beginner-authored';
    question.explanationMatchScore = 0;
    authored += 1;
  }
}

const hansolLinked = allHansol.filter(({ question }) => question.explanation
  && question.explanationProvenance !== 'hansol-beginner-authored'
  && question.explanationProvenance !== 'hansol-answer-only');
const linkedByStem = new Map();
const linkedByFull = new Map();
for (const entry of hansolLinked) {
  linkedByStem.set(`${entry.question.answer}:${stemKey(entry.question)}`, entry);
  linkedByFull.set(`${entry.question.answer}:${fullKey(entry.question)}`, entry);
}

let restoredMerged = 0;
for (const round of hvac.rounds) {
  if (Number(round.year) < 2021) continue;
  for (const question of round.questions) {
    const source = linkedByFull.get(`${question.answer}:${fullKey(question)}`)
      || linkedByStem.get(`${question.answer}:${stemKey(question)}`);
    if (!source) continue;
    const supplement = plain(source.question.explanation);
    const current = plain(question.explanation);
    if (!supplement || current.includes(supplement) || (current && supplement.includes(current))) continue;
    question.explanation = `${question.explanation || ''}\n\n[한솔아카데미 동일 문제 보충 해설]\n${source.question.explanation}`.trim();
    question.explanationSupplementSource = `${source.round.id}:${source.question.number}`;
    restoredMerged += 1;
  }
}

fs.writeFileSync(path.join(root, 'data/hvac-hansol.js'), `window.CBT_DATA_HANSOL_HVAC=${JSON.stringify(hansol)};\n`);
fs.writeFileSync(path.join(root, 'data/hvac.js'), `window.CBT_DATA_HVAC=${JSON.stringify(hvac)};\n`);

const finalLinked = allHansol.filter(({ question }) => question.explanation
  && question.explanationProvenance !== 'hansol-beginner-authored'
  && question.explanationProvenance !== 'hansol-answer-only').length;
const finalAuthored = allHansol.filter(({ question }) => question.explanationProvenance === 'hansol-beginner-authored').length;
const finalAnswerOnly = allHansol.filter(({ question }) => question.explanationProvenance === 'hansol-answer-only').length;
const reportPath = path.join(root, 'work/hansol-import-report.json');
if (fs.existsSync(reportPath)) {
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  report.enrichment = {
    linkedExplanations: finalLinked,
    beginnerAuthoredExplanations: finalAuthored,
    answerOnlyExplanations: finalAnswerOnly,
    restoredQuestionsWithHansolSupplement: hvac.rounds
      .flatMap((round) => round.questions)
      .filter((question) => question.explanationSupplementSource).length,
  };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

console.log(JSON.stringify({
  propagated,
  authored,
  restoredMerged,
  hansolQuestions: allHansol.length,
  finalLinked,
  finalAuthored,
  finalAnswerOnly,
}));
