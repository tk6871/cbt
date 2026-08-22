import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'data/hvac-hansol.js'), 'utf8'), context, {
  filename: 'data/hvac-hansol.js',
});

const catalog = context.window.CBT_DATA_HANSOL_HVAC;
const errors = [];
const images = new Set();
let questions = 0;
let linkedExplanations = 0;
let answerOnlyExplanations = 0;
let authoredExplanations = 0;
let hotspots = 0;
let answerCorrections = 0;
let genericFallbackExplanations = 0;

const reviewedHotspotRegressions = new Map([
  ['hvac-hansol-2019-3:60', [[6.50, 10.10, 19.50, 3.10], [47.00, 10.10, 20.00, 3.10], [6.50, 13.90, 19.50, 4.20], [47.00, 13.90, 18.00, 5.00]]],
  ['hvac-hansol-2020-4:29', [[2.00, 83.50, 39.00, 7.80], [46.30, 83.50, 39.00, 7.80], [2.00, 91.50, 39.00, 8.00], [46.30, 91.50, 39.00, 8.00]]],
  ['hvac-hansol-2021-1:4', [[1.91, 27.03, 29.03, 16.59], [1.91, 43.62, 29.03, 14.95], [1.91, 58.57, 29.03, 13.24], [1.91, 72.01, 29.03, 14.50]]],
  ['hvac-hansol-2021-2:17', [[1.91, 14.42, 73.45, 7.25], [1.91, 24.97, 93.61, 18.56], [1.91, 46.61, 93.61, 17.59], [1.91, 67.37, 93.61, 18.00]]],
  ['hvac-hansol-2021-3:70', [[4.59, 33.58, 22.50, 14.33], [4.59, 47.91, 29.63, 12.71], [4.59, 60.62, 21.58, 12.77], [4.59, 73.39, 28.70, 13.00]]],
  ['hvac-hansol-2023-3:2', [[1.50, 36.60, 74.00, 10.00], [1.50, 48.00, 74.00, 10.00], [1.50, 59.30, 74.00, 10.00], [1.50, 70.70, 74.00, 10.30]]],
  ['hvac-hansol-2024-1:2', [[1.90, 69.00, 14.20, 11.80], [17.00, 69.00, 15.20, 11.80], [1.90, 83.20, 14.20, 11.80], [17.00, 83.20, 15.20, 11.80]]],
  ['hvac-hansol-2024-2:2', [[1.50, 46.90, 74.00, 10.30], [1.50, 60.80, 74.00, 10.30], [1.50, 74.40, 74.00, 10.30], [1.50, 88.00, 74.00, 10.20]]],
]);

function overlap(left, right) {
  const width = Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x);
  const height = Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y);
  return width > 0.01 && height > 0.01;
}

if (catalog?.key !== 'hvac-hansol') errors.push('카탈로그 키가 hvac-hansol이 아닙니다.');
if (catalog?.rounds?.length !== 27) errors.push(`회차 수가 27이 아닙니다: ${catalog?.rounds?.length}`);

