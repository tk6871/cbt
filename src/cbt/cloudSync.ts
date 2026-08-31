import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { reactive, watch } from 'vue';
import { db, persistStudyStoreNow, studyStore, type ExamRecord } from './storage';
import type { AttemptRecord, LegacyStore } from './types';

type BookmarkState = { value: boolean; at: number };
type SyncStore = Required<Pick<LegacyStore, 'attempts' | 'wrong' | 'bookmarks' | 'history' | 'notes' | 'progress'>> & LegacyStore;
type SyncPayload = {
  version: 1;
  capturedAt: number;
  store: SyncStore;
  exams: ExamRecord[];
};

export type QuestionIssueType =
  | 'missing-image'
  | 'wrong-image'
  | 'answer-hotspot'
  | 'answer'
  | 'explanation'
  | 'text-ocr'
  | 'layout'
  | 'other';

export type QuestionIssueSubmission = {
  space: 'industrial' | 'jewelry';
  qualification_key: string;
  qualification?: string;
  round_id: string;
  round_title?: string;
  round_year?: number;
  round_session?: string;
  question_id: string;
  question_number: number;
  display_number?: number;
  subject?: string;
  issue_types: QuestionIssueType[];
  details: string;
  question_text?: string;
  choices_snapshot?: string[];
  configured_answer?: number;
  source_image?: string;
  page_url?: string;
  app_version?: string;
  device_info?: string;
};

export const cloudSyncState = reactive({
  configured: false,
  email: '',
  mustChangePassword: false,
  status: 'disabled' as 'disabled' | 'signed-out' | 'syncing' | 'synced' | 'error',
  message: '',
  lastSyncedAt: 0,
});

const space = window.CBT_APP_SPACE === 'jewelry' ? 'jewelry' : 'industrial';
const config = window.CBT_CLOUD_CONFIG;
let client: SupabaseClient | null = null;
let session: Session | null = null;
let syncTimer = 0;
let syncing = false;
let rerunRequested = false;
let applyingRemote = false;
let stopStoreWatch: (() => void) | null = null;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeStore(value?: LegacyStore): SyncStore {
  const source = value || {};
  return {
    ...source,
    attempts: clone(source.attempts || {}),
    wrong: clone(source.wrong || {}),
    bookmarks: [...new Set(source.bookmarks || [])],
    progress: clone(source.progress || {}),
    history: clone(source.history || []),
    notes: clone(source.notes || {}),
    sync: { bookmarks: clone(source.sync?.bookmarks || {}) },
  };
}

function bookmarkStates(store: SyncStore): Record<string, BookmarkState> {
  const states = clone(store.sync?.bookmarks || {});
  store.bookmarks.forEach((id) => { states[id] ||= { value: true, at: 0 }; });
  return states;
}

function mergeProgress(
  local: Record<string, unknown>,
  remote: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...remote, ...local };
  const key = 'activeLearningSessionV1';
  const localSession = local[key];
  const remoteSession = remote[key];
  const savedAt = (value: unknown): number => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return 0;
    return Number((value as { savedAt?: unknown }).savedAt) || 0;
  };
  if (savedAt(remoteSession) > savedAt(localSession)) merged[key] = clone(remoteSession);
  else if (localSession !== undefined) merged[key] = clone(localSession);
  return merged;
}

function mergeAttempt(local?: AttemptRecord, remote?: AttemptRecord): AttemptRecord | undefined {
  if (!local) return remote ? clone(remote) : undefined;
  if (!remote) return clone(local);
  const latest = local.at >= remote.at ? local : remote;
  const correctCount = Math.max(local.correctCount || 0, remote.correctCount || 0);
  const wrongCount = Math.max(local.wrongCount || 0, remote.wrongCount || 0);
  return {
    ...latest,
    count: Math.max(local.count || 0, remote.count || 0, correctCount + wrongCount),
    correctCount,
    wrongCount,
  };
}

function mergeStores(localValue: LegacyStore, remoteValue: LegacyStore): SyncStore {
  const local = normalizeStore(localValue);
  const remote = normalizeStore(remoteValue);
  const attempts: Record<string, AttemptRecord> = {};
  new Set([...Object.keys(local.attempts), ...Object.keys(remote.attempts)]).forEach((id) => {
    const merged = mergeAttempt(local.attempts[id], remote.attempts[id]);
    if (merged) attempts[id] = merged;
  });

  const localBookmarks = bookmarkStates(local);
  const remoteBookmarks = bookmarkStates(remote);
  const mergedBookmarks: Record<string, BookmarkState> = {};
  new Set([...Object.keys(localBookmarks), ...Object.keys(remoteBookmarks)]).forEach((id) => {
    const left = localBookmarks[id];
    const right = remoteBookmarks[id];
    mergedBookmarks[id] = !right || (left && left.at >= right.at) ? clone(left) : clone(right);
  });

  const wrong: SyncStore['wrong'] = {};
  Object.entries(attempts).forEach(([id, attempt]) => {
    if (!attempt.lastCorrect) wrong[id] = { count: attempt.wrongCount, at: attempt.at };
  });
  for (const source of [remote.wrong, local.wrong]) {
    Object.entries(source).forEach(([id, row]) => {
      if (!attempts[id] && row) wrong[id] = clone(row);
    });
  }

  return {
    ...local,
    attempts,
    wrong,
    bookmarks: Object.entries(mergedBookmarks).filter(([, state]) => state.value).map(([id]) => id),
    history: local.history.length >= remote.history.length ? local.history : remote.history,
    notes: { ...remote.notes, ...local.notes },
    progress: mergeProgress(local.progress, remote.progress),
    sync: { bookmarks: mergedBookmarks },
  };
}

