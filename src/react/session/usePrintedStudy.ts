import {useEffect, useSyncExternalStore} from 'react';
import type {PrintedStudyData} from '../../cbt/printedStudy';

type Groups<T> = [string[], T][];
type Archive = {
  books: Groups<PrintedStudyData['books'][string]>;
  assets: Groups<PrintedStudyData['assets'][string]>;
  placements: PrintedStudyData['placements'];
};

const listeners = new Set<() => void>();
const snapshot = () => window.CBT_PRINTED_STUDY;
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function expand<T>(groups: Groups<T>): Record<string,T> {
  const records: Record<string,T> = Object.create(null);
  for (const [keys, value] of groups) {
    for (const key of keys) records[key] = value;
  }
  return records;
}

let loading = false;
let retryAfter = 0;
async function load() {
  if (snapshot() || loading || Date.now() < retryAfter) return;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="cbt-study-data"]');
  if (!meta || document.documentElement.dataset.nativeApp === 'true') return;
  loading = true;
  try {
    const response = await fetch(meta.content, {
      integrity: meta.dataset.integrity,
      credentials: 'omit',
      signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) throw new Error('Study data unavailable');
    const archive: Archive = await response.json();
    window.CBT_PRINTED_STUDY = {
      books: expand(archive.books), assets: expand(archive.assets), placements: archive.placements,
    };
    for (const listener of listeners) listener();
  } catch {
    // Keep the existing question bank usable while the separate host is unavailable.
    retryAfter = Date.now() + 10000;
  } finally {
    loading = false;
  }
}

export function usePrintedStudy() {
  useEffect(() => { void load(); }, []);
  return useSyncExternalStore(subscribe, snapshot);
}
