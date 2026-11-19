import type { Question } from './types';

const cache = new WeakMap<Question, { text: string; fingerprint: string }>();

export function coolingBookFingerprint(q: Question): string {
  const text = JSON.stringify([q.text || '', q.html || '', q.ocrText || '',
    q.choices.map(c => [c.text || '', c.html || '', c.images || []]), q.answer, q.images || [], q.sourceImage || '']);
  const known = cache.get(q);
  if (known?.text === text) return known.fingerprint;
  let h = 14695981039346656037n;
  for (const ch of text) { h ^= BigInt(ch.codePointAt(0)!); h = BigInt.asUintN(64, h * 1099511628211n); }
  const result = h.toString(16);
  cache.set(q, { text, fingerprint: result });
  return result;
}