function mergeExams(local: ExamRecord[], remote: ExamRecord[]): ExamRecord[] {
  const rows = new Map<string, ExamRecord>();
  [...remote, ...local].forEach((row) => {
    const previous = rows.get(row.id);
    if (!previous || row.finishedAt >= previous.finishedAt) rows.set(row.id, clone(row));
  });
  return [...rows.values()].sort((a, b) => b.finishedAt - a.finishedAt);
}

async function localPayload(): Promise<SyncPayload> {
  return {
    version: 1,
    capturedAt: Date.now(),
    store: normalizeStore(clone(studyStore)),
    exams: await db.exams.toArray(),
  };
}

async function applyPayload(payload: SyncPayload): Promise<void> {
  applyingRemote = true;
  try {
    const store = normalizeStore(payload.store);
    Object.keys(studyStore.attempts).forEach((key) => delete studyStore.attempts[key]);
    Object.assign(studyStore.attempts, store.attempts);
    Object.keys(studyStore.wrong).forEach((key) => delete studyStore.wrong[key]);
    Object.assign(studyStore.wrong, store.wrong);
    studyStore.bookmarks.splice(0, studyStore.bookmarks.length, ...store.bookmarks);
    studyStore.history.splice(0, studyStore.history.length, ...store.history);
    Object.keys(studyStore.notes).forEach((key) => delete studyStore.notes[key]);
    Object.assign(studyStore.notes, store.notes);
    studyStore.progress = store.progress;
    studyStore.sync = store.sync;
    const attemptRows = Object.entries(store.attempts).map(([id, row]) => ({ id, ...row }));
    await db.transaction('rw', db.attempts, db.exams, async () => {
      await db.attempts.clear();
      if (attemptRows.length) await db.attempts.bulkPut(attemptRows);
      await db.exams.clear();
      if (payload.exams.length) await db.exams.bulkPut(payload.exams);
    });
    persistStudyStoreNow();
    window.dispatchEvent(new CustomEvent('cbt:cloud-synced'));
  } finally {
    applyingRemote = false;
  }
}

export async function syncLearningData(): Promise<void> {
  if (!client || !session || syncing) {
    if (syncing) rerunRequested = true;
    return;
  }
  if (!navigator.onLine) {
    cloudSyncState.message = '인터넷 연결 후 자동으로 동기화합니다.';
    return;
  }
  syncing = true;
  cloudSyncState.status = 'syncing';
  cloudSyncState.message = '기록을 안전하게 합치는 중…';
  try {
    const local = await localPayload();
    const { data, error } = await client.from('user_learning_states')
      .select('payload')
      .eq('space', space)
      .maybeSingle();
    if (error) throw error;
    const remote = data?.payload as SyncPayload | undefined;
    const merged: SyncPayload = remote?.version === 1
      ? {
          version: 1,
          capturedAt: Date.now(),
          store: mergeStores(local.store, remote.store),
          exams: mergeExams(local.exams, remote.exams || []),
        }
      : local;
    const { error: saveError } = await client.from('user_learning_states').upsert({
      user_id: session.user.id,
      space,
      payload: merged,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,space' });
    if (saveError) throw saveError;
    await applyPayload(merged);
    cloudSyncState.status = 'synced';
    cloudSyncState.lastSyncedAt = Date.now();
    cloudSyncState.message = '모든 기기의 기록이 최신입니다.';
  } catch (error) {
    console.error('학습 기록 동기화 실패', error);
    cloudSyncState.status = 'error';
    cloudSyncState.message = '동기화하지 못했습니다. 잠시 후 다시 시도합니다.';
  } finally {
    syncing = false;
    if (rerunRequested) {
      rerunRequested = false;
      scheduleLearningSync(300);
    }
  }
}

export function scheduleLearningSync(delay = 1200): void {
  if (!session || applyingRemote) return;
  window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(() => { void syncLearningData(); }, delay);
}

export async function initializeCloudSync(): Promise<void> {
  cloudSyncState.configured = Boolean(config?.enabled && config.supabaseUrl && config.supabaseAnonKey);
  if (!cloudSyncState.configured || !config) return;
  client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: `cbt-learning-auth-${space}`,
    },
  });
  client.auth.onAuthStateChange((event, nextSession) => {
    session = nextSession;
    cloudSyncState.email = String(nextSession?.user.user_metadata?.sync_username || nextSession?.user.email || '');
    cloudSyncState.mustChangePassword = Boolean(nextSession?.user.user_metadata?.must_change_password);
    cloudSyncState.status = nextSession ? 'syncing' : 'signed-out';
    cloudSyncState.message = nextSession ? '로그인 확인 완료 · 기록을 불러오는 중…' : '';
    if (nextSession) window.setTimeout(() => { void syncLearningData(); }, 0);
  });
  const { data } = await client.auth.getSession();
  session = data.session;
  cloudSyncState.email = String(session?.user.user_metadata?.sync_username || session?.user.email || '');
  cloudSyncState.mustChangePassword = Boolean(session?.user.user_metadata?.must_change_password);
  cloudSyncState.status = session ? 'syncing' : 'signed-out';
  stopStoreWatch ||= watch(studyStore, () => scheduleLearningSync(), { deep: true });
  window.addEventListener('online', () => scheduleLearningSync(100));
  if (session) await syncLearningData();
}

