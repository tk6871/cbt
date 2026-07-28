import Dexie, { type EntityTable } from 'dexie';
import { reactive, watch } from 'vue';
import type { AttemptRecord, LegacyStore } from './types';

const STORAGE_KEY = 'unified-industrial-cbt-v1';
const THEME_KEY = 'unified-cbt-theme';

type AttemptRow = AttemptRecord & { id: string };
type ExamRow = {
  id: string;
  qualificationKey: string;
  title: string;
  score: number;
  passed: boolean;
  answered: number;
  total: number;
  finishedAt: number;
};

class CbtDatabase extends Dexie {
  attempts!: EntityTable<AttemptRow, 'id'>;
  exams!: EntityTable<ExamRow, 'id'>;

  constructor() {
    super('industrial-cbt');
    this.version(1).stores({
      attempts: 'id, at, lastCorrect',
      exams: 'id, qualificationKey, finishedAt, score',
    });
  }
}

export const db = new CbtDatabase();

function loadLegacy(): Required<Pick<LegacyStore, 'attempts' | 'wrong' | 'bookmarks' | 'history' | 'notes'>> & LegacyStore {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as LegacyStore;
    return {
      ...value,
      attempts: value.attempts || {},
      wrong: value.wrong || {},
      bookmarks: value.bookmarks || [],
      history: value.history || [],
      notes: value.notes || {},
    };
  } catch {
    return { attempts: {}, wrong: {}, bookmarks: [], history: [], notes: {} };
  }
}

export const studyStore = reactive(loadLegacy());

let persistHandle = 0;
watch(studyStore, () => {
  window.clearTimeout(persistHandle);
  persistHandle = window.setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(studyStore));
  }, 120);
}, { deep: true });

export async function hydrateIndexedDb(): Promise<void> {
  const rows = await db.attempts.toArray();
  if (!rows.length) {
    const legacyRows = Object.entries(studyStore.attempts).map(([id, row]) => ({ id, ...row }));
    if (legacyRows.length) await db.attempts.bulkPut(legacyRows);
    return;
  }
  rows.forEach(({ id, ...record }) => {
    if (!studyStore.attempts[id] || record.at > studyStore.attempts[id].at) {
      studyStore.attempts[id] = record;
    }
  });
}

export function recordAttempt(id: string, choice: number, answer: number): AttemptRecord {
  const previous = studyStore.attempts[id];
  const correct = choice === answer;
  const next: AttemptRecord = {
    count: (previous?.count || 0) + 1,
    correctCount: (previous?.correctCount || 0) + (correct ? 1 : 0),
    wrongCount: (previous?.wrongCount || 0) + (correct ? 0 : 1),
    lastChoice: choice,
    lastCorrect: correct,
    at: Date.now(),
  };
  studyStore.attempts[id] = next;
  if (correct) delete studyStore.wrong[id];
  else studyStore.wrong[id] = { count: next.wrongCount, at: next.at };
  void db.attempts.put({ id, ...next });
  return next;
}

export async function recordExam(row: ExamRow): Promise<void> {
  await db.exams.put(row);
}

export function currentTheme(): 'system' | 'light' | 'dark' {
  const mode = localStorage.getItem(THEME_KEY);
  return mode === 'light' || mode === 'dark' ? mode : 'system';
}

export function applyTheme(mode: 'system' | 'light' | 'dark'): void {
  localStorage.setItem(THEME_KEY, mode);
  const dark = mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}
