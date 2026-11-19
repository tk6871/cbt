import type { Question } from './types';

const cache = new WeakMap<Question, { text: string; fingerprint: string }>();

export function coolingBookFingerprint(q: Question): string {
  const text = JSON.stringify([q.text || '', q.html || '', q.ocrText || '',
    q.choices.map(c => [c.text || '', c.html || '', c.images || []]), q.answer, q.images || [], q.sourceImage || '']);
  const known = cache.get(q);
  if (known?.text === text) return known.fingerprint;
  // FNV-1a's 64-bit prime is 2^40 + 435. Both word products fit exactly in a JS number.
  let high = 0xcbf29ce4;
  let low = 0x84222325;
  for (const ch of text) {
    low = (low ^ ch.codePointAt(0)!) >>> 0;
    const product = low * 435;
    high = (high * 435 + low * 256 + Math.floor(product / 0x100000000)) >>> 0;
    low = product >>> 0;
  }
  const result = high ? high.toString(16) + low.toString(16).padStart(8, '0') : low.toString(16);
  cache.set(q, { text, fingerprint: result });
  return result;
}
