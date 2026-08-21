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
    if (!question.sourceImage) {
      errors.push(`${location}: 원문 이미지가 없습니다.`);
    } else {
      const clean = String(question.sourceImage).replace(/^\//, '');
      images.add(clean);
      if (!fs.existsSync(path.join(root, clean))) errors.push(`${location}: 이미지 파일 누락 ${clean}`);
    }
    if (question.explanationProvenance === 'hansol-answer-only') answerOnlyExplanations += 1;
    else linkedExplanations += 1;
  });
}

if (questions !== 1920) errors.push(`전체 문항 수가 1,920이 아닙니다: ${questions}`);
if (images.size !== 1920) errors.push(`고유 이미지 수가 1,920이 아닙니다: ${images.size}`);
if (linkedExplanations + answerOnlyExplanations !== 1920) {
  errors.push(`해설 출처 분류 합계가 1,920이 아닙니다: ${linkedExplanations + answerOnlyExplanations}`);
}

console.log(JSON.stringify({
  rounds: catalog?.rounds?.length || 0,
  questions,
  images: images.size,
  linkedExplanations,
  answerOnlyExplanations,
  errors: errors.length,
}, null, 2));

if (errors.length) {
  errors.slice(0, 30).forEach((error) => console.error(error));
  process.exitCode = 1;
}