async function digest(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function normalizedUsername(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase('ko-KR');
}

async function usernameEmail(username: string): Promise<string> {
  const hash = await digest(`cbt-sync:${normalizedUsername(username)}`);
  return `${hash.slice(0, 40)}@accounts.cbt.invalid`;
}

type AccountFunctionResult = {
  error?: string;
  username?: string;
  internalEmail?: string;
  recoveryCode?: string;
};

async function accountFunction(body: Record<string, unknown>): Promise<AccountFunctionResult> {
  if (!config?.enabled || !config.supabaseUrl || !config.supabaseAnonKey) {
    return { error: '클라우드 연결 설정을 확인해 주세요.' };
  }
  try {
    const response = await fetch(`${config.supabaseUrl.replace(/\/$/, '')}/functions/v1/sync-account`, {
      method: 'POST',
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${config.supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const result = await response.json() as AccountFunctionResult;
    return response.ok ? result : { error: result.error || '계정 요청을 처리하지 못했습니다.' };
  } catch {
    return { error: '인터넷 연결을 확인한 뒤 다시 시도해 주세요.' };
  }
}

export async function signInForSync(identifier: string, password: string): Promise<string | null> {
  if (!client) return '클라우드 연결 설정을 확인해 주세요.';
  const clean = identifier.trim();
  const email = clean.includes('@') ? clean.toLowerCase() : await usernameEmail(clean);
  const { error } = await client.auth.signInWithPassword({ email, password });
  return error ? '아이디 또는 비밀번호를 확인해 주세요.' : null;
}

export async function signUpForSync(username: string, password: string): Promise<AccountFunctionResult> {
  if (!client) return { error: '클라우드 연결 설정을 확인해 주세요.' };
  const result = await accountFunction({ action: 'signup', username, password });
  if (result.error || !result.internalEmail) return result;
  const { error } = await client.auth.signInWithPassword({ email: result.internalEmail, password });
  return error ? { error: '계정은 만들어졌지만 자동 로그인하지 못했습니다. 아이디로 다시 로그인해 주세요.', recoveryCode: result.recoveryCode } : result;
}

export async function signOutFromSync(): Promise<void> {
  await client?.auth.signOut();
}

export async function findSyncId(recoveryCode: string): Promise<AccountFunctionResult> {
  return accountFunction({ action: 'find-id', recoveryCode });
}

export async function resetSyncPassword(username: string, recoveryCode: string, password: string): Promise<AccountFunctionResult> {
  return accountFunction({ action: 'reset-password', username, recoveryCode, password });
}

export async function updateSyncPassword(password: string): Promise<string | null> {
  if (!client || !session) return '먼저 로그인해 주세요.';
  if (password.length < 8) return '새 비밀번호는 8자 이상으로 입력해 주세요.';
  const { data, error } = await client.auth.updateUser({
    password,
    data: { ...session.user.user_metadata, must_change_password: false },
  });
  if (!error && data.user) {
    session = { ...session, user: data.user };
    cloudSyncState.mustChangePassword = false;
  }
  return error ? '비밀번호를 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.' : null;
}

export async function clearCloudLearningState(): Promise<void> {
  if (!client || !session) return;
  const { error } = await client.from('user_learning_states').delete().eq('space', space);
  if (error) throw error;
}

export async function submitQuestionIssue(payload: QuestionIssueSubmission): Promise<string | null> {
  if (!config?.enabled || !config.supabaseUrl || !config.supabaseAnonKey) {
    return '온라인 신고 저장소가 연결되어 있지 않습니다.';
  }
  if (!payload.issue_types.length || payload.details.trim().length < 3) {
    return '문제 유형을 고르고 내용을 3자 이상 적어 주세요.';
  }
  try {
    const response = await fetch(`${config.supabaseUrl.replace(/\/$/, '')}/rest/v1/question_issue_reports`, {
      method: 'POST',
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${config.supabaseAnonKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        ...payload,
        details: payload.details.trim(),
        issue_types: [...new Set(payload.issue_types)],
      }),
    });
    if (!response.ok) {
      console.error('문제 이상 신고 저장 실패', response.status, await response.text());
      return '신고를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.';
    }
    return null;
  } catch (error) {
    console.error('문제 이상 신고 전송 실패', error);
    return '인터넷 연결을 확인한 뒤 다시 시도해 주세요.';
  }
}
