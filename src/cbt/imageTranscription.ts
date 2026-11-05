import { computed, shallowReactive, watch, type ComputedRef } from 'vue';
import { explanationDisplay } from './explanationDisplay';
import { problemImage } from './problemImages';
import confirmed from '../../data/image-text/confirmed.json' with {type:'json'};
import families from '../../data/image-text/families.json' with {type:'json'};

export interface ImageTranscription {
  asset: string; sha256: string; kind: 'question' | 'explanation';
  status: 'reviewed' | 'provisional'; text: string; eligible: boolean;
  question?: { stem: string; choices: string[] }; basis?: string;
}
declare const __CBT_BUILD_VERSION__: string;
const verified: Record<string, ImageTranscription> = confirmed as unknown as Record<string, ImageTranscription>;
const supported = new Set(families);
const entries = shallowReactive(new Map<string,Record<string,ImageTranscription>>());
const pendingFamilies = shallowReactive(new Set<string>());
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
function load(family: string): void {
  if (!family || entries.has(family) || pendingFamilies.has(family)) return;
  pendingFamilies.add(family);
  const url = new URL(`data/image-text/${family}.json?v=${__CBT_BUILD_VERSION__}`,document.baseURI);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  void fetch(url,{signal:controller.signal}).then(async response => {
    if (!response.ok) throw new Error('OCR registry unavailable');
    const rows: unknown=await response.json();
    if (!rows || typeof rows!=='object' || Array.isArray(rows)) throw new Error('Invalid OCR registry');
    entries.set(family,rows as Record<string,ImageTranscription>);
  }).catch(() => { /* Original image remains usable; a later view can retry. */ })
    .finally(() => { clearTimeout(timeout); pendingFamilies.delete(family); });
}
export function useImageTranscription(source: ComputedRef<string | null | undefined>) {
  watch([source, explanationDisplay], ([value, mode]) => {
    const key = imageSourceKey(value);
    if (mode === 'ocr' && !verified[key]) load(familyFor(key));
  }, {immediate:true});
  const entry=computed(() => {
    const key = imageSourceKey(source.value);
    return allowedTranscription(verified[key] || entries.get(familyFor(key))?.[key], key, explanationDisplay.value);
  });
  const pending=computed(()=> {
    const key=imageSourceKey(source.value);
    return !verified[key] && explanationDisplay.value==='ocr' && pendingFamilies.has(familyFor(key));
  });
  return {entry,pending};
}
export function escapeTranscription(text: string): string {
  return text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
}
