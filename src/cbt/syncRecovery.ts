import Dexie, { type EntityTable } from 'dexie';
import type { LegacyStore } from './types';

export type RecoveryPart = {
  kind: 'session' | 'practical' | 'note';
  key: string;
  label: string;
  local: unknown;
  remote: unknown;
};
export type SyncRecovery = RecoveryPart & { id: string; owner: string; createdAt: number };

// Separate database: older open CBT tabs do not block upgrading the learning database.
const recoveryDb = new Dexie('cbt-sync-recovery-v1') as Dexie & { copies: EntityTable<SyncRecovery, 'id'> };
recoveryDb.version(1).stores({ copies: 'id, owner, createdAt' });
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export function differingLearningCopies(local: LegacyStore, remote: LegacyStore): RecoveryPart[] {
  const parts: RecoveryPart[] = [];
  const add = (kind: RecoveryPart['kind'], key: string, label: string, left: unknown, right: unknown) => {
    if (left !== undefined && right !== undefined && JSON.stringify(left) !== JSON.stringify(right)) {
      parts.push({ kind, key, label, local: copy(left), remote: copy(right) });
    }
  };
  const key = 'activeLearningSessionV1';
  add('session', key, '풀던 필기 문제', local.progress?.[key], remote.progress?.[key]);
  const rows = (store: LegacyStore) => (store.progress?.hvacPracticalV2 || {}) as Record<string, unknown>;
  const left = rows(local), right = rows(remote);
  for (const id of Object.keys(left)) add('practical', id, `필답 답안 · ${id}`, left[id], right[id]);
  for (const id of Object.keys(local.notes || {})) add('note', id, `문제 메모 · ${id}`, local.notes?.[id], remote.notes?.[id]);
  return parts;
}

export async function listSyncRecoveries(owner: string): Promise<SyncRecovery[]> {
  return (await recoveryDb.copies.where('owner').equals(owner).toArray()).sort((a, b) => b.createdAt - a.createdAt);
}

export async function preserveLearningCopies(owner: string, parts: RecoveryPart[]): Promise<void> {
  if (!parts.length) return;
  await recoveryDb.transaction('rw', recoveryDb.copies, async () => {
    const existing = await listSyncRecoveries(owner);
    const signature = (part: RecoveryPart) => JSON.stringify([part.kind, part.key, part.local, part.remote]);
    const seen = new Set(existing.map(signature));
    for (const part of parts) {
      const key = signature(part);
      if (seen.has(key)) continue;
      seen.add(key);
      await recoveryDb.copies.add({ ...part, owner, id: crypto.randomUUID(), createdAt: Date.now() });
    }
    // Bounded local safety copies, never remove cloud learning records.
    const all = await listSyncRecoveries(owner);
    await recoveryDb.copies.bulkDelete(all.slice(100).map(row => row.id));
  });
}

export function restoreLearningCopy(store: LegacyStore, part: RecoveryPart, side: 'local' | 'remote'): void {
  const value = copy(part[side]);
  store.progress ||= {};
  if (part.kind === 'note') {
    store.notes ||= {};
    store.notes[part.key] = value as string;
    return;
  }
  const stampKey = part.kind === 'session' ? 'savedAt' : 'updatedAt';
  const rows = (store.progress.hvacPracticalV2 || {}) as Record<string, Record<string, unknown>>;
  const current = part.kind === 'session' ? store.progress[part.key] : rows[part.key];
  const timestamp = Math.max(Date.now(), ...[current, part.local, part.remote].map(row => Number((row as Record<string, unknown> | null)?.[stampKey]) + 1 || 0));
  const restored = { ...(value as Record<string, unknown>), [stampKey]: timestamp };
  if (part.kind === 'session') store.progress[part.key] = restored;
  else store.progress.hvacPracticalV2 = { ...rows, [part.key]: restored };
}

export function recoveryPreview(value: unknown): string {
  if (typeof value === 'string') return value || '(빈 메모)';
  const row = (value || {}) as Record<string, unknown>;
  if ('draft' in row) return String(row.draft || '(입력 답안 없음)');
  if ('answers' in row) return `${String(row.title || '필기 풀이')} · 선택한 답 ${Object.keys(row.answers || {}).length}개 · ${Number(row.page || 0) + 1}페이지`;
  return JSON.stringify(value).slice(0, 400);
}
