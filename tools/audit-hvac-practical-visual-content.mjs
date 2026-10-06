// Read-only content screening. Candidates are NOT confirmed missing media or answers.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const rows = JSON.parse(fs.readFileSync(path.join(root, 'data/hvac-practical-restored.json'), 'utf8'));
const missingReferences = [];
const imageDependentWithoutMedia = [];
const duplicateQuestionImages = [];
const counts = { questions: rows.length, questionImageReferences: 0, answerImageReferences: 0 };
for (const row of rows) {
  const images = [...(row.image ? [row.image] : []), ...(row.images || row.sourceImages || [])];
  const answers = row.answerImages || [];
  counts.questionImageReferences += images.length;
  counts.answerImageReferences += answers.length;
  if (/그림|사진|영상|회로도|선도/.test(row.question) && !images.length) {
    imageDependentWithoutMedia.push({ id: row.id, question: row.question, hasAnswerImage: !!answers.length });
  }
  const seen = new Map();
  for (const [kind, paths] of [['question', images], ['answer', answers]]) {
    for (const relative of paths) {
      const absolute = path.resolve(root, relative);
      if (!absolute.startsWith(root) || !fs.existsSync(absolute)) {
        missingReferences.push({ id: row.id, kind, path: relative });
        continue;
      }
      if (kind !== 'question') continue;
      const hash = crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex');
      if (seen.has(hash)) duplicateQuestionImages.push({ id: row.id, images: [seen.get(hash), relative] });
      seen.set(hash, relative);
    }
  }
}
const report = {
  description: '이미지가 연결되지 않은 시각자료 의존 문장과 완전 동일 파일을 선별합니다. 대체 그림 자동 생성/수정은 하지 않습니다.',
  counts,
  missingReferenceCount: missingReferences.length,
  imageDependentCandidateCount: imageDependentWithoutMedia.length,
  duplicateCandidateCount: duplicateQuestionImages.length,
  missingReferences, imageDependentWithoutMedia, duplicateQuestionImages,
  choiceOnlyAnswers: rows.filter(row => /^(가|나|다|라|A|B|C|D|[1-4]번)$/.test(row.answer)).map(row=>({id:row.id,answer:row.answer,question:row.question,status:'source-review-needed'})),
  limitation: '312문항의 연결·문구 선별이다. 원문 영상을 전 회차 대조한 것은 아니며 후보를 자동으로 정답/오류 판정하지 않는다.',
};
const output = process.argv.find(arg=>arg.startsWith('--output='))?.slice('--output='.length);
if (output) fs.writeFileSync(path.resolve(root,output), JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(output ? {...counts,missingReferences:missingReferences.length,visualCandidates:imageDependentWithoutMedia.length,choiceOnlyAnswers:report.choiceOnlyAnswers.length,output} : report,null,2));
if (missingReferences.length) process.exitCode = 1;
