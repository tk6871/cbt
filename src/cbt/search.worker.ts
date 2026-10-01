type SearchEntry = {
  id: string;
  qualificationKey: string;
  haystack: string;
  subject: string;
};

let entries: SearchEntry[] = [];

self.addEventListener('message', (event: MessageEvent) => {
  const message = event.data as { type: 'index' | 'search'; entries?: SearchEntry[]; query?: string; qualificationKey?: string; qualificationKeys?: string[]; subject?: string; requestId?: number };
  if (message.type === 'index') {
    entries = message.entries || [];
    self.postMessage({ type: 'ready', count: entries.length });
    return;
  }

  const query = String(message.query || '').trim().toLocaleLowerCase('ko');
  if (query.length < 2) {
    self.postMessage({ type: 'results', ids: [], total: 0, requestId: message.requestId });
    return;
  }
  const tokens = query.split(/\s+/).filter(Boolean);
  const matches = entries
    .filter((entry) => !message.qualificationKey || entry.qualificationKey === message.qualificationKey)
    .filter((entry) => !message.qualificationKeys || message.qualificationKeys.includes(entry.qualificationKey))
    .filter((entry) => !message.subject || message.subject === 'all' || entry.subject === message.subject)
    .filter((entry) => tokens.every((token) => entry.haystack.includes(token)));
  const ids = matches
    .slice(0, 120)
    .map((entry) => entry.id);
  self.postMessage({ type: 'results', ids, total: matches.length, requestId: message.requestId });
});
