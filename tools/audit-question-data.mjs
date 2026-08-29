import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const dataFiles = ['hvac.js', 'hvac-hansol.js', 'safety.js', 'energy.js', 'energy-engineer.js', 'maintenance.js', 'electric-craftsman.js', 'gas-craftsman.js', 'hazardous-craftsman.js', 'information-engineer.js', 'jewelry.js'];
const context = { window: {} };

for (const file of dataFiles) {
  const source = fs.readFileSync(path.join(root, 'data', file), 'utf8');
  vm.runInNewContext(source, context, { filename: file });
}

const catalogs = [
  context.window.CBT_DATA_HVAC,
  context.window.CBT_DATA_HANSOL_HVAC,
  context.window.CBT_DATA_SAFETY,
  context.window.CBT_DATA_ENERGY,
  context.window.CBT_DATA_ENERGY_ENGINEER,
  context.window.CBT_DATA_MAINTENANCE,
  context.window.CBT_DATA_ELECTRIC_CRAFTSMAN,
  context.window.CBT_DATA_GAS_CRAFTSMAN,
  context.window.CBT_DATA_HAZARDOUS_CRAFTSMAN,
  context.window.CBT_DATA_INFORMATION_ENGINEER,
  ...(context.window.CBT_DATA_JEWELRY || []),
].filter(Boolean);

const errors = [];
const warnings = [];
const missingImages = [];
const referencedImages = new Set();
const manualReview = [];
const catalogRows = [];
const roundIds = new Set();
const duplicateSignatures = new Map();
const answerConflicts = [];
const explanationAnswerReviewCandidates = [];

