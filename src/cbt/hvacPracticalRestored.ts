import restoredRows from '../../data/hvac-practical-restored.json';
import scanEnhancement from '../../data/hvac-practical-scan-enhancement-20261007.json';
import publicVideos from '../../data/hvac-practical-public-video-sources.json';
import type { PracticalCategory, PracticalDifficulty, PracticalPrompt } from './hvacPracticalTypes';

type RestoredPracticalRow = {
  id: string;
  year: number;
  session: string | number;
  number: number;
  bookNumber?: number | null;
  question: string;
  answer: string;
  explanation: string;
  keyPoints?: string[];
  category: PracticalCategory;
  difficulty: PracticalDifficulty;
  points: number;
  sourceNote: string;
  image?: string;
  images?: string[];
  sourceImages?: string[];
  answerImages?: string[];
};

export const hvacPracticalRestored: PracticalPrompt[] = [...(restoredRows as RestoredPracticalRow[])]
  .sort((left, right) => right.year - left.year
    || String(right.session).localeCompare(String(left.session), 'ko', { numeric: true })
    || (left.bookNumber === null ? 999 : left.bookNumber ?? left.number)
      - (right.bookNumber === null ? 999 : right.bookNumber ?? right.number))
  .map((row) => ({
  id: row.id,
  group: 'restored',
  year: row.year,
  session: String(row.session),
  number: row.bookNumber === null ? undefined : row.bookNumber ?? row.number,
  numberLabel: row.bookNumber === null ? '추가 복원(책 미대응)' : undefined,
  question: row.question.trim(),
  answer: row.answer.trim(),
  explanation: row.explanation.trim(),
  keyPoints: row.keyPoints?.map((point) => point.trim()).filter(Boolean),
  category: row.category,
  difficulty: row.difficulty,
  points: row.points,
  sourceNote: row.sourceNote.trim(),
  image: row.image,
  images: (row.images || row.sourceImages)?.filter(Boolean).map(image =>
    image === scanEnhancement.source ? scanEnhancement.output : image),
  imageMaxHeight: row.images?.includes(scanEnhancement.source) ? 480 : undefined,
  answerImages: row.answerImages?.filter(Boolean),
  sourceUrl: (() => {
    const video = publicVideos.sources.find(s => s.year === row.year && s.session === String(row.session));
    const chapter = video?.chapters.find(c => c.number === row.number);
    return video?.availability === 'public' && chapter ? `${video.url}&t=${chapter.startSeconds}s` : undefined;
  })(),
  }));
