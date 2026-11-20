import {importLegacyDirectAnswers} from './textbookAnswerProgress';
import Dexie, { type EntityTable, type Table } from 'dexie';
import { proxy, subscribe } from 'valtio/vanilla';
import type { AttemptRecord, LegacyStore, StudyMode } from './types';

const IS_JEWELRY = window.CBT_APP_SPACE === 'jewelry';
const STORAGE_KEY = IS_JEWELRY ? 'unified-jewelry-cbt-v1' : 'unified-industrial-cbt-v1';
const LEGACY_STORAGE_KEY = 'unified-industrial-cbt-v1';
const THEME_KEY = 'unified-cbt-theme';
const LEGACY_VISUAL_STYLE_KEY = 'unified-cbt-visual-style';
const VISUAL_STYLE_KEY = IS_JEWELRY ? 'unified-jewelry-cbt-visual-style' : 'unified-industrial-cbt-visual-style';
const DYNAMIC_UI_KEY = 'unified-cbt-dynamic-ui';
export type VisualStyle = 'default' | 'simpsons' | 'sunjae';

type AttemptRow = AttemptRecord & { id: string };
export type ExamRecord = {
  id: string;
  qualificationKey: string;
  roundId?: string;
  year?: number;
  session?: string;
  mode?: StudyMode;
  title: string;
  score: number;
  passed: boolean;
  answered: number;
  total: number;
  subjectRows?: Array<{ subject: string; correct: number; total: number; score: number; passed: boolean }>;
  answers?: Record<string, number>;
  itemIds?: string[];
  wrongAnswers?: Array<{
    id: string;
    subject: string;
    number: number;
    selected: number;
    answer: number;
  }>;
  finishedAt: number;
};

class CbtDatabase extends Dexie {
  attempts!: EntityTable<AttemptRow, 'id'>;
  exams!: EntityTable<ExamRecord, 'id'>;

  constructor() {
    super(IS_JEWELRY ? 'jewelry-cbt' : 'industrial-cbt');
    this.version(1).stores({
      attempts: 'id, at, lastCorrect',
      exams: 'id, qualificationKey, finishedAt, score',
    });
    this.version(2).stores({
      attempts: 'id, at, lastCorrect',
      exams: 'id, qualificationKey, roundId, mode, finishedAt, score',
    });
  }
}

export const db = new CbtDatabase();

function loadLegacy(): Required<Pick<LegacyStore, 'attempts' | 'wrong' | 'bookmarks' | 'history' | 'notes'>> & LegacyStore {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const source = saved || (IS_JEWELRY ? localStorage.getItem(LEGACY_STORAGE_KEY) : null) || '{}';
    const value = JSON.parse(source) as LegacyStore;
    if (IS_JEWELRY && !saved) {
      const jewelryPrefix = /^(?:jewelry-|gem-|precious-)/;
      value.attempts = Object.fromEntries(Object.entries(value.attempts || {}).filter(([id]) => jewelryPrefix.test(id)));
      value.wrong = Object.fromEntries(Object.entries(value.wrong || {}).filter(([id]) => jewelryPrefix.test(id)));
      value.bookmarks = (value.bookmarks || []).filter((id) => jewelryPrefix.test(id));
      value.notes = Object.fromEntries(Object.entries(value.notes || {}).filter(([id]) => jewelryPrefix.test(id)));
      value.history = [];
    }
    const progress = value.progress || {};
    if (!IS_JEWELRY) importLegacyDirectAnswers(progress, localStorage);
    return {
      ...value,
      attempts: value.attempts || {},
      wrong: value.wrong || {},
      bookmarks: value.bookmarks || [],
      progress,
      history: value.history || [],
      notes: value.notes || {},
      sync: {
        bookmarks: value.sync?.bookmarks || {},
      },
    };
  } catch {
    return { attempts: {}, wrong: {}, bookmarks: [], progress: {}, history: [], notes: {}, sync: { bookmarks: {} } };
  }
}

export const studyStore = proxy(loadLegacy());

export function subscribeStudyChanges(listener: () => void): () => void {
  return subscribe(studyStore, listener);
}

// Android WebView can acknowledge a localStorage write before it reaches disk.
// Keep the bundled APK's study snapshot in a strict IndexedDB transaction.
let nativeSnapshots: Table<string, string> | undefined;
let lastNativeSnapshot: string | undefined;

export async function openBundledStudyStorage(): Promise<void> {
  const store = new Dexie('cbt-bundled-study', {chromeTransactionDurability: 'strict'});
  store.version(1).stores({snapshots: ''});
  await store.open();
  const table = store.table<string, string>('snapshots');
  const saved = await table.get(STORAGE_KEY);
  if (saved !== undefined) {
    localStorage.setItem(STORAGE_KEY, saved);
    Object.assign(studyStore, loadLegacy());
  }
  nativeSnapshots = table;
  lastNativeSnapshot = saved;
  await persistStudyStoreNow();
}

let persistHandle = 0;
subscribeStudyChanges(() => {
  window.clearTimeout(persistHandle);
  if (nativeSnapshots) {
    void persistStudyStoreNow();
    return;
  }
  persistHandle = window.setTimeout(persistStudyStoreNow, 120);
});

export function persistStudyStoreNow(): void | Promise<void> {
  window.clearTimeout(persistHandle);
  const data = JSON.stringify(studyStore);
  if (!nativeSnapshots) {
    localStorage.setItem(STORAGE_KEY, data);
    return;
  }
  if (lastNativeSnapshot === data) return;
  lastNativeSnapshot = data;
  return nativeSnapshots.put(data, STORAGE_KEY).then(() => {
    if (lastNativeSnapshot === data) localStorage.setItem(STORAGE_KEY, data);
  }).catch((error: unknown) => {
    if (lastNativeSnapshot === data) lastNativeSnapshot = undefined;
    throw error;
  });
}

export function markBookmarkSyncState(id: string, value: boolean): void {
  studyStore.sync ||= {};
  studyStore.sync.bookmarks ||= {};
  studyStore.sync.bookmarks[id] = { value, at: Date.now() };
}

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

export async function recordExam(row: ExamRecord): Promise<void> {
  await db.exams.put(row);
}

export async function loadExamRecords(qualificationKey: string): Promise<ExamRecord[]> {
  const rows = await db.exams.where('qualificationKey').equals(qualificationKey).toArray();
  return rows.sort((a, b) => b.finishedAt - a.finishedAt);
}

export function currentTheme(): 'system' | 'light' | 'dark' {
  const mode = localStorage.getItem(THEME_KEY);
  return mode === 'system' || mode === 'light' || mode === 'dark' ? mode : 'dark';
}

export function applyTheme(mode: 'system' | 'light' | 'dark'): void {
  localStorage.setItem(THEME_KEY, mode);
  const dark = mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

export function currentVisualStyle(): VisualStyle {
  const saved = localStorage.getItem(VISUAL_STYLE_KEY) || localStorage.getItem(LEGACY_VISUAL_STYLE_KEY);
  return saved === 'simpsons' || saved === 'sunjae' ? saved : 'default';
}

export function applyVisualStyle(style: VisualStyle): void {
  localStorage.setItem(VISUAL_STYLE_KEY, style);
  document.documentElement.dataset.visualStyle = style;
}

export function currentDynamicUiEnabled(): boolean {
  return localStorage.getItem(DYNAMIC_UI_KEY) !== 'false';
}

export function applyDynamicUiPreference(enabled: boolean): void {
  localStorage.setItem(DYNAMIC_UI_KEY, String(enabled));
  document.documentElement.dataset.dynamicUi = enabled ? 'on' : 'off';
}
