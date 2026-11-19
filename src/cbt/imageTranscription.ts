import { problemImage } from './problemImages';
import confirmed from '../../data/image-text/confirmed.json' with {type:'json'};
import readerVariants from '../../data/image-text/book-reader-variants.json' with {type:'json'};
import families from '../../data/image-text/families.json' with {type:'json'};

export interface ImageTranscription {
  asset: string; sha256: string; kind: 'question' | 'explanation';
  status: 'reviewed' | 'provisional'; text: string; eligible: boolean;
  question?: { stem: string; choices: string[] }; basis?: string;
}
declare const __CBT_BUILD_VERSION__: string;
const verified: Record<string, ImageTranscription> = {...confirmed} as unknown as Record<string, ImageTranscription>;
for (const [path, variant] of Object.entries(readerVariants)) {
  const original = verified[variant.original];
  if (original?.status === 'reviewed') {
    verified[path] = {...original, asset: variant.asset, sha256: variant.sha256};
  }
}
const supported = new Set(families);
const entries = new Map<string,Record<string,ImageTranscription>>();
const pendingFamilies = new Set<string>();
export function imageSourceKey(value?: string | null): string {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) {
    let url:URL;
    try { url=new URL(value); } catch { return ''; }
    if (url.origin !== 'https://tk6871.github.io' && url.origin !== (typeof location==='undefined'?'':location.origin)) return '';
    value = url.pathname;
  }
  return value.replace(/[?#].*$/, '').replace(/^(?:\.\/|\/cbt\/|\/)/,'');
}
export function allowedTranscription(entry: ImageTranscription | undefined, original: string, mode: string) {
  if (!entry?.eligible || mode === 'image') return;
  if (mode !== 'ocr' && entry.status !== 'reviewed') return;
  if (imageSourceKey(problemImage(original)) !== entry.asset) return;
  return entry;
}
function familyFor(key: string): string {
  if(!key.startsWith('assets/'))return '';
  const family=key.split('/')[1]||'';
  return supported.has(family)?family:'';
}
const listeners=new Map<string,Set<()=>void>>();
export function subscribeImageTranscription(key:string, notify:()=>void) {
  const family=familyFor(key);
  const group=listeners.get(family) ?? new Set<()=>void>();
  listeners.set(family,group);
  group.add(notify);
  return ()=>{group.delete(notify);if(!group.size)listeners.delete(family);};
}
function notifyFamily(family:string) {listeners.get(family)?.forEach(notify=>notify());}
function load(family: string): void {
  if (!family || entries.has(family) || pendingFamilies.has(family)) return;
  pendingFamilies.add(family);
  notifyFamily(family);
  const url = new URL(`data/image-text/${family}.json?v=${__CBT_BUILD_VERSION__}`,document.baseURI);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  void fetch(url,{signal:controller.signal}).then(async response => {
    if (!response.ok) throw new Error('OCR registry unavailable');
    const rows: unknown=await response.json();
    if (!rows || typeof rows!=='object' || Array.isArray(rows)) throw new Error('Invalid OCR registry');
    entries.set(family,rows as Record<string,ImageTranscription>);
  }).catch(() => { /* Original image remains usable; a later view can retry. */ })
    .finally(() => { clearTimeout(timeout); pendingFamilies.delete(family); notifyFamily(family); });
}
export function requestImageTranscription(key:string, mode:string) {
  if (mode === 'ocr' && !verified[key]) load(familyFor(key));
}
export function imageTranscriptionSnapshot(key:string, mode:string) {
  const family=familyFor(key);
  if(!verified[key] && mode==='ocr' && pendingFamilies.has(family) && !entries.has(family)) return 'pending' as const;
  return allowedTranscription(verified[key] || entries.get(family)?.[key], key, mode);
}
export function escapeTranscription(text: string): string {
  return text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
}
