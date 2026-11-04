import {readonly, ref} from 'vue';

export type ExplanationDisplay = 'text' | 'image';
export const explanationDisplayKey = 'cbt-explanation-display-v1';
function load(): ExplanationDisplay {
  try { return localStorage.getItem(explanationDisplayKey) === 'image' ? 'image' : 'text'; }
  catch { return 'text'; }
}
const preference = ref<ExplanationDisplay>(load());
export const explanationDisplay = readonly(preference);
export function setExplanationDisplay(value: ExplanationDisplay): void {
  preference.value = value;
  try { localStorage.setItem(explanationDisplayKey, value); } catch { /* Reading remains available if storage is blocked. */ }
}
if (typeof window !== 'undefined') window.addEventListener('storage', event => {
  if (event.key === explanationDisplayKey || event.key === null) preference.value = load();
});
