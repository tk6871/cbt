import {computed, effect, signal} from '@preact/signals-core';
import {nextTick} from './controllerSignals';

function useStorage<T extends string | boolean | number>(key:string, fallback:T) {
  function read():T {
    try {
      const raw=localStorage.getItem(key);
      if(raw===null)return fallback;
      if(typeof fallback==='boolean')return (raw==='true') as T;
      if(typeof fallback==='number')return (Number.isFinite(Number(raw))?Number(raw):fallback) as T;
      return raw as T;
    } catch {return fallback;}
  }
  const cell=signal(read());
  cell.subscribe(value=>{try {localStorage.setItem(key,String(value));} catch {}});
  window.addEventListener('storage',event=>{if(!event.key || event.key===key)cell.value=read();});
  return cell;
}
function mediaPreference(feature:string,values:string[]) {
  const queries=values.map(value=>matchMedia('('+feature+': '+value+')'));
  const read=()=>values[queries.findIndex(query=>query.matches)] || 'no-preference';
  const cell=signal(read());
  for(const query of queries)query.addEventListener('change',()=>{cell.value=read();});
  return cell;
}

export type UiDensity = 'comfortable' | 'compact';
export type UiSurface = 'soft' | 'flat' | 'glass';
export type UiMotion = 'full' | 'reduced' | 'off';
export type UiAccent = 'auto' | 'blue' | 'emerald' | 'violet' | 'pink' | 'yellow';

const accentColors: Record<Exclude<UiAccent, 'auto'>, string> = {
  blue: '#1268d3',
  emerald: '#0b8f6a',
  violet: '#7655d9',
  pink: '#d83d85',
  yellow: '#d28a00',
};

const safeMode = typeof location !== 'undefined' && new URLSearchParams(location.search).get('safe') === '1';
const enabled = useStorage<boolean>('unified-cbt-ui-lab-enabled', false);
const density = useStorage<UiDensity>('unified-cbt-ui-density', 'comfortable');
const surface = useStorage<UiSurface>('unified-cbt-ui-surface', 'soft');
const motion = useStorage<UiMotion>('unified-cbt-ui-motion', 'full');
const accent = useStorage<UiAccent>('unified-cbt-ui-accent', 'auto');
const photoOverlay = useStorage<number>('unified-cbt-theme-photo-overlay', 68);
const preferredContrast = mediaPreference('prefers-contrast',['more','less']);
const preferredReducedMotion = mediaPreference('prefers-reduced-motion',['reduce']);

function mix(color: string, target: string, amount: number): string {
  return `color-mix(in oklch, ${color} ${(1 - amount) * 100}%, ${target})`;
}

function applyAccent(root: HTMLElement): void {
  root.dataset.uiAccent = enabled.value ? accent.value : 'auto';
  if (!enabled.value || accent.value === 'auto') {
    root.style.removeProperty('--primary');
    root.style.removeProperty('--primary-2');
    root.style.removeProperty('--primary-soft');
    return;
  }
  const base = accentColors[accent.value];
  const dark = root.dataset.theme === 'dark';
  root.style.setProperty('--primary', dark ? mix(base, '#ffffff', .27) : base);
  root.style.setProperty('--primary-2', dark ? mix(base, '#ffffff', .43) : mix(base, '#000000', .2));
  root.style.setProperty('--primary-soft', dark ? mix(base, '#000000', .66) : mix(base, '#ffffff', .86));
}

export function applyUiLabPreferences(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const active = enabled.value && !safeMode;
  root.dataset.uiLab = active ? 'on' : 'off';
  root.dataset.uiDensity = active ? density.value : 'comfortable';
  root.dataset.uiSurface = active ? surface.value : 'soft';
  root.dataset.uiMotion = active ? motion.value : 'full';
  root.style.setProperty('--theme-photo-veil', `${Math.max(0, Math.min(92, photoOverlay.value)) / 100}`);
  applyAccent(root);
}

effect(applyUiLabPreferences);

export function useUiLab() {
  const active = computed(() => enabled.value && !safeMode);
  const systemPreferenceLabel = computed(() => {
    const values: string[] = [];
    if (preferredContrast.value === 'more') values.push('기기 고대비');
    if (preferredContrast.value === 'less') values.push('기기 저대비');
    if (preferredReducedMotion.value === 'reduce') values.push('모션 줄이기');
    return values.length ? values.join(' · ') : '기기 기본 설정';
  });

  async function contrastReport(): Promise<{ ratio: number; grade: '좋음' | '보통' | '부족' }> {
    await nextTick();
    if (typeof document === 'undefined') return { ratio: 7, grade: '좋음' };
    const { default: Color } = await import('colorjs.io');
    const styles = getComputedStyle(document.documentElement);
    const foreground = new Color(styles.getPropertyValue('--text').trim() || '#10243f');
    const background = new Color(styles.getPropertyValue('--surface').trim() || '#ffffff');
    const ratio = Number(foreground.contrast(background, 'WCAG21'));
    return {
      ratio,
      grade: ratio >= 7 ? '좋음' : ratio >= 4.5 ? '보통' : '부족',
    };
  }

  function reset(): void {
    density.value = 'comfortable';
    surface.value = 'soft';
    motion.value = 'full';
    accent.value = 'auto';
    photoOverlay.value = 68;
  }

  return {
    enabled,
    active,
    safeMode,
    density,
    surface,
    motion,
    accent,
    photoOverlay,
    preferredContrast,
    preferredReducedMotion,
    systemPreferenceLabel,
    contrastReport,
    reset,
  };
}
