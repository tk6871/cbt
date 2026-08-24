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

export const cloudSyncState = reactive({
  configured: false,
  email: '',
  status: 'disabled' as 'disabled' | 'signed-out' | 'syncing' | 'synced' | 'error',
  message: '',
  lastSyncedAt: 0,
  passwordRecovery: false,
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
    cloudSyncState.email = nextSession?.user.email || '';
    cloudSyncState.status = nextSession ? 'syncing' : 'signed-out';
    cloudSyncState.message = nextSession ? '로그인 확인 완료 · 기록을 불러오는 중…' : '';
    if (nextSession) window.setTimeout(() => { void syncLearningData(); }, 0);
    if (event === 'PASSWORD_RECOVERY') {
      cloudSyncState.passwordRecovery = true;
      window.dispatchEvent(new CustomEvent('cbt:password-recovery'));
    }
  });
  const { data } = await client.auth.getSession();
  session = data.session;
  cloudSyncState.email = session?.user.email || '';
  cloudSyncState.status = session ? 'syncing' : 'signed-out';
  stopStoreWatch ||= watch(studyStore, () => scheduleLearningSync(), { deep: true });
  window.addEventListener('online', () => scheduleLearningSync(100));
  if (session) await syncLearningData();
}

export async function signInForSync(email: string, password: string): Promise<string | null> {
  if (!client) return '클라우드 연결 설정을 확인해 주세요.';
  const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
  return error ? '이메일 또는 비밀번호를 확인해 주세요.' : null;
}

export async function signUpForSync(email: string, password: string): Promise<string | null> {
  if (!client) return '클라우드 연결 설정을 확인해 주세요.';
  const { data, error } = await client.auth.signUp({ email: email.trim(), password });
  if (error) return error.message.includes('Password') ? '비밀번호는 8자 이상으로 입력해 주세요.' : '계정을 만들지 못했습니다. 이메일을 확인해 주세요.';
  return data.session ? null : '확인 메일을 보냈습니다. 메일 인증 후 같은 정보로 로그인해 주세요.';
}

export async function signOutFromSync(): Promise<void> {
  await client?.auth.signOut();
}

export async function requestSyncPasswordReset(email: string): Promise<string | null> {
  if (!client) return '클라우드 연결 설정을 확인해 주세요.';
  if (!email.trim()) return '먼저 이메일을 입력해 주세요.';
  const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: 'https://tk6871.github.io/cbt/',
  });
  return error ? '재설정 메일을 보내지 못했습니다. 이메일을 확인해 주세요.' : null;
}

export async function updateSyncPassword(password: string): Promise<string | null> {
  if (!client || !session) return '재설정 링크가 만료되었습니다. 다시 요청해 주세요.';
  if (password.length < 8) return '새 비밀번호는 8자 이상으로 입력해 주세요.';
  const { error } = await client.auth.updateUser({ password });
  if (!error) cloudSyncState.passwordRecovery = false;
  return error ? '비밀번호를 바꾸지 못했습니다. 재설정 링크를 다시 요청해 주세요.' : null;
}

export async function clearCloudLearningState(): Promise<void> {
  if (!client || !session) return;
  const { error } = await client.from('user_learning_states').delete().eq('space', space);
  if (error) throw error;
}