for (const round of catalog?.rounds || []) {
  const expected = round.year <= 2021 ? 80 : 60;
  if (round.questions.length !== expected) errors.push(`${round.id}: ${expected}문항이 아닌 ${round.questions.length}문항`);
  round.questions.forEach((question, index) => {
    questions += 1;
    const location = `${round.id}/${question.number}`;
    if (question.number !== index + 1) errors.push(`${location}: 문제 번호가 순서와 다릅니다.`);
    if (!Number.isInteger(question.answer) || question.answer < 1 || question.answer > 4) errors.push(`${location}: 정답 범위 오류`);
    if (question.choices?.length !== 4) errors.push(`${location}: 보기 4개가 아닙니다.`);
    if (!question.explanation) errors.push(`${location}: 해설 안내가 없습니다.`);
    const boxes = question.answerHotspots || [];
    if (boxes.length !== 4) errors.push(`${location}: 답안 박스가 ${boxes.length}개입니다.`);
    const choices = new Set();
    boxes.forEach((box) => {
      hotspots += 1;
      choices.add(box.choice);
      for (const key of ['x', 'y', 'width', 'height']) {
        if (!Number.isFinite(box[key])) errors.push(`${location}: ${box.choice}번 ${key}가 숫자가 아닙니다.`);
      }
      if (box.x < 0 || box.y < 0 || box.width <= 0 || box.height <= 0
        || box.x + box.width > 100.02 || box.y + box.height > 100.02) {
        errors.push(`${location}: ${box.choice}번 박스가 이미지 밖입니다.`);
      }
      if (box.width < 1 || box.height < 1) {
        errors.push(`${location}: ${box.choice}번 박스가 1%보다 작게 찌그러졌습니다.`);
      }
    });
    if ([1, 2, 3, 4].some((choice) => !choices.has(choice))) errors.push(`${location}: 답안 번호가 1~4와 다릅니다.`);
    const regression = reviewedHotspotRegressions.get(`${round.id}:${question.number}`);
    if (regression) {
      boxes.forEach((box, index) => {
        const actual = [box.x, box.y, box.width, box.height];
        if (actual.some((value, coordinate) => Math.abs(value - regression[index][coordinate]) > 0.02)) {
          errors.push(`${location}: ${box.choice}번 검수 좌표가 원본 기준값과 다릅니다.`);
        }
      });
    }
    if (round.id === 'hvac-hansol-2025-3' && question.number === 3) {
      const leftAnswers = boxes.filter((box) => box.choice === 1 || box.choice === 3);
      const rightAnswers = boxes.filter((box) => box.choice === 2 || box.choice === 4);
      if (leftAnswers.some((box) => box.x + box.width < 35)
        || rightAnswers.some((box) => box.x < 50 || box.x + box.width < 84)) {
        errors.push(`${location}: 긴 2열 답안이 잘렸습니다.`);
      }
    }
    for (let left = 0; left < boxes.length; left += 1) {
      for (let right = left + 1; right < boxes.length; right += 1) {
        if (overlap(boxes[left], boxes[right])) errors.push(`${location}: ${boxes[left].choice}·${boxes[right].choice}번 박스가 겹칩니다.`);
      }
    }
    if (!question.sourceImage) {
      errors.push(`${location}: 원문 이미지가 없습니다.`);
    } else {
      const clean = String(question.sourceImage).replace(/^\//, '');
      images.add(clean);
      if (!fs.existsSync(path.join(root, clean))) errors.push(`${location}: 이미지 파일 누락 ${clean}`);
    }
    if (question.explanationProvenance === 'hansol-answer-only') answerOnlyExplanations += 1;
    else if (question.explanationProvenance === 'hansol-beginner-authored') {
      authoredExplanations += 1;
      if (question.explanation.startsWith('핵심 조건은')) genericFallbackExplanations += 1;
    }
    else linkedExplanations += 1;
    if (question.answerCorrectionSource) answerCorrections += 1;
  });
}

if (questions !== 1920) errors.push(`전체 문항 수가 1,920이 아닙니다: ${questions}`);
if (images.size !== 1920) errors.push(`고유 이미지 수가 1,920이 아닙니다: ${images.size}`);
if (linkedExplanations + authoredExplanations + answerOnlyExplanations !== 1920) {
  errors.push(`해설 출처 분류 합계가 1,920이 아닙니다: ${linkedExplanations + authoredExplanations + answerOnlyExplanations}`);
}
if (hotspots !== 7680) errors.push(`답안 박스 수가 7,680개가 아닙니다: ${hotspots}`);
if (answerOnlyExplanations) errors.push(`정답만 안내하는 해설이 남아 있습니다: ${answerOnlyExplanations}`);
if (genericFallbackExplanations) errors.push(`문제별 원리 없이 공통 문장만 사용한 해설이 남아 있습니다: ${genericFallbackExplanations}`);
if (answerCorrections !== 44) errors.push(`검증 정답 교정 수가 44개가 아닙니다: ${answerCorrections}`);

console.log(JSON.stringify({
  rounds: catalog?.rounds?.length || 0,
  questions,
  images: images.size,
  hotspots,
  linkedExplanations,
  authoredExplanations,
  answerOnlyExplanations,
  genericFallbackExplanations,
  answerCorrections,
  errors: errors.length,
}, null, 2));

if (errors.length) {
  errors.slice(0, 30).forEach((error) => console.error(error));
  process.exitCode = 1;
}
