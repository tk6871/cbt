import {useEffect, useSyncExternalStore} from 'react';
import {fetchJson} from '../../cbt/fetchJson';
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
  return () => {
    listeners.delete(listener);
    if (!listeners.size) clearRetry();
  };
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
let retryTimer: number | undefined;
function clearRetry() {
  window.clearTimeout(retryTimer);
  retryTimer = undefined;
}

async function load(retry = true) {
  if (snapshot() || loading || Date.now() < retryAfter) return;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="cbt-study-data"]');
  if (!meta || document.documentElement.dataset.bundledAssets === 'true') return;
  loading = true;
  try {
    const archive = await fetchJson<Archive>(meta.content, 60000, {
      integrity: meta.dataset.integrity,
      credentials: 'omit',
    });
    window.CBT_PRINTED_STUDY = {
      books: expand(archive.books), assets: expand(archive.assets), placements: archive.placements,
    };
    clearRetry();
    for (const listener of listeners) listener();
  } catch {
    // Keep the existing question bank usable while the separate host is unavailable.
    retryAfter = Date.now() + 10000;
    if (retry && listeners.size) {
      retryTimer = window.setTimeout(() => {
        retryTimer = undefined;
        if (listeners.size) void load(false);
      }, 10000);
    }
  } finally {
    loading = false;
  }
}

if (typeof window !== 'undefined') window.addEventListener('online', () => {
  clearRetry();
  retryAfter = 0;
  if (listeners.size) void load();
});

export function usePrintedStudy() {
  useEffect(() => { void load(); }, []);
  return useSyncExternalStore(subscribe, snapshot);
}
