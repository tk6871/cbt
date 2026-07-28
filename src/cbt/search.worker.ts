type SearchEntry = {
  id: string;
  qualificationKey: string;
  haystack: string;
};

let entries: SearchEntry[] = [];

self.addEventListener('message', (event: MessageEvent) => {
  const message = event.data as { type: 'index' | 'search'; entries?: SearchEntry[]; query?: string; qualificationKey?: string };
  if (message.type === 'index') {
    entries = message.entries || [];
    self.postMessage({ type: 'ready', count: entries.length });
    return;
  }

  const query = String(message.query || '').trim().toLocaleLowerCase('ko');
  if (query.length < 2) {
    self.postMessage({ type: 'results', ids: [] });
    return;
  }
  const tokens = query.split(/\s+/).filter(Boolean);
  const ids = entries
    .filter((entry) => !message.qualificationKey || entry.qualificationKey === message.qualificationKey)
    .filter((entry) => tokens.every((token) => entry.haystack.includes(token)))
    .slice(0, 120)
    .map((entry) => entry.id);
  self.postMessage({ type: 'results', ids });
});
