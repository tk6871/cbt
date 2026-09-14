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
console.log(JSON.stringify({
  description: '이미지가 연결되지 않은 시각자료 의존 문장과 완전 동일 파일을 선별합니다. 대체 그림 자동 생성/수정은 하지 않습니다.',
  counts,
  missingReferenceCount: missingReferences.length,
  imageDependentCandidateCount: imageDependentWithoutMedia.length,
  duplicateCandidateCount: duplicateQuestionImages.length,
  missingReferences, imageDependentWithoutMedia, duplicateQuestionImages,
}, null, 2));
if (missingReferences.length) process.exitCode = 1;
