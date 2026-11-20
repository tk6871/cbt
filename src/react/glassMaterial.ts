import { signal } from '@preact/signals-core';

export const glassMaterials = [
  {value:'clear', label:'클리어 글라스', detail:'맑은 표면과 얇은 테두리'},
  {value:'frost', label:'프로스트 글라스', detail:'부드러운 흐림과 은은한 반사'},
  {value:'prism', label:'프리즘 글라스', detail:'청록과 오팔빛이 맺히는 가장자리'},
] as const;
export type GlassMaterial = typeof glassMaterials[number]['value'];
const key = 'cbt-glass-material';
function read(): GlassMaterial {
  try { return glassMaterials.find(item => item.value === localStorage.getItem(key))?.value ?? 'prism'; }
  catch { return 'prism'; }
}
export const glassMaterial = signal(read());
glassMaterial.subscribe(value => { document.documentElement.dataset.glass = value; });
export function setGlassMaterial(value: GlassMaterial) {
  glassMaterial.value = value;
  try { localStorage.setItem(key,value); } catch { /* The selection still applies to this tab. */ }
}
window.addEventListener('storage', event => { if (event.key === key || event.key === null) glassMaterial.value = read(); });