function addImage(image, location) {
  if (!image || /^(?:https?:|data:)/i.test(image)) return;
  const clean = decodeURIComponent(String(image).split(/[?#]/)[0]).replace(/^\//, '');
  referencedImages.add(clean);
  if (!fs.existsSync(path.join(root, clean))) missingImages.push({ location, image: clean });
}

function cleanImageReference(image) {
  if (!image || /^(?:https?:|data:)/i.test(image)) return '';
  return decodeURIComponent(String(image).split(/[?#]/)[0]).replace(/^\//, '');
}

function originalForImage(image) {
  const clean = cleanImageReference(image);
  if (!clean) return null;
  const extension = path.extname(clean).toLowerCase();
  if (extension === '.png') {
    const gif = clean.slice(0, -extension.length) + '.gif';
    if (fs.existsSync(path.join(root, gif))) return { type: 'preserved-file', image: gif };
  }
  if (clean.startsWith('assets/hvac/assets/questions/')) {
    return { type: 'git-history', revision: '1d38c97^', image: clean };
  }
  if (clean.startsWith('assets/energy/assets/engineer-2022/')) {
    return { type: 'git-history', revision: '62549e8^', image: clean };
  }
  return { type: 'current-file', image: clean };
}

function plainText(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function duplicateSignature(question) {
  if (question.sourceImage || question.images?.length || question.choices?.some((choice) => choice.images?.length)) return '';
  const questionText = plainText(question.text || question.html);
  const choices = (question.choices || []).map((choice) => plainText(choice.text || choice.html));
  const combined = [questionText, ...choices].join('|');
  return combined.replace(/^\d+\s*[.)번]\s*/, '').length >= 24 ? combined : '';
}

function statedExplanationAnswer(question) {
  const explanation = plainText(String(question.explanation || question.explanationHtml || '')
    .split(/\n\n\[(?:한솔아카데미 동일 문제 보충 해설|COMCBT 동일 문제 추가 해설|정답·해설 대조 완료)\]\n/)[0]);
  if (!explanation) return null;
  const matches = [
    ...explanation.matchAll(/(?:^|[^가-힣])(?:정답|답)\s*(?:은|:|=)?\s*([①②③④])(?:\s*(?:입니다|이다|임|맞습니다)|[.]|$)/g),
    ...explanation.matchAll(/(?:^|[^가-힣])(?:정답|답)\s*(?:은|:|=)?\s*([1-4])\s*번(?:\s*(?:입니다|이다|임|맞습니다)|[.]|$)/g),
  ].map((match) => ({ '①': 1, '②': 2, '③': 3, '④': 4 })[match[1]] || Number(match[1]));
  const unique = [...new Set(matches)];
  return unique.length === 1 ? unique[0] : null;
}

function quotedExplanationAnswerMismatch(question) {
  const source = String(question.explanation || question.explanationHtml || '')
    .split(/\n\n\[(?:한솔아카데미 동일 문제 보충 해설|COMCBT 동일 문제 추가 해설|정답·해설 대조 완료)\]\n/)[0];
  const normalize = (value) => plainText(value).replace(/[^0-9a-z가-힣]/gi, '');
  const choiceTexts = (question.choices || []).map((choice) => normalize(choice.text || choice.html));
  const circleMap = { '①': 1, '②': 2, '③': 3, '④': 4 };
  for (const match of source.matchAll(/[‘']([^’']{2,160})[’'][^.!?\n]{0,70}?(?:([①②③④])|([1-4])\s*번)/g)) {
    const quoted = normalize(match[1]);
    const matchedChoices = choiceTexts.map((choice, index) => choice === quoted ? index + 1 : 0).filter(Boolean);
    const stated = circleMap[match[2]] || Number(match[3]);
    if (matchedChoices.length === 1
      && (matchedChoices[0] !== question.answer || stated !== question.answer || stated !== matchedChoices[0])) {
      return { quotedChoice: matchedChoices[0], stated };
    }
  }
  return null;
}

for (const catalog of catalogs) {
  let questionCount = 0;
  let explanationCount = 0;
  let imageQuestionCount = 0;
  for (const round of catalog.rounds || []) {
    const location = `${catalog.key}/${round.id}`;
    if (!round.id) errors.push({ location, issue: '회차 ID 없음' });
    if (roundIds.has(round.id)) errors.push({ location, issue: '중복 회차 ID' });
    roundIds.add(round.id);
    const numbers = new Set();
    for (const question of round.questions || []) {
      questionCount += 1;
      const questionLocation = `${location}/${question.number}`;
      if (numbers.has(question.number)) errors.push({ location: questionLocation, issue: '회차 안의 중복 문제 번호' });
      numbers.add(question.number);
      const choices = question.choices || [];
      if (!Number.isInteger(question.answer) || question.answer < 1 || question.answer > choices.length) {
        errors.push({ location: questionLocation, issue: `정답 범위 오류: ${question.answer}/${choices.length}` });
      }
      if (choices.length !== 4) warnings.push({ location: questionLocation, issue: `보기 ${choices.length}개` });
      if (!question.text && !question.html && !question.sourceImage) errors.push({ location: questionLocation, issue: '문제 본문과 원문 이미지가 모두 없음' });
      if (question.explanation || question.explanationHtml) explanationCount += 1;
      const images = [question.sourceImage, ...(question.images || []), ...choices.flatMap((choice) => choice.images || [])].filter(Boolean);
      if (images.length) imageQuestionCount += 1;
      images.forEach((image) => addImage(image, questionLocation));
      const htmlImages = [question.html, question.explanationHtml, ...choices.map((choice) => choice.html)]
        .filter(Boolean).join(' ').matchAll(/(?:src|href)=["']([^"']+)["']/gi);
      for (const match of htmlImages) addImage(match[1], questionLocation);
      for (const hotspot of question.answerHotspots || []) {
        const values = [hotspot.x, hotspot.y, hotspot.width, hotspot.height];
        if (!Number.isInteger(hotspot.choice) || hotspot.choice < 1 || hotspot.choice > choices.length
          || values.some((value) => !Number.isFinite(value) || value < 0 || value > 100)
          || hotspot.x + hotspot.width > 100 || hotspot.y + hotspot.height > 100) {
          errors.push({ location: questionLocation, issue: `이미지 답안 좌표 오류: ${JSON.stringify(hotspot)}` });
        }
      }
      if (question.imageOnly && !question.sourceImage && !(question.images || []).length) {
        manualReview.push({ location: questionLocation, issue: 'imageOnly인데 표시할 문제 이미지 없음' });
      }
      if (images.length && !question.explanation && !question.explanationHtml) {
        manualReview.push({
          location: questionLocation,
          issue: '이미지 문제·해설 없음: 원본 육안 검수 필요',
          answer: question.answer,
          images: images.map(cleanImageReference).filter(Boolean),
          originals: images.map(originalForImage).filter(Boolean),
        });
      }
      const signature = duplicateSignature(question);
      if (signature) {
        const existing = duplicateSignatures.get(signature) || [];
        existing.push({ location: questionLocation, answer: question.answer });
        duplicateSignatures.set(signature, existing);
      }
      const explanationAnswer = statedExplanationAnswer(question);
      if (explanationAnswer && explanationAnswer !== question.answer && !question.explanationAnswerReviewed) {
        explanationAnswerReviewCandidates.push({
          location: questionLocation,
          answer: question.answer,
          explanationAnswer,
          question: plainText(question.text || question.html),
          choices: choices.map((choice) => plainText(choice.text || choice.html)),
          explanation: plainText(question.explanation || question.explanationHtml),
        });
      }
      const quotedMismatch = quotedExplanationAnswerMismatch(question);
      if (quotedMismatch && !question.explanationAnswerReviewed) {
        explanationAnswerReviewCandidates.push({
          location: questionLocation,
          answer: question.answer,
          ...quotedMismatch,
          question: plainText(question.text || question.html),
          choices: choices.map((choice) => plainText(choice.text || choice.html)),
          explanation: plainText(question.explanation || question.explanationHtml),
        });
      }
      for (const [index, addition] of (question.additionalExplanations || []).entries()) {
        const additionLocation = `${questionLocation}/additionalExplanations/${index}`;
        if (!plainText(addition.label) || !plainText(addition.source) || !plainText(addition.text)) {
          errors.push({ location: additionLocation, issue: '추가 해설의 출처·제목·내용이 비어 있습니다.' });
        }
      }
    }
  }
  catalogRows.push({ key: catalog.key, rounds: catalog.rounds?.length || 0, questions: questionCount, imageQuestions: imageQuestionCount, explanations: explanationCount });
}

for (const rows of duplicateSignatures.values()) {
  const answers = [...new Set(rows.map((row) => row.answer))];
  if (rows.length > 1 && answers.length > 1) answerConflicts.push({ answers, rows });
}

const report = {
  generatedAt: new Date().toISOString(),
  scope: '구조·참조 자동 검사. 실제 정답과 해설의 학술적 정확성 및 업스케일 변형은 원본 육안 대조가 별도로 필요함.',
  totals: {
    catalogs: catalogs.length,
    rounds: catalogRows.reduce((sum, row) => sum + row.rounds, 0),
    questions: catalogRows.reduce((sum, row) => sum + row.questions, 0),
    imageReferences: referencedImages.size,
    structuralErrors: errors.length,
    warnings: warnings.length,
    missingImages: missingImages.length,
    manualReviewCandidates: manualReview.length,
    duplicateAnswerConflicts: answerConflicts.length,
    explanationAnswerReviewCandidates: explanationAnswerReviewCandidates.length,
  },
  catalogs: catalogRows,
  errors,
  warnings,
  missingImages,
  manualReview,
  answerConflicts,
  explanationAnswerReviewCandidates,
};

const reportIndex = process.argv.indexOf('--report');
if (reportIndex >= 0 && process.argv[reportIndex + 1]) {
  const reportPath = path.resolve(root, process.argv[reportIndex + 1]);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`검증 보고서: ${path.relative(root, reportPath)}`);
}

console.log(JSON.stringify({ totals: report.totals, catalogs: report.catalogs }, null, 2));
if (errors.length || missingImages.length) {
  console.error(`구조 오류 ${errors.length}건, 누락 이미지 ${missingImages.length}건`);
  process.exitCode = 1;
}
