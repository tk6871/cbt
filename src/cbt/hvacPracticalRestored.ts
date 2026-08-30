import restoredRows from '../../data/hvac-practical-restored.json';
import type { PracticalCategory, PracticalDifficulty, PracticalPrompt } from './hvacPracticalTypes';

type RestoredPracticalRow = {
  id: string;
  year: number;
  session: string | number;
  number: number;
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
    || left.number - right.number)
  .map((row) => ({
  id: row.id,
  group: 'restored',
  year: row.year,
  session: String(row.session),
  number: row.number,
  question: row.question.trim(),
  answer: row.answer.trim(),
  explanation: row.explanation.trim(),
  keyPoints: row.keyPoints?.map((point) => point.trim()).filter(Boolean),
  category: row.category,
  difficulty: row.difficulty,
  points: row.points,
  sourceNote: row.sourceNote.trim(),
  image: row.image,
  images: (row.images || row.sourceImages)?.filter(Boolean),
  answerImages: row.answerImages?.filter(Boolean),
  }));
