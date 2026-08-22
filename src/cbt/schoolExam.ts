import type { Catalog, Round } from './types';

export const SCHOOL_EXAM_CATALOG_KEY = 'school-exams';
const schoolExamStorageKey = 'unified-cbt-school-exams-v1';

export type SchoolExamKind = 'midterm' | 'final' | 'quiz' | 'other';

export type SchoolStudyScope = {
  id: string;
  subject: string;
  year: number;
  semester: 1 | 2;
  examKind: SchoolExamKind;
  textbook?: string;
  pages?: string;
  note?: string;
  important?: boolean;
};

export type SchoolMemoryCard = {
  id: string;
  subject: string;
  prompt: string;
  answer: string;
  sourcePage?: string;
  teacherHint?: string;
  sourceImage?: string;
  important?: boolean;
  reviewCount?: number;
  knownCount?: number;
  lastReviewedAt?: number;
};

export type SchoolExamData = {
  version: 1;
  rounds: Round[];
  scopes: SchoolStudyScope[];
  memoryCards: SchoolMemoryCard[];
};

export function emptySchoolExamData(): SchoolExamData {
  return { version: 1, rounds: [], scopes: [], memoryCards: [] };
}

function validRound(round: unknown): round is Round {
  if (!round || typeof round !== 'object') return false;
  const candidate = round as Partial<Round>;
  return typeof candidate.id === 'string'
    && typeof candidate.title === 'string'
    && Number.isFinite(Number(candidate.year))
    && Array.isArray(candidate.subjects)
    && candidate.subjects.every((subject) => typeof subject === 'string')
    && Array.isArray(candidate.questions)
    && candidate.questions.every((question) => Boolean(question)
      && (typeof question.text === 'string' || typeof question.html === 'string')
      && Array.isArray(question.choices)
      && question.choices.length === 4
      && question.choices.every((choice) => choice && typeof choice === 'object'
        && (typeof choice.text === 'string' || typeof choice.html === 'string'))
      && Number(question.answer) >= 1
      && Number(question.answer) <= 4);
}

export function normalizeSchoolExamData(value: unknown): SchoolExamData {
  if (!value || typeof value !== 'object') return emptySchoolExamData();
  const source = value as Partial<SchoolExamData>;
  const rounds = Array.isArray(source.rounds) ? source.rounds.filter(validRound).map((round) => ({
    ...round,
    qualificationKey: SCHOOL_EXAM_CATALOG_KEY,
    qualification: '학교 중간·기말고사',
    shortQualification: '학교 시험',
    kind: 'school-exam',
    questions: round.questions.map((question, index) => ({
      ...question,
      number: index + 1,
      source: question.source || 'school-user',
      choices: question.choices.slice(0, 4),
      answer: Math.min(4, Math.max(1, Number(question.answer) || 1)),
    })),
  })) : [];
  const scopes = Array.isArray(source.scopes) ? source.scopes.filter((scope) => scope
    && typeof scope.id === 'string'
    && typeof scope.subject === 'string') as SchoolStudyScope[] : [];
  const memoryCards = Array.isArray(source.memoryCards) ? source.memoryCards.filter((card) => card
    && typeof card.id === 'string'
    && typeof card.subject === 'string'
    && typeof card.prompt === 'string'
    && typeof card.answer === 'string') as SchoolMemoryCard[] : [];
  return { version: 1, rounds, scopes, memoryCards };
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const incomingIds = new Set(incoming.map((item) => item.id));
  return [...incoming, ...current.filter((item) => !incomingIds.has(item.id))];
}

export function mergeSchoolExamData(current: SchoolExamData, incoming: unknown): SchoolExamData {
  const normalizedCurrent = normalizeSchoolExamData(current);
  const normalizedIncoming = normalizeSchoolExamData(incoming);
  return normalizeSchoolExamData({
    version: 1,
    rounds: mergeById(normalizedCurrent.rounds, normalizedIncoming.rounds),
    scopes: mergeById(normalizedCurrent.scopes, normalizedIncoming.scopes),
    memoryCards: mergeById(normalizedCurrent.memoryCards, normalizedIncoming.memoryCards),
  });
}

export function loadSchoolExamData(): SchoolExamData {
  try {
    return normalizeSchoolExamData(JSON.parse(localStorage.getItem(schoolExamStorageKey) || 'null'));
  } catch {
    return emptySchoolExamData();
  }
}

export function saveSchoolExamData(data: SchoolExamData): void {
  localStorage.setItem(schoolExamStorageKey, JSON.stringify(normalizeSchoolExamData(data)));
}

export function schoolExamCatalog(data: SchoolExamData): Catalog {
  return {
    key: SCHOOL_EXAM_CATALOG_KEY,
    name: '학교 중간·기말고사',
    shortName: '학교 시험',
    rounds: data.rounds,
    roundCount: data.rounds.length,
    questionCount: data.rounds.reduce((sum, round) => sum + round.questions.length, 0),
  };
}
