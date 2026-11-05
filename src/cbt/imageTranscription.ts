import { computed, shallowRef, watch, type ComputedRef } from 'vue';
import { explanationDisplay } from './explanationDisplay';
import { problemImage } from './problemImages';

export interface ImageTranscription {
  asset: string; sha256: string; kind: 'question' | 'explanation';
  status: 'reviewed' | 'provisional'; text: string; eligible: boolean;
  question?: { stem: string; choices: string[] }; basis?: string;
}
const entries = shallowRef<Record<string, ImageTranscription>>({});
const registryPending = shallowRef(false);
let loading: Promise<void> | undefined;
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
function load(): Promise<void> {
  if (loading) return loading;
  registryPending.value=true;
  return loading = import('../../data/image-text-candidates.json').then(module => {
    entries.value = module.default.entries as unknown as Record<string, ImageTranscription>;
  }).catch(() => { loading = undefined; }).finally(()=>{ registryPending.value=false; }); // Image stays usable if the optional import fails.
}
export function useImageTranscription(source: ComputedRef<string | null | undefined>) {
  watch([source, explanationDisplay], ([value, mode]) => {
    const key = imageSourceKey(value);
    if (mode !== 'image' && key.startsWith('assets/energy-textbook/')) void load();
  }, {immediate:true});
  const entry=computed(() => {
    const key = imageSourceKey(source.value);
    return allowedTranscription(entries.value[key], key, explanationDisplay.value);
  });
  const pending=computed(()=>registryPending.value && explanationDisplay.value!=='image' && imageSourceKey(source.value).startsWith('assets/energy-textbook/'));
  return {entry,pending};
}
export function escapeTranscription(text: string): string {
  return text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
}
