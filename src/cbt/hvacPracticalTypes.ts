export type PracticalPromptGroup = 'public' | 'restored' | 'foundation' | 'drill';
export type PracticalCategory = 'equipment' | 'cycle' | 'calculation' | 'operation' | 'piping' | 'air' | 'safety';
export type PracticalDifficulty = 'basic' | 'standard' | 'advanced';

export type PracticalPrompt = {
  id: string;
  group: PracticalPromptGroup;
  category: PracticalCategory;
  difficulty: PracticalDifficulty;
  points: number;
  question: string;
  answer: string;
  explanation: string;
  sourceNote: string;
  keyPoints?: string[];
  image?: string;
  images?: string[];
  answerImages?: string[];
  sourceUrl?: string;
  year?: number;
  session?: string;
  number?: number;
};

export const practicalCategoryLabels: Record<PracticalCategory, string> = {
  equipment: '장치·구조',
  cycle: '냉동사이클',
  calculation: '계산',
  operation: '운전·고장진단',
  piping: '배관·시공',
  air: '공기조화',
  safety: '안전·점검',
};

export const practicalDifficultyLabels: Record<PracticalDifficulty, string> = {
  basic: '기초',
  standard: '보통',
  advanced: '심화',
};
